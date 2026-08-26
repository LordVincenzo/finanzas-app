import Link from 'next/link'
import { Plus, Users, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { formatearCOP } from '@/lib/format'
import { BarraProgreso } from '@/components/barra-progreso'

export default async function AhorrosEscritorioPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: metas }, { data: cuentas }] = await Promise.all([
    supabase.from('metas_resumen')
      .select('id, name, target_amount, acumulado, progreso, visibility, target_date')
      .eq('is_archived', false)
      .order('created_at', { ascending: false }),
    // Misma vista que Inicio, Cuentas y Ahorros del celular: fuente
    // única del "disponible" (ver CLAUDE.md).
    supabase.from('cuentas_disponible')
      .select('asignado, disponible').eq('owner_id', user!.id),
  ])

  const listaMetas = metas ?? []
  const filas = cuentas ?? []
  const asignado = filas.reduce((s, c) => s + Number(c.asignado), 0)
  const disponible = filas.reduce((s, c) => s + Number(c.disponible), 0)

  return (
    <div className="mx-auto max-w-[1400px] px-8 py-10">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight">Ahorros</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Una meta no mueve tu dinero: marca cuánto de lo que ya tienes está destinado a algo.
          </p>
        </div>
        <Link href="/ahorros/nueva"
              className="flex h-9 items-center gap-1.5 rounded-full bg-primary
                         px-4 text-[13px] font-medium text-primary-foreground
                         shadow-card transition hover:opacity-90">
          <Plus className="size-4" /> Nueva meta
        </Link>
      </div>

      {listaMetas.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-border px-6 py-12 text-center">
          <p className="text-[15px] font-medium">Aún no tienes metas</p>
          <p className="mx-auto mt-1.5 max-w-[40ch] text-[13px] text-muted-foreground">
            Una meta no mueve tu dinero: marca cuánto de lo que ya tienes está
            destinado a algo.
          </p>
          <Link href="/ahorros/nueva"
                className="mt-4 inline-flex h-11 items-center rounded-xl bg-primary
                           px-5 text-[14px] font-medium text-primary-foreground shadow-card">
            Crear la primera
          </Link>
        </div>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-3 gap-4">
            <TarjetaResumen etiqueta="Comprometido por ti" valor={formatearCOP(asignado)} />
            <TarjetaResumen etiqueta="Libre" valor={formatearCOP(disponible)} />
            <TarjetaResumen
              etiqueta={listaMetas.length === 1 ? 'Meta activa' : 'Metas activas'}
              valor={String(listaMetas.length)}
            />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
            {listaMetas.map((m) => {
              const conjunta = m.visibility === 'joint'
              return (
                <Link key={m.id} href={`/escritorio/ahorros/${m.id}`}
                      className="group rounded-2xl bg-card p-5 shadow-card ring-1
                                 ring-border/70 transition hover:ring-primary/40">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 truncate text-[15px] font-medium">
                        {m.name}
                        {conjunta && (
                          <Users className="size-3.5 shrink-0 text-muted-foreground" />
                        )}
                      </p>
                      <p className="mt-0.5 truncate text-[13px] text-muted-foreground tabular-nums">
                        {formatearCOP(Number(m.acumulado))} de {formatearCOP(Number(m.target_amount))}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <span className="text-[16px] font-semibold tabular-nums">
                        {m.progreso}%
                      </span>
                      <ChevronRight className="size-4 text-muted-foreground/60
                                               transition group-hover:translate-x-0.5" />
                    </div>
                  </div>
                  <div className="mt-3">
                    <BarraProgreso progreso={Number(m.progreso)} />
                  </div>
                </Link>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

function TarjetaResumen({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="rounded-2xl bg-card p-4 shadow-card ring-1 ring-border/70">
      <p className="text-[12px] text-muted-foreground">{etiqueta}</p>
      <p className="mt-0.5 text-[20px] font-semibold tabular-nums">{valor}</p>
    </div>
  )
}
