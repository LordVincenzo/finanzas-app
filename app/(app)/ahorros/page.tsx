import Link from 'next/link'
import { Plus, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { formatearCOP } from '@/lib/format'
import { BarraProgreso } from '@/components/barra-progreso'

export default async function AhorrosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data }, { data: cuentas }] = await Promise.all([
    supabase.from('metas_resumen')
      .select('id, name, target_amount, acumulado, progreso, visibility, target_date')
      .eq('is_archived', false).order('created_at', { ascending: false }),
    supabase.from('cuentas_disponible')
      .select('saldo, asignado, disponible').eq('owner_id', user!.id),
  ])

  const metas = data ?? []
  const asignado = (cuentas ?? []).reduce((s, c) => s + Number(c.asignado), 0)
  const libre = (cuentas ?? []).reduce((s, c) => s + Number(c.disponible), 0)

  return (
    <main className="px-4 pt-6">
      <div className="flex items-start justify-between gap-3">
        <h1 className="text-xl font-semibold">Ahorros</h1>
        <Link href="/ahorros/nueva" aria-label="Nueva meta"
              className="flex size-8 items-center justify-center rounded-full border">
          <Plus className="size-4" />
        </Link>
      </div>

      {/* Contexto: sin esto, una meta suelta no dice nada */}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-xl border p-3">
          <p className="text-[11px] text-muted-foreground">Comprometido</p>
          <p className="mt-0.5 text-[15px] font-medium tabular-nums">
            {formatearCOP(asignado)}
          </p>
        </div>
        <div className="rounded-xl border p-3">
          <p className="text-[11px] text-muted-foreground">Libre</p>
          <p className="mt-0.5 text-[15px] font-medium tabular-nums">
            {formatearCOP(libre)}
          </p>
        </div>
      </div>

      {metas.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed p-6 text-center">
          <p className="text-[13px] text-muted-foreground">
            Aún no tienes metas de ahorro.
          </p>
          <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
            Una meta no mueve tu dinero: marca cuánto de lo que ya tienes
            está destinado a algo.
          </p>
          <Link href="/ahorros/nueva"
                className="mt-3 inline-block rounded-lg bg-foreground px-3 py-1.5
                           text-[13px] font-medium text-background">
            Crear la primera
          </Link>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          {metas.map((m) => (
            <Link key={m.id} href={`/ahorros/${m.id}`}
                  className="block rounded-xl border p-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium leading-tight">
                    {m.name}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-tight
                                text-muted-foreground tabular-nums">
                    {formatearCOP(Number(m.acumulado))} de{' '}
                    {formatearCOP(Number(m.target_amount))}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {m.visibility === 'joint' && (
                    <Users className="size-3.5 text-muted-foreground" />
                  )}
                  <span className="text-[13px] font-semibold tabular-nums">
                    {m.progreso}%
                  </span>
                </div>
              </div>
              <div className="mt-2.5">
                <BarraProgreso progreso={Number(m.progreso)} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  )
}