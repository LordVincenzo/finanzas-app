import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft, Check, AlertCircle, Clock } from 'lucide-react'
import { createClient, requerirUsuario } from '@/lib/supabase/server'
import { formatearCOP, formatearFecha } from '@/lib/format'
import { BarraProgreso } from '@/components/barra-progreso'
import { FormularioAbono } from '@/components/formulario-abono'
import { BotonAccion } from '@/components/boton-accion'
import { Seccion, Lista } from '@/components/seccion'
import { eliminarAbono, eliminarPrestamo } from '../actions'

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

export default async function DetallePrestamoPage({
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
    <main className="px-4 pt-6">
      <Link href="/prestamos"
            className="inline-flex items-center gap-1 text-[13px]
                       text-muted-foreground">
        <ChevronLeft className="size-4" /> Préstamos
      </Link>

      <h1 className="mt-3 text-xl font-semibold">{prestamo.person_name}</h1>
      <p className="mt-0.5 text-[13px] text-muted-foreground">
        Prestado el {formatearFecha(prestamo.loan_date)}
      </p>

      {/* Resumen */}
      <section className="mt-5 rounded-xl border p-4">
        <div className="flex items-baseline justify-between">
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

        <div className="mt-3">
          <BarraProgreso progreso={progreso} />
        </div>

        <div className="mt-2 flex justify-between text-[12px] text-muted-foreground">
          <span>Pagado {formatearCOP(Number(prestamo.pagado))}</span>
          <span>{progreso}%</span>
        </div>

        {prestamo.status === 'paid' && (
          <p className="mt-3 border-t pt-3 text-[13px] font-medium text-positivo">
            Préstamo saldado
          </p>
        )}
      </section>

      {/* Cuotas */}
      <Seccion titulo="Cuotas">
        <Lista>
          {(cuotas ?? []).map((c) => {
            const { Icono, color } = ICONO[c.estado as keyof typeof ICONO]
            const parcial = Number(c.pagado) > 0 && Number(c.pendiente) > 0

            return (
              <div key={c.id} className="flex items-center gap-3 px-4 py-3">
                <Icono className={`size-4 shrink-0 ${color}`} />

                <div className="min-w-0 flex-1">
                  <p className="text-[15px] leading-tight">
                    Cuota {c.number}
                    <span className="ml-2 text-[12px] text-muted-foreground">
                      {formatearFecha(c.due_date)}
                    </span>
                  </p>
                  {parcial && (
                    <p className="mt-0.5 text-[12px] text-muted-foreground
                                  tabular-nums">
                      Pagado {formatearCOP(Number(c.pagado))} · Faltan{' '}
                      {formatearCOP(Number(c.pendiente))}
                    </p>
                  )}
                </div>

                <span className={`shrink-0 text-[15px] tabular-nums ${
                  c.estado === 'pagada'
                    ? 'text-muted-foreground line-through' : ''
                }`}>
                  {formatearCOP(Number(c.amount))}
                </span>
              </div>
            )
          })}
        </Lista>
      </Seccion>

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
        <Seccion titulo="Abonos recibidos">
          <Lista>
            {(abonos ?? []).map((a) => (
              <div key={a.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] leading-tight tabular-nums
                                text-positivo">
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
                  className="text-[12px] text-destructive underline
                             disabled:opacity-50"
                >
                  Deshacer
                </BotonAccion>
              </div>
            ))}
          </Lista>
        </Seccion>
      )}

      {/* Siempre disponible: un préstamo mal registrado debe poder borrarse */}
      <BotonAccion
        accion={eliminarPrestamo}
        campos={{ id }}
        textoEnviando="Eliminando…"
        claseFormulario="mt-8"
        className="text-[13px] text-destructive underline disabled:opacity-50"
      >
        Eliminar préstamo
      </BotonAccion>
    </main>
  )
}