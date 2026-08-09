/**
 * Piezas de estructura compartidas.
 * La densidad se decide una sola vez, aquí.
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
            <h2 className="text-[12px] font-medium uppercase tracking-wider
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
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] leading-tight">{titulo}</p>
        {detalle && (
          <p className="mt-0.5 truncate text-[12px] leading-tight
                        text-muted-foreground">
            {detalle}
          </p>
        )}
      </div>
      <div className="shrink-0 text-[15px] tabular-nums">{valor}</div>
      {extra}
    </div>
  )
}

/** Tarjeta compacta para bloques que no son listas. */
export function Tarjeta({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border p-4">{children}</div>
}