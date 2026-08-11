import { formatearCOP } from '@/lib/format'

type Categoria = { nombre: string; valor: number }

/**
 * Reparto de los gastos del mes por categoría.
 *
 * Dos lecturas, con pesos distintos a propósito:
 *
 *   La barra de arriba es el TOTAL. Va gruesa y con el acento pleno,
 *   porque responde a "cómo se reparte todo lo que gasté".
 *
 *   Las de cada fila son el detalle. Van finas y atenuadas, porque
 *   responden a "cuánto pesa esta categoría".
 *
 * El porcentaje va escrito junto al monto: la barra da la proporción
 * aproximada, pero no distingue un 51% de un 58%. Y como la barra
 * apilada y las de fila usan escalas distintas —una reparte el ancho
 * entre todas, la otra mide cada una contra el total— la cifra es lo
 * único que relaciona las dos sin ambigüedad.
 *
 * El nombre está pegado a su barra, así que no hace falta una leyenda
 * ni un color por categoría: basta con la intensidad del acento.
 */

/** Opacidades del acento, de la categoría mayor a la menor. */
const INTENSIDAD = ['opacity-100', 'opacity-70', 'opacity-45', 'opacity-30', 'opacity-20']

export function RepartoGastos({
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
    ...categorias.map((c) => ({ nombre: c.nombre, valor: c.valor })),
    ...(resto > 0 ? [{ nombre: 'Otras', valor: resto }] : []),
  ].map((t, i) => ({
    ...t,
    pct: (t.valor * 100) / total,
    intensidad: INTENSIDAD[Math.min(i, INTENSIDAD.length - 1)],
  }))

  return (
    <div className="rounded-2xl bg-card px-4 py-3.5 shadow-card
                    ring-1 ring-border/70">
      {/* Reparto del total. Los segmentos se separan con un hueco de
          3px, no con un borde: sobre la tarjeta blanca un borde se
          vería como una línea más y aquí solo hace falta separar. */}
      <div
        className="flex h-3 gap-[3px] overflow-hidden rounded-full"
        role="img"
        aria-label={`Reparto de ${formatearCOP(total)} en gastos del mes`}
      >
        {trozos.map((t) => (
          <div
            key={t.nombre}
            className={`crece h-full rounded-full bg-primary ${t.intensidad}`}
            style={{
              '--ancho': `${t.pct}%`,
              '--retraso': `${retraso}ms`,
            } as React.CSSProperties}
          />
        ))}
      </div>

      <ul className="mt-3">
        {trozos.map((t, i) => (
          <li key={t.nombre} className="py-1.5">
            <div className="flex items-baseline justify-between gap-2.5">
              <span className="min-w-0 flex-1 truncate text-[14px]">
                {t.nombre}
              </span>
              <span className="shrink-0 text-[12px] text-muted-foreground
                               tabular-nums">
                {Math.round(t.pct)}%
              </span>
              <span className="shrink-0 text-[14px] font-medium tabular-nums">
                {formatearCOP(t.valor)}
              </span>
            </div>
            {/* Fina y atenuada: es el detalle, no el resumen. */}
            <div className="mt-1 h-[3px] overflow-hidden rounded-full
                            bg-muted">
              <div
                className={`crece h-full rounded-full bg-primary
                            ${t.intensidad}`}
                style={{
                  '--ancho': `${t.pct}%`,
                  '--retraso': `${retraso + 80 + i * 70}ms`,
                } as React.CSSProperties}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}