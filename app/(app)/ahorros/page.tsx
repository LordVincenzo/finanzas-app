import Link from 'next/link'
import { Plus, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { formatearCOP } from '@/lib/format'
import { BarraProgreso } from '@/components/barra-progreso'

export default async function AhorrosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data }, { data: cuentas }, { data: aportantes }] = await Promise.all([
    supabase.from('metas_resumen')
      .select('id, name, target_amount, acumulado, progreso, visibility, target_date')
      .eq('is_archived', false).order('created_at', { ascending: false }),
    supabase.from('cuentas_disponible')
      .select('saldo, asignado, disponible').eq('owner_id', user!.id),
    // Quién ha puesto qué en cada meta. La vista existía desde 0008 y
    // no se usaba en ninguna pantalla.
    supabase.from('metas_aportes_por_persona')
      .select('goal_id, profile_id, display_name, total'),
  ])

  const metas = data ?? []
  const asignado = (cuentas ?? []).reduce((s, c) => s + Number(c.asignado), 0)
  const libre = (cuentas ?? []).reduce((s, c) => s + Number(c.disponible), 0)

  // Agrupamos el reparto por meta para no recorrer la lista entera
  // dentro de cada tarjeta.
  const repartoPorMeta = new Map<string, { quien: string; total: number }[]>()
  for (const a of aportantes ?? []) {
    const lista = repartoPorMeta.get(a.goal_id) ?? []
    lista.push({
      quien: a.profile_id === user!.id ? 'Tú' : (a.display_name ?? 'Tu pareja'),
      total: Number(a.total),
    })
    repartoPorMeta.set(a.goal_id, lista)
  }

  return (
    <main className="px-4 pb-28 pt-4">
      <div className="flex items-center justify-between gap-3 px-1">
        <h1 className="text-[22px] font-semibold tracking-tight">Ahorros</h1>
        <Link href="/ahorros/nueva" aria-label="Nueva meta"
              className="flex size-10 items-center justify-center rounded-full
                         bg-card shadow-card ring-1 ring-border/70 transition
                         active:scale-95">
          <Plus className="size-[18px]" />
        </Link>
      </div>

      {/* Contexto: sin esto, una meta suelta no dice nada.
          "Comprometido" cuenta solo TU dinero: en una meta conjunta será
          menor que el acumulado de la meta, y eso es correcto. Por eso
          cada tarjeta muestra debajo quién puso qué. */}
      <section className="mt-3 overflow-hidden rounded-2xl bg-card
                          shadow-elevada ring-1 ring-border/70">
        <div className="grid grid-cols-2 divide-x divide-border/70">
          <div className="px-4 py-3">
            <p className="text-[12px] text-muted-foreground">
              Comprometido por ti
            </p>
            <p className="mt-0.5 text-[18px] font-medium tabular-nums">
              {formatearCOP(asignado)}
            </p>
          </div>
          <div className="px-4 py-3">
            <p className="text-[12px] text-muted-foreground">Libre</p>
            <p className="mt-0.5 text-[18px] font-medium tabular-nums">
              {formatearCOP(libre)}
            </p>
          </div>
        </div>
      </section>

      {metas.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-border
                        px-5 py-7 text-center">
          <p className="text-[15px] font-medium">Aún no tienes metas</p>
          <p className="mx-auto mt-1.5 max-w-[30ch] text-[13px] leading-snug
                        text-muted-foreground">
            Una meta no mueve tu dinero: marca cuánto de lo que ya tienes
            está destinado a algo.
          </p>
          <Link href="/ahorros/nueva"
                className="mt-4 inline-flex min-h-11 items-center rounded-xl
                           bg-primary px-5 text-[14px] font-medium
                           text-primary-foreground shadow-card">
            Crear la primera
          </Link>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          {metas.map((m) => {
            const reparto = repartoPorMeta.get(m.id) ?? []
            const conjunta = m.visibility === 'joint'

            return (
              <Link key={m.id} href={`/ahorros/${m.id}`}
                    className="block rounded-2xl bg-card px-4 py-3 shadow-card
                               ring-1 ring-border/70 transition
                               active:scale-[0.99]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-medium leading-tight">
                      {m.name}
                    </p>
                    {/* El total de la meta, no tu parte: lo que importa
                        es si van a llegar. */}
                    <p className="mt-0.5 truncate text-[12px] leading-tight
                                  text-muted-foreground tabular-nums">
                      {formatearCOP(Number(m.acumulado))} de{' '}
                      {formatearCOP(Number(m.target_amount))}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {conjunta && (
                      <Users className="size-3.5 text-muted-foreground" />
                    )}
                    <span className="text-[15px] font-semibold tabular-nums">
                      {m.progreso}%
                    </span>
                  </div>
                </div>

                <div className="mt-2.5">
                  <BarraProgreso progreso={Number(m.progreso)} />
                </div>

                {/* Sin esta línea, ver "$1.000.000" en la meta y
                    "$500.000 comprometido" arriba parece un error. */}
                {conjunta && reparto.length > 1 && (
                  <p className="mt-2 truncate text-[11px] text-muted-foreground
                                tabular-nums">
                    {reparto.map((r) =>
                      `${r.quien} ${formatearCOP(r.total)}`
                    ).join(' · ')}
                  </p>
                )}
              </Link>
            )
          })}
        </div>
      )}
    </main>
  )
}