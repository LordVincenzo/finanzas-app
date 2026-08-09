'use client'

import { useActionState } from 'react'
import { crearMeta, type EstadoMeta } from '@/app/(app)/ahorros/actions'

const estadoInicial: EstadoMeta = {}

export function FormularioMeta({ tienePareja }: { tienePareja: boolean }) {
  const [estado, accion, enviando] = useActionState(crearMeta, estadoInicial)
  const clase = 'w-full rounded-lg border bg-transparent px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-ring'

  return (
    <form action={accion} className="mt-6 space-y-5">
      <div>
        <label htmlFor="nombre" className="mb-1.5 block text-sm font-medium">
          Nombre
        </label>
        <input id="nombre" name="nombre" required maxLength={80}
               placeholder="Viaje a Japón" className={clase} />
      </div>

      <div>
        <label htmlFor="objetivo" className="mb-1.5 block text-sm font-medium">
          Cuánto quieres juntar
        </label>
        <input id="objetivo" name="objetivo" inputMode="numeric" required
               placeholder="12.000.000" className={`${clase} tabular-nums`} />
        <p className="mt-1.5 text-xs text-muted-foreground">
          Puedes escribir 12m.
        </p>
      </div>

      <div>
        <label htmlFor="fecha" className="mb-1.5 block text-sm font-medium">
          Fecha objetivo{' '}
          <span className="font-normal text-muted-foreground">(opcional)</span>
        </label>
        <input id="fecha" name="fecha" type="date" className={clase} />
      </div>

      <div>
        <label htmlFor="visibilidad" className="mb-1.5 block text-sm font-medium">
          Visibilidad
        </label>
        <select id="visibilidad" name="visibilidad" required
                defaultValue="private" className={clase}>
          <option value="private">Privada — solo tú</option>
          {tienePareja && (
            <>
              <option value="shared_view">Compartida — tu pareja la ve</option>
              <option value="joint">Conjunta — ambos aportan</option>
            </>
          )}
        </select>
        {!tienePareja && (
          <p className="mt-1.5 text-xs text-muted-foreground">
            Vincula una pareja para crear metas compartidas.
          </p>
        )}
      </div>

      <div>
        <label htmlFor="descripcion" className="mb-1.5 block text-sm font-medium">
          Notas <span className="font-normal text-muted-foreground">(opcional)</span>
        </label>
        <textarea id="descripcion" name="descripcion" rows={2}
                  maxLength={300} className={clase} />
      </div>

      {estado.error && (
        <p className="text-sm text-destructive" role="alert">{estado.error}</p>
      )}

      <button type="submit" disabled={enviando}
              className="w-full rounded-lg bg-foreground py-3 font-medium
                         text-background disabled:opacity-50">
        {enviando ? 'Creando…' : 'Crear meta'}
      </button>
    </form>
  )
}