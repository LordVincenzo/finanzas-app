import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { NavInferior } from '@/components/nav-inferior'

export default async function LayoutApp({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Un solo sitio protege TODAS las páginas de dentro.
  if (!user) redirect('/login')

  return (
    <div className="mx-auto min-h-screen w-full max-w-lg pb-24 sm:max-w-md">
      {children}
      <NavInferior />
    </div>
  )
}