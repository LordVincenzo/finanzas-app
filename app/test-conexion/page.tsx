import { createClient } from '@/lib/supabase/server'

export default async function TestConexion() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()

  return (
    <main className="p-8 font-mono text-sm">
      <h1 className="text-xl font-bold mb-4">Prueba de conexión</h1>

      <p>URL configurada: {process.env.NEXT_PUBLIC_SUPABASE_URL ? 'sí' : 'NO'}</p>
      <p>Clave configurada: {process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ? 'sí' : 'NO'}</p>
      <p>Usuario: {data.user ? data.user.email : 'ninguno (esperado)'}</p>
      <p>Error: {error ? error.message : 'ninguno'}</p>
    </main>
  )
}