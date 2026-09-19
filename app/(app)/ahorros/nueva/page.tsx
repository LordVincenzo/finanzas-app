import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { createClient, requerirUsuario } from '@/lib/supabase/server'
import { FormularioMeta } from '@/components/formulario-meta'

export default async function NuevaMetaPage() {
  const supabase = await createClient()
  const user = await requerirUsuario(supabase)

  const { data: membresia } = await supabase
    .from('couple_members')
    .select('couple_id')
    .eq('profile_id', user.id)
    .eq('status', 'active')
    .maybeSingle()

  return (
    <main className="px-5 pt-6">
      <Link
        href="/ahorros"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground"
      >
        <ChevronLeft className="size-4" /> Ahorros
      </Link>

      <h1 className="mt-4 text-2xl font-semibold">Nueva meta</h1>

      <FormularioMeta tienePareja={Boolean(membresia)} />
    </main>
  )
}