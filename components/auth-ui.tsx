/**
 * Piezas compartidas de las pantallas de autenticación.
 *
 * La cabecera lleva el MISMO degradado que la tarjeta de patrimonio
 * (--destacado). Así la primera pantalla que alguien ve ya usa el color
 * de la app, en vez de parecer de otro producto.
 */

/**
 * La onda que corta la cabecera.
 *
 * Tres detalles que la hacen funcionar:
 *
 * 1. preserveAspectRatio="none" — el SVG se estira a lo ancho sin
 *    tocar la altura. Sin esto, en una pantalla ancha la onda crecería
 *    proporcionalmente y ocuparía media pantalla.
 *
 * 2. fill="var(--background)" — hereda el tema. Un color fijo obligaría
 *    a duplicar el componente para claro y oscuro.
 *
 * 3. -mb-px y el path bajando hasta y=100 — el SVG solapa un pixel con
 *    lo que viene debajo. Sin ese solape, el redondeo de subpíxeles
 *    deja una línea del color de la cabecera entre la onda y el fondo,
 *    y se ve como un fallo de renderizado.
 */
function Onda() {
  return (
    <svg
      viewBox="0 0 390 60"
      preserveAspectRatio="none"
      aria-hidden="true"
      className="-mb-px block h-[80px] w-full shrink-0"
    >
      <path
        d="M0,30 C60,4 130,4 195,22 C258,39 320,44 390,20 L390,100 L0,100 Z"
        fill="var(--background)"
      />
    </svg>
  )
}

export function PantallaAuth({
  titulo, subtitulo, children,
}: {
  titulo: string
  subtitulo?: string
  children: React.ReactNode
}) {
  return (
    <main className="flex min-h-dvh flex-col bg-background">
      {/*
        Dos decisiones aquí:

        min-h-[42dvh] — la cabecera ocupa algo más del 40% de la
        pantalla, no un tercio. En dvh y no en píxeles para que se
        adapte: en un móvil alto crece, en uno pequeño se encoge y no
        aplasta el formulario.

        justify-end — el texto va pegado a la onda, no arriba con un
        hueco azul debajo. Ese hueco vacío era lo que hacía que el
        bloque de color se viera flojo comparado con las referencias.
        Aquí el color lo ocupa el texto.
      */}
      <header className="flex min-h-[42dvh] flex-col justify-end
                         bg-destacado pt-14 text-destacado">
        <div className="mx-auto w-full max-w-sm px-6 pb-7">
          <p className="aparece text-[13px] font-semibold uppercase
                        tracking-[0.18em] text-destacado-suave">
            Finanzas
          </p>
          <h1 className="aparece mt-4 text-[29px] font-semibold leading-tight
                         tracking-tight"
              style={{ '--retraso': '70ms' } as React.CSSProperties}>
            {titulo}
          </h1>
          {subtitulo && (
            <p className="aparece mt-2 max-w-[30ch] text-[14px] leading-snug
                          text-destacado-suave"
               style={{ '--retraso': '130ms' } as React.CSSProperties}>
              {subtitulo}
            </p>
          )}
        </div>
        <Onda />
      </header>

      {/* flex-1 hace que el fondo claro llegue hasta abajo. Así
          recuperar contraseña —un solo campo— no deja aire suelto bajo
          el formulario. */}
      <section className="flex-1 px-6 pb-10 pt-6">
        <div className="aparece mx-auto w-full max-w-sm"
             style={{ '--retraso': '180ms' } as React.CSSProperties}>
          {children}
        </div>
      </section>
    </main>
  )
}

/**
 * Campo de formulario.
 *
 * Antes usaba una línea inferior en vez de una caja. Se veía bien, pero
 * el resto de la app usa campos con borde completo y 48px de alto, y
 * dos sistemas distintos en la misma app no se sostienen. Manda el que
 * ya está en catorce formularios.
 */
export function CampoAuth({
  id, label, type, autoComplete, minLength, ayuda, placeholder,
}: {
  id: string
  label: string
  type: string
  autoComplete: string
  minLength?: number
  ayuda?: string
  placeholder?: string
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium">
        {label}
      </label>
      <input
        id={id} name={id} type={type} required
        autoComplete={autoComplete} minLength={minLength}
        placeholder={placeholder}
        className="min-h-12 w-full rounded-xl border bg-card px-3.5
                   text-[15px] placeholder:text-muted-foreground/50
                   focus:outline-none focus:ring-2 focus:ring-ring"
      />
      {ayuda && (
        <p className="mt-1.5 text-[12px] text-muted-foreground">{ayuda}</p>
      )}
    </div>
  )
}

export function BotonAuth({
  enviando, children, textoEnviando,
}: {
  enviando: boolean
  children: React.ReactNode
  textoEnviando: string
}) {
  return (
    <button
      type="submit" disabled={enviando}
      className="min-h-12 w-full rounded-xl bg-primary text-[15px] font-medium
                 text-primary-foreground shadow-card transition
                 active:scale-[0.99] disabled:opacity-50"
    >
      {enviando ? textoEnviando : children}
    </button>
  )
}