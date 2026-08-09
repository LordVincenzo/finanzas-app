'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

export type EstadoPareja = { error?: string; ok?: string }

function traducir(mensaje: string): string {
  return mensaje.replace(/^.*?:\s*/, '').trim() || 'Algo salió mal'
}

function revalidarTodo() {
  revalidatePath('/pareja')
  revalidatePath('/cuentas')
  revalidatePath('/inicio')
}

const esquemaEmail = z.object({
  email: z.string().trim().email('Escribe un correo válido'),
})

export async function invitar(
  _previo: EstadoPareja,
  formData: FormData
): Promise<EstadoPareja> {
  const datos = esquemaEmail.safeParse({ email: formData.get('email') })
  if (!datos.success) return { error: datos.error.issues[0].message }

  const supabase = await createClient()
  const { error } = await supabase.rpc('invitar_pareja', {
    p_email: datos.data.email,
  })

  if (error) return { error: traducir(error.message) }

  revalidarTodo()
  return { ok: 'Invitación enviada' }
}

export async function aceptar(formData: FormData) {
  const id = String(formData.get('id') ?? '')
  const supabase = await createClient()
  const { error } = await supabase.rpc('aceptar_invitacion', { p_id: id })
  if (error) throw new Error(traducir(error.message))
  revalidarTodo()
}

export async function rechazar(formData: FormData) {
  const id = String(formData.get('id') ?? '')
  const supabase = await createClient()
  await supabase.rpc('rechazar_invitacion', { p_id: id })
  revalidarTodo()
}

export async function cancelar(formData: FormData) {
  const id = String(formData.get('id') ?? '')
  const supabase = await createClient()
  await supabase.rpc('cancelar_invitacion', { p_id: id })
  revalidarTodo()
}

export async function salir() {
  const supabase = await createClient()
  const { error } = await supabase.rpc('salir_pareja')
  if (error) throw new Error(traducir(error.message))
  revalidarTodo()
}

/** Cambia una cuenta entre privada y compartida. */
export async function cambiarVisibilidad(formData: FormData) {
  const id = String(formData.get('id') ?? '')
  const nueva = String(formData.get('visibilidad') ?? '')

  if (nueva !== 'private' && nueva !== 'shared_view') return

  const supabase = await createClient()
  // El RLS ya garantiza que solo puedas tocar tus propias cuentas.
  await supabase.from('accounts').update({ visibility: nueva }).eq('id', id)

  revalidarTodo()
}