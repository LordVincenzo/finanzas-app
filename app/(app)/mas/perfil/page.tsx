import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { createClient, requerirUsuario } from '@/lib/supabase/server'
import { FormularioPerfil } from '@/components/formulario-perfil'

export default async function EditarPerfilPage() {
  const supabase = await createClient()
  const user = await requerirUsuario(supabase)
  const { data: perfil } = await supabase
    .from('profiles')
    .select('display_name, avatar_url')
    .eq('id', user.id).single()

  return (
    <main className="px-5 pt-6">
      <Link
        href="/mas"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground"
      >
        <ChevronLeft className="size-4" /> Más
      </Link>

      <h1 className="mt-4 text-2xl font-semibold">Editar perfil</h1>

      <FormularioPerfil
        nombreActual={perfil?.display_name ?? ''}
        fotoActual={perfil?.avatar_url ?? null}
      />
    </main>
  )
}
