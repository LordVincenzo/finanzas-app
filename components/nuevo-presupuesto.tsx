'use client'

import { useActionState, useState } from 'react'
import { ChevronDown, Plus } from 'lucide-react'
import {
  ponerPresupuesto, type EstadoPresupuesto,
} from '@/app/(app)/presupuestos/actions'
import type { Opcion } from '@/lib/datos-bandeja'

const estadoInicial: EstadoPresupuesto = {}

/**
 * Ponerle tope a una categoría que todavía no lo tiene.
 *
 * Plegado hasta que se toca: una pantalla que abre con un formulario
 * vacío da a entender que hay trabajo pendiente, y aquí lo normal es
 * llegar a mirar cómo va el mes, no a añadir.
 *
 * Solo se ofrecen las categorías SIN tope. Las que ya lo tienen se
 * cambian desde su propia fila, que es donde uno las está mirando.
 */
export function NuevoPresupuesto({ categorias }: { categorias: Opcion[] }) {
  const [estado, accion, enviando] = useActionState(ponerPresupuesto, estadoInicial)
  const [abierto, setAbierto] = useState(false)

  if (categorias.length === 0) return null

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="flex min-h-12 w-full items-center justify-center gap-2
                   rounded-2xl border border-dashed border-border
                   text-[14px] font-medium text-muted-foreground
                   transition active:scale-[0.99]"
      >
        <Plus className="size-4" />
        Ponerle tope a otra categoría
      </button>
    )
  }

  return (
    <form action={accion}
          className="rounded-2xl bg-card p-4 shadow-card ring-1 ring-border/70">
      <div className="relative">
        <select
          name="categoria" required defaultValue=""
          aria-label="Categoría"
          className="min-h-11 w-full appearance-none rounded-xl border
                     bg-transparent pl-3 pr-9 text-[14px]
                     focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="" disabled>Categoría…</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <ChevronDown aria-hidden
          className="pointer-events-none absolute right-3 top-1/2 size-4
                     -translate-y-1/2 text-muted-foreground" />
      </div>

      <div className="mt-2 flex items-center rounded-xl border
                      focus-within:ring-2 focus-within:ring-ring">
        <span className="pl-3 text-[14px] text-muted-foreground">$</span>
        <input
          name="monto" inputMode="numeric" required
          placeholder="600.000"
          aria-label="Tope al mes"
          className="min-h-11 w-full rounded-xl bg-transparent pl-1.5 pr-3
                     text-[14px] font-medium tabular-nums
                     placeholder:text-muted-foreground/50 focus:outline-none"
        />
      </div>
      <p className="mt-1.5 text-[12px] text-muted-foreground">
        Al mes. Puedes escribir 600k.
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
          {enviando ? 'Guardando…' : 'Poner el tope'}
        </button>
        <button
          type="button" onClick={() => setAbierto(false)}
          className="min-h-11 shrink-0 rounded-xl px-4 text-[13px]
                     font-medium text-muted-foreground transition
                     active:scale-[0.99]"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}
