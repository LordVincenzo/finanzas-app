import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { cerrarSesion } from '@/app/auth/actions'

export default async function InicioPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // La protección vive AQUÍ, junto a los datos. Ver nota abajo.
  if (!user) redirect('/login')

  const { data: perfil } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .single()

  return (
    <main className="p-6 max-w-md mx-auto">
      <h1 className="text-2xl font-semibold">
        Hola, {perfil?.display_name ?? user.email}
      </h1>
      <p className="text-sm text-neutral-500 mt-1">Sesión iniciada correctamente.</p>

      <form action={cerrarSesion} className="mt-8">
        <button className="text-sm text-red-600 underline">Cerrar sesión</button>
      </form>
    </main>
  )
}