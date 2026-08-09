import { createBrowserClient } from '@supabase/ssr'

/**
 * Cliente de Supabase para el NAVEGADOR.
 * Solo se usa dentro de Client Components ('use client').
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  )
}