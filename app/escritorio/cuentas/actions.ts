'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

/**
 * Ajuste de saldo en línea: se llama directo desde el componente
 * cliente (no por <form action>), así que recibe valores ya
 * validados en el navegador — la validación real, como siempre, es
 * la del RPC.
 */
export async function ajustarSaldoEscritorio(
  cuentaId: string,
  nuevoSaldo: number,
): Promise<{ error?: string }> {
  if (!Number.isFinite(nuevoSaldo) || nuevoSaldo < 0) {
    return { error: 'El saldo no puede ser negativo' }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('ajustar_saldo', {
    p_cuenta: cuentaId,
    p_saldo_real: Math.round(nuevoSaldo),
    p_notas: null,
    p_ocurrido_en: new Date().toISOString(),
  })

  if (error) {
    return { error: error.message.replace(/^.*?:\s*/, '').trim() || 'No se pudo ajustar el saldo' }
  }

  // Mismas pantallas que revalida el ajuste desde el celular, más las
  // de escritorio.
  revalidatePath('/escritorio/cuentas')
  revalidatePath('/escritorio')
  revalidatePath('/cuentas')
  revalidatePath('/inicio')
  revalidatePath('/ahorros')
  revalidatePath('/prestamos')
  revalidatePath('/pareja')
  return {}
}
