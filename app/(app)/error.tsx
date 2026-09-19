'use client'

import { PantallaError } from '@/components/pantalla-error'

/**
 * Frontera de error de la app de celular. Se dibuja DENTRO del layout de
 * (app), así que la barra de navegación de abajo sigue ahí y no te quedas
 * encerrado en la pantalla del error.
 */
export default function ErrorApp({
  error, reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return <PantallaError error={error} reset={reset} />
}
