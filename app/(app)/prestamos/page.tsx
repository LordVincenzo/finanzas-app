import Link from 'next/link'
import { Plus, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { formatearCOP, formatearFecha } from '@/lib/format'
import { BarraProgreso } from '@/components/barra-progreso'

export default async function PrestamosPage() {
  const supabase = await createClient()

  const { data } = await supabase
    .from('prestamos_resumen')
    .select('*')
    .neq('status', 'cancelled')
    .neq('type', 'receivable')
    .neq('type', 'partner_receivable')
    .order('loan_date', { ascending: false })

  const prestamos = data ?? []
  const activos = prestamos.filter((p) => p.status === 'active')
  const porCobrar = activos.reduce((s, p) => s + Number(p.pendiente), 0)

  return (
    <main className="px-5 pt-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Préstamos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Por cobrar: <span className="tabular-nums">{formatearCOP(porCobrar)}</span>
          </p>
        </div>
        <Link href="/prestamos/nuevo" aria-label="Nuevo préstamo"
              className="flex size-10 items-center justify-center rounded-full border">
          <Plus className="size-5" />
        </Link>
      </div>

      {prestamos.length === 0 ? (
        <div className="mt-12 rounded-2xl border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No has registrado préstamos.
          </p>
          <Link href="/prestamos/nuevo"
                className="mt-4 inline-block rounded-lg bg-foreground px-4 py-2
                           text-sm font-medium text-background">
            Registrar uno
          </Link>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {prestamos.map((p) => {
            const progreso = Math.round(
              (Number(p.pagado) * 100) / Number(p.principal)
            )
            return (
              <Link key={p.id} href={`/prestamos/${p.id}`}
                    className="block rounded-2xl border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{p.person_name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                      {formatearCOP(Number(p.pagado))} de{' '}
                      {formatearCOP(Number(p.principal))}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    {p.status === 'paid' ? (
                      <span className="text-xs font-medium text-positivo">
                        Pagado
                      </span>
                    ) : (
                      <span className="text-sm font-semibold tabular-nums">
                        {formatearCOP(Number(p.pendiente))}
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-3">
                  <BarraProgreso progreso={progreso} />
                </div>

                <div className="mt-2 flex items-center justify-between text-xs
                                text-muted-foreground">
                  <span>
                    {p.cuotas_pagadas}/{p.cuotas_total} cuotas
                  </span>
                  {' '}
                  {Number(p.cuotas_vencidas) > 0 ? (
                    <span className="flex items-center gap-1 text-destructive">
                      <AlertCircle className="size-3.5" />
                      {p.cuotas_vencidas} vencida{Number(p.cuotas_vencidas) > 1 ? 's' : ''}
                    </span>
                  ) : p.proxima_fecha ? (
                    <span>Próxima: {formatearFecha(p.proxima_fecha)}</span>
                  ) : null}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </main>
  )
}