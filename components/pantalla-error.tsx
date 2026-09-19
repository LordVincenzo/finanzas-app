'use client'

import Link from 'next/link'
import { AlertCircle } from 'lucide-react'

/**
 * Lo que se ve cuando algo se rompe de verdad.
 *
 * No había ninguna pantalla así en el proyecto, así que cualquier error
 * no controlado enseñaba la pantalla por defecto de Next: útil para
 * quien programa, inútil para quien usa la app.
 *
 * Tres cosas, en este orden de importancia:
 *   1. Que tus datos están intactos. Es lo primero que uno piensa en una
 *      app de dinero, y en este caso es verdad por diseño: los saldos se
 *      derivan del ledger, y un error al PINTAR una pantalla no escribe
 *      nada. Decirlo evita el susto.
 *   2. Un botón para reintentar. `reset()` vuelve a renderizar el tramo
 *      que falló, sin recargar la página entera.
 *   3. Una salida, para no quedarse encerrado.
 *
 * SOBRE EL MENSAJE. En desarrollo llega entero. En producción Next lo
 * sustituye por un identificador (`digest`) a propósito, para no filtrar
 * detalles del servidor en la pantalla. Por eso se muestra lo que haya:
 * el mensaje si existe, y si no, el identificador, que es lo que sirve
 * para buscarlo en los registros.
 */
export function PantallaError({
  error, reset, volverA = '/inicio', volverTexto = 'Volver a Inicio',
}: {
  error: Error & { digest?: string }
  reset: () => void
  volverA?: string
  volverTexto?: string
}) {
  const detalle = error.message?.trim() || null

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-5 py-16
                    text-center">
      <span className="flex size-12 items-center justify-center rounded-full
                       bg-muted">
        <AlertCircle className="size-5 text-muted-foreground" />
      </span>

      <h1 className="mt-4 text-[18px] font-semibold tracking-tight">
        Algo salió mal
      </h1>

      <p className="mt-2 text-[14px] leading-snug text-muted-foreground">
        Tus datos están a salvo: esto falló al mostrar la pantalla, no al
        guardar nada.
      </p>

      {detalle && (
        <p className="mt-4 w-full rounded-xl bg-muted px-4 py-3 text-left
                      text-[12px] leading-snug text-muted-foreground">
          {detalle}
        </p>
      )}

      {!detalle && error.digest && (
        <p className="mt-4 text-[12px] text-muted-foreground tabular-nums">
          Referencia: {error.digest}
        </p>
      )}

      <div className="mt-6 flex w-full flex-col gap-2">
        <button
          type="button"
          onClick={reset}
          className="min-h-12 w-full rounded-xl bg-primary text-[15px]
                     font-medium text-primary-foreground shadow-card
                     transition active:scale-[0.99]"
        >
          Intentar de nuevo
        </button>
        <Link
          href={volverA}
          className="flex min-h-12 w-full items-center justify-center
                     rounded-xl border border-border text-[15px]"
        >
          {volverTexto}
        </Link>
      </div>
    </div>
  )
}
