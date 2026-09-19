'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

/** `ok` para los mensajes de éxito. Antes el aviso de "te enviamos un
 *  enlace" viajaba dentro de `error` y se pintaba en rojo. */
export type EstadoAuth = { error?: string; ok?: string }

const esquemaLogin = z.object({
  email: z.string().trim().email('Escribe un correo válido'),
  password: z.string().min(1, 'Escribe tu contraseña'),
})

const esquemaRegistro = z.object({
  nombre: z.string().trim().min(2, 'Escribe tu nombre').max(80),
  email: z.string().trim().email('Escribe un correo válido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
})

const esquemaEmail = z.object({
  email: z.string().trim().email('Escribe un correo válido'),
})

/**
 * La URL pública de la app, para los enlaces que van por correo.
 *
 * Antes esto era `process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'`
 * dentro de la acción. En desarrollo está bien; en producción, si la
 * variable falta, Supabase manda un correo con un enlace a localhost y
 * la persona no tiene forma de saber por qué no funciona. Un fallo de
 * configuración tiene que notarse, no disfrazarse de correo enviado.
 */
function urlDelSitio(): string | null {
  const url = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (url) return url.replace(/\/+$/, '')
  if (process.env.NODE_ENV === 'production') return null
  return 'http://localhost:3000'
}

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

export async function recuperarPassword(
  _previo: EstadoAuth,
  formData: FormData
): Promise<EstadoAuth> {
  const datos = esquemaEmail.safeParse({ email: formData.get('email') })
  if (!datos.success) return { error: datos.error.issues[0].message }

  const sitio = urlDelSitio()
  if (!sitio) {
    return {
      error: 'Falta configurar NEXT_PUBLIC_SITE_URL en el servidor. Sin ella, el enlace del correo apuntaría a localhost.',
    }
  }

  const supabase = await createClient()
  await supabase.auth.resetPasswordForEmail(datos.data.email, {
    redirectTo: `${sitio}/auth/nueva-password`,
  })

  // Mensaje idéntico exista o no el correo: no revelamos quién está
  // registrado. Va en `ok`, no en `error`: es una confirmación.
  return { ok: 'Si ese correo está registrado, te enviamos un enlace.' }
}

export async function cambiarPassword(
  _previo: EstadoAuth,
  formData: FormData
): Promise<EstadoAuth> {
  const password = String(formData.get('password') ?? '')
  if (password.length < 8) {
    return { error: 'La contraseña debe tener al menos 8 caracteres' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password })
  if (error) return { error: error.message }

  redirect('/inicio')
}
