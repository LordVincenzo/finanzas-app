import { createClient } from '@/lib/supabase/server'
import { formatearCOP } from '@/lib/format'

export default async function InicioPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: perfil } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', user!.id)
    .single()

  return (
    <main className="px-5 pt-8">
      <p className="text-sm text-muted-foreground">Hola,</p>
      <h1 className="text-2xl font-semibold">{perfil?.display_name}</h1>

      <section className="mt-8 rounded-2xl border p-5">
        <p className="text-sm text-muted-foreground">Tu patrimonio</p>
        <p className="mt-1 text-3xl font-semibold tabular-nums">
          {formatearCOP(0)}
        </p>
        <p className="mt-3 text-xs text-muted-foreground">
          Aún no has registrado cuentas.
        </p>
      </section>
    </main>
  )
}