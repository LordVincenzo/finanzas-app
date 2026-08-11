import { formatearCOP } from '@/lib/format'

type Categoria = { nombre: string; valor: number }

/**
 * Reparto de los gastos del mes por categoría.
 *
 * Los colores son gradaciones del mismo índigo (--chart-1 a --chart-5),
 * no un color por categoría. Dos razones: cualquier verde o rojo
 * chocaría con el significado que ya tienen en esta app, y con una sola
 * familia el orden se lee por intensidad sin tener que consultar la
 * leyenda.
 *
 * El SVG usa r = 15.9155 porque su circunferencia es exactamente 100.
 * Así cada stroke-dasharray se escribe directamente en porcentaje, sin
 * multiplicar por 2πr en cada segmento.
 */
const COLORES = [
  'stroke-chart-1', 'stroke-chart-2', 'stroke-chart-3',
  'stroke-chart-4', 'stroke-chart-5',
]

const PUNTOS = [
  'bg-chart-1', 'bg-chart-2', 'bg-chart-3', 'bg-chart-4', 'bg-chart-5',
]

export function DonaCategorias({
  categorias, total, retraso = 0,
}: {
  categorias: Categoria[]
  /** Gasto total del mes, incluyendo lo que no cabe en la lista. */
  total: number
  retraso?: number
}) {
  if (categorias.length === 0 || total <= 0) return null

  const enLista = categorias.reduce((s, c) => s + c.valor, 0)
  const resto = total - enLista

  const trozos = [
    ...categorias.map((c) => ({
      nombre: c.nombre,
      valor: c.valor,
      pct: (c.valor * 100) / total,
    })),
    ...(resto > 0
      ? [{ nombre: 'Otras', valor: resto, pct: (resto * 100) / total }]
      : []),
  ]

  let acumulado = 0

  return (
    <div className="flex items-center gap-4 rounded-2xl bg-card px-4 py-3.5
                    shadow-card ring-1 ring-border/70">
      <svg
        viewBox="0 0 42 42"
        className="dona-entra size-[92px] shrink-0 -rotate-90"
        style={{ '--retraso': `${retraso}ms` } as React.CSSProperties}
        role="img"
        aria-label={`Reparto de ${formatearCOP(total)} en gastos del mes`}
      >
        <circle
          cx="21" cy="21" r="15.9155"
          fill="none"
          className="stroke-muted"
          strokeWidth="5.2"
        />
        {trozos.map((t, i) => {
          const offset = -acumulado
          acumulado += t.pct
          return (
            <circle
              key={t.nombre}
              cx="21" cy="21" r="15.9155"
              fill="none"
              className={COLORES[i % COLORES.length]}
              strokeWidth="5.2"
              strokeDasharray={`${t.pct} ${100 - t.pct}`}
              strokeDashoffset={offset}
            />
          )
        })}
      </svg>

      <ul className="min-w-0 flex-1 space-y-2">
        {trozos.map((t, i) => (
          <li key={t.nombre} className="flex items-center gap-2.5">
            <span
              aria-hidden
              className={`size-2 shrink-0 rounded-full
                          ${PUNTOS[i % PUNTOS.length]}`}
            />
            <span className="min-w-0 flex-1 truncate text-[13px]">
              {t.nombre}
            </span>
            <span className="shrink-0 text-[13px] font-medium tabular-nums">
              {formatearCOP(t.valor)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}