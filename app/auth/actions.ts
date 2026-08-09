'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

export type EstadoAuth = { error?: string }

const esquemaLogin = z.object({
  email: z.string().trim().email('Escribe un correo válido'),
  password: z.string().min(1, 'Escribe tu contraseña'),
})

const esquemaRegistro = z.object({
  nombre: z.string().trim().min(2, 'Escribe tu nombre').max(80),
  email: z.string().trim().email('Escribe un correo válido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
})

export async function iniciarSesion(
  _estadoPrevio: EstadoAuth,
  formData: FormData
): Promise<EstadoAuth> {
  const datos = esquemaLogin.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })

  if (!datos.success) {
    return { error: datos.error.issues[0].message }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword(datos.data)

  if (error) {
    // Mensaje genérico a propósito: no revelamos si el correo existe.
    return { error: 'Correo o contraseña incorrectos' }
  }

  revalidatePath('/', 'layout')
  redirect('/inicio')
}

export async function registrarse(
  _estadoPrevio: EstadoAuth,
  formData: FormData
): Promise<EstadoAuth> {
  const datos = esquemaRegistro.safeParse({
    nombre: formData.get('nombre'),
    email: formData.get('email'),
    password: formData.get('password'),
  })

  if (!datos.success) {
    return { error: datos.error.issues[0].message }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signUp({
    email: datos.data.email,
    password: datos.data.password,
    options: {
      // Esto llega a raw_user_meta_data y lo lee nuestro trigger
      // handle_new_user para rellenar profiles.display_name
      data: { display_name: datos.data.nombre },
    },
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/', 'layout')
  redirect('/inicio')
}

export async function cerrarSesion() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}