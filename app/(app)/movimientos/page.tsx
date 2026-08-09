import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { formatearCOP, formatearFecha } from '@/lib/format'
import { FilaMovimiento, type Movimiento } from '@/components/fila-movimiento'

const FILTROS = [
  { valor: '',           etiqueta: 'Todos' },
  { valor: 'expense',    etiqueta: 'Gastos' },
  { valor: 'income',     etiqueta: 'Ingresos' },
  { valor: 'transfer',   etiqueta: 'Transferencias' },
  { valor: 'adjustment', etiqueta: 'Ajustes' },
]

/** Mes actual en Bogotá, formato "2026-08". */
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

  // Rango del mes. Comparamos contra occurred_on (día contable en
  // Bogotá), no contra occurred_at, para que agosto sea agosto.
  const desde = `${mes}-01`
  const [anio, m] = mes.split('-').map(Number)
  const hasta = new Date(Date.UTC(anio, m, 0)).toISOString().slice(0, 10)

  let consulta = supabase
    .from('movimientos_detalle')
    .select('id, type, description, occurred_at, occurred_on, monto, cuenta_origen, cuenta_destino, clase_origen, clase_destino')
    .gte('occurred_on', desde)
    .lte('occurred_on', hasta)
    .order('occurred_at', { ascending: false })

  if (tipo) consulta = consulta.eq('type', tipo)

  const { data } = await consulta
  const movimientos = (data ?? []) as (Movimiento & { occurred_on: string })[]

  // Agrupamos por día
  const porDia = new Map<string, typeof movimientos>()
  for (const mov of movimientos) {
    const lista = porDia.get(mov.occurred_on) ?? []
    lista.push(mov)
    porDia.set(mov.occurred_on, lista)
  }

  return (
    <main className="px-5 pt-8">
      <h1 className="text-2xl font-semibold">Movimientos</h1>

      {/* Filtros por tipo */}
      <div className="-mx-5 mt-4 flex gap-2 overflow-x-auto px-5 pb-1">
        {FILTROS.map((f) => (
          <Link
            key={f.valor}
            href={`/movimientos?mes=${mes}${f.valor ? `&tipo=${f.valor}` : ''}`}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs transition ${
              tipo === f.valor
                ? 'bg-foreground text-background'
                : 'text-muted-foreground'
            }`}
          >
            {f.etiqueta}
          </Link>
        ))}
      </div>

      {/* Selector de mes */}
      <form className="mt-3">
        {tipo && <input type="hidden" name="tipo" value={tipo} />}
        <input
          type="month" name="mes" defaultValue={mes}
          className="rounded-lg border bg-transparent px-3 py-1.5 text-xs"
        />
        <button
          type="submit"
          className="ml-2 rounded-lg border px-3 py-1.5 text-xs"
        >
          Ver
        </button>
      </form>

      {movimientos.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No hay movimientos en este periodo.
          </p>
          <Link
            href="/movimientos/nuevo"
            className="mt-4 inline-block rounded-lg bg-foreground px-4 py-2
                       text-sm font-medium text-background"
          >
            Registrar uno
          </Link>
        </div>
      ) : (
        <div className="mt-6 space-y-5">
          {[...porDia.entries()].map(([dia, lista]) => (
            <section key={dia}>
              <h2 className="mb-2 text-xs font-medium uppercase tracking-wide
                             text-muted-foreground">
                {formatearFecha(dia)}
              </h2>
              <div className="divide-y rounded-2xl border">
                {lista.map((mov) => (
                  <FilaMovimiento key={mov.id} mov={mov} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  )
}