'use client'

import { PantallaError } from '@/components/pantalla-error'

/**
 * Red de último recurso, para lo que queda fuera de (app) y de
 * escritorio: login, registro, recuperar contraseña.
 */
export default function ErrorRaiz({
  error, reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <PantallaError
      error={error}
      reset={reset}
      volverA="/login"
      volverTexto="Ir a iniciar sesión"
    />
  )
}
