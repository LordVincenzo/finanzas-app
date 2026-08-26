'use client'

import { useActionState, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { formatearCOP, formatearHora } from '@/lib/format'
import { eliminarMovimiento, type EstadoEliminar } from '@/app/(app)/movimientos/actions'
import { type Movimiento, NOMBRE_TIPO, presentarMovimiento } from '@/lib/movimientos'

export type { Movimiento }

const estadoInicial: EstadoEliminar = {}

export function FilaMovimiento({ mov }: { mov: Movimiento }) {
  const [abierta, setAbierta] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  const [estado, accion, borrando] = useActionState(eliminarMovimiento, estadoInicial)

  const { signo, color, contexto } = presentarMovimiento(mov)
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