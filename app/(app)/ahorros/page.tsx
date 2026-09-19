import Link from 'next/link'
import { Plus, Users } from 'lucide-react'
import { createClient, requerirUsuario } from '@/lib/supabase/server'
import { formatearCOP } from '@/lib/format'
import { BarraProgreso } from '@/components/barra-progreso'
import { RitmoMeta } from '@/components/ritmo-meta'
import { CifraAnimada } from '@/components/cifra-animada'
import {
  TarjetaDestacada, Reparto, DosRepartos,
} from '@/components/tarjeta-destacada'

export default async function AhorrosPage() {
  const supabase = await createClient()
  const user = await requerirUsuario(supabase)

  const [{ data }, { data: cuentas }, { data: aportantes }] = await Promise.all([
    /* SIN owner_id a propósito: una meta conjunta pertenece a la pareja y
       las dos personas tienen que verla. El RLS ya recorta a las tuyas
       más las shared_view/joint de ella. No lo "arregles" añadiendo el
       filtro: escondería las metas compartidas. */
    supabase.from('metas_resumen')
      .select('id, name, target_amount, acumulado, progreso, visibility, target_date')
      .eq('is_archived', false).order('created_at', { ascending: false }),
    supabase.from('cuentas_disponible')
      .select('saldo, asignado, disponible').eq('owner_id', user.id),
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
      quien: a.profile_id === user.id ? 'Tú' : (a.display_name ?? 'Tu pareja'),
      total: Number(a.total),
    })
    repartoPorMeta.set(a.goal_id, lista)
  }

  return (
    <main className="px-4 pt-4 pb-[calc(8rem+env(safe-area-inset-bottom))]">
      <div className="aparece flex items-center justify-between gap-3 px-1">
        <h1 className="text-[22px] font-semibold tracking-tight">Ahorros</h1>
        <Link href="/ahorros/nueva" aria-label="Nueva meta"
              className="flex size-10 items-center justify-center rounded-full
                         bg-card shadow-card ring-1 ring-border/70 transition
                         active:scale-95">
          <Plus className="size-[18px]" />
        </Link>
      </div>

      {/* "Comprometido" cuenta solo TU dinero: en una meta conjunta será
          menor que el acumulado de la meta, y eso es correcto. Por eso
          cada tarjeta muestra debajo quién puso qué. */}
      <div className="mt-3">
        <TarjetaDestacada
          etiqueta="Comprometido por ti"
          valor={<CifraAnimada valor={asignado} />}
          retraso={50}
        >
          <DosRepartos>
            <Reparto etiqueta="Libre" valor={formatearCOP(libre)} />
            <Reparto
              etiqueta="Metas activas"
              valor={String(metas.length)}
            />
          </DosRepartos>
        </TarjetaDestacada>
      </div>

      {metas.length === 0 ? (
        <div className="aparece mt-6 rounded-2xl border border-dashed
                        border-border px-5 py-7 text-center"
             style={{ '--retraso': '130ms' } as React.CSSProperties}>
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
          {metas.map((m, i) => {
            const reparto = repartoPorMeta.get(m.id) ?? []
            const conjunta = m.visibility === 'joint'

            return (
              <Link key={m.id} href={`/ahorros/${m.id}`}
                    className="aparece block rounded-2xl bg-card px-4 py-3
                               shadow-card ring-1 ring-border/70 transition
                               active:scale-[0.99]"
                    style={{ '--retraso': `${140 + i * 60}ms` } as React.CSSProperties}>
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
                  <BarraProgreso
                    progreso={Number(m.progreso)}
                    retraso={260 + i * 60}
                  />
                </div>

                {/* La barra dice dónde vas; esto dice qué hacer. Sin la
                    cuota mensual, una meta es una lista de deseos con
                    una barra al lado. */}
                <RitmoMeta
                  meta={{
                    target_amount: Number(m.target_amount),
                    acumulado: Number(m.acumulado),
                    target_date: m.target_date,
                  }}
                  compacto
                  className="mt-2"
                />

                {/* Sin esta línea, ver el acumulado de la meta y otro
                    número en "comprometido" parece un error. */}
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