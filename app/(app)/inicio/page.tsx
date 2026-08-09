import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { formatearCOP } from '@/lib/format'

export default async function InicioPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: perfil }, { data: patrimonio }] = await Promise.all([
    supabase.from('profiles').select('display_name').eq('id', user!.id).single(),
    supabase.from('net_worth').select('net_worth, assets, liabilities')
      .eq('owner_id', user!.id).maybeSingle(),
  ])

  const total = Number(patrimonio?.net_worth ?? 0)

  return (
    <main className="px-5 pt-8">
      <p className="text-sm text-muted-foreground">Hola,</p>
      <h1 className="text-2xl font-semibold">{perfil?.display_name}</h1>

      <section className="mt-8 rounded-2xl border p-5">
        <p className="text-sm text-muted-foreground">Tu patrimonio</p>
        <p className="mt-1 text-3xl font-semibold tabular-nums">
          {formatearCOP(total)}
        </p>
        {total === 0 && (
          <Link
            href="/cuentas/nueva"
            className="mt-3 inline-block text-xs underline text-muted-foreground"
          >
            Registra tu primera cuenta
          </Link>
        )}
      </section>
    </main>
  )
}