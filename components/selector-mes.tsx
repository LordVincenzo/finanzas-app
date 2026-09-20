'use client'

import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { moverMes, nombreDelMes } from '@/lib/format'

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

      <span className="min-w-[86px] text-center text-[12px]">
        {nombreDelMes(mes)}
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