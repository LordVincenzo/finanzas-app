import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy'

export default async function proxy(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Se ejecuta en todas las rutas EXCEPTO archivos estáticos e imágenes.
     * Evita gastar peticiones a Supabase en cada icono o fuente.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}