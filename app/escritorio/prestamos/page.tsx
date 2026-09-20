import Link from 'next/link'
import { Plus, AlertCircle, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { formatearCOP, formatearFecha } from '@/lib/format'
import { BarraProgreso } from '@/components/barra-progreso'

export default async function PrestamosEscritorioPage() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('prestamos_resumen')
    .select('*')
    .neq('status', 'cancelled')
    .order('loan_date', { ascending: false })

  if (error) {
    return (
      <div>
        <h1 className="text-[26px] font-semibold tracking-tight">Préstamos</h1>
        <p className="mt-4 rounded-2xl bg-card p-4 text-[13px] text-destructive
                      shadow-card ring-1 ring-destructive/30">
          No se pudieron cargar: {error.message}
        </p>
      </div>
    )
  }

  const prestamos = data ?? []
  const activos = prestamos.filter((p) => p.status === 'active')
  const porCobrar = activos.reduce((s, p) => s + Number(p.pendiente), 0)
  const yaCobrado = prestamos.reduce((s, p) => s + Number(p.pagado), 0)

  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight">Préstamos</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Prestar dinero no reduce tu patrimonio: lo mueve a &quot;por cobrar&quot;.
          </p>
        </div>
        <Link href="/escritorio/prestamos/nuevo"
              className="flex h-9 items-center gap-1.5 rounded-full bg-primary
                         px-4 text-[13px] font-medium text-primary-foreground
                         shadow-card transition hover:opacity-90">
          <Plus className="size-4" /> Nuevo préstamo
        </Link>
      </div>

      {prestamos.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-border px-6 py-12 text-center">
          <p className="text-[15px] font-medium">No has registrado préstamos</p>
          <p className="mx-auto mt-1.5 max-w-[40ch] text-[13px] text-muted-foreground">
            Prestar dinero no reduce tu patrimonio: lo mueve a &quot;por cobrar&quot;.
          </p>
          <Link href="/escritorio/prestamos/nuevo"
                className="mt-4 inline-flex h-11 items-center rounded-xl bg-primary
                           px-5 text-[14px] font-medium text-primary-foreground shadow-card">
            Registrar uno
          </Link>
        </div>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-3 gap-4">
            <TarjetaResumen etiqueta="Por cobrar" valor={formatearCOP(porCobrar)} />
            <TarjetaResumen etiqueta="Ya te devolvieron" valor={formatearCOP(yaCobrado)} />
            <TarjetaResumen
              etiqueta={activos.length === 1 ? 'Préstamo activo' : 'Préstamos activos'}
              valor={String(activos.length)}
            />
          </div>

          <div className="mt-6 overflow-hidden rounded-2xl bg-card shadow-card ring-1 ring-border/70">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-border/70 text-[12px] text-muted-foreground">
                  <th className="px-5 py-3 font-medium">Persona</th>
                  <th className="px-5 py-3 font-medium">Fecha</th>
                  <th className="px-5 py-3 font-medium">Progreso</th>
                  <th className="px-5 py-3 font-medium">Cuotas</th>
                  <th className="px-5 py-3 text-right font-medium">Pendiente</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {prestamos.map((p) => {
                  const principal = Number(p.principal) || 1
                  const progreso = Math.round((Number(p.pagado) * 100) / principal)
                  const cuotas = Number(p.cuotas_total ?? 0)
                  const vencidas = Number(p.cuotas_vencidas ?? 0)
                  const pagado = p.status === 'paid'

                  return (
                    <tr key={p.id} className="transition hover:bg-muted/40">
                      <td className="px-5 py-3">
                        <Link href={`/escritorio/prestamos/${p.id}`} className="font-medium hover:underline">
                          {p.person_name}
                        </Link>
                        <p className="mt-0.5 text-[11px] text-muted-foreground tabular-nums">
                          {formatearCOP(Number(p.pagado))} de {formatearCOP(principal)}
                        </p>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 text-muted-foreground tabular-nums">
                        {formatearFecha(p.loan_date)}
                      </td>
                      <td className="px-5 py-3">
                        <div className="w-32">
                          <BarraProgreso progreso={progreso} />
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 text-muted-foreground">
                        {vencidas > 0 ? (
                          <span className="flex items-center gap-1 text-destructive">
                            <AlertCircle className="size-3.5" />
                            {vencidas} vencida{vencidas > 1 ? 's' : ''}
                          </span>
                        ) : cuotas > 1 ? (
                          `${p.cuotas_pagadas ?? 0} de ${cuotas}`
                        ) : (
                          'Pago único'
                        )}
                      </td>
                      <td className="px-5 py-3 text-right font-medium tabular-nums">
                        {pagado ? (
                          <span className="text-positivo">Pagado</span>
                        ) : (
                          formatearCOP(Number(p.pendiente))
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <Link href={`/escritorio/prestamos/${p.id}`} aria-label={`Ver ${p.person_name}`}>
                          <ChevronRight className="size-4 text-muted-foreground/60" />
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
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
