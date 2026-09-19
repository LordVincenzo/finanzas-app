import Link from 'next/link'
import { Compass } from 'lucide-react'

/**
 * 404. Aparece sobre todo por notFound(), que ya usan los detalles de
 * meta y de préstamo cuando el id no existe o no es tuyo — hasta ahora
 * eso enseñaba la pantalla por defecto de Next.
 *
 * No dice "no tienes permiso" aunque a veces sea el caso: si el RLS
 * esconde algo que no es tuyo, confirmar que existe ya sería contar algo.
 * "No existe" es la respuesta correcta y la que no filtra nada.
 */
export default function NoEncontrado() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-5 py-16
                    text-center">
      <span className="flex size-12 items-center justify-center rounded-full
                       bg-muted">
        <Compass className="size-5 text-muted-foreground" />
      </span>

      <h1 className="mt-4 text-[18px] font-semibold tracking-tight">
        Esta página no existe
      </h1>
      <p className="mt-2 text-[14px] leading-snug text-muted-foreground">
        Puede que el enlace esté mal, o que lo que buscabas se haya
        eliminado.
      </p>

      <div className="mt-6 flex w-full flex-col gap-2">
        <Link
          href="/inicio"
          className="flex min-h-12 w-full items-center justify-center
                     rounded-xl bg-primary text-[15px] font-medium
                     text-primary-foreground shadow-card"
        >
          Ir a Inicio
        </Link>
        <Link
          href="/escritorio"
          className="flex min-h-12 w-full items-center justify-center
                     rounded-xl border border-border text-[15px]"
        >
          Ir al escritorio
        </Link>
      </div>
    </div>
  )
}
