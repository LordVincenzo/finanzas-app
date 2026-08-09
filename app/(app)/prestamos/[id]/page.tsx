import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft, Check, AlertCircle, Clock } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { formatearCOP, formatearFecha } from '@/lib/format'
import { BarraProgreso } from '@/components/barra-progreso'
import { FormularioAbono } from '@/components/formulario-abono'
import { eliminarAbono, cancelarPrestamo } from '../actions'

function hoyEnBogota(): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Bogota',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
}

const ICONO = {
  pagada:    { Icono: Check,       color: 'text-emerald-600' },
  vencida:   { Icono: AlertCircle, color: 'text-destructive' },
  pendiente: { Icono: Clock,       color: 'text-muted-foreground' },
}

export default async function DetallePrestamoPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

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
        .select('id, name').eq('owner_id', user!.id)
        .eq('class', 'asset').eq('is_active', true)
        .neq('type', 'receivable').order('name'),
    ])

  const progreso = Math.round(
    (Number(prestamo.pagado) * 100) / Number(prestamo.principal)
  )
  const pendientes = (cuotas ?? []).filter((c) => c.estado !== 'pagada')
  const activo = prestamo.status === 'active'

  return (
    <main className="px-5 pt-6">
      <Link href="/prestamos"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground">
        <ChevronLeft className="size-4" /> Préstamos
      </Link>

      <h1 className="mt-4 text-2xl font-semibold">{prestamo.person_name}</h1>
      <p className="mt-0.5 text-sm text-muted-foreground">
        Prestado el {formatearFecha(prestamo.loan_date)}
      </p>

      {/* Resumen */}
      <section className="mt-6 rounded-2xl border p-5">
        <div className="flex items-baseline justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Te debe</p>
            <p className="text-2xl font-semibold tabular-nums">
              {formatearCOP(Number(prestamo.pendiente))}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Prestaste</p>
            <p className="text-sm tabular-nums">
              {formatearCOP(Number(prestamo.principal))}
            </p>
          </div>
        </div>

        <div className="mt-3">
          <BarraProgreso progreso={progreso} />
        </div>

        <div className="mt-2 flex justify-between text-xs text-muted-foreground">
          <span>Pagado {formatearCOP(Number(prestamo.pagado))}</span>
          <span>{progreso}%</span>
        </div>

        {prestamo.status === 'paid' && (
          <p className="mt-3 border-t pt-3 text-sm font-medium text-emerald-600">
            Préstamo saldado
          </p>
        )}
      </section>

      {/* Cuotas */}
      <section className="mt-6">
        <h2 className="mb-2 text-xs font-medium uppercase tracking-wide
                       text-muted-foreground">
          Cuotas
        </h2>
        <div className="divide-y rounded-2xl border">
          {(cuotas ?? []).map((c) => {
            const { Icono, color } = ICONO[c.estado as keyof typeof ICONO]
            const parcial = Number(c.pagado) > 0 && Number(c.pendiente) > 0

            return (
              <div key={c.id} className="flex items-center gap-3 px-4 py-3.5">
                <Icono className={`size-4 shrink-0 ${color}`} />

                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    Cuota {c.number}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {formatearFecha(c.due_date)}
                    </span>
                  </p>
                  {parcial && (
                    <p className="text-xs text-muted-foreground tabular-nums">
                      Pagado {formatearCOP(Number(c.pagado))} · Faltan{' '}
                      {formatearCOP(Number(c.pendiente))}
                    </p>
                  )}
                </div>

                <span className={`shrink-0 text-sm tabular-nums ${
                  c.estado === 'pagada' ? 'text-muted-foreground line-through' : ''
                }`}>
                  {formatearCOP(Number(c.amount))}
                </span>
              </div>
            )
          })}
        </div>
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

      {/* Historial de abonos */}
      {(abonos ?? []).length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wide
                         text-muted-foreground">
            Abonos recibidos
          </h2>
          <div className="divide-y rounded-2xl border">
            {(abonos ?? []).map((a) => (
              <div key={a.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm tabular-nums text-emerald-600">
                    +{formatearCOP(Number(a.amount))}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {formatearFecha(a.occurred_on)}
                    {a.note ? ` · ${a.note}` : ''}
                  </p>
                </div>
                <form action={eliminarAbono}>
                  <input type="hidden" name="id" value={a.id} />
                  <input type="hidden" name="prestamo" value={id} />
                  <button className="shrink-0 text-xs text-destructive underline">
                    Deshacer
                  </button>
                </form>
              </div>
            ))}
          </div>
        </section>
      )}

      {activo && (
        <form action={cancelarPrestamo} className="mt-8">
          <input type="hidden" name="id" value={id} />
          <button className="text-sm text-destructive underline">
            Cancelar préstamo
          </button>
        </form>
      )}
    </main>
  )
}