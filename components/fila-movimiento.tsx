'use client'

import { useActionState, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { formatearCOP, formatearHora } from '@/lib/format'
import { eliminarMovimiento, type EstadoEliminar } from '@/app/(app)/movimientos/actions'

export type Movimiento = {
  id: string
  type: string
  description: string
  occurred_at: string
  cuenta_origen: string
  cuenta_destino: string
  clase_origen: string
  clase_destino: string
  /** Lo que de verdad gastaste o ingresaste. */
  monto: number
  /** Todo el dinero que se movió. Difiere solo en gastos compartidos. */
  monto_total: number
}

const estadoInicial: EstadoEliminar = {}

const NOMBRE_TIPO: Record<string, string> = {
  expense: 'Gasto',
  income: 'Ingreso',
  transfer: 'Transferencia',
  adjustment: 'Ajuste de saldo',
  opening: 'Saldo inicial',
  loan_out: 'Préstamo',
  loan_repay: 'Cobro de préstamo',
  settlement: 'Liquidación',
}

/**
 * Cómo se ve el movimiento según su tipo.
 *
 * Los gastos van en color neutro a propósito: en una lista donde casi todo
 * son gastos, pintarlos todos de rojo deja de ser información. El signo "−"
 * ya dice que el dinero salió.
 */
function presentar(m: Movimiento) {
  switch (m.type) {
    case 'expense':
      return { signo: '-', color: '',
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
               contexto: m.clase_destino === 'income'
                 ? m.cuenta_origen : m.cuenta_destino }
    default: // opening, loan_out, loan_repay, settlement
      return { signo: '', color: 'text-muted-foreground',
               contexto: `${m.cuenta_origen} → ${m.cuenta_destino}` }
  }
}

export function FilaMovimiento({ mov }: { mov: Movimiento }) {
  const [abierta, setAbierta] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  const [estado, accion, borrando] = useActionState(eliminarMovimiento, estadoInicial)

  const { signo, color, contexto } = presentar(mov)
  const esApertura = mov.type === 'opening'

  /* En un gasto compartido, del total pagado solo una parte es gasto
     tuyo; el resto es dinero que te deben. La lista muestra el total
     —que es lo que salió de la cuenta— y el desglose vive aquí dentro,
     a un toque, para no alargar cada línea del historial. */
  const total = Number(mov.monto_total ?? mov.monto)
  const propio = Number(mov.monto)
  const compartido = total !== propio
  const deOtros = total - propio

  return (
    <div>
      {/* La fila entera abre el detalle. Antes había un icono de basura
          permanente: 16px de área táctil, a un toque del borrado, en una
          lista que se recorre con el pulgar. */}
      <button
        type="button"
        onClick={() => { setAbierta(!abierta); setConfirmando(false) }}
        aria-expanded={abierta}
        className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left
                   transition active:bg-muted/60"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] leading-tight">{mov.description}</p>
          <p className="mt-0.5 truncate text-[12px] leading-tight
                        text-muted-foreground">
            {formatearHora(mov.occurred_at)} · {contexto}
          </p>
        </div>

        <span className={`shrink-0 text-[15px] font-medium tabular-nums ${color}`}>
          {signo}{formatearCOP(Math.abs(total))}
        </span>

        <ChevronDown
          aria-hidden
          className={`size-4 shrink-0 text-muted-foreground/60
                      transition-transform ${abierta ? 'rotate-180' : ''}`}
        />
      </button>

      {abierta && (
        <div className="border-t border-border/70 bg-muted/40 px-4 py-3">
          <dl className="space-y-1.5 text-[13px]">
            <Detalle etiqueta="Tipo" valor={NOMBRE_TIPO[mov.type] ?? mov.type} />
            <Detalle etiqueta="Sale de" valor={mov.cuenta_origen} />
            <Detalle etiqueta="Entra a" valor={mov.cuenta_destino} />
            <Detalle etiqueta="Hora" valor={formatearHora(mov.occurred_at)} />
            {compartido && (
              <>
                <Detalle etiqueta="Tu parte"
                         valor={formatearCOP(Math.abs(propio))} />
                <Detalle etiqueta="Te deben"
                         valor={formatearCOP(Math.abs(deOtros))} />
              </>
            )}
          </dl>

          {compartido && (
            <p className="mt-2.5 text-[12px] leading-snug text-muted-foreground">
              Gasto compartido: pagaste el total, pero solo tu parte cuenta
              como gasto tuyo. El resto pasó a "por cobrar".
            </p>
          )}

          {estado.error && (
            <p className="mt-3 text-[13px] text-destructive" role="alert">
              {estado.error}
            </p>
          )}

          {esApertura ? (
            <p className="mt-3 text-[12px] leading-snug text-muted-foreground">
              El saldo inicial no se puede eliminar. Para corregirlo, registra
              un ajuste de saldo.
            </p>
          ) : compartido ? (
            <p className="mt-3 text-[12px] leading-snug text-muted-foreground">
              Este gasto se borra desde Pareja, para que se deshaga también
              en el historial de tu pareja.
            </p>
          ) : confirmando ? (
            <form action={accion} className="mt-3 flex gap-2">
              <input type="hidden" name="id" value={mov.id} />
              <button
                type="submit" disabled={borrando}
                className="min-h-10 flex-1 rounded-xl bg-destructive
                           text-[13px] font-medium text-background
                           disabled:opacity-50"
              >
                {borrando ? 'Eliminando…' : 'Sí, eliminar'}
              </button>
              <button
                type="button" onClick={() => setConfirmando(false)}
                className="min-h-10 flex-1 rounded-xl border text-[13px]"
              >
                Cancelar
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmando(true)}
              className="mt-3 min-h-10 w-full rounded-xl border text-[13px]
                         font-medium text-destructive"
            >
              Eliminar movimiento
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function Detalle({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex gap-3">
      <dt className="w-20 shrink-0 text-muted-foreground">{etiqueta}</dt>
      <dd className="min-w-0 flex-1 truncate tabular-nums">{valor}</dd>
    </div>
  )
}