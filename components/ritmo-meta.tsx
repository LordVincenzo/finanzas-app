import { CalendarClock, CircleAlert, PartyPopper, CalendarPlus } from 'lucide-react'
import { formatearCOP } from '@/lib/format'
import { ritmoDeMeta } from '@/lib/metas'

/**
 * Qué hay que hacer para llegar a la meta.
 *
 * Una barra de progreso dice dónde estás. Esto dice qué falta hacer,
 * que es lo único con lo que se puede hacer algo un martes cualquiera.
 *
 * Los cuatro estados dicen cosas distintas a propósito:
 *
 *   en_curso   "$1.090.910 al mes durante 11 meses" — la cuota
 *   vencida    la fecha pasó y falta dinero; no se disimula
 *   sin_fecha  invita a ponerle una, porque sin fecha no hay cuota
 *   lograda    se celebra y se calla, que ya no hay nada que hacer
 */
export function RitmoMeta({
  meta, className = '', compacto = false,
}: {
  meta: { target_amount: number; acumulado: number; target_date: string | null }
  className?: string
  /** En una lista: una línea, sin icono de fondo ni invitaciones. */
  compacto?: boolean
}) {
  const ritmo = ritmoDeMeta(meta)

  if (ritmo.clase === 'lograda') {
    return (
      <p className={`flex items-center gap-1.5 text-[12px] font-medium
                     text-positivo ${className}`}>
        <PartyPopper className="size-3.5 shrink-0" aria-hidden />
        Meta cumplida
      </p>
    )
  }

  if (ritmo.clase === 'sin_fecha') {
    // En una lista, callarse: una invitación por fila es ruido.
    if (compacto) return null
    return (
      <p className={`flex items-start gap-1.5 text-[12px] leading-snug
                     text-muted-foreground ${className}`}>
        <CalendarPlus className="mt-px size-3.5 shrink-0" aria-hidden />
        Ponle una fecha y te digo cuánto apartar cada mes.
      </p>
    )
  }

  if (ritmo.clase === 'vencida') {
    return (
      <p className={`flex items-start gap-1.5 text-[12px] leading-snug
                     text-negativo ${className}`}>
        <CircleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
        <span>
          La fecha pasó hace {ritmo.diasDeRetraso}{' '}
          {ritmo.diasDeRetraso === 1 ? 'día' : 'días'} y faltan{' '}
          <span className="font-medium tabular-nums">
            {formatearCOP(ritmo.faltante)}
          </span>
        </span>
      </p>
    )
  }

  return (
    <p className={`flex items-start gap-1.5 text-[12px] leading-snug
                   text-muted-foreground ${className}`}>
      <CalendarClock className="mt-px size-3.5 shrink-0" aria-hidden />
      <span>
        <span className="font-medium tabular-nums text-foreground">
          {formatearCOP(ritmo.porMes)}
        </span>
        {' al mes'}
        {ritmo.meses > 1 && ` durante ${ritmo.meses} meses`}
      </span>
    </p>
  )
}
