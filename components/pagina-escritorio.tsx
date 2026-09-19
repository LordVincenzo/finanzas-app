import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

/**
 * El envoltorio de las pantallas de formulario de escritorio.
 *
 * Las listas de escritorio usan `max-w-[1400px]` porque tienen tablas
 * anchas. Un formulario no: estirar un campo de texto a 1400px lo vuelve
 * más difícil de leer, no más cómodo. Por eso la columna se queda en
 * `max-w-xl` y va pegada a la izquierda, alineada con el resto de los
 * encabezados de la vista.
 *
 * Existe para que las cuatro pantallas de creación no repitan cuatro
 * veces el mismo enlace de volver, el mismo título y el mismo ancho.
 */
export function PaginaFormulario({
  volverA, volverTexto, titulo, ayuda, children,
}: {
  volverA: string
  volverTexto: string
  titulo: string
  ayuda?: string
  children: React.ReactNode
}) {
  return (
    <div className="mx-auto max-w-[1400px] px-8 py-10">
      <div className="max-w-xl">
        <Link
          href={volverA}
          className="inline-flex items-center gap-1 text-[13px]
                     text-muted-foreground transition hover:text-foreground"
        >
          <ChevronLeft className="size-4" /> {volverTexto}
        </Link>

        <h1 className="mt-3 text-[26px] font-semibold tracking-tight">
          {titulo}
        </h1>
        {ayuda && (
          <p className="mt-1 text-[13px] text-muted-foreground">{ayuda}</p>
        )}

        {children}
      </div>
    </div>
  )
}
