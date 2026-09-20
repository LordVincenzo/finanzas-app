'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type EstadoFechas = { error?: string; ok?: boolean }

function traducir(mensaje: string): string {
  return mensaje.replace(/^.*?:\s*/, '').trim() || 'Algo salió mal'
}

/** Un día del mes, o null si el campo viene vacío. */
function dia(valor: FormDataEntryValue | null): number | null | 'malo' {
  const texto = String(valor ?? '').trim()
  if (!texto) return null
  const n = Number(texto)
  if (!Number.isInteger(n) || n < 1 || n > 31) return 'malo'
  return n
}

/**
 * Cuándo cierra y cuándo vence una tarjeta.
 *
 * Los dos son días del mes, no fechas: "corte el 15, pago el 5" vale
 * para siempre, mientras que una fecha concreta habría que volver a
 * escribirla cada mes — y eso se abandona.
 *
 * Se permite dejar solo el día de pago. El de corte es útil para saber
 * en qué extracto cae una compra, pero exigir los dos para guardar uno
 * es pedir un dato que mucha gente no tiene a mano.
 */
export async function ponerFechasTarjeta(
  _previo: EstadoFechas,
  formData: FormData
): Promise<EstadoFechas> {
  const cuenta = String(formData.get('cuenta') ?? '')
  if (!cuenta) return { error: 'No se identificó la cuenta' }

  const corte = dia(formData.get('corte'))
  const pago = dia(formData.get('pago'))

  if (corte === 'malo' || pago === 'malo') {
    return { error: 'Los días tienen que estar entre 1 y 31' }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('poner_fechas_tarjeta', {
    p_cuenta: cuenta,
    p_corte: corte,
    p_pago: pago,
  })

  if (error) return { error: traducir(error.message) }

  revalidatePath('/cuentas')
  revalidatePath('/inicio')
  revalidatePath('/escritorio/cuentas')
  return { ok: true }
}
