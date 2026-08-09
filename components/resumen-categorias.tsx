import { formatearCOP } from '@/lib/format'

export type GastoCategoria = { nombre: string; total: number }

export function ResumenCategorias({
  categorias,
  totalGastos,
}: {
  categorias: GastoCategoria[]
  totalGastos: number
}) {
  if (categorias.length === 0) return null

  return (
    <section className="mt-4 rounded-2xl border p-5">
      <p className="text-sm font-medium">En qué gastaste</p>

      <ul className="mt-4 space-y-3.5">
        {categorias.map((c) => {
          const porcentaje = totalGastos > 0
            ? Math.round((c.total / totalGastos) * 100)
            : 0

          return (
            <li key={c.nombre}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate text-sm">{c.nombre}</span>
                <span className="shrink-0 text-sm tabular-nums">
                  {formatearCOP(c.total)}
                </span>
              </div>

              {/* Barra de proporción: comunica el peso relativo sin
                  necesidad de una librería de gráficos. */}
              <div className="mt-1.5 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-foreground"
                    style={{ width: `${porcentaje}%` }}
                  />
                </div>
                <span className="w-8 shrink-0 text-right text-xs
                                 tabular-nums text-muted-foreground">
                  {porcentaje}%
                </span>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}