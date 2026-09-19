'use client'

import { useActionState } from 'react'
import { ChevronDown } from 'lucide-react'
import { crearMeta, type EstadoMeta } from '@/app/(app)/ahorros/actions'
import type { Origen } from '@/lib/interfaz'

const estadoInicial: EstadoMeta = {}

const CAMPO = `min-h-12 w-full rounded-xl border bg-transparent px-3.5
               text-[15px] placeholder:text-muted-foreground/50
               focus:outline-none focus:ring-2 focus:ring-ring`

export function FormularioMeta({
  tienePareja, origen = 'celular',
}: {
  tienePareja: boolean
  origen?: Origen
}) {
  const [estado, accion, enviando] = useActionState(crearMeta, estadoInicial)

  return (
    <form action={accion} className="mt-5 space-y-4">
      {/* A qué lista volver al terminar. La acción lo traduce contra una
          tabla blanca, nunca lo usa tal cual en redirect(). */}
      <input type="hidden" name="origen" value={origen} />

      <div>
        <label htmlFor="nombre" className="mb-1.5 block text-[13px] font-medium">
          Nombre
        </label>
        <input id="nombre" name="nombre" required maxLength={80}
               placeholder="Viaje a Japón" className={CAMPO} />
      </div>

      <div>
        <label htmlFor="objetivo" className="mb-1.5 block text-[13px] font-medium">
          Cuánto quieres juntar
        </label>
        <div className="flex items-center rounded-xl border
                        focus-within:ring-2 focus-within:ring-ring">
          <span className="pl-3.5 text-[20px] font-semibold
                           text-muted-foreground">
            $
          </span>
          <input
            id="objetivo" name="objetivo" inputMode="numeric" required
            placeholder="12.000.000"
            className="min-h-12 w-full rounded-xl bg-transparent pl-1.5 pr-3.5
                       text-[20px] font-semibold tabular-nums
                       placeholder:text-muted-foreground/50
                       focus:outline-none"
          />
        </div>
        <p className="mt-1.5 text-[12px] text-muted-foreground">
          Puedes escribir 12m.
        </p>
      </div>

      <div>
        <label htmlFor="fecha" className="mb-1.5 block text-[13px] font-medium">
          Fecha objetivo{' '}
          <span className="font-normal text-muted-foreground">(opcional)</span>
        </label>
        <input id="fecha" name="fecha" type="date"
               className={`${CAMPO} tabular-nums`} />
      </div>

      <div>
        <label htmlFor="visibilidad"
               className="mb-1.5 block text-[13px] font-medium">
          Visibilidad
        </label>
        <div className="relative">
          <select id="visibilidad" name="visibilidad" required
                  defaultValue="private"
                  className="min-h-12 w-full appearance-none rounded-xl border
                             bg-transparent pl-3.5 pr-10 text-[15px]
                             focus:outline-none focus:ring-2 focus:ring-ring">
            <option value="private">Privada — solo tú</option>
            {tienePareja && (
              <>
                <option value="shared_view">Compartida — tu pareja la ve</option>
                <option value="joint">Conjunta — ambos aportan</option>
              </>
            )}
          </select>
          <ChevronDown
            aria-hidden
            className="pointer-events-none absolute right-3.5 top-1/2 size-4
                       -translate-y-1/2 text-muted-foreground"
          />
        </div>
        {!tienePareja && (
          <p className="mt-1.5 text-[12px] text-muted-foreground">
            Vincula una pareja para crear metas compartidas.
          </p>
        )}
      </div>

      <div>
        <label htmlFor="descripcion"
               className="mb-1.5 block text-[13px] font-medium">
          Notas{' '}
          <span className="font-normal text-muted-foreground">(opcional)</span>
        </label>
        <textarea id="descripcion" name="descripcion" rows={2} maxLength={300}
                  className="w-full rounded-xl border bg-transparent px-3.5 py-3
                             text-[15px] focus:outline-none focus:ring-2
                             focus:ring-ring" />
      </div>

      {estado.error && (
        <p className="text-[13px] text-destructive" role="alert">
          {estado.error}
        </p>
      )}

      <button type="submit" disabled={enviando}
              className="min-h-12 w-full rounded-xl bg-primary text-[15px]
                         font-medium text-primary-foreground shadow-card
                         transition active:scale-[0.99] disabled:opacity-50">
        {enviando ? 'Creando…' : 'Crear meta'}
      </button>
    </form>
  )
}