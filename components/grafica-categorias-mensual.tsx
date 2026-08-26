'use client'

import { useState } from 'react'
import { formatearCOP, formatearCOPCompacto, etiquetaMesCorta } from '@/lib/format'
import { escalaLineal } from '@/lib/graficas'

type Punto = { mes: string; categorias: { nombre: string; monto: number }[] }

const ANCHO = 760
const ALTO = 280
const MARGEN = { arriba: 16, abajo: 28, izquierda: 8, derecha: 8 }
const HUECO = 2 // separación entre segmentos apilados, y entre barras

// chart-1..5 en orden fijo: la categoría con más gasto total siempre
// cae en el mismo puesto del orden, no un color por ranking que
// cambiaría de mes a mes. "Otras" es gris a propósito: no es una
// categoría real, es "todo lo demás".
const COLORES = ['fill-chart-1', 'fill-chart-2', 'fill-chart-3', 'fill-chart-4', 'fill-chart-5']
const COLOR_OTRAS = 'fill-muted-foreground/25'

type Tooltip = { x: number; y: number; mes: string; nombre: string; valor: number }

export function GraficaCategoriasMensual({
  datos, nombresCategorias,
}: {
  datos: Punto[]
  nombresCategorias: string[]
}) {
  const [tooltip, setTooltip] = useState<Tooltip | null>(null)

  const totalesPorMes = datos.map((d) => d.categorias.reduce((s, c) => s + c.monto, 0))
  const maximo = Math.max(1, ...totalesPorMes) * 1.1

  const anchoUtil = ANCHO - MARGEN.izquierda - MARGEN.derecha
  const altoUtil = ALTO - MARGEN.arriba - MARGEN.abajo
  const y0 = ALTO - MARGEN.abajo

  const anchoGrupo = anchoUtil / datos.length
  const anchoBarra = anchoGrupo * 0.55

  const lineasY = [0, 0.5, 1].map((f) => ({
    y: y0 - altoUtil * f,
    etiqueta: formatearCOPCompacto(maximo * f),
  }))

  return (
    <div className="relative">
      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[12px] text-muted-foreground">
        {nombresCategorias.map((nombre, i) => (
          <span key={nombre} className="flex items-center gap-1.5">
            <span className={`size-2 rounded-full ${
              nombre === 'Otras' ? 'bg-muted-foreground/25' : COLORES[i % COLORES.length]
            }`} />
            {nombre}
          </span>
        ))}
      </div>

      <svg viewBox={`0 0 ${ANCHO} ${ALTO}`} className="w-full" role="img"
           aria-label="Gasto por categoría, mes a mes">
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
          const xBarra = MARGEN.izquierda + i * anchoGrupo + (anchoGrupo - anchoBarra) / 2
          let yAcumulado = y0

          return (
            <g key={d.mes}>
              {nombresCategorias.map((nombre, j) => {
                const monto = d.categorias.find((c) => c.nombre === nombre)?.monto ?? 0
                if (monto <= 0) return null
                const alto = Math.max(
                  escalaLineal(monto, [0, maximo], [0, altoUtil]) - HUECO, 0,
                )
                const yBarra = yAcumulado - alto - HUECO
                yAcumulado = yBarra
                return (
                  <rect
                    key={nombre}
                    x={xBarra} y={yBarra} width={anchoBarra} height={alto}
                    rx={2}
                    className={`cursor-pointer ${
                      nombre === 'Otras' ? COLOR_OTRAS : COLORES[j % COLORES.length]
                    }`}
                    onMouseEnter={() => setTooltip({
                      x: xBarra + anchoBarra / 2, y: yBarra,
                      mes: d.mes, nombre, valor: monto,
                    })}
                    onMouseLeave={() => setTooltip(null)}
                  />
                )
              })}
              <text x={xBarra + anchoBarra / 2} y={ALTO - 8} fontSize={11}
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
          <p className="font-medium">{tooltip.nombre} · {etiquetaMesCorta(tooltip.mes)}</p>
          <p className="tabular-nums">{formatearCOP(tooltip.valor)}</p>
        </div>
      )}
    </div>
  )
}
