'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type EstadoMetaEscritorio = { error?: string }

function traducir(mensaje: string): string {
  return mensaje.replace(/^.*?:\s*/, '').trim() || 'Algo salió mal'
}

/**
 * Igual que eliminarMeta de app/(app)/ahorros/actions.ts, pero redirige
 * de vuelta a la vista de escritorio en vez de a la del celular — las
 * dos interfaces son pantallas distintas, no se puede reusar el mismo
 * redirect.
 */
export async function eliminarMetaEscritorio(
  _previo: EstadoMetaEscritorio,
  formData: FormData
): Promise<EstadoMetaEscritorio> {
  const id = String(formData.get('id') ?? '')
  if (!id) return { error: 'No se identificó la meta' }

  const supabase = await createClient()
  const { error } = await supabase.rpc('eliminar_meta', { p_id: id })
  if (error) return { error: traducir(error.message) }

  revalidatePath('/escritorio/ahorros')
  revalidatePath('/escritorio')
  revalidatePath('/escritorio/cuentas')
  revalidatePath('/ahorros')
  revalidatePath('/inicio')
  revalidatePath('/cuentas')
  redirect('/escritorio/ahorros')
}
