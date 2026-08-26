'use client'

import { useRef, useState } from 'react'
import { formatearCOP, formatearCOPCompacto, etiquetaMesCorta } from '@/lib/format'
import { escalaLineal } from '@/lib/graficas'

type Punto = { mes: string; patrimonio: number }

const ANCHO = 760
const ALTO = 260
const MARGEN = { arriba: 20, abajo: 28, izquierda: 8, derecha: 8 }

/** Una sola serie: el patrimonio no necesita leyenda, el título de la
 *  sección ya dice qué es. Color de marca (--primary), no uno de los
 *  colores de dinero: esto no es "entra" ni "sale", es un total. */
export function GraficaPatrimonio({ datos }: { datos: Punto[] }) {
  const [activo, setActivo] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const valores = datos.map((d) => d.patrimonio)
  const minimo = Math.min(0, ...valores)
  const maximo = Math.max(1, ...valores) * 1.1
  const anchoUtil = ANCHO - MARGEN.izquierda - MARGEN.derecha
  const altoUtil = ALTO - MARGEN.arriba - MARGEN.abajo
  const y0 = ALTO - MARGEN.abajo

  const x = (i: number) => MARGEN.izquierda +
    (datos.length === 1 ? anchoUtil / 2 : (i / (datos.length - 1)) * anchoUtil)
  const y = (v: number) => y0 - escalaLineal(v, [minimo, maximo], [0, altoUtil])

  const puntos = datos.map((d, i) => `${x(i)},${y(d.patrimonio)}`).join(' ')
  const area = `${MARGEN.izquierda},${y0} ${puntos} ${ANCHO - MARGEN.derecha},${y0}`

  const lineasY = [0, 0.5, 1].map((f) => ({
    y: y0 - altoUtil * f,
    etiqueta: formatearCOPCompacto(minimo + (maximo - minimo) * f),
  }))

  function alMoverMouse(e: React.MouseEvent<SVGSVGElement>) {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect || datos.length < 2) return
    const xRelativa = ((e.clientX - rect.left) / rect.width) * ANCHO
    const paso = anchoUtil / (datos.length - 1)
    const indice = Math.round((xRelativa - MARGEN.izquierda) / paso)
    setActivo(Math.min(datos.length - 1, Math.max(0, indice)))
  }

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${ANCHO} ${ALTO}`} className="w-full" role="img"
        aria-label="Evolución del patrimonio por mes"
        onMouseMove={alMoverMouse}
        onMouseLeave={() => setActivo(null)}
      >
        {lineasY.map(({ y: ly, etiqueta }) => (
          <g key={ly}>
            <line x1={MARGEN.izquierda} x2={ANCHO - MARGEN.derecha} y1={ly} y2={ly}
                  stroke="var(--border)" strokeWidth={1} />
            <text x={MARGEN.izquierda} y={ly - 4} fontSize={10}
                  fill="var(--muted-foreground)">
              {etiqueta}
            </text>
          </g>
        ))}

        <polygon points={area} className="fill-primary/10" />
        <polyline points={puntos} fill="none" className="stroke-primary"
                   strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        {datos.map((d, i) => (
          <text key={d.mes} x={x(i)} y={ALTO - 8} fontSize={11}
                textAnchor="middle" fill="var(--muted-foreground)">
            {etiquetaMesCorta(d.mes)}
          </text>
        ))}

        {activo !== null && (
          <>
            <line x1={x(activo)} x2={x(activo)} y1={MARGEN.arriba} y2={y0}
                  stroke="var(--border)" strokeWidth={1} strokeDasharray="3 3" />
            <circle cx={x(activo)} cy={y(datos[activo].patrimonio)} r={4}
                    className="fill-primary" stroke="var(--card)" strokeWidth={2} />
          </>
        )}
      </svg>

      {activo !== null && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full
                     rounded-lg bg-foreground px-2.5 py-1.5 text-[12px]
                     text-background shadow-flotante"
          style={{
            left: `${(x(activo) / ANCHO) * 100}%`,
            top: `${(y(datos[activo].patrimonio) / ALTO) * 100}%`,
            marginTop: -8,
          }}
        >
          <p className="font-medium">{etiquetaMesCorta(datos[activo].mes)}</p>
          <p className="tabular-nums">{formatearCOP(datos[activo].patrimonio)}</p>
        </div>
      )}
    </div>
  )
}
