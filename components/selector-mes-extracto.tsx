'use client'

import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { moverMes, nombreDelMes, mesActualBogota } from '@/lib/format'
import { rutaDe, type Origen } from '@/lib/interfaz'

/**
 * De qué mes es el extracto.
 *
 * NO DEJA IR AL FUTURO. Un extracto de octubre en septiembre estaría
 * siempre vacío, y una pantalla vacía sin explicación se lee como un
 * fallo. El mes en curso sí se puede ver —a veces uno quiere mirar cómo
 * va— pero el que se ofrece por defecto es el anterior, que es el único
 * que ya no va a cambiar.
 *
 * LA RUTA SALE DE `rutaDe`, NO DE UNA CADENA FIJA. Enlazaba siempre a
 * /extracto, que es la ruta del celular: desde el escritorio, cambiar de
 * mes te sacaba al layout de teléfono en un monitor de 1400px. Es justo
 * lo que CLAUDE.md prohíbe, y pasó por escribir la ruta a mano en vez de
 * preguntársela a la tabla.
 */
export function SelectorMesExtracto({
  mes, origen = 'celular',
}: {
  mes: string
  origen?: Origen
}) {
  const base = rutaDe(origen, 'extracto')
  const actual = mesActualBogota()
  const anterior = moverMes(mes, -1)
  const siguiente = moverMes(mes, 1)
  const puedeAvanzar = siguiente <= actual

  return (
    <div className="flex items-center justify-center gap-1 rounded-full border
                    py-0.5">
      <Link
        href={`${base}?mes=${anterior}`}
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
          href={`${base}?mes=${siguiente}`}
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
