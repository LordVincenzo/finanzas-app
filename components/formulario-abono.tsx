'use client'

import { useActionState, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { registrarAbono, type EstadoPrestamo } from '@/app/(app)/prestamos/actions'
import { formatearCOP, formatearFecha } from '@/lib/format'

type Cuenta = { id: string; name: string }
type Cuota = { id: string; number: number; due_date: string; pendiente: number }

const estadoInicial: EstadoPrestamo = {}

const CAMPO = `min-h-12 w-full rounded-xl border bg-transparent px-3.5
               text-[15px] placeholder:text-muted-foreground/50
               focus:outline-none focus:ring-2 focus:ring-ring`

const SELECT = `min-h-12 w-full appearance-none rounded-xl border
                bg-transparent pl-3.5 pr-10 text-[15px]
                focus:outline-none focus:ring-2 focus:ring-ring`

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

  return (
    <section className="mt-3 rounded-2xl bg-card p-4 shadow-card
                        ring-1 ring-border/70">
      <p className="text-[15px] font-medium">Registrar abono</p>

      <form action={accion} className="mt-4 space-y-3.5">
        <input type="hidden" name="prestamo" value={prestamoId} />

        {cuotas.length > 0 && (
          <div>
            <label htmlFor="cuota-ab"
                   className="mb-1.5 block text-[13px] font-medium">
              ¿A qué cuota se aplica?
            </label>
            <div className="relative">
              <select
                id="cuota-ab" name="cuota" value={cuotaId}
                onChange={(e) => setCuotaId(e.target.value)}
                className={SELECT}
              >
                {cuotas.map((c) => (
                  <option key={c.id} value={c.id}>
                    Cuota {c.number} — {formatearFecha(c.due_date)} —
                    {' '}faltan {formatearCOP(c.pendiente)}
                  </option>
                ))}
                <option value="">Sin asignar a una cuota</option>
              </select>
              <ChevronDown
                aria-hidden
                className="pointer-events-none absolute right-3.5 top-1/2 size-4
                           -translate-y-1/2 text-muted-foreground"
              />
            </div>
          </div>
        )}

        <div>
          <label htmlFor="monto-ab"
                 className="mb-1.5 block text-[13px] font-medium">
            Cuánto abonó
          </label>
          <div className="flex items-center rounded-xl border
                          focus-within:ring-2 focus-within:ring-ring">
            <span className="pl-3.5 text-[20px] font-semibold
                             text-muted-foreground">
              $
            </span>
            <input
              id="monto-ab" name="monto" inputMode="numeric" required
              /* Antes esto era String(pendiente): salía "130000" en un
                 formulario donde todo lo demás va con puntos de millar. */
              placeholder={cuotaSel
                ? formatearCOP(cuotaSel.pendiente).replace('$', '').trim()
                : '400.000'}
              className="min-h-12 w-full rounded-xl bg-transparent pl-1.5 pr-3.5
                         text-[20px] font-semibold tabular-nums
                         placeholder:text-muted-foreground/50
                         focus:outline-none"
            />
          </div>
          {cuotaSel && (
            <p className="mt-1.5 text-[12px] text-muted-foreground">
              Puede ser menos: quedará como abono parcial.
            </p>
          )}
        </div>

        <div>
          <label htmlFor="cuenta-ab"
                 className="mb-1.5 block text-[13px] font-medium">
            ¿A qué cuenta entró el dinero?
          </label>
          <div className="relative">
            <select id="cuenta-ab" name="cuenta" required className={SELECT}>
              {cuentas.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <ChevronDown
              aria-hidden
              className="pointer-events-none absolute right-3.5 top-1/2 size-4
                         -translate-y-1/2 text-muted-foreground"
            />
          </div>
        </div>

        <div>
          <label htmlFor="fecha-ab"
                 className="mb-1.5 block text-[13px] font-medium">
            Fecha
          </label>
          <input id="fecha-ab" name="fecha" type="date" defaultValue={hoy}
                 className={`${CAMPO} tabular-nums`} />
        </div>

        <div>
          {/* Antes este campo solo tenía placeholder, que desaparece al
              escribir y no lo anuncia un lector de pantalla. */}
          <label htmlFor="nota-ab"
                 className="mb-1.5 block text-[13px] font-medium">
            Nota{' '}
            <span className="font-normal text-muted-foreground">(opcional)</span>
          </label>
          <input id="nota-ab" name="nota" maxLength={200}
                 placeholder="Transferencia Nequi" className={CAMPO} />
        </div>

        {estado.error && (
          <p className="text-[13px] text-destructive" role="alert">
            {estado.error}
          </p>
        )}

        <button
          type="submit" disabled={enviando}
          className="min-h-12 w-full rounded-xl bg-primary text-[15px]
                     font-medium text-primary-foreground shadow-card
                     transition active:scale-[0.99] disabled:opacity-50"
        >
          {enviando ? 'Registrando…' : 'Registrar abono'}
        </button>
      </form>
    </section>
  )
}