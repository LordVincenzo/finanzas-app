'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { parsearCOP } from '@/lib/format'
import { ladosDelMovimiento } from '@/lib/movimientos'
import { revalidarLedger } from '@/lib/revalidar'
import { cargarBandeja } from '@/lib/datos-bandeja'
import { propuestaDe } from '@/lib/bandeja-propuesta'

export type EstadoBandeja = { error?: string; ok?: string }

function traducir(mensaje: string): string {
  return mensaje.replace(/^.*?:\s*/, '').trim() || 'Algo salió mal'
}

function revalidarBandeja() {
  revalidatePath('/bandeja')
  revalidatePath('/escritorio/bandeja')
}

const esquema = z.object({
  id: z.string().uuid('No se identificó el mensaje'),
  tipo: z.enum(['expense', 'income', 'transfer']),
  cuenta: z.string().uuid('Selecciona una cuenta'),
  contraparte: z.string().uuid('Selecciona una categoría'),
  descripcion: z.string().trim().min(1, 'Escribe una descripción').max(200),
})

/**
 * Convertir un mensaje de la bandeja en un movimiento de verdad.
 *
 * Lo que la persona ve en pantalla puede venir interpretado del texto de
 * la notificación, pero lo que llega aquí se valida como cualquier otro
 * formulario: el texto de un banco no tiene más crédito que lo que
 * alguien escriba a mano.
 *
 * El monto se vuelve a parsear en el servidor, y confirmar_ingesta()
 * crea el movimiento y marca el mensaje en una sola transacción — si
 * fueran dos pasos y el segundo fallara, el gasto quedaría registrado
 * con el mensaje todavía pendiente, y confirmarlo otra vez lo
 * duplicaría.
 */
export async function confirmarMensaje(
  _previo: EstadoBandeja,
  formData: FormData
): Promise<EstadoBandeja> {
  const datos = esquema.safeParse({
    id: formData.get('id'),
    tipo: formData.get('tipo'),
    cuenta: formData.get('cuenta'),
    contraparte: formData.get('contraparte'),
    descripcion: formData.get('descripcion') ?? '',
  })
  if (!datos.success) return { error: datos.error.issues[0].message }

  const monto = parsearCOP(String(formData.get('monto') ?? ''))
  if (monto === null || monto <= 0) {
    return { error: 'Escribe cuánto fue, mayor que cero' }
  }

  const { tipo, cuenta, contraparte } = datos.data
  if (tipo === 'transfer' && cuenta === contraparte) {
    return { error: 'El origen y el destino no pueden ser la misma cuenta' }
  }

  // Misma regla que el formulario de movimiento: el servidor decide
  // qué lado es cuál, nunca el cliente.
  const { origen, destino } = ladosDelMovimiento(tipo, cuenta, contraparte)

  /* Una transferencia entre cuentas propias llegó como DOS avisos que
     la 0024 enlazó. Si la persona confirma que son lo mismo, se crea UN
     movimiento de tipo transfer y se marcan los dos mensajes — si no,
     el historial mostraría un gasto y un ingreso que se anulan, y
     "gastos del mes" e "ingresos del mes" saldrían inflados por el
     mismo importe. */
  const esPareja = formData.get('pareja') === '1'

  const supabase = await createClient()
  const { error } = esPareja
    ? await supabase.rpc('confirmar_pareja_ingesta', {
        p_id: datos.data.id,
        p_monto: monto,
        p_cuenta_origen: origen,
        p_cuenta_destino: destino,
        p_descripcion: datos.data.descripcion,
      })
    : await supabase.rpc('confirmar_ingesta', {
        p_id: datos.data.id,
        p_tipo: tipo,
        p_monto: monto,
        p_cuenta_origen: origen,
        p_cuenta_destino: destino,
        p_descripcion: datos.data.descripcion,
      })

  if (error) return { error: traducir(error.message) }

  revalidarLedger()
  revalidarBandeja()
  return {}
}

/** No era un movimiento, o no era mío. Sale de la bandeja sin tocar nada. */
export async function ignorarMensaje(
  _previo: EstadoBandeja,
  formData: FormData
): Promise<EstadoBandeja> {
  const id = String(formData.get('id') ?? '')
  if (!id) return { error: 'No se identificó el mensaje' }

  const supabase = await createClient()
  const { error } = await supabase.rpc('ignorar_ingesta', { p_id: id })
  if (error) return { error: traducir(error.message) }

  revalidarBandeja()
  return {}
}

/**
 * Conectar un dispositivo.
 *
 * Devuelve el token EN CLARO, y es la única vez que existe así: la base
 * solo guarda su sha256. Por eso viaja en `ok` y la pantalla lo enseña
 * con un aviso de copiarlo ahora. Quien lo pierda crea otro y revoca el
 * anterior; nadie, ni nosotros, puede recuperarlo.
 */
export async function conectarDispositivo(
  _previo: EstadoBandeja,
  formData: FormData
): Promise<EstadoBandeja> {
  const nombre = String(formData.get('nombre') ?? '').trim()
  if (!nombre) return { error: 'Ponle un nombre al dispositivo' }
  if (nombre.length > 60) return { error: 'El nombre es demasiado largo' }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('crear_token_ingesta', {
    p_nombre: nombre,
  })

  if (error) return { error: traducir(error.message) }

  revalidarBandeja()
  return { ok: String(data) }
}

export async function revocarDispositivo(
  _previo: EstadoBandeja,
  formData: FormData
): Promise<EstadoBandeja> {
  const id = String(formData.get('id') ?? '')
  if (!id) return { error: 'No se identificó el dispositivo' }

  const supabase = await createClient()
  const { error } = await supabase.rpc('revocar_token_ingesta', { p_id: id })
  if (error) return { error: traducir(error.message) }

  revalidarBandeja()
  return {}
}

/**
 * Confirmar de una vez todas las que no hace falta preguntar.
 *
 * PARA QUÉ: si vuelves después de dos días hay seis esperando, y seis
 * toques para seis movimientos que la app ya tenía resueltos es una
 * tarea inventada.
 *
 * QUÉ ENTRA Y QUÉ NO. Solo los mensajes que la pantalla enseñaba como
 * resueltos, y solo si el servidor vuelve a llegar a la misma
 * conclusión. Las dos condiciones importan:
 *
 *   - La lista la manda el cliente porque tiene que ser lo que la
 *     persona VIO. Si el servidor confirmara "todo lo completo que haya
 *     ahora", un mensaje que llegó entre que se dibujó la pantalla y se
 *     tocó el botón entraría al ledger sin que nadie lo mirara nunca.
 *
 *   - El servidor recalcula porque no se fía de la lista: que un id
 *     venga marcado como completo no lo hace completo. Los montos y las
 *     cuentas salen de la base, nunca del formulario.
 *
 * SE PARA EN EL PRIMER ERROR. Lo que ya se confirmó queda confirmado
 * —cada uno es su propia transacción— y el resto se queda en la
 * bandeja. Seguir adelante tras un fallo dejaría un hueco silencioso en
 * mitad de la lista, que es peor que parar y decirlo.
 */
export async function confirmarTodas(
  _previo: EstadoBandeja,
  formData: FormData
): Promise<EstadoBandeja> {
  const pedidos = new Set(formData.getAll('ids').map(String))
  if (pedidos.size === 0) return { error: 'No había nada que confirmar' }

  const { mensajes, cuentas, categoriasGasto, categoriasIngreso } =
    await cargarBandeja()

  const supabase = await createClient()
  let hechas = 0

  for (const m of mensajes) {
    if (!pedidos.has(m.id)) continue

    const p = propuestaDe(m, cuentas, categoriasGasto, categoriasIngreso)
    if (!p) continue   // ya no está completo: que lo mire una persona

    const { origen, destino } = ladosDelMovimiento(p.tipo, p.cuenta, p.contraparte)

    const { error } = p.esPareja
      ? await supabase.rpc('confirmar_pareja_ingesta', {
          p_id: m.id,
          p_monto: p.monto,
          p_cuenta_origen: origen,
          p_cuenta_destino: destino,
          p_descripcion: p.descripcion,
        })
      : await supabase.rpc('confirmar_ingesta', {
          p_id: m.id,
          p_tipo: p.tipo,
          p_monto: p.monto,
          p_cuenta_origen: origen,
          p_cuenta_destino: destino,
          p_descripcion: p.descripcion,
        })

    if (error) {
      revalidarBandeja()
      revalidarLedger()
      return {
        error: hechas === 0
          ? traducir(error.message)
          : `Se confirmaron ${hechas} y luego falló una: ${traducir(error.message)}`,
      }
    }

    hechas++
  }

  revalidarBandeja()
  revalidarLedger()

  if (hechas === 0) {
    return { error: 'Ninguna estaba lista; revísalas una por una' }
  }
  return { ok: String(hechas) }
}
