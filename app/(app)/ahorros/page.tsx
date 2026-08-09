import Link from 'next/link'
import { Plus, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { formatearCOP } from '@/lib/format'
import { BarraProgreso } from '@/components/barra-progreso'

export default async function AhorrosPage() {
  const supabase = await createClient()

  const { data } = await supabase
    .from('metas_resumen')
    .select('id, name, target_amount, acumulado, progreso, visibility, target_date')
    .eq('is_archived', false)
    .order('created_at', { ascending: false })

  const metas = data ?? []
  const totalAhorrado = metas.reduce((s, m) => s + Number(m.acumulado), 0)

  return (
    <main className="px-5 pt-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Ahorros</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Asignado: <span className="tabular-nums">{formatearCOP(totalAhorrado)}</span>
          </p>
        </div>
        <Link
          href="/ahorros/nueva"
          aria-label="Nueva meta"
          className="flex size-10 items-center justify-center rounded-full border"
        >
          <Plus className="size-5" />
        </Link>
      </div>

      {metas.length === 0 ? (
        <div className="mt-12 rounded-2xl border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Aún no tienes metas de ahorro.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Una meta no mueve tu dinero: solo marca cuánto de lo que ya
            tienes está destinado a algo.
          </p>
          <Link
            href="/ahorros/nueva"
            className="mt-4 inline-block rounded-lg bg-foreground px-4 py-2
                       text-sm font-medium text-background"
          >
            Crear la primera
          </Link>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {metas.map((m) => (
            <Link
              key={m.id}
              href={`/ahorros/${m.id}`}
              className="block rounded-2xl border p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{m.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                    {formatearCOP(Number(m.acumulado))} de{' '}
                    {formatearCOP(Number(m.target_amount))}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {m.visibility === 'joint' && (
                    <Users className="size-3.5 text-muted-foreground" />
                  )}
                  <span className="text-sm font-semibold tabular-nums">
                    {m.progreso}%
                  </span>
                </div>
              </div>
              <div className="mt-3">
                <BarraProgreso progreso={Number(m.progreso)} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  )
}