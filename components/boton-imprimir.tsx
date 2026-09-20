'use client'

import { Printer } from 'lucide-react'

/**
 * Imprimir el extracto, o guardarlo como PDF.
 *
 * POR QUÉ NO HAY LIBRERÍA DE PDF. El diálogo del navegador ya trae
 * "Guardar como PDF" y produce el mismo archivo. Meter 300 KB de
 * dependencia en una app que maneja dinero, para replicar algo que el
 * sistema hace, es cambiar una descarga por una cosa más que auditar y
 * que se desactualiza.
 *
 * Lo que sí hace falta es que la página esté preparada para el papel:
 * de eso se encarga `solo-pantalla` y la regla @media print.
 */
export function BotonImprimir() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="mt-3 flex min-h-11 w-full items-center justify-center gap-2
                 rounded-xl bg-primary text-[14px] font-medium
                 text-primary-foreground shadow-card transition
                 active:scale-[0.99]"
    >
      <Printer className="size-4" />
      Guardar como PDF o imprimir
    </button>
  )
}
