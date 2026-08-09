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

  if (!user) redirect('/login')

  return (
    <div className="mx-auto min-h-screen max-w-md pb-24">
      {children}
      <NavInferior />
    </div>
  )
}