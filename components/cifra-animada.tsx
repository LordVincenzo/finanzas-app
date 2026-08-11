'use client'

import { useEffect, useRef, useState } from 'react'
import { formatearCOP } from '@/lib/format'

/**
 * Una cifra de dinero que cuenta desde cero al aparecer.
 *
 * El valor final se renderiza en el servidor y solo después empieza la
 * animación. Si el JavaScript no llega a ejecutarse, se ve el número
 * correcto igualmente: nunca se queda en cero.
 *
 * Cuenta en pesos enteros, sin decimales, porque el dinero de esta app
 * es BIGINT. Interpolar con decimales haría parpadear cifras que no
 * existen.
 */
export function CifraAnimada({
  valor, duracion = 700, className = '',
}: {
  valor: number
  duracion?: number
  className?: string
}) {
  const [actual, setActual] = useState(valor)
  const yaCorrio = useRef(false)

  useEffect(() => {
    // Solo la primera vez: si el componente se vuelve a renderizar por
    // otro motivo, la cifra no debe saltar otra vez a cero.
    if (yaCorrio.current) {
      setActual(valor)
      return
    }
    yaCorrio.current = true

    const reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reducido || valor === 0) {
      setActual(valor)
      return
    }

    let frame = 0
    const inicio = performance.now()

    function paso(ahora: number) {
      const t = Math.min(1, (ahora - inicio) / duracion)
      // Desacelera al final: arranca rápido y se posa suave.
      const suave = 1 - Math.pow(1 - t, 3)
      setActual(Math.round(valor * suave))
      if (t < 1) frame = requestAnimationFrame(paso)
    }

    frame = requestAnimationFrame(paso)
    return () => cancelAnimationFrame(frame)
  }, [valor, duracion])

  return (
    <span className={`tabular-nums ${className}`}>
      {formatearCOP(actual)}
    </span>
  )
}