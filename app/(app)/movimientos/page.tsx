import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { formatearFecha } from '@/lib/format'
import { FilaMovimiento, type Movimiento } from '@/components/fila-movimiento'
import { Seccion, Lista } from '@/components/seccion'
import { SelectorMes } from '@/components/selector-mes'

const FILTROS = [
  { valor: '',           etiqueta: 'Todos' },
  { valor: 'expense',    etiqueta: 'Gastos' },
  { valor: 'income',     etiqueta: 'Ingresos' },
  { valor: 'transfer',   etiqueta: 'Traslados' },
  { valor: 'adjustment', etiqueta: 'Ajustes' },
]

function mesActual(): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Bogota', year: 'numeric', month: '2-digit',
  }).format(new Date()).slice(0, 7)
}

export default async function MovimientosPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string; mes?: string }>
}) {
  const { tipo = '', mes = mesActual() } = await searchParams
  const supabase = await createClient()

  const desde = `${mes}-01`
  const [anio, m] = mes.split('-').map(Number)
  const hasta = new Date(Date.UTC(anio, m, 0)).toISOString().slice(0, 10)

  let consulta = supabase
    .from('movimientos_detalle')
    // monto_total es el dinero que se movió; monto es lo que de verdad
    // gastaste. Solo difieren en un gasto compartido, donde parte del
    // pago no es tuyo sino algo que te deben.
    .select('id, type, description, occurred_at, occurred_on, monto, monto_total, cuenta_origen, cuenta_destino, clase_origen, clase_destino')
    .gte('occurred_on', desde).lte('occurred_on', hasta)
    .order('occurred_at', { ascending: false })

  if (tipo) consulta = consulta.eq('type', tipo)

  const { data } = await consulta
  const movimientos = (data ?? []) as (Movimiento & { occurred_on: string })[]

  const porDia = new Map<string, typeof movimientos>()
  for (const mov of movimientos) {
    const lista = porDia.get(mov.occurred_on) ?? []
    lista.push(mov)
    porDia.set(mov.occurred_on, lista)
  }

  return (
    <main className="px-4 pt-4 pb-[calc(8rem+env(safe-area-inset-bottom))]">
      <div className="aparece flex items-center justify-between gap-3 px-1">
        <h1 className="text-[22px] font-semibold tracking-tight">Movimientos</h1>
        <SelectorMes mes={mes} tipo={tipo} />
      </div>

      {/* Filtros: chips que caben en una sola línea deslizable */}
      <div className="aparece -mx-4 mt-3 flex gap-1.5 overflow-x-auto px-4 pb-1"
           style={{ '--retraso': '60ms' } as React.CSSProperties}>
        {FILTROS.map((f) => (
          <Link
            key={f.valor}
            href={`/movimientos?mes=${mes}${f.valor ? `&tipo=${f.valor}` : ''}`}
            className={`flex h-9 shrink-0 items-center rounded-full px-3.5
                        text-[13px] font-medium transition ${
              tipo === f.valor
                ? 'bg-primary text-primary-foreground shadow-card'
                : 'bg-card text-muted-foreground ring-1 ring-border/70'
            }`}
          >
            {f.etiqueta}
          </Link>
        ))}
      </div>

      {movimientos.length === 0 ? (
        <div className="aparece mt-8 rounded-2xl border border-dashed
                        border-border px-5 py-7 text-center"
             style={{ '--retraso': '120ms' } as React.CSSProperties}>
          <p className="text-[15px] font-medium">
            No hay movimientos en este periodo
          </p>
          <p className="mx-auto mt-1.5 max-w-[28ch] text-[13px] leading-snug
                        text-muted-foreground">
            Prueba con otro mes o registra el primero.
          </p>
          <Link href="/movimientos/nuevo"
                className="mt-4 inline-flex min-h-11 items-center rounded-xl
                           bg-primary px-5 text-[14px] font-medium
                           text-primary-foreground shadow-card">
            Registrar uno
          </Link>
        </div>
      ) : (
        [...porDia.entries()].map(([dia, lista], i) => (
          <Seccion key={dia} titulo={formatearFecha(dia)}>
            <div className="aparece"
                 style={{ '--retraso': `${120 + i * 60}ms` } as React.CSSProperties}>
              <Lista>
                {lista.map((mov) => (
                  <FilaMovimiento key={mov.id} mov={mov} />
                ))}
              </Lista>
            </div>
          </Seccion>
        ))
      )}
    </main>
  )
}