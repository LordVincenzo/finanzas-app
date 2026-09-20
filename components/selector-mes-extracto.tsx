'use client'

import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { moverMes, nombreDelMes, mesActualBogota } from '@/lib/format'

/**
 * De qué mes es el extracto.
 *
 * NO DEJA IR AL FUTURO. Un extracto de octubre en septiembre estaría
 * siempre vacío, y una pantalla vacía sin explicación se lee como un
 * fallo. El mes en curso sí se puede ver —a veces uno quiere mirar cómo
 * va— pero el que se ofrece por defecto es el anterior, que es el único
 * que ya no va a cambiar.
 */
export function SelectorMesExtracto({ mes }: { mes: string }) {
  const actual = mesActualBogota()
  const anterior = moverMes(mes, -1)
  const siguiente = moverMes(mes, 1)
  const puedeAvanzar = siguiente <= actual

  return (
    <div className="flex items-center justify-center gap-1 rounded-full border
                    py-0.5">
      <Link
        href={`/extracto?mes=${anterior}`}
        aria-label="Mes anterior"
        className="flex size-11 items-center justify-center rounded-full
                   text-muted-foreground transition active:scale-95"
      >
        <ChevronLeft className="size-4" />
      </Link>

      <span className="min-w-[130px] text-center text-[13px]">
        {nombreDelMes(mes)}
      </span>

      {puedeAvanzar ? (
        <Link
          href={`/extracto?mes=${siguiente}`}
          aria-label="Mes siguiente"
          className="flex size-11 items-center justify-center rounded-full
                     text-muted-foreground transition active:scale-95"
        >
          <ChevronRight className="size-4" />
        </Link>
      ) : (
        /* El hueco se conserva para que el mes no se descoloque al
           llegar al presente. */
        <span className="size-11" aria-hidden />
      )}
    </div>
  )
}
