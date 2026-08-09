import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

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