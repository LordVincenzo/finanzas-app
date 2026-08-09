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
    .select('id, type, description, occurred_at, occurred_on, monto, cuenta_origen, cuenta_destino, clase_origen, clase_destino')
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
    <main className="px-4 pt-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Movimientos</h1>
        <SelectorMes mes={mes} tipo={tipo} />
      </div>

      {/* Filtros: chips que caben en una sola línea deslizable */}
      <div className="-mx-4 mt-3 flex gap-1.5 overflow-x-auto px-4 pb-1">
        {FILTROS.map((f) => (
          <Link
            key={f.valor}
            href={`/movimientos?mes=${mes}${f.valor ? `&tipo=${f.valor}` : ''}`}
            className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] transition ${
              tipo === f.valor
                ? 'bg-foreground text-background'
                : 'border text-muted-foreground'
            }`}
          >
            {f.etiqueta}
          </Link>
        ))}
      </div>

      {movimientos.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed p-6 text-center">
          <p className="text-[13px] text-muted-foreground">
            No hay movimientos en este periodo.
          </p>
          <Link href="/movimientos/nuevo"
                className="mt-3 inline-block rounded-lg bg-foreground px-3 py-1.5
                           text-[13px] font-medium text-background">
            Registrar uno
          </Link>
        </div>
      ) : (
        [...porDia.entries()].map(([dia, lista]) => (
          <Seccion key={dia} titulo={formatearFecha(dia)}>
            <Lista>
              {lista.map((mov) => (
                <FilaMovimiento key={mov.id} mov={mov} />
              ))}
            </Lista>
          </Seccion>
        ))
      )}
    </main>
  )
}