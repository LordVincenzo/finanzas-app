'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

export type EstadoPerfil = { error?: string }

const TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const TAMANO_MAXIMO = 5 * 1024 * 1024 // 5 MB

const esquema = z.object({
  nombre: z.string().trim().min(1, 'Escribe un nombre').max(80),
})

export async function actualizarPerfil(
  _previo: EstadoPerfil,
  formData: FormData
): Promise<EstadoPerfil> {
  const datos = esquema.safeParse({ nombre: formData.get('nombre') })
  if (!datos.success) return { error: datos.error.issues[0].message }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Tu sesión expiró. Vuelve a entrar.' }

  const cambios: { display_name: string; avatar_url?: string } = {
    display_name: datos.data.nombre,
  }

  const foto = formData.get('foto')
  if (foto instanceof File && foto.size > 0) {
    if (!TIPOS_PERMITIDOS.includes(foto.type)) {
      return { error: 'La foto debe ser JPG, PNG, WEBP o GIF' }
    }
    if (foto.size > TAMANO_MAXIMO) {
      return { error: 'La foto no puede pesar más de 5 MB' }
    }

    // Mismo nombre de archivo siempre ("<user_id>/avatar.ext"): así
    // reemplazar la foto no deja fotos viejas sueltas en el bucket.
    // Si cambias de extensión entre una foto y otra sí queda un
    // archivo viejo huérfano — caso raro, no vale la pena resolverlo
    // todavía.
    const extension = foto.name.split('.').pop() || 'jpg'
    const ruta = `${user.id}/avatar.${extension}`

    const { error: errorSubida } = await supabase.storage
      .from('avatars')
      .upload(ruta, foto, { upsert: true, contentType: foto.type })

    if (errorSubida) return { error: 'No se pudo subir la foto. Intenta de nuevo.' }

    const { data: publica } = supabase.storage.from('avatars').getPublicUrl(ruta)
    // La ruta no cambia al reemplazar la foto, así que sin esto el
    // navegador seguiría mostrando la versión vieja desde su caché.
    cambios.avatar_url = `${publica.publicUrl}?v=${Date.now()}`
  }

  const { error } = await supabase
    .from('profiles').update(cambios).eq('id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/mas')
  revalidatePath('/inicio')
  redirect('/mas')
}
