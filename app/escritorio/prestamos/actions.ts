'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

function traducir(mensaje: string): string {
  return mensaje.replace(/^.*?:\s*/, '').trim() || 'Algo salió mal'
}

/**
 * Igual que eliminarPrestamo de app/(app)/prestamos/actions.ts, pero
 * redirige de vuelta a la vista de escritorio en vez de a la del
 * celular — las dos interfaces son pantallas distintas, no se puede
 * reusar el mismo redirect.
 */
export async function eliminarPrestamoEscritorio(formData: FormData) {
  const id = String(formData.get('id') ?? '')
  const supabase = await createClient()
  const { error } = await supabase.rpc('eliminar_prestamo', { p_prestamo: id })
  if (error) throw new Error(traducir(error.message))

  revalidatePath('/escritorio/prestamos')
  revalidatePath('/escritorio')
  revalidatePath('/escritorio/cuentas')
  revalidatePath('/prestamos')
  revalidatePath('/cuentas')
  revalidatePath('/inicio')
  redirect('/escritorio/prestamos')
}
