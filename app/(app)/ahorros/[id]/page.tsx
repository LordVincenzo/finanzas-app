import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { formatearCOP, formatearFecha } from '@/lib/format'
import { BarraProgreso } from '@/components/barra-progreso'
import { FormularioAporte } from '@/components/formulario-aporte'
import { EliminarMeta } from '@/components/eliminar-meta'
import { CifraAnimada } from '@/components/cifra-animada'
import { TarjetaDestacada } from '@/components/tarjeta-destacada'
import { eliminarAporte } from '../actions'

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
      // Ordenadas por saldo libre: la cuenta con más dinero sin asignar
      // sale primero, en vez de la primera del abecedario.
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
    <main className="px-4 pt-4 pb-[calc(8rem+env(safe-area-inset-bottom))]">
      <div className="aparece">
        <Link href="/ahorros"
              className="inline-flex min-h-9 items-center gap-1 px-1 text-[13px]
                         text-muted-foreground">
          <ChevronLeft className="size-4" /> Ahorros
        </Link>

        <div className="mt-1 flex items-start justify-between gap-3 px-1">
          <h1 className="text-[22px] font-semibold tracking-tight">
            {meta.name}
          </h1>
          {esConjunta && (
            <span className="mt-1.5 flex shrink-0 items-center gap-1 text-[12px]
                             text-muted-foreground">
              <Users className="size-3.5" /> Conjunta
            </span>
          )}
        </div>
        {meta.description && (
          <p className="mt-1 px-1 text-[13px] leading-snug text-muted-foreground">
            {meta.description}
          </p>
        )}
      </div>

      <div className="mt-3">
        <TarjetaDestacada
          etiqueta="Acumulado"
          valor={<CifraAnimada valor={Number(meta.acumulado)} />}
          pie={completada
            ? `Completada · objetivo ${formatearCOP(Number(meta.target_amount))}`
            : `Faltan ${formatearCOP(restante)} de ${formatearCOP(Number(meta.target_amount))}`}
          retraso={50}
        >
          <div className="px-4 py-3">
            <div className="flex items-baseline justify-between gap-3
                            text-[12px] text-destacado-suave tabular-nums">
              <span>{meta.progreso}% del objetivo</span>
              {meta.target_date && (
                <span>Para el {formatearFecha(meta.target_date)}</span>
              )}
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full
                            bg-white/20">
              <div
                className="crece h-full rounded-full bg-white/90"
                style={{
                  '--ancho': `${Math.min(100, Number(meta.progreso))}%`,
                  '--retraso': '260ms',
                } as React.CSSProperties}
              />
            </div>
          </div>
        </TarjetaDestacada>
      </div>

      {/* Reparto de aportes: solo tiene sentido en metas conjuntas.
          Y hace falta: sin esto, ver el acumulado aquí y otro número en
          "comprometido" parece una contradicción, cuando son dos
          preguntas distintas. */}
      {esConjunta && (porPersona ?? []).length > 0 && (
        <section className="aparece mt-3 overflow-hidden rounded-2xl bg-card
                            shadow-card ring-1 ring-border/70"
                 style={{ '--retraso': '150ms' } as React.CSSProperties}>
          <p className="px-4 pt-3 text-[11px] font-semibold uppercase
                        tracking-[0.09em] text-muted-foreground">
            Quién ha aportado
          </p>
          <dl className="mt-2 divide-y divide-border/70">
            {(porPersona ?? []).map((p) => (
              <div key={p.profile_id}
                   className="flex items-center justify-between px-4 py-2.5">
                <dt className="text-[14px]">
                  {p.profile_id === user!.id ? 'Tú' : p.display_name}
                </dt>
                <dd className="text-[14px] font-medium tabular-nums">
                  {formatearCOP(Number(p.total))}
                </dd>
              </div>
            ))}
          </dl>
          <p className="border-t border-border/70 px-4 py-2.5 text-[11px]
                        leading-snug text-muted-foreground tabular-nums">
            De tus cuentas hay {formatearCOP(miParte)} reservados para esta
            meta. El resto lo pone tu pareja desde las suyas, así que no
            cuenta en tu dinero comprometido.
          </p>
        </section>
      )}

      <div className="aparece"
           style={{ '--retraso': '210ms' } as React.CSSProperties}>
        <FormularioAporte metaId={id} cuentas={cuentas ?? []} />
      </div>

      {/* Historial */}
      {(aportes ?? []).length > 0 && (
        <section className="aparece mt-6"
                 style={{ '--retraso': '280ms' } as React.CSSProperties}>
          <h2 className="mb-2 px-1 text-[11px] font-semibold uppercase
                         tracking-[0.09em] text-muted-foreground">
            Historial
          </h2>
          <div className="overflow-hidden rounded-2xl bg-card shadow-card
                          ring-1 ring-border/70 divide-y divide-border/70">
            {(aportes ?? []).map((a) => {
              const retiro = Number(a.amount) < 0
              return (
                <div key={a.id}
                     className="flex min-h-14 items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className={`text-[15px] font-medium tabular-nums
                                   ${retiro ? 'text-negativo' : ''}`}>
                      {retiro ? '−' : '+'}
                      {formatearCOP(Math.abs(Number(a.amount)))}
                    </p>
                    <p className="mt-0.5 truncate text-[12px]
                                  text-muted-foreground">
                      {formatearFecha(a.occurred_on)}
                      {a.note ? ` · ${a.note}` : ''}
                    </p>
                  </div>
                  {a.profile_id === user!.id && (
                    <form action={eliminarAporte}>
                      <input type="hidden" name="id" value={a.id} />
                      <input type="hidden" name="meta" value={id} />
                      <button className="shrink-0 pl-2 text-[12px] font-medium
                                         text-destructive">
                        Quitar
                      </button>
                    </form>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {meta.owner_id === user!.id && (
        <EliminarMeta
          metaId={id}
          nombre={meta.name}
          acumulado={Number(meta.acumulado)}
          esConjunta={esConjunta}
        />
      )}
    </main>
  )
}