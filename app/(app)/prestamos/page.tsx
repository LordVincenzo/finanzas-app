import Link from 'next/link'
import { Plus, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { formatearCOP, formatearFecha } from '@/lib/format'
import { BarraProgreso } from '@/components/barra-progreso'
import { CifraAnimada } from '@/components/cifra-animada'
import {
  TarjetaDestacada, Reparto, DosRepartos,
} from '@/components/tarjeta-destacada'

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
      <main className="px-4 pt-4 pb-[calc(8rem+env(safe-area-inset-bottom))]">
        <h1 className="px-1 text-[22px] font-semibold tracking-tight">
          Préstamos
        </h1>
        <p className="mt-4 rounded-2xl bg-card p-4 text-[13px] text-destructive
                      shadow-card ring-1 ring-destructive/30">
          No se pudieron cargar: {error.message}
        </p>
      </main>
    )
  }

  const prestamos = data ?? []
  const activos = prestamos.filter((p) => p.status === 'active')
  const porCobrar = activos.reduce((s, p) => s + Number(p.pendiente), 0)
  const yaCobrado = prestamos.reduce((s, p) => s + Number(p.pagado), 0)

  return (
    <main className="px-4 pt-4 pb-[calc(8rem+env(safe-area-inset-bottom))]">
      <div className="aparece flex items-center justify-between gap-3 px-1">
        <h1 className="text-[22px] font-semibold tracking-tight">Préstamos</h1>
        <Link href="/prestamos/nuevo" aria-label="Nuevo préstamo"
              className="flex size-10 items-center justify-center rounded-full
                         bg-card shadow-card ring-1 ring-border/70 transition
                         active:scale-95">
          <Plus className="size-[18px]" />
        </Link>
      </div>

      {prestamos.length > 0 && (
        <div className="mt-3">
          <TarjetaDestacada
            etiqueta="Por cobrar"
            valor={<CifraAnimada valor={porCobrar} />}
            retraso={50}
          >
            <DosRepartos>
              <Reparto
                etiqueta="Ya te devolvieron"
                valor={formatearCOP(yaCobrado)}
              />
              <Reparto
                etiqueta={activos.length === 1 ? 'Préstamo activo' : 'Préstamos activos'}
                valor={String(activos.length)}
              />
            </DosRepartos>
          </TarjetaDestacada>
        </div>
      )}

      {prestamos.length === 0 ? (
        <div className="aparece mt-8 rounded-2xl border border-dashed
                        border-border px-5 py-7 text-center"
             style={{ '--retraso': '100ms' } as React.CSSProperties}>
          <p className="text-[15px] font-medium">No has registrado préstamos</p>
          <p className="mx-auto mt-1.5 max-w-[30ch] text-[13px] leading-snug
                        text-muted-foreground">
            Prestar dinero no reduce tu patrimonio: lo mueve a "por cobrar".
          </p>
          <Link href="/prestamos/nuevo"
                className="mt-4 inline-flex min-h-11 items-center rounded-xl
                           bg-primary px-5 text-[14px] font-medium
                           text-primary-foreground shadow-card">
            Registrar uno
          </Link>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          {prestamos.map((p, i) => {
            const principal = Number(p.principal) || 1
            const progreso = Math.round((Number(p.pagado) * 100) / principal)
            const cuotas = Number(p.cuotas_total ?? 0)
            const vencidas = Number(p.cuotas_vencidas ?? 0)
            const pagado = p.status === 'paid'

            return (
              <Link key={p.id} href={`/prestamos/${p.id}`}
                    className="aparece block rounded-2xl bg-card px-4 py-3
                               shadow-card ring-1 ring-border/70 transition
                               active:scale-[0.99]"
                    style={{ '--retraso': `${140 + i * 55}ms` } as React.CSSProperties}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-medium leading-tight">
                      {p.person_name}
                    </p>
                    <p className="mt-0.5 truncate text-[12px] leading-tight
                                  text-muted-foreground tabular-nums">
                      {formatearCOP(Number(p.pagado))} de{' '}
                      {formatearCOP(principal)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    {pagado ? (
                      <span className="text-[13px] font-medium text-positivo">
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
                  <BarraProgreso progreso={progreso} retraso={260 + i * 55} />
                </div>

                {/* El contador de cuotas solo aparece si de verdad hay
                    cuotas que contar: "0/1 cuotas" no informa de nada. */}
                {(cuotas > 1 || vencidas > 0 || p.proxima_fecha) && !pagado && (
                  <div className="mt-2 flex items-center justify-between gap-2
                                  text-[12px] text-muted-foreground">
                    <span className="tabular-nums">
                      {cuotas > 1
                        ? `${p.cuotas_pagadas ?? 0} de ${cuotas} cuotas`
                        : 'Pago único'}
                    </span>
                    {vencidas > 0 ? (
                      <span className="flex items-center gap-1 text-destructive">
                        <AlertCircle className="size-3.5" />
                        {vencidas} vencida{vencidas > 1 ? 's' : ''}
                      </span>
                    ) : p.proxima_fecha ? (
                      <span className="tabular-nums">
                        {formatearFecha(p.proxima_fecha)}
                      </span>
                    ) : null}
                  </div>
                )}
              </Link>
            )
          })}
        </div>
      )}
    </main>
  )
}