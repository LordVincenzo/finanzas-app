import Link from 'next/link'
import { Plus, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { formatearCOP, formatearFecha } from '@/lib/format'
import { BarraProgreso } from '@/components/barra-progreso'

export default async function PrestamosPage() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('prestamos_resumen')
    .select('*')
    .neq('status', 'cancelled')
    .order('loan_date', { ascending: false })

  // Si algo falla en la consulta, mejor verlo que quedarse en blanco.
  if (error) {
    return (
      <main className="px-4 pt-6">
        <h1 className="text-xl font-semibold">Préstamos</h1>
        <p className="mt-4 rounded-xl border border-destructive/40 p-4
                      text-[13px] text-destructive">
          No se pudieron cargar: {error.message}
        </p>
      </main>
    )
  }

  const prestamos = data ?? []
  const activos = prestamos.filter((p) => p.status === 'active')
  const porCobrar = activos.reduce((s, p) => s + Number(p.pendiente), 0)

  return (
    <main className="px-4 pt-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Préstamos</h1>
          <p className="mt-0.5 text-[13px] text-muted-foreground tabular-nums">
            Por cobrar: {formatearCOP(porCobrar)}
          </p>
        </div>
        <Link href="/prestamos/nuevo" aria-label="Nuevo préstamo"
              className="flex size-8 items-center justify-center rounded-full border">
          <Plus className="size-4" />
        </Link>
      </div>

      {prestamos.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed p-6 text-center">
          <p className="text-[14px] text-muted-foreground">
            No has registrado préstamos.
          </p>
          <Link href="/prestamos/nuevo"
                className="mt-3 inline-block rounded-lg bg-foreground px-3 py-1.5
                           text-[14px] font-medium text-background">
            Registrar uno
          </Link>
        </div>
      ) : (
        <div className="mt-5 space-y-2">
          {prestamos.map((p) => {
            const principal = Number(p.principal) || 1
            const progreso = Math.round((Number(p.pagado) * 100) / principal)

            return (
              <Link key={p.id} href={`/prestamos/${p.id}`}
                    className="block rounded-xl border p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-medium leading-tight">
                      {p.person_name}
                    </p>
                    <p className="mt-0.5 text-[12px] leading-tight
                                  text-muted-foreground tabular-nums">
                      {formatearCOP(Number(p.pagado))} de{' '}
                      {formatearCOP(principal)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    {p.status === 'paid' ? (
                      <span className="text-[12px] font-medium text-positivo">
                        Pagado
                      </span>
                    ) : (
                      <span className="text-[15px] font-semibold tabular-nums">
                        {formatearCOP(Number(p.pendiente))}
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-2.5">
                  <BarraProgreso progreso={progreso} />
                </div>

                <div className="mt-2 flex items-center justify-between gap-2
                                text-[12px] text-muted-foreground">
                  <span>
                    {p.cuotas_pagadas ?? 0}/{p.cuotas_total ?? 0} cuotas
                  </span>
                  {Number(p.cuotas_vencidas) > 0 ? (
                    <span className="flex items-center gap-1 text-destructive">
                      <AlertCircle className="size-3.5" />
                      {p.cuotas_vencidas} vencida
                      {Number(p.cuotas_vencidas) > 1 ? 's' : ''}
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