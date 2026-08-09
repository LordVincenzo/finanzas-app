'use client'

import { useActionState, useState } from 'react'
import { registrarAbono, type EstadoPrestamo } from '@/app/(app)/prestamos/actions'
import { formatearCOP, formatearFecha } from '@/lib/format'

type Cuenta = { id: string; name: string }
type Cuota = { id: string; number: number; due_date: string; pendiente: number }

const estadoInicial: EstadoPrestamo = {}

export function FormularioAbono({
  prestamoId, cuentas, cuotas, hoy,
}: {
  prestamoId: string
  cuentas: Cuenta[]
  cuotas: Cuota[]
  hoy: string
}) {
  const [estado, accion, enviando] = useActionState(registrarAbono, estadoInicial)
  const [cuotaId, setCuotaId] = useState(cuotas[0]?.id ?? '')

  const cuotaSel = cuotas.find((c) => c.id === cuotaId)
  const clase = 'w-full rounded-lg border bg-transparent px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-ring'

  return (
    <section className="mt-4 rounded-2xl border p-5">
      <p className="text-sm font-medium">Registrar abono</p>

      <form action={accion} className="mt-4 space-y-3">
        <input type="hidden" name="prestamo" value={prestamoId} />

        {cuotas.length > 0 && (
          <div>
            <label htmlFor="cuota" className="mb-1 block text-xs text-muted-foreground">
              ¿A qué cuota se aplica?
            </label>
            <select
              id="cuota" name="cuota" value={cuotaId}
              onChange={(e) => setCuotaId(e.target.value)}
              className={clase}
            >
              {cuotas.map((c) => (
                <option key={c.id} value={c.id}>
                  Cuota {c.number} — {formatearFecha(c.due_date)} —
                  {' '}faltan {formatearCOP(c.pendiente)}
                </option>
              ))}
              <option value="">Sin asignar a una cuota</option>
            </select>
          </div>
        )}

        <div>
          <label htmlFor="monto" className="mb-1 block text-xs text-muted-foreground">
            Cuánto abonó
          </label>
          <input
            id="monto" name="monto" inputMode="numeric" required
            placeholder={cuotaSel ? String(cuotaSel.pendiente) : '400.000'}
            className={`${clase} tabular-nums`}
          />
          {cuotaSel && (
            <p className="mt-1 text-xs text-muted-foreground">
              Puede ser menos: quedará como abono parcial.
            </p>
          )}
        </div>

        <div>
          <label htmlFor="cuenta" className="mb-1 block text-xs text-muted-foreground">
            ¿A qué cuenta entró el dinero?
          </label>
          <select id="cuenta" name="cuenta" required className={clase}>
            {cuentas.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="fecha" className="mb-1 block text-xs text-muted-foreground">
            Fecha
          </label>
          <input id="fecha" name="fecha" type="date" defaultValue={hoy}
                 className={clase} />
        </div>

        <input name="nota" maxLength={200} placeholder="Nota (opcional)"
               className={clase} />

        {estado.error && (
          <p className="text-sm text-destructive" role="alert">{estado.error}</p>
        )}

        <button type="submit" disabled={enviando}
                className="w-full rounded-lg bg-foreground py-2.5 text-sm
                           font-medium text-background disabled:opacity-50">
          {enviando ? 'Registrando…' : 'Registrar abono'}
        </button>
      </form>
    </section>
  )
}