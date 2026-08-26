'use client'

import { useState } from 'react'
import { formatearCOP, formatearCOPCompacto, etiquetaMesCorta } from '@/lib/format'
import { escalaLineal } from '@/lib/graficas'

type Punto = { mes: string; ingresos: number; gastos: number }

const ANCHO = 760
const ALTO = 260
const MARGEN = { arriba: 28, abajo: 28, izquierda: 8, derecha: 8 }

type Tooltip = { x: number; y: number; mes: string; tipo: string; valor: number }

/** Barras agrupadas: ingresos y gastos, mes a mes. Colores de dinero
 *  (verde/rojo), los mismos que el resto de la app — no un color
 *  nuevo inventado para la gráfica. */
export function GraficaBarrasComparadas({ datos }: { datos: Punto[] }) {
  const [tooltip, setTooltip] = useState<Tooltip | null>(null)

  const maximo = Math.max(1, ...datos.map((d) => Math.max(d.ingresos, d.gastos))) * 1.15
  const anchoUtil = ANCHO - MARGEN.izquierda - MARGEN.derecha
  const altoUtil = ALTO - MARGEN.arriba - MARGEN.abajo
  const y0 = ALTO - MARGEN.abajo

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

      <svg viewBox={`0 0 ${ANCHO} ${ALTO}`} className="w-full" role="img"
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
            <g key={d.mes}>
              <rect
                x={xIngreso} y={y0 - hIngreso} width={anchoBarra} height={Math.max(hIngreso, 1)}
                rx={4} className="fill-positivo cursor-pointer"
                onMouseEnter={() => setTooltip({
                  x: xIngreso + anchoBarra / 2, y: y0 - hIngreso,
                  mes: d.mes, tipo: 'Ingresos', valor: d.ingresos,
                })}
                onMouseLeave={() => setTooltip(null)}
              />
              <rect
                x={xGasto} y={y0 - hGasto} width={anchoBarra} height={Math.max(hGasto, 1)}
                rx={4} className="fill-negativo cursor-pointer"
                onMouseEnter={() => setTooltip({
                  x: xGasto + anchoBarra / 2, y: y0 - hGasto,
                  mes: d.mes, tipo: 'Gastos', valor: d.gastos,
                })}
                onMouseLeave={() => setTooltip(null)}
              />
              <text x={xGrupo + anchoGrupo / 2} y={ALTO - 8} fontSize={11}
                    textAnchor="middle" fill="var(--muted-foreground)">
                {etiquetaMesCorta(d.mes)}
              </text>
            </g>
          )
        })}
      </svg>

      {tooltip && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full
                     rounded-lg bg-foreground px-2.5 py-1.5 text-[12px]
                     text-background shadow-flotante"
          style={{
            left: `${(tooltip.x / ANCHO) * 100}%`,
            top: `${(tooltip.y / ALTO) * 100}%`,
            marginTop: -6,
          }}
        >
          <p className="font-medium">{tooltip.tipo} · {etiquetaMesCorta(tooltip.mes)}</p>
          <p className="tabular-nums">{formatearCOP(tooltip.valor)}</p>
        </div>
      )}
    </div>
  )
}
