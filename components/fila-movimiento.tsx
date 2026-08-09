'use client'

import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { formatearCOP, formatearHora } from '@/lib/format'
import { eliminarMovimiento } from '@/app/(app)/movimientos/actions'

export type Movimiento = {
  id: string
  type: string
  description: string
  occurred_at: string
  cuenta_origen: string
  cuenta_destino: string
  clase_origen: string
  clase_destino: string
  monto: number
}

/** Cómo se ve el movimiento según su tipo. */
function presentar(m: Movimiento) {
  switch (m.type) {
    case 'expense':
      return { signo: '-', color: 'text-foreground',
               contexto: `${m.cuenta_origen} · ${m.cuenta_destino}` }
    case 'income':
      return { signo: '+', color: 'text-positivo',
               contexto: `${m.cuenta_destino} · ${m.cuenta_origen}` }
    case 'transfer':
      return { signo: '', color: 'text-muted-foreground',
               contexto: `${m.cuenta_origen} → ${m.cuenta_destino}` }
    case 'adjustment':
      return { signo: m.clase_destino === 'income' ? '-' : '+',
               color: 'text-muted-foreground',
               contexto: m.clase_destino === 'income' ? m.cuenta_origen : m.cuenta_destino }
    default: // opening
      return { signo: '+', color: 'text-muted-foreground',
               contexto: m.cuenta_destino }
  }
}

export function FilaMovimiento({ mov }: { mov: Movimiento }) {
  const [confirmando, setConfirmando] = useState(false)
  const { signo, color, contexto } = presentar(mov)
  const esApertura = mov.type === 'opening'

  return (
    <div className="flex items-center gap-2.5 px-3.5 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] leading-tight">{mov.description}</p>
        <p className="truncate text-[11px] leading-tight text-muted-foreground">
          {formatearHora(mov.occurred_at)} · {contexto}
        </p>
      </div>

      <span className={`shrink-0 text-[13px] font-medium tabular-nums ${color}`}>
        {signo}{formatearCOP(Math.abs(Number(mov.monto)))}
      </span>

      {!esApertura && (
        confirmando ? (
          <form action={eliminarMovimiento} className="flex shrink-0 gap-1">
            <input type="hidden" name="id" value={mov.id} />
            <button
              type="submit"
              className="rounded-md bg-destructive px-2 py-1 text-xs
                         font-medium text-white"
            >
              Borrar
            </button>
            <button
              type="button"
              onClick={() => setConfirmando(false)}
              className="rounded-md border px-2 py-1 text-xs"
            >
              No
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmando(true)}
            aria-label={`Eliminar ${mov.description}`}
            className="shrink-0 text-muted-foreground"
          >
            <Trash2 className="size-4" />
          </button>
        )
      )}
    </div>
  )
}