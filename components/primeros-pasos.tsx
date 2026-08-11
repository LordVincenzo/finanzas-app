import Link from 'next/link'
import { Check, ChevronRight } from 'lucide-react'

/**
 * Guía de primeros pasos.
 *
 * No guarda ningún estado: cada paso se deduce de los datos que ya
 * existen. Eso tiene dos consecuencias buenas.
 *
 * Primero, no puede quedar desincronizada: no hay un campo
 * "onboarding_completed" que diga que terminaste mientras la base dice
 * lo contrario.
 *
 * Segundo, si alguna vez borras todas tus cuentas, la guía reaparece.
 * Es lo correcto: volverías a estar al principio.
 *
 * Cuando los tres pasos están hechos, el componente devuelve null y no
 * vuelve a aparecer.
 */

type Paso = {
  titulo: string
  detalle: string
  href: string
  hecho: boolean
}

export function PrimerosPasos({
  tieneCuenta, tieneMovimiento, tieneMeta,
}: {
  tieneCuenta: boolean
  tieneMovimiento: boolean
  tieneMeta: boolean
}) {
  const pasos: Paso[] = [
    {
      titulo: 'Crea tus cuentas',
      detalle: 'Nu, Nequi, efectivo… con el saldo que tienen hoy',
      href: '/cuentas/nueva',
      hecho: tieneCuenta,
    },
    {
      titulo: 'Registra un movimiento',
      detalle: 'Un gasto, un ingreso o una transferencia',
      href: '/movimientos/nuevo',
      hecho: tieneMovimiento,
    },
    {
      titulo: 'Ponte una meta',
      detalle: 'Marca cuánto de lo que tienes va destinado a algo',
      href: '/ahorros/nueva',
      hecho: tieneMeta,
    },
  ]

  if (pasos.every((p) => p.hecho)) return null

  const hechos = pasos.filter((p) => p.hecho).length
  // El primero sin hacer: es el único que puede tocarse ahora mismo.
  const siguiente = pasos.findIndex((p) => !p.hecho)

  return (
    <section className="overflow-hidden rounded-2xl bg-card shadow-card
                        ring-1 ring-border/70">
      <div className="flex items-baseline justify-between gap-3 px-4 pt-3.5">
        <p className="text-[15px] font-medium">Para empezar</p>
        <span className="text-[12px] text-muted-foreground tabular-nums">
          {hechos} de {pasos.length}
        </span>
      </div>

      <ol className="mt-2.5 divide-y divide-border/70 border-t
                     border-border/70">
        {pasos.map((paso, i) => {
          const activo = i === siguiente

          /* Los pasos ya hechos no son enlaces: llevarían a "crear otra
             cuenta", que no es lo que pide un tic verde. Los que están
             más allá del siguiente tampoco, porque el orden importa:
             no se puede registrar un gasto sin una cuenta de donde
             salga. */
          const contenido = (
            <div className="flex min-h-14 items-center gap-3 px-4 py-2.5">
              <span
                aria-hidden
                className={`flex size-6 shrink-0 items-center justify-center
                            rounded-full text-[11px] font-semibold ${
                  paso.hecho
                    ? 'bg-positivo text-background'
                    : activo
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                }`}
              >
                {paso.hecho ? <Check className="size-3.5" /> : i + 1}
              </span>

              <div className="min-w-0 flex-1">
                <p className={`text-[14px] leading-tight ${
                  paso.hecho
                    ? 'text-muted-foreground line-through'
                    : 'font-medium'
                }`}>
                  {paso.titulo}
                </p>
                {!paso.hecho && (
                  <p className="mt-0.5 truncate text-[12px] leading-tight
                                text-muted-foreground">
                    {paso.detalle}
                  </p>
                )}
              </div>

              {activo && (
                <ChevronRight className="size-4 shrink-0 text-primary" />
              )}
            </div>
          )

          return (
            <li key={paso.titulo}>
              {activo ? (
                <Link href={paso.href}
                      className="block transition active:bg-muted/60">
                  {contenido}
                </Link>
              ) : (
                <div className={paso.hecho ? '' : 'opacity-55'}>
                  {contenido}
                </div>
              )}
            </li>
          )
        })}
      </ol>
    </section>
  )
}