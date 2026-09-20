import Link from 'next/link'
import { CreditCard } from 'lucide-react'
import { formatearCOP } from '@/lib/format'
import { Seccion } from '@/components/seccion'

export type TarjetaPorPagar = {
  account_id: string
  name: string
  debes: number
  proxima: string
  dias: number
}

/**
 * Las tarjetas que hay que pagar pronto.
 *
 * POR QUÉ ESTÁ EN INICIO. Es el único sitio de esta app donde NO hacer
 * algo cuesta dinero: olvidar la fecha no descuadra nada, cobra
 * intereses de mora. Un dato así no puede vivir dos pantallas adentro.
 *
 * SOLO LAS PRÓXIMAS. Una tarjeta que vence en 20 días no es una noticia
 * y ocupa el sitio de la que vence pasado mañana. Ocho días es el
 * margen para poder mover plata si hace falta.
 *
 * LO QUE SE DICE ES CUÁNDO, no la fecha: "en 3 días" se entiende sin
 * pensar; "el 5 de octubre" obliga a mirar el calendario. La fecha va
 * al lado, pequeña, para quien quiera comprobarla.
 */
export function AvisoTarjetas({ tarjetas }: { tarjetas: TarjetaPorPagar[] }) {
  const pronto = tarjetas.filter((t) => t.dias <= 8)
  if (pronto.length === 0) return null

  return (
    <Seccion titulo="Por pagar">
      <div className="space-y-2">
        {pronto.map((t, i) => {
          // Vencida: el día pasó y la deuda sigue ahí.
          const tarde = t.dias < 0
          const hoy = t.dias === 0

          return (
            <Link
              key={t.account_id}
              href="/cuentas"
              className={`aparece flex items-center gap-3 rounded-2xl bg-card
                          px-4 py-3 shadow-card transition active:scale-[0.99]
                          ${tarde
                            ? 'ring-1 ring-negativo/40'
                            : 'ring-1 ring-border/70'}`}
              style={{ '--retraso': `${180 + i * 60}ms` } as React.CSSProperties}
            >
              <span className="flex size-9 shrink-0 items-center justify-center
                               rounded-xl bg-muted">
                <CreditCard className="size-[17px] text-muted-foreground" />
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] leading-tight">{t.name}</p>
                <p className={`mt-0.5 text-[12px] leading-tight ${
                  tarde || hoy ? 'text-negativo' : 'text-muted-foreground'
                }`}>
                  {tarde
                    ? `Venció hace ${-t.dias} ${-t.dias === 1 ? 'día' : 'días'}`
                    : hoy
                      ? 'Vence hoy'
                      : `En ${t.dias} ${t.dias === 1 ? 'día' : 'días'}`}
                </p>
              </div>

              <span className="shrink-0 text-[15px] font-semibold tabular-nums">
                {formatearCOP(t.debes)}
              </span>
            </Link>
          )
        })}
      </div>
    </Seccion>
  )
}
