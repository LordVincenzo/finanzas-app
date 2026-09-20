/**
 * La tarjeta que resume una pantalla.
 *
 * Lleva el degradado destacado, y por eso solo puede haber UNA por
 * pantalla: si apareciera en varios bloques dejaría de significar "esta
 * es la cifra principal" y sería decoración.
 *
 * Pantallas que la usan:
 *   Inicio      patrimonio (como primera página de carrusel-patrimonio.tsx)
 *   Cuentas     disponible y por cobrar
 *   Ahorros     comprometido y libre
 *   Préstamos   por cobrar
 *   Pareja      balance
 *   Meta        acumulado
 *
 * En Inicio esta misma tarjeta es la primera página de un carrusel
 * (ver carrusel-patrimonio.tsx): las páginas siguientes son cuentas en
 * bg-card, así que el degradado sigue apareciendo una sola vez.
 *
 * Movimientos y Más no la llevan: son un historial y un menú, no
 * tienen una cifra que resuma nada.
 *
 * Los colores del texto van en variables propias (--destacado-texto,
 * --destacado-suave) porque aquí el fondo es oscuro en los DOS temas.
 * Usar --foreground haría el texto negro sobre el degradado.
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
      className="aparece flex h-full flex-col justify-between
                 overflow-hidden rounded-2xl bg-destacado text-destacado
                 shadow-elevada"
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
 * Variante para una cuenta recién creada.
 *
 * Con todo a cero, la tarjeta normal mostraba "$0" arriba y
 * "Disponible para gastar $0" debajo: el mismo cero dos veces, ocupando
 * media pantalla para no decir nada.
 *
 * En ese momento lo útil no es la cifra —que se sabe— sino qué
 * significa la palabra. Es lo único que alguien nuevo no puede deducir.
 */
export function TarjetaDestacadaVacia({
  etiqueta, explicacion, retraso = 0,
}: {
  etiqueta: string
  explicacion: string
  retraso?: number
}) {
  return (
    <section
      className="aparece overflow-hidden rounded-2xl bg-destacado
                 px-4 py-3.5 text-destacado shadow-elevada"
      style={{ '--retraso': `${retraso}ms` } as React.CSSProperties}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.09em]
                    text-destacado-suave">
        {etiqueta}
      </p>
      <p className="mt-1 text-[34px] font-semibold leading-none
                    tracking-tight tabular-nums">
        $0
      </p>
      <p className="mt-2.5 max-w-[34ch] text-[12px] leading-relaxed
                    text-destacado-suave">
        {explicacion}
      </p>
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

/**
 * Tantos repartos como haga falta, de dos en dos.
 *
 * PARA EL CELULAR. En 390px, tres columnas dejan unos 83px de texto por
 * columna y "$5.436.500" a 18px necesita unos 95: se recorta y se lee
 * "$5.436.50", que es un número distinto y perfectamente creíble. Un
 * saldo mal leído es el peor error que puede cometer esta app, y no
 * avisa: se ve bien hasta que alguien tiene un millón más.
 *
 * Por eso aquí el número de columnas no se elige: son dos, y lo que
 * sobra baja a otra fila. Es más alto y cabe siempre.
 *
 * En escritorio hay 1130px y tres o cuatro columnas caben de verdad, así
 * que allí el Panorama arma su propia rejilla según cuántas partes haya.
 * Aquí no: el ancho no da para elegir.
 */
export function Repartos({ children }: { children: React.ReactNode[] }) {
  const partes = children.filter(Boolean)
  if (partes.length <= 1) return <>{partes}</>

  const filas: React.ReactNode[][] = []
  for (let i = 0; i < partes.length; i += 2) {
    filas.push(partes.slice(i, i + 2))
  }

  return (
    <div className="divide-y divide-destacado">
      {filas.map((fila, i) => (
        <div key={i}
             className={fila.length === 2
               ? 'grid grid-cols-2 divide-x divide-destacado'
               : ''}>
          {fila}
        </div>
      ))}
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
