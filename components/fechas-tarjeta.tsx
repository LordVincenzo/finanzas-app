'use client'

import { useActionState, useState } from 'react'
import { CalendarClock } from 'lucide-react'
import {
  ponerFechasTarjeta, type EstadoFechas,
} from '@/app/(app)/cuentas/fechas-actions'

const estadoInicial: EstadoFechas = {}

const CAMPO = `min-h-11 w-full rounded-xl border bg-transparent px-3
               text-center text-[15px] font-medium tabular-nums
               placeholder:font-normal placeholder:text-muted-foreground/50
               focus:outline-none focus:ring-2 focus:ring-ring`

/**
 * Cuándo cierra y cuándo vence una tarjeta.
 *
 * POR QUÉ IMPORTA. Es el único dato de esta app cuyo olvido cuesta
 * dinero de verdad: no pagar a tiempo no descuadra nada, cobra
 * intereses de mora. Todo lo demás, si se te olvida, solo deja un
 * número desactualizado.
 *
 * DOS FECHAS Y NO UNA, porque son cosas distintas y confundirlas es el
 * error clásico: el corte es cuando cierra el extracto —lo que compres
 * después ya se paga el mes siguiente— y el pago es cuando vence. Sin
 * el corte no se puede responder "esto que voy a comprar, ¿cuándo lo
 * pago?", que es la pregunta de verdad cuando estás en la caja.
 *
 * Plegado hasta que se toca: en una lista de cuentas, dos campos
 * abiertos bajo cada tarjeta es ruido.
 */
export function FechasTarjeta({
  cuentaId, nombre, corte, pago,
}: {
  cuentaId: string
  nombre: string
  corte: number | null
  pago: number | null
}) {
  const [estado, accion, enviando] = useActionState(ponerFechasTarjeta, estadoInicial)
  const [abierto, setAbierto] = useState(false)

  const puesto = pago !== null

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="flex min-h-11 w-full items-center gap-2 px-4 text-left
                   text-[12px] text-muted-foreground transition
                   active:bg-muted/60"
      >
        <CalendarClock className="size-3.5 shrink-0" aria-hidden />
        {puesto
          ? `Corte el ${corte ?? '—'} · vence el ${pago}`
          : 'Ponle fecha de pago'}
      </button>
    )
  }

  return (
    <form action={accion} className="px-4 py-3">
      <input type="hidden" name="cuenta" value={cuentaId} />

      <p className="text-[12px] font-medium">{nombre}</p>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <div>
          <label htmlFor={`corte-${cuentaId}`}
                 className="mb-1 block text-[11px] text-muted-foreground">
            Día de corte
          </label>
          <input
            id={`corte-${cuentaId}`} name="corte"
            inputMode="numeric" maxLength={2} placeholder="15"
            defaultValue={corte ?? ''}
            className={CAMPO}
          />
        </div>
        <div>
          <label htmlFor={`pago-${cuentaId}`}
                 className="mb-1 block text-[11px] text-muted-foreground">
            Día de pago
          </label>
          <input
            id={`pago-${cuentaId}`} name="pago"
            inputMode="numeric" maxLength={2} placeholder="5"
            defaultValue={pago ?? ''}
            className={CAMPO}
          />
        </div>
      </div>

      <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
        Días del mes, no fechas. El corte es cuando cierra el extracto: lo
        que compres después se paga el mes siguiente. Déjalos vacíos para
        quitar el aviso.
      </p>

      {estado.error && (
        <p className="mt-2 text-[12px] text-destructive" role="alert">
          {estado.error}
        </p>
      )}

      <div className="mt-3 flex gap-2">
        <button
          type="submit" disabled={enviando}
          className="min-h-11 flex-1 rounded-xl bg-primary text-[14px]
                     font-medium text-primary-foreground shadow-card
                     transition active:scale-[0.99] disabled:opacity-50"
        >
          {enviando ? 'Guardando…' : 'Guardar'}
        </button>
        <button
          type="button" onClick={() => setAbierto(false)}
          className="min-h-11 shrink-0 rounded-xl px-4 text-[13px]
                     font-medium text-muted-foreground transition
                     active:scale-[0.99]"
        >
          Cerrar
        </button>
      </div>
    </form>
  )
}
