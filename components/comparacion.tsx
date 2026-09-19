import { ArrowDown, ArrowUp, Minus } from 'lucide-react'
import { formatearCOP } from '@/lib/format'

/**
 * Cuánto cambió una cifra respecto al mes pasado.
 *
 * POR QUÉ EXISTE. Un gasto de $473.500 no dice nada por sí solo. La
 * pregunta que la gente se hace al abrir una app de finanzas no es
 * «¿cuánto gasté?» sino «¿voy bien?», y esa solo se responde
 * comparando. Sin esto, cada pantalla es un extracto bancario con mejor
 * tipografía.
 *
 * EL COLOR NO ES EL SIGNO DEL CAMBIO, es si el cambio te conviene.
 * Gastar $180.000 MENOS es una bajada y es buena; ingresar $180.000
 * menos es una bajada y es mala. Por eso hace falta decir de qué lado
 * está lo bueno (`bajarEsBueno`) en vez de deducirlo de la flecha.
 *
 * SIN MES ANTERIOR NO SE INVENTA NADA. El primer mes de uso no tiene
 * con qué comparar, y «+100%» desde cero es ruido, no información: no
 * se dibuja.
 */
export function Comparacion({
  actual, anterior, mesAnterior, bajarEsBueno = true, className = '',
}: {
  actual: number
  /** null si ese mes no tiene datos: entonces no se dibuja nada. */
  anterior: number | null
  /** "agosto", para poder decir de qué mes hablamos. */
  mesAnterior: string
  /** ¿Bajar es una buena noticia? Cierto en gastos, falso en ingresos. */
  bajarEsBueno?: boolean
  className?: string
}) {
  if (anterior === null) return null

  /* Desde cero no hay porcentaje que calcular, pero sí algo que decir —
     y es de lo más útil que hay: una categoría nueva es justo donde se
     escapa el dinero sin que nadie lo note. Callarse aquí, que es lo
     que hacía antes, dejaba muda la fila más interesante del mes. */
  if (anterior === 0) {
    if (actual === 0) return null
    return (
      <p className={`flex items-center gap-1 text-[11px] leading-snug
                     text-muted-foreground ${className}`}>
        <ArrowUp className="size-3 shrink-0" aria-hidden />
        Nuevo: en {mesAnterior} no hubo nada
      </p>
    )
  }

  const delta = actual - anterior
  if (delta === 0) {
    return (
      <p className={`flex items-center gap-1 text-[11px] leading-snug
                     text-muted-foreground ${className}`}>
        <Minus className="size-3 shrink-0" aria-hidden />
        Igual que en {mesAnterior}
      </p>
    )
  }

  const subio = delta > 0
  const bueno = subio ? !bajarEsBueno : bajarEsBueno

  /* El cero nunca se colorea y esto tampoco cuando el cambio es
     pequeño: por debajo del 5% la diferencia es ruido del mes —un
     recibo que cayó un día antes— y pintarla de rojo enseña a ignorar
     el rojo. */
  const proporcion = Math.abs(delta) / Math.abs(anterior)
  const color = proporcion < 0.05
    ? 'text-muted-foreground'
    : bueno ? 'text-positivo' : 'text-negativo'

  const Flecha = subio ? ArrowUp : ArrowDown

  return (
    <p className={`flex items-center gap-1 text-[11px] leading-snug
                   tabular-nums ${color} ${className}`}>
      <Flecha className="size-3 shrink-0" aria-hidden />
      {formatearCOP(Math.abs(delta))} {subio ? 'más' : 'menos'} que en {mesAnterior}
    </p>
  )
}
