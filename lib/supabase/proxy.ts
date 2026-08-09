import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Refresca el token de sesión en CADA petición y lo devuelve
 * al navegador en cookies actualizadas.
 * Sin esto, la sesión caduca y el usuario aparece deslogueado.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // getUser() valida el token contra el servidor de Supabase.
  // NUNCA uses getSession() para decidir permisos: lee la cookie
  // sin verificarla, y una cookie se puede falsificar.
  await supabase.auth.getUser()

  return supabaseResponse
}