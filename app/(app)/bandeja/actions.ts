'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { parsearCOP } from '@/lib/format'
import { ladosDelMovimiento } from '@/lib/movimientos'
import { revalidarLedger } from '@/lib/revalidar'

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

  const supabase = await createClient()
  const { error } = await supabase.rpc('confirmar_ingesta', {
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
