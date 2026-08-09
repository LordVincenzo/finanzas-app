import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { formatearCOP, formatearFecha } from '@/lib/format'
import { BarraProgreso } from '@/components/barra-progreso'
import { FormularioAporte } from '@/components/formulario-aporte'
import { archivarMeta, eliminarAporte } from '../actions'

export default async function DetalleMetaPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: meta } = await supabase
    .from('metas_resumen')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (!meta) notFound()

  const [{ data: porPersona }, { data: aportes }, { data: cuentas }] =
    await Promise.all([
      supabase.from('metas_aportes_por_persona')
        .select('profile_id, display_name, total').eq('goal_id', id),
      supabase.from('savings_contributions')
        .select('id, amount, note, occurred_on, profile_id')
        .eq('goal_id', id).order('occurred_on', { ascending: false }),
      supabase.from('cuentas_disponible')
        .select('account_id, name, disponible')
        .eq('owner_id', user!.id).order('name'),
    ])

  const esConjunta = meta.visibility === 'joint'
  const restante = Number(meta.target_amount) - Number(meta.acumulado)

  return (
    <main className="px-5 pt-6">
      <Link href="/ahorros"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground">
        <ChevronLeft className="size-4" /> Ahorros
      </Link>

      <h1 className="mt-4 text-2xl font-semibold">{meta.name}</h1>
      {meta.description && (
        <p className="mt-1 text-sm text-muted-foreground">{meta.description}</p>
      )}

      <section className="mt-6 rounded-2xl border p-5">
        <div className="flex items-baseline justify-between">
          <span className="text-2xl font-semibold tabular-nums">
            {formatearCOP(Number(meta.acumulado))}
          </span>
          <span className="text-sm text-muted-foreground tabular-nums">
            de {formatearCOP(Number(meta.target_amount))}
          </span>
        </div>

        <div className="mt-3">
          <BarraProgreso progreso={Number(meta.progreso)} />
        </div>

        <div className="mt-2 flex justify-between text-xs text-muted-foreground">
          <span>{meta.progreso}%</span>
          <span className="tabular-nums">
            {restante > 0 ? `Faltan ${formatearCOP(restante)}` : '¡Completada!'}
          </span>
        </div>

        {meta.target_date && (
          <p className="mt-3 border-t pt-3 text-xs text-muted-foreground">
            Fecha objetivo: {formatearFecha(meta.target_date)}
          </p>
        )}
      </section>

      {/* Reparto de aportes: solo tiene sentido en metas conjuntas */}
      {esConjunta && (porPersona ?? []).length > 0 && (
        <section className="mt-4 rounded-2xl border p-5">
          <p className="text-sm font-medium">Quién ha aportado</p>
          <dl className="mt-3 space-y-2">
            {(porPersona ?? []).map((p) => (
              <div key={p.profile_id} className="flex justify-between">
                <dt className="text-sm text-muted-foreground">
                  {p.profile_id === user!.id ? 'Tú' : p.display_name}
                </dt>
                <dd className="text-sm tabular-nums">
                  {formatearCOP(Number(p.total))}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <FormularioAporte metaId={id} cuentas={cuentas ?? []} />

      {/* Historial */}
      {(aportes ?? []).length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wide
                         text-muted-foreground">
            Historial
          </h2>
          <div className="divide-y rounded-2xl border">
            {(aportes ?? []).map((a) => (
              <div key={a.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm tabular-nums">
                    {Number(a.amount) > 0 ? '+' : '−'}
                    {formatearCOP(Math.abs(Number(a.amount)))}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {formatearFecha(a.occurred_on)}
                    {a.note ? ` · ${a.note}` : ''}
                  </p>
                </div>
                {a.profile_id === user!.id && (
                  <form action={eliminarAporte}>
                    <input type="hidden" name="id" value={a.id} />
                    <input type="hidden" name="meta" value={id} />
                    <button className="shrink-0 text-xs text-destructive underline">
                      Quitar
                    </button>
                  </form>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {meta.owner_id === user!.id && (
        <form action={archivarMeta} className="mt-8">
          <input type="hidden" name="id" value={id} />
          <button className="text-sm text-destructive underline">
            Archivar meta
          </button>
        </form>
      )}
    </main>
  )
}