/**
 * Pantalla de carga de todas las rutas protegidas.
 *
 * Next.js la muestra en cuanto tocas un enlace, sin esperar al servidor.
 * No acelera nada: las consultas tardan lo mismo. Lo que cambia es que
 * la app responde al instante en vez de quedarse quieta mientras carga,
 * que es de donde viene casi toda la sensación de lentitud.
 *
 * Va en el nivel del grupo (app), así que cubre las siete pantallas.
 * Si alguna necesitara una silueta propia, basta con crear su propio
 * loading.tsx dentro de su carpeta: el más cercano gana.
 *
 * Las medidas imitan las de las pantallas reales para que el contenido
 * no dé un salto al llegar.
 */

function Barra({ className = '' }: { className?: string }) {
  return <div className={`rounded-md bg-muted ${className}`} />
}

function FilaFalsa() {
  return (
    <div className="flex min-h-14 items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1 space-y-1.5">
        <Barra className="h-[15px] w-2/5" />
        <Barra className="h-[11px] w-3/5" />
      </div>
      <Barra className="h-[15px] w-20" />
    </div>
  )
}

export default function Cargando() {
  return (
    // aria-busy y el texto oculto: sin esto, un lector de pantalla
    // anuncia una página vacía en vez de decir que está cargando.
    <main className="animate-pulse px-4 pb-28 pt-4" aria-busy="true">
      <span className="sr-only">Cargando…</span>

      {/* Título */}
      <Barra className="h-[22px] w-40" />

      {/* Tarjeta de resumen: casi todas las pantallas abren con una */}
      <div className="mt-3 overflow-hidden rounded-2xl bg-card shadow-card
                      ring-1 ring-border/70">
        <div className="px-4 py-3.5">
          <Barra className="h-[11px] w-24" />
          <Barra className="mt-2 h-[32px] w-52" />
        </div>
        <div className="grid grid-cols-2 divide-x divide-border/70
                        border-t border-border/70">
          <div className="space-y-2 px-4 py-3">
            <Barra className="h-[12px] w-20" />
            <Barra className="h-[18px] w-28" />
          </div>
          <div className="space-y-2 px-4 py-3">
            <Barra className="h-[12px] w-20" />
            <Barra className="h-[18px] w-28" />
          </div>
        </div>
      </div>

      {/* Primer grupo de filas */}
      <div className="mt-7">
        <Barra className="mb-2 ml-1 h-[11px] w-28" />
        <div className="overflow-hidden rounded-2xl bg-card shadow-card
                        ring-1 ring-border/70 divide-y divide-border/70">
          <FilaFalsa />
          <FilaFalsa />
          <FilaFalsa />
        </div>
      </div>

      {/* Segundo grupo */}
      <div className="mt-7">
        <Barra className="mb-2 ml-1 h-[11px] w-24" />
        <div className="overflow-hidden rounded-2xl bg-card shadow-card
                        ring-1 ring-border/70 divide-y divide-border/70">
          <FilaFalsa />
          <FilaFalsa />
        </div>
      </div>
    </main>
  )
}