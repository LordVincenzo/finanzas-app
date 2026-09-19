'use client'

import { PantallaError } from '@/components/pantalla-error'

/**
 * Frontera de error de la vista de escritorio. Se dibuja dentro de su
 * layout, así que el sidebar sigue visible: puedes irte a otra sección
 * sin recargar.
 */
export default function ErrorEscritorio({
  error, reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <PantallaError
      error={error}
      reset={reset}
      volverA="/escritorio"
      volverTexto="Volver a Panorama"
    />
  )
}
