/**
 * Esqueleto mientras el servidor resuelve las consultas.
 *
 * El celular ya tenía el suyo en app/(app)/loading.tsx; el escritorio
 * no, así que al cambiar de sección la pantalla se quedaba congelada en
 * la anterior sin ninguna señal de que algo estuviera pasando.
 *
 * No imita ninguna pantalla en concreto: un encabezado, tres cifras y
 * una lista es la forma que comparten Panorama, Cuentas, Ahorros y
 * Préstamos. Sin animación de entrada, porque aparece y desaparece en
 * milisegundos y un fundido lo haría notar más, no menos.
 */
export default function CargandoEscritorio() {
  return (
    <div className="mx-auto max-w-[1400px] px-8 py-10" aria-busy="true">
      <span className="sr-only">Cargando…</span>

      <div className="h-7 w-52 animate-pulse rounded-lg bg-muted" />
      <div className="mt-2 h-4 w-80 animate-pulse rounded bg-muted/60" />

      <div className="mt-6 grid grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i}
               className="rounded-2xl bg-card p-4 shadow-card ring-1 ring-border/70">
            <div className="h-3 w-24 animate-pulse rounded bg-muted/60" />
            <div className="mt-2.5 h-6 w-32 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>

      <div className="mt-8 overflow-hidden rounded-2xl bg-card shadow-card
                      ring-1 ring-border/70">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i}
               className="flex items-center justify-between gap-4 border-b
                          border-border/70 px-5 py-4 last:border-b-0">
            <div className="min-w-0 flex-1">
              <div className="h-4 w-48 animate-pulse rounded bg-muted" />
              <div className="mt-1.5 h-3 w-28 animate-pulse rounded bg-muted/60" />
            </div>
            <div className="h-4 w-24 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  )
}
