import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { formatearCOP, formatearFecha } from '@/lib/format'
import { FormularioAporte } from '@/components/formulario-aporte'
import { EliminarMetaEscritorio } from '@/components/eliminar-meta-escritorio'
import { CifraAnimada } from '@/components/cifra-animada'
import { TarjetaDestacada } from '@/components/tarjeta-destacada'
import { eliminarAporte } from '@/app/(app)/ahorros/actions'

export default async function DetalleMetaEscritorioPage({
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
        .eq('owner_id', user!.id)
        .order('disponible', { ascending: false }),
    ])

  const esConjunta = meta.visibility === 'joint'
  const restante = Number(meta.target_amount) - Number(meta.acumulado)
  const completada = restante <= 0

  const miParte = (porPersona ?? [])
    .filter((p) => p.profile_id === user!.id)
    .reduce((s, p) => s + Number(p.total), 0)

  return (
    <div className="mx-auto max-w-[1400px] px-8 py-10">
      <Link href="/escritorio/ahorros"
            className="inline-flex items-center gap-1 text-[13px] text-muted-foreground
                       hover:text-foreground">
        <ChevronLeft className="size-4" /> Ahorros
      </Link>

      <div className="mt-2 flex items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-[26px] font-semibold tracking-tight">
            {meta.name}
            {esConjunta && (
              <span className="flex items-center gap-1 text-[13px] font-normal text-muted-foreground">
                <Users className="size-3.5" /> Conjunta
              </span>
            )}
          </h1>
          {meta.description && (
            <p className="mt-1 max-w-[60ch] text-[13px] text-muted-foreground">
              {meta.description}
            </p>
          )}
        </div>
      </div>

      {/* items-start: sin esto, el grid estira la columna izquierda a la
          altura de la derecha, y TarjetaDestacada (h-full) crece con
          ella — empujando el formulario de aportar fuera de la vista. */}
      <div className="mt-6 grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-1">
          <TarjetaDestacada
            etiqueta="Acumulado"
            valor={<CifraAnimada valor={Number(meta.acumulado)} />}
            pie={completada
              ? `Completada · objetivo ${formatearCOP(Number(meta.target_amount))}`
              : `Faltan ${formatearCOP(restante)} de ${formatearCOP(Number(meta.target_amount))}`}
          >
            <div className="px-4 py-3">
              <div className="flex items-baseline justify-between gap-3
                              text-[12px] text-destacado-suave tabular-nums">
                <span>{meta.progreso}% del objetivo</span>
                {meta.target_date && (
                  <span>Para el {formatearFecha(meta.target_date)}</span>
                )}
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/20">
                <div
                  className="crece h-full rounded-full bg-white/90"
                  style={{
                    '--ancho': `${Math.min(100, Number(meta.progreso))}%`,
                    '--retraso': '150ms',
                  } as React.CSSProperties}
                />
              </div>
            </div>
          </TarjetaDestacada>

          <FormularioAporte metaId={id} cuentas={cuentas ?? []} />

          {meta.owner_id === user!.id && (
            <EliminarMetaEscritorio
              metaId={id}
              nombre={meta.name}
              acumulado={Number(meta.acumulado)}
              esConjunta={esConjunta}
            />
          )}
        </div>

        <div className="space-y-6 lg:col-span-2">
          {esConjunta && (porPersona ?? []).length > 0 && (
            <section className="overflow-hidden rounded-2xl bg-card shadow-card ring-1 ring-border/70">
              <p className="px-5 pt-4 text-[11px] font-semibold uppercase
                            tracking-[0.09em] text-muted-foreground">
                Quién ha aportado
              </p>
              <dl className="mt-2 divide-y divide-border/70">
                {(porPersona ?? []).map((p) => (
                  <div key={p.profile_id}
                       className="flex items-center justify-between px-5 py-3">
                    <dt className="text-[14px]">
                      {p.profile_id === user!.id ? 'Tú' : p.display_name}
                    </dt>
                    <dd className="text-[14px] font-medium tabular-nums">
                      {formatearCOP(Number(p.total))}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="border-t border-border/70 px-5 py-3 text-[12px]
                            leading-snug text-muted-foreground tabular-nums">
                De tus cuentas hay {formatearCOP(miParte)} reservados para esta
                meta. El resto lo pone tu pareja desde las suyas, así que no
                cuenta en tu dinero comprometido.
              </p>
            </section>
          )}

          <section className="overflow-hidden rounded-2xl bg-card shadow-card ring-1 ring-border/70">
            <p className="px-5 pt-4 text-[11px] font-semibold uppercase
                          tracking-[0.09em] text-muted-foreground">
              Historial
            </p>
            {(aportes ?? []).length === 0 ? (
              <p className="px-5 py-6 text-[13px] text-muted-foreground">
                Todavía no hay aportes registrados.
              </p>
            ) : (
              <div className="mt-2 divide-y divide-border/70">
                {(aportes ?? []).map((a) => {
                  const retiro = Number(a.amount) < 0
                  return (
                    <div key={a.id} className="flex items-center gap-3 px-5 py-3">
                      <div className="min-w-0 flex-1">
                        <p className={`text-[14px] font-medium tabular-nums ${retiro ? 'text-negativo' : ''}`}>
                          {retiro ? '−' : '+'}{formatearCOP(Math.abs(Number(a.amount)))}
                        </p>
                        <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
                          {formatearFecha(a.occurred_on)}
                          {a.note ? ` · ${a.note}` : ''}
                        </p>
                      </div>
                      {a.profile_id === user!.id && (
                        <form action={eliminarAporte}>
                          <input type="hidden" name="id" value={a.id} />
                          <input type="hidden" name="meta" value={id} />
                          <button className="shrink-0 text-[12px] font-medium text-destructive">
                            Quitar
                          </button>
                        </form>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
