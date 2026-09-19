'use server'

import { revalidarLedger } from '@/lib/revalidar'
import { createClient } from '@/lib/supabase/server'

/**
 * Ajuste de saldo en línea: se llama directo desde el componente
 * cliente (no por <form action>), así que recibe valores ya
 * validados en el navegador — la validación real, como siempre, es
 * la del RPC.
 *
 * Vive aquí y no en app/(app) porque no tiene equivalente en el
 * celular: allí el ajuste se hace desde el formulario de movimiento.
 * No navega, así que no necesita saber el origen.
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
    return {
      error: error.message.replace(/^.*?:\s*/, '').trim()
        || 'No se pudo ajustar el saldo',
    }
  }

  revalidarLedger()
  return {}
}
