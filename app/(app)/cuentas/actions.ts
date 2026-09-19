'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { parsearCOP } from '@/lib/format'
import { esDeuda } from '@/lib/tipos'
import { leerOrigen, rutaDe } from '@/lib/interfaz'
import { revalidarLedger } from '@/lib/revalidar'

export type EstadoCuenta = { error?: string }

/** Los mensajes de Postgres ya vienen en español; limpiamos el prefijo. */
function traducir(mensaje: string): string {
  return mensaje.replace(/^.*?:\s*/, '').trim() || 'No se pudo crear la cuenta'
}

const esquema = z.object({
  nombre: z.string().trim().min(1, 'Escribe un nombre').max(60),
  tipo: z.enum([
    'digital_wallet', 'checking', 'savings', 'cash', 'investment',
    'credit_card', 'debt', 'other',
  ]),
  institucion: z.string().trim().max(60).optional(),
  visibilidad: z.enum(['private', 'shared_view']),
})

/**
 * La usan las dos interfaces. El campo oculto `origen` decide a qué
 * lista volver al terminar; la validación y el RPC son los mismos,
 * porque duplicarlos sería duplicar el cálculo.
 */
export async function crearCuenta(
  _previo: EstadoCuenta,
  formData: FormData
): Promise<EstadoCuenta> {
  const origen = leerOrigen(formData.get('origen'))

  const datos = esquema.safeParse({
    nombre: formData.get('nombre'),
    tipo: formData.get('tipo'),
    institucion: formData.get('institucion') ?? '',
    visibilidad: formData.get('visibilidad'),
  })

  if (!datos.success) {
    return { error: datos.error.issues[0].message }
  }

  /* El monto llega como texto ("2.430.000", "2430k"). Lo convertimos a
     entero de pesos AQUÍ, en el servidor. Nunca confiamos en el número
     que venga del navegador.

     Y el SIGNO también lo decide el servidor, no el formulario. En una
     tarjeta de crédito la persona escribe lo que DEBE, en positivo,
     porque es como se piensa una deuda; el ledger la necesita negativa
     para que patrimonio_detalle la reste. Si el signo dependiera de un
     campo oculto, bastaría con manipularlo para que una deuda sumara
     al patrimonio en vez de restar. */
  const deuda = esDeuda(datos.data.tipo)
  const textoSaldo = String(formData.get('saldoInicial') ?? '').trim()
  let saldo = 0
  if (textoSaldo) {
    const valor = parsearCOP(textoSaldo)
    if (valor === null) return { error: 'El saldo inicial no es un número válido' }
    if (valor < 0) {
      return {
        error: deuda
          ? 'Escribe cuánto debes, en positivo'
          : 'El saldo inicial no puede ser negativo',
      }
    }
    saldo = deuda ? -valor : valor
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('crear_cuenta', {
    p_nombre: datos.data.nombre,
    p_tipo: datos.data.tipo,
    p_institucion: datos.data.institucion || null,
    p_saldo_inicial: saldo,
    p_visibilidad: datos.data.visibilidad,
  })

  if (error) {
    if (error.message.includes('uq_account_name_per_owner')) {
      return { error: 'Ya tienes una cuenta con ese nombre' }
    }
    return { error: traducir(error.message) }
  }

  revalidarLedger()
  redirect(rutaDe(origen, 'cuentas'))
}
