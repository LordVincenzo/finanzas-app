'use client'

import { useActionState, useState } from 'react'
import { Check, Pencil, X } from 'lucide-react'
import {
  ponerPresupuesto, quitarPresupuesto, type EstadoPresupuesto,
} from '@/app/(app)/presupuestos/actions'
import { formatearCOP } from '@/lib/format'
import { BarraProgreso } from '@/components/barra-progreso'

const estadoInicial: EstadoPresupuesto = {}

/**
 * Una categoría con su tope: cuánto llevas y cuánto queda.
 *
 * LO QUE SE DICE NO ES EL PORCENTAJE, ES LO QUE QUEDA. "Llevas el 78%"
 * obliga a hacer una cuenta para saber si puedes comprar algo hoy;
 * "te quedan $132.000" no. El porcentaje va igualmente, pero pequeño y
 * al lado, porque para ver de un vistazo cómo va el mes entero sí sirve.
 *
 * PASARSE NO SE DISIMULA. Por encima del tope la barra se llena y el
 * texto pasa a rojo diciendo cuánto te pasaste. Una barra que se queda
 * en 100% cuando vas en 140% es una mentira piadosa, y esta app no las
 * hace con dinero.
 */
export function FilaPresupuesto({
  categoriaId, categoria, tope, gastado,
}: {
  categoriaId: string
  categoria: string
  tope: number
  gastado: number
}) {
  const [guardar, accionGuardar, guardando] =
    useActionState(ponerPresupuesto, estadoInicial)
  const [quitar, accionQuitar, quitando] =
    useActionState(quitarPresupuesto, estadoInicial)
  const [editando, setEditando] = useState(false)

  const restante = tope - gastado
  const pasado = restante < 0
  const porcentaje = Math.round((gastado * 100) / tope)

  const error = guardar.error ?? quitar.error

  return (
    <div className="rounded-2xl bg-card px-4 py-3.5 shadow-card
                    ring-1 ring-border/70">
      <div className="flex items-baseline justify-between gap-3">
        <p className="min-w-0 flex-1 truncate text-[15px] font-medium">
          {categoria}
        </p>
        <span className="shrink-0 text-[12px] text-muted-foreground
                         tabular-nums">
          {porcentaje}%
        </span>
        {!editando && (
          <button
            type="button"
            onClick={() => setEditando(true)}
            aria-label={`Cambiar el tope de ${categoria}`}
            className="-my-2 -mr-1 shrink-0 px-1 py-2 text-muted-foreground
                       transition active:scale-90"
          >
            <Pencil className="size-3.5" />
          </button>
        )}
      </div>

      <div className="mt-2">
        <BarraProgreso progreso={Math.min(100, porcentaje)} />
      </div>

      <p className={`mt-2 text-[13px] tabular-nums ${
        pasado ? 'text-negativo' : 'text-muted-foreground'
      }`}>
        {pasado ? (
          <>
            Te pasaste{' '}
            <span className="font-medium">{formatearCOP(-restante)}</span>
            {' '}de {formatearCOP(tope)}
          </>
        ) : (
          <>
            Te quedan{' '}
            <span className="font-medium text-foreground">
              {formatearCOP(restante)}
            </span>
            {' '}de {formatearCOP(tope)}
          </>
        )}
      </p>

      {editando && (
        <div className="mt-3 border-t border-border/70 pt-3">
          <form action={accionGuardar} className="flex items-center gap-2">
            <input type="hidden" name="categoria" value={categoriaId} />
            <div className="flex min-w-0 flex-1 items-center rounded-xl border
                            focus-within:ring-2 focus-within:ring-ring">
              <span className="pl-3 text-[14px] text-muted-foreground">$</span>
              <input
                name="monto" inputMode="numeric" required autoFocus
                defaultValue={String(tope)}
                aria-label={`Tope de ${categoria}`}
                className="min-h-11 w-full rounded-xl bg-transparent pl-1.5 pr-3
                           text-[14px] font-medium tabular-nums
                           focus:outline-none"
              />
            </div>
            <button
              type="submit" disabled={guardando || quitando}
              aria-label="Guardar el tope"
              className="flex size-11 shrink-0 items-center justify-center
                         rounded-xl bg-primary text-primary-foreground
                         shadow-card transition active:scale-95
                         disabled:opacity-50"
            >
              <Check className="size-4" />
            </button>
            <button
              type="button" onClick={() => setEditando(false)}
              aria-label="Cancelar"
              className="flex size-11 shrink-0 items-center justify-center
                         rounded-xl text-muted-foreground transition
                         active:scale-95"
            >
              <X className="size-4" />
            </button>
          </form>

          <form action={accionQuitar} className="mt-1">
            <input type="hidden" name="categoria" value={categoriaId} />
            <button
              type="submit" disabled={guardando || quitando}
              className="min-h-10 text-[12px] font-medium text-destructive
                         disabled:opacity-50"
            >
              Quitar el tope
            </button>
          </form>
        </div>
      )}

      {error && (
        <p className="mt-2 text-[12px] text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
