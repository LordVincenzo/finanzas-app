import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

/**
 * Cliente de Supabase para el SERVIDOR.
 * Se usa en Server Components, Server Actions y Route Handlers.
 * Lee la sesión desde las cookies de la petición.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Los Server Components no pueden escribir cookies.
            // No pasa nada: proxy.ts ya refrescó la sesión antes.
          }
        },
      },
    }
  )
}

/** El tipo del cliente de servidor, para poder pasarlo como parámetro. */
type ClienteServidor = Awaited<ReturnType<typeof createClient>>

/**
 * El usuario de la sesión, o a /login si no hay ninguna.
 *
 * POR QUÉ EXISTE. El layout comprueba la sesión y redirige, pero en el
 * App Router el layout y la página se renderizan EN PARALELO: cuando el
 * redirect del layout surte efecto, la página ya se ejecutó. Por eso 23
 * pantallas hacían `user!.id` sobre un `user` que de verdad podía ser
 * null, y cada petición sin sesión lanzaba "TypeError: Cannot read
 * properties of null" antes de redirigir.
 *
 * Hoy gana el redirect y no se ve nada roto, pero es una carrera: al
 * caducar la sesión a mitad de uso, lo que aparezca depende de quién
 * llegue primero. Con esto la página se protege sola, y el `!` deja de
 * hacer falta — TypeScript sabe que después de un redirect() el código
 * no sigue, así que `user` ya no es nullable.
 *
 * RECIBE el cliente en vez de crearlo. Devolverlo desde aquí hacía que
 * los genéricos de Supabase se perdieran al cruzar la frontera de la
 * función: todas las consultas quedaban tipadas como `any` y `tsc`
 * escupía docenas de "implicitly has an 'any' type". Creándolo en la
 * página, como siempre, el tipado se conserva intacto.
 *
 * getUser() y nunca getSession(): getSession lee la cookie sin
 * verificarla contra el servidor de Supabase, y una cookie se falsifica.
 */
export async function requerirUsuario(supabase: ClienteServidor) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return user
}
