'use client'

import { useState } from 'react'
import { formatearCOP, formatearCOPCompacto } from '@/lib/format'
import { escalaLineal } from '@/lib/graficas'

type Categoria = { etiqueta: string; monto: number }

/**
 * `etiqueta` ya viene formateada por quien llama ("ene", "26"...): esta
 * gráfica no sabe si agrupa por mes o por día, solo dibuja barras.
 *
 * `detalleIngresos`/`detalleGastos` son opcionales: sin ellos el
 * tooltip solo muestra el total (así sigue funcionando la vista de
 * varios meses, donde no tiene sentido desglosar por categoría).
 */
type Punto = {
  etiqueta: string
  ingresos: number
  gastos: number
  detalleIngresos?: Categoria[]
  detalleGastos?: Categoria[]
}

const ANCHO = 760
const MARGEN = { arriba: 22, abajo: 22, izquierda: 8, derecha: 8 }
const MAX_CATEGORIAS_TOOLTIP = 4

type Tooltip = {
  x: number
  y: number
  etiqueta: string
  tipo: string
  valor: number
  detalle?: Categoria[]
}

/** Barras agrupadas: ingresos y gastos, punto a punto (mes o día).
 *  Colores de dinero (verde/rojo), los mismos que el resto de la
 *  app — no un color nuevo inventado para la gráfica.
 *
 *  `alto` es más bajo en widgets compactos (el panorama) que en la
 *  pantalla dedicada de estadísticas — mismo componente, dos tamaños. */
export function GraficaBarrasComparadas({
  datos, alto = 260,
}: {
  datos: Punto[]
  alto?: number
}) {
  const [tooltip, setTooltip] = useState<Tooltip | null>(null)

  const maximo = Math.max(1, ...datos.map((d) => Math.max(d.ingresos, d.gastos))) * 1.15
  const anchoUtil = ANCHO - MARGEN.izquierda - MARGEN.derecha
  const altoUtil = alto - MARGEN.arriba - MARGEN.abajo
  const y0 = alto - MARGEN.abajo

  const anchoGrupo = anchoUtil / datos.length
  const anchoBarra = anchoGrupo * 0.32
  const separacion = anchoGrupo * 0.06

  const lineasY = [0, 0.5, 1].map((f) => ({
    y: y0 - altoUtil * f,
    etiqueta: formatearCOPCompacto(maximo * f),
  }))

  return (
    <div className="relative">
      <div className="mb-3 flex items-center gap-4 text-[12px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-positivo" /> Ingresos
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-negativo" /> Gastos
        </span>
      </div>

      <svg viewBox={`0 0 ${ANCHO} ${alto}`} className="w-full" role="img"
           aria-label="Ingresos y gastos por mes">
        {lineasY.map(({ y, etiqueta }) => (
          <g key={y}>
            <line x1={MARGEN.izquierda} x2={ANCHO - MARGEN.derecha} y1={y} y2={y}
                  stroke="var(--border)" strokeWidth={1} />
            <text x={MARGEN.izquierda} y={y - 4} fontSize={10}
                  fill="var(--muted-foreground)">
              {etiqueta}
            </text>
          </g>
        ))}

        {datos.map((d, i) => {
          const xGrupo = MARGEN.izquierda + i * anchoGrupo
          const xIngreso = xGrupo + anchoGrupo / 2 - separacion / 2 - anchoBarra
          const xGasto = xGrupo + anchoGrupo / 2 + separacion / 2
          const hIngreso = escalaLineal(d.ingresos, [0, maximo], [0, altoUtil])
          const hGasto = escalaLineal(d.gastos, [0, maximo], [0, altoUtil])

          return (
            <g key={d.etiqueta}>
              <rect
                x={xIngreso} y={y0 - hIngreso} width={anchoBarra} height={Math.max(hIngreso, 1)}
                rx={4} className="fill-positivo cursor-pointer"
                onMouseEnter={() => setTooltip({
                  x: xIngreso + anchoBarra / 2, y: y0 - hIngreso,
                  etiqueta: d.etiqueta, tipo: 'Ingresos', valor: d.ingresos,
                  detalle: d.detalleIngresos,
                })}
                onMouseLeave={() => setTooltip(null)}
              />
              <rect
                x={xGasto} y={y0 - hGasto} width={anchoBarra} height={Math.max(hGasto, 1)}
                rx={4} className="fill-negativo cursor-pointer"
                onMouseEnter={() => setTooltip({
                  x: xGasto + anchoBarra / 2, y: y0 - hGasto,
                  etiqueta: d.etiqueta, tipo: 'Gastos', valor: d.gastos,
                  detalle: d.detalleGastos,
                })}
                onMouseLeave={() => setTooltip(null)}
              />
              <text x={xGrupo + anchoGrupo / 2} y={alto - 6} fontSize={11}
                    textAnchor="middle" fill="var(--muted-foreground)">
                {d.etiqueta}
              </text>
            </g>
          )
        })}
      </svg>

      {tooltip && (
        <div
          className="pointer-events-none absolute z-10 min-w-[150px] -translate-x-1/2
                     -translate-y-full rounded-lg bg-foreground px-2.5 py-1.5 text-[12px]
                     text-background shadow-flotante"
          style={{
            left: `${(tooltip.x / ANCHO) * 100}%`,
            top: `${(tooltip.y / alto) * 100}%`,
            marginTop: -6,
          }}
        >
          <p className="flex items-baseline justify-between gap-3 font-medium">
            <span>{tooltip.tipo} · {tooltip.etiqueta}</span>
            <span className="tabular-nums">{formatearCOP(tooltip.valor)}</span>
          </p>

          {/* Sin esto, la barra solo decía "Gastos · 26": la cifra sin
              saber de qué es hace que haya que ir a buscar el
              movimiento aparte para entender qué pasó ese día. */}
          {tooltip.detalle && tooltip.detalle.length > 0 && (
            <ul className="mt-1 space-y-0.5 border-t border-background/20 pt-1">
              {tooltip.detalle.slice(0, MAX_CATEGORIAS_TOOLTIP).map((c) => (
                <li key={c.etiqueta} className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-background/75">{c.etiqueta}</span>
                  <span className="shrink-0 tabular-nums">{formatearCOP(c.monto)}</span>
                </li>
              ))}
              {tooltip.detalle.length > MAX_CATEGORIAS_TOOLTIP && (
                <li className="text-background/60">
                  +{tooltip.detalle.length - MAX_CATEGORIAS_TOOLTIP} más
                </li>
              )}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
