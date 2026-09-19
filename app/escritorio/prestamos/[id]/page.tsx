import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft, Check, AlertCircle, Clock } from 'lucide-react'
import { createClient, requerirUsuario } from '@/lib/supabase/server'
import { formatearCOP, formatearFecha } from '@/lib/format'
import { BarraProgreso } from '@/components/barra-progreso'
import { FormularioAbono } from '@/components/formulario-abono'
import { BotonAccion } from '@/components/boton-accion'
import { eliminarAbono, eliminarPrestamo } from '@/app/(app)/prestamos/actions'

function hoyEnBogota(): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Bogota',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
}

const ICONO = {
  pagada:    { Icono: Check,       color: 'text-positivo' },
  vencida:   { Icono: AlertCircle, color: 'text-destructive' },
  pendiente: { Icono: Clock,       color: 'text-muted-foreground' },
}

export default async function DetallePrestamoEscritorioPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const user = await requerirUsuario(supabase)

  const { data: prestamo } = await supabase
    .from('prestamos_resumen').select('*').eq('id', id).maybeSingle()

  if (!prestamo) notFound()

  const [{ data: cuotas }, { data: abonos }, { data: cuentas }] =
    await Promise.all([
      supabase.from('cuotas_detalle')
        .select('*').eq('loan_id', id).order('number'),
      supabase.from('loan_payments')
        .select('id, amount, occurred_on, note, installment_id')
        .eq('loan_id', id).order('occurred_on', { ascending: false }),
      supabase.from('accounts')
        .select('id, name').eq('owner_id', user.id)
        .eq('class', 'asset').eq('is_active', true)
        .neq('type', 'receivable').neq('type', 'partner_receivable')
        .order('name'),
    ])

  const progreso = Math.round(
    (Number(prestamo.pagado) * 100) / Number(prestamo.principal)
  )
  const pendientes = (cuotas ?? []).filter((c) => c.estado !== 'pagada')
  const activo = prestamo.status === 'active'

  return (
    <div className="mx-auto max-w-[1400px] px-8 py-10">
      <Link href="/escritorio/prestamos"
            className="inline-flex items-center gap-1 text-[13px] text-muted-foreground
                       hover:text-foreground">
        <ChevronLeft className="size-4" /> Préstamos
      </Link>

      <h1 className="mt-2 text-[26px] font-semibold tracking-tight">
        {prestamo.person_name}
      </h1>
      <p className="mt-1 text-[13px] text-muted-foreground">
        Prestado el {formatearFecha(prestamo.loan_date)}
      </p>

      <div className="mt-6 grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-1">
          <section className="rounded-2xl bg-card p-5 shadow-card ring-1 ring-border/70">
            <div className="flex items-baseline justify-between gap-3">
              <div>
                <p className="text-[12px] text-muted-foreground">Te debe</p>
                <p className="text-[26px] font-semibold leading-none tabular-nums">
                  {formatearCOP(Number(prestamo.pendiente))}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[12px] text-muted-foreground">Prestaste</p>
                <p className="text-[14px] tabular-nums">
                  {formatearCOP(Number(prestamo.principal))}
                </p>
              </div>
            </div>

            <div className="mt-4">
              <BarraProgreso progreso={progreso} />
            </div>
            <div className="mt-2 flex justify-between text-[12px] text-muted-foreground">
              <span>Pagado {formatearCOP(Number(prestamo.pagado))}</span>
              <span>{progreso}%</span>
            </div>

            {prestamo.status === 'paid' && (
              <p className="mt-4 border-t border-border/70 pt-3 text-[13px]
                            font-medium text-positivo">
                Préstamo saldado
              </p>
            )}
          </section>

          {activo && (cuentas ?? []).length > 0 && (
            <FormularioAbono
              prestamoId={id}
              cuentas={cuentas ?? []}
              cuotas={pendientes.map((c) => ({
                id: c.id, number: c.number,
                due_date: c.due_date, pendiente: Number(c.pendiente),
              }))}
              hoy={hoyEnBogota()}
            />
          )}

          {/* Siempre disponible: un préstamo mal registrado debe poder borrarse */}
          <BotonAccion
            accion={eliminarPrestamo}
            campos={{ id, origen: 'escritorio' }}
            textoEnviando="Eliminando…"
            className="text-[13px] font-medium text-destructive
                       disabled:opacity-50"
          >
            Eliminar préstamo
          </BotonAccion>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <section className="overflow-hidden rounded-2xl bg-card shadow-card ring-1 ring-border/70">
            <p className="px-5 pt-4 text-[11px] font-semibold uppercase
                          tracking-[0.09em] text-muted-foreground">
              Cuotas
            </p>
            <div className="mt-2 divide-y divide-border/70">
              {(cuotas ?? []).map((c) => {
                const { Icono, color } = ICONO[c.estado as keyof typeof ICONO]
                const parcial = Number(c.pagado) > 0 && Number(c.pendiente) > 0

                return (
                  <div key={c.id} className="flex items-center gap-3 px-5 py-3">
                    <Icono className={`size-4 shrink-0 ${color}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] leading-tight">
                        Cuota {c.number}
                        <span className="ml-2 text-[12px] text-muted-foreground">
                          {formatearFecha(c.due_date)}
                        </span>
                      </p>
                      {parcial && (
                        <p className="mt-0.5 text-[12px] text-muted-foreground tabular-nums">
                          Pagado {formatearCOP(Number(c.pagado))} · Faltan{' '}
                          {formatearCOP(Number(c.pendiente))}
                        </p>
                      )}
                    </div>
                    <span className={`shrink-0 text-[14px] tabular-nums ${
                      c.estado === 'pagada' ? 'text-muted-foreground line-through' : ''
                    }`}>
                      {formatearCOP(Number(c.amount))}
                    </span>
                  </div>
                )
              })}
            </div>
          </section>

          {(abonos ?? []).length > 0 && (
            <section className="overflow-hidden rounded-2xl bg-card shadow-card ring-1 ring-border/70">
              <p className="px-5 pt-4 text-[11px] font-semibold uppercase
                            tracking-[0.09em] text-muted-foreground">
                Abonos recibidos
              </p>
              <div className="mt-2 divide-y divide-border/70">
                {(abonos ?? []).map((a) => (
                  <div key={a.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] leading-tight tabular-nums text-positivo">
                        +{formatearCOP(Number(a.amount))}
                      </p>
                      <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
                        {formatearFecha(a.occurred_on)}
                        {a.note ? ` · ${a.note}` : ''}
                      </p>
                    </div>
                    <BotonAccion
                      accion={eliminarAbono}
                      campos={{ id: a.id, prestamo: id }}
                      claseFormulario="shrink-0"
                      claseError="text-right"
                      className="text-[12px] font-medium text-destructive
                                 underline disabled:opacity-50"
                    >
                      Deshacer
                    </BotonAccion>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
