'use client'

import { useState, type ReactNode } from 'react'

/**
 * El detalle de movimientos, y si entra o no en el papel.
 *
 * POR QUÉ. Un mes normal son setenta y pico de movimientos. Impresos uno
 * debajo de otro son cuatro hojas de letra pequeña donde ya nadie busca
 * nada — y el resumen, que es lo que de verdad se lee, queda enterrado en
 * la primera. Quien quiere el detalle lo quiere; quien quiere mandarle el
 * mes a alguien, no.
 *
 * SE APAGA SOLO PARA IMPRIMIR. En pantalla la lista sigue estando: no se
 * esconde información, se decide qué va al PDF. Por eso `print:hidden` y
 * no `hidden`.
 */
export function DetalleEnElPdf({
  titulo, children,
}: {
  titulo: string
  children: ReactNode
}) {
  const [incluir, setIncluir] = useState(true)

  return (
    <section className={incluir ? 'break-before-page' : 'print:hidden'}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.09em]
                       text-muted-foreground">
          {titulo}
        </h2>
        <label className="solo-pantalla -my-2 flex cursor-pointer select-none
                          items-center gap-2 py-2 text-[12px]
                          text-muted-foreground">
          <input
            type="checkbox"
            checked={incluir}
            onChange={(e) => setIncluir(e.target.checked)}
            className="size-4 accent-[var(--primary)]"
          />
          Incluir en el PDF
        </label>
      </div>
      {children}
    </section>
  )
}
