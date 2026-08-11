/**
 * La tarjeta que resume una pantalla.
 *
 * Lleva el degradado destacado, y por eso solo puede haber UNA por
 * pantalla: si apareciera en varios bloques dejaría de significar "esta
 * es la cifra principal" y sería decoración.
 *
 * Pantallas que la usan:
 *   Inicio      patrimonio
 *   Cuentas     disponible y por cobrar
 *   Ahorros     comprometido y libre
 *   Préstamos   por cobrar
 *   Pareja      balance
 *   Meta        acumulado
 *
 * Movimientos y Más no la llevan: son un historial y un menú, no
 * tienen una cifra que resuma nada.
 *
 * Los colores del texto van en variables propias (--destacado-texto,
 * --destacado-suave) porque aquí el fondo es oscuro en los DOS temas.
 * Usar --foreground haría el texto negro sobre grafito en tema claro.
 */

export function TarjetaDestacada({
  etiqueta, valor, pie, children, retraso = 0,
}: {
  etiqueta: string
  /** Acepta un nodo, no solo texto, para poder pasar <CifraAnimada>. */
  valor: React.ReactNode
  /** Línea pequeña bajo la cifra principal. */
  pie?: string
  /** Bloques del desglose, separados por una línea. */
  children?: React.ReactNode
  retraso?: number
}) {
  return (
    <section
      className="aparece overflow-hidden rounded-2xl bg-destacado
                 text-destacado shadow-elevada"
      style={{ '--retraso': `${retraso}ms` } as React.CSSProperties}
    >
      <div className="px-4 pb-3.5 pt-3.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.09em]
                      text-destacado-suave">
          {etiqueta}
        </p>
        <p className="mt-1 text-[34px] font-semibold leading-none
                      tracking-tight tabular-nums">
          {valor}
        </p>
        {pie && (
          <p className="mt-1.5 text-[12px] leading-snug text-destacado-suave
                        tabular-nums">
            {pie}
          </p>
        )}
      </div>

      {children && (
        <div className="border-t border-destacado">{children}</div>
      )}
    </section>
  )
}

/**
 * Un bloque del desglose. Dos seguidos se reparten el ancho y se
 * separan con una línea; uno solo ocupa todo.
 */
export function Reparto({
  etiqueta, valor, nota,
}: {
  etiqueta: string
  valor: React.ReactNode
  nota?: string
}) {
  return (
    <div className="px-4 py-3">
      <p className="text-[12px] text-destacado-suave">{etiqueta}</p>
      <p className="mt-0.5 text-[18px] font-medium tabular-nums">{valor}</p>
      {nota && (
        <p className="mt-1 text-[11px] leading-snug text-destacado-suave
                      tabular-nums">
          {nota}
        </p>
      )}
    </div>
  )
}

/** Fila de dos repartos, con la línea vertical entre ellos. */
export function DosRepartos({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 divide-x divide-destacado">
      {children}
    </div>
  )
}