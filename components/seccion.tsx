/**
 * Piezas de estructura compartidas.
 *
 * Antes cada pantalla repetía "rounded-2xl border p-5". El resultado:
 * todo con el mismo peso visual y demasiado aire en pantallas pequeñas.
 * Aquí decidimos la densidad una sola vez.
 */

export function Seccion({
  titulo, accion, children,
}: {
  titulo?: string
  accion?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="mt-5">
      {(titulo || accion) && (
        <div className="mb-1.5 flex items-baseline justify-between px-1">
          {titulo && (
            <h2 className="text-[11px] font-medium uppercase tracking-wider
                           text-muted-foreground">
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

/** Contenedor de lista: líneas finas en vez de tarjetas separadas. */
export function Lista({ children }: { children: React.ReactNode }) {
  return <div className="divide-y rounded-xl border">{children}</div>
}

/** Una línea de extracto: etiqueta a la izquierda, cifra a la derecha. */
export function Fila({
  titulo, detalle, valor, extra,
}: {
  titulo: string
  detalle?: string
  valor: React.ReactNode
  extra?: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-3 px-3.5 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] leading-tight">{titulo}</p>
        {detalle && (
          <p className="truncate text-[11px] leading-tight text-muted-foreground">
            {detalle}
          </p>
        )}
      </div>
      <div className="shrink-0 text-[13px] tabular-nums">{valor}</div>
      {extra}
    </div>
  )
}

/** Tarjeta compacta para bloques que no son listas. */
export function Tarjeta({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border p-4">{children}</div>
}