'use client'

import { useEffect, useRef, useState } from 'react'
import { formatearCOP } from '@/lib/format'
import { useReducido } from '@/lib/navegador'

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
  /* El valor interpolado va EMPAREJADO con el `valor` al que pertenece.
     Antes el estado guardaba solo el número y el efecto lo corregía con
     un setState sincrónico (un render en cascada en cada montaje, y un
     error de react-hooks/set-state-in-effect). Guardando también a qué
     valor corresponde, la cifra correcta se deduce al renderizar: si
     `valor` cambia, la interpolación vieja se descarta sola en vez de
     quedarse congelada en pantalla. */
  const [animado, setAnimado] = useState<{ para: number; actual: number } | null>(null)
  const yaCorrio = useRef(false)
  const reducido = useReducido()

  useEffect(() => {
    // Solo la primera vez: si el componente se vuelve a renderizar por
    // otro motivo, la cifra no debe saltar otra vez a cero. Y con
    // "menos animación" puesto, o con la cifra en cero, no hay nada que
    // animar. Ninguno de los tres casos toca el estado.
    if (yaCorrio.current || reducido || valor === 0) return
    yaCorrio.current = true

    let frame = 0
    const inicio = performance.now()

    function paso(ahora: number) {
      const t = Math.min(1, (ahora - inicio) / duracion)
      // Desacelera al final: arranca rápido y se posa suave.
      const suave = 1 - Math.pow(1 - t, 3)
      setAnimado({ para: valor, actual: Math.round(valor * suave) })
      if (t < 1) frame = requestAnimationFrame(paso)
    }

    frame = requestAnimationFrame(paso)
    return () => cancelAnimationFrame(frame)
  }, [valor, duracion, reducido])

  // Al acabar, suave vale 1 y `actual` ya es `valor`: no hace falta
  // limpiar nada.
  const mostrado = animado?.para === valor ? animado.actual : valor

  return (
    <span className={`tabular-nums ${className}`}>
      {formatearCOP(mostrado)}
    </span>
  )
}
