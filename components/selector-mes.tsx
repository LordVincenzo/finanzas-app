'use client'

import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'

/** Suma o resta meses a "2026-08" devolviendo "2026-09". */
function moverMes(mes: string, delta: number): string {
  const [anio, m] = mes.split('-').map(Number)
  const d = new Date(Date.UTC(anio, m - 1 + delta, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

/** "2026-08" -> "agosto 2026" */
function nombreMes(mes: string): string {
  const [anio, m] = mes.split('-').map(Number)
  const texto = new Intl.DateTimeFormat('es-CO', {
    month: 'long', timeZone: 'UTC',
  }).format(new Date(Date.UTC(anio, m - 1, 1)))
  return `${texto} ${anio}`
}

export function SelectorMes({ mes, tipo }: { mes: string; tipo: string }) {
  const sufijo = tipo ? `&tipo=${tipo}` : ''

  return (
    <div className="flex items-center gap-0.5 rounded-full border">
      <Link
        href={`/movimientos?mes=${moverMes(mes, -1)}${sufijo}`}
        aria-label="Mes anterior"
        className="flex size-11 items-center justify-center rounded-full
                   text-muted-foreground transition active:scale-95"
      >
        <ChevronLeft className="size-4" />
      </Link>

      <span className="min-w-[86px] text-center text-[12px] capitalize">
        {nombreMes(mes)}
      </span>

      <Link
        href={`/movimientos?mes=${moverMes(mes, 1)}${sufijo}`}
        aria-label="Mes siguiente"
        className="flex size-11 items-center justify-center rounded-full
                   text-muted-foreground transition active:scale-95"
      >
        <ChevronRight className="size-4" />
      </Link>
    </div>
  )
}