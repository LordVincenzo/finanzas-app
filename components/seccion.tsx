import Link from 'next/link'
/**
 * Piezas de estructura compartidas.
 * La densidad se decide una sola vez, aquí.
 *
 * Los bloques ya no se separan del fondo con un borde de 1px, sino
 * elevándose sobre él: `bg-card` sobre un lienzo más oscuro, con una
 * sombra mínima. El borde queda solo como línea de pelo, para definir
 * el canto sin dibujar una caja.
 */

export function Seccion({
  titulo, accion, children,
}: {
  titulo?: string
  accion?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="mt-6">
      {(titulo || accion) && (
        <div className="mb-2 flex items-baseline justify-between px-1">
          {titulo && (
            <h2 className="text-[11px] font-semibold uppercase
                           tracking-[0.09em] text-muted-foreground">
              {titulo}
            </h2>
          )}
          {accion}
        </div>
      )}
      {children}
    </section>
  )
}

/** Contenedor de lista: una sola tarjeta con las filas separadas. */
export function Lista({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl bg-card shadow-card
                    ring-1 ring-border/70 divide-y divide-border/70">
      {children}
    </div>
  )
}

/**
 * Una línea de extracto: etiqueta a la izquierda, cifra a la derecha.
 * min-h-14 (56px) porque el pulgar necesita al menos 44px y las filas
 * de dos líneas se quedaban justas.
 */
export function Fila({
  titulo, detalle, valor, extra, href,
}: {
  titulo: string
  detalle?: string
  valor: React.ReactNode
  extra?: React.ReactNode
  /** Si se pasa, la fila entera es tocable y lleva ahí.
   *
   *  Está en la primitiva y no en cada pantalla porque la altura
   *  mínima, el padding y la reacción al toque tienen que ser los
   *  mismos toque o no toque: dos filas que se ven iguales y se
   *  comportan distinto es peor que una que no se pueda tocar. */
  href?: string
}) {
  const dentro = (
    <>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] leading-tight">{titulo}</p>
        {detalle && (
          <p className="mt-1 truncate text-[12px] leading-tight
                        text-muted-foreground">
            {detalle}
          </p>
        )}
      </div>
      <div className="shrink-0 text-[15px] font-medium tabular-nums">
        {valor}
      </div>
      {extra}
    </>
  )

  const clases = 'flex min-h-14 items-center gap-3 px-4 py-3'

  if (href) {
    return (
      <Link href={href} className={`${clases} transition active:bg-muted/60`}>
        {dentro}
      </Link>
    )
  }

  return <div className={clases}>{dentro}</div>
}

/** Tarjeta compacta para bloques que no son listas. */
export function Tarjeta({
  children, className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`rounded-2xl bg-card p-4 shadow-card ring-1
                     ring-border/70 ${className}`}>
      {children}
    </div>
  )
}

/**
 * Una cifra de dinero con la regla de color en un solo sitio.
 *
 * `tono` decide qué significa el número, no cómo se ve:
 *   auto      verde si es positivo, rojo si es negativo, neutro si es 0
 *   positivo  siempre verde, salvo que valga 0
 *   negativo  siempre rojo, salvo que valga 0
 *   neutro    nunca lleva color
 *
 * El cero nunca se colorea: no tiene signo, y pintarlo afirma algo
 * que no es cierto.
 */
export function Monto({
  valor, tono = 'neutro', formato, className = '',
}: {
  valor: number
  tono?: 'auto' | 'positivo' | 'negativo' | 'neutro'
  formato: (n: number) => string
  className?: string
}) {
  let color = ''
  if (valor !== 0) {
    if (tono === 'positivo' || (tono === 'auto' && valor > 0)) {
      color = 'text-positivo'
    } else if (tono === 'negativo' || (tono === 'auto' && valor < 0)) {
      color = 'text-negativo'
    }
  }

  return (
    <span className={`tabular-nums ${color} ${className}`}>
      {formato(valor)}
    </span>
  )
}