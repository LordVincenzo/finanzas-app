'use client'

import { useActionState } from 'react'
import { liquidar, type EstadoPareja } from '@/app/(app)/pareja/actions'
import { formatearCOP } from '@/lib/format'

type Opcion = { id: string; name: string }

const estadoInicial: EstadoPareja = {}

export function FormularioLiquidar({
  cuentas, balance, nombrePareja, hoy,
}: {
  cuentas: Opcion[]
  balance: number
  nombrePareja: string
  hoy: string
}) {
  const [estado, accion, enviando] = useActionState(liquidar, estadoInicial)
  const meDeben = balance > 0
  const clase = 'w-full rounded-lg border bg-transparent px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-ring'

  return (
    <form action={accion} className="mt-4 space-y-3">
      <input type="hidden" name="direccion" value={meDeben ? 'cobro' : 'pago'} />

      <div>
        <label htmlFor="monto" className="mb-1 block text-xs text-muted-foreground">
          Cuánto se liquida
        </label>
        <input
          id="monto" name="monto" inputMode="numeric" required
          defaultValue={String(Math.abs(balance))}
          className={`${clase} tabular-nums`}
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Puede ser menos: quedará un saldo pendiente.
        </p>
      </div>

      <div>
        <label htmlFor="cta" className="mb-1 block text-xs text-muted-foreground">
          {meDeben ? '¿A qué cuenta te entró?' : '¿De qué cuenta pagaste?'}
        </label>
        <select id="cta" name="cuenta" required className={clase}>
          {cuentas.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <input name="fecha" type="date" defaultValue={hoy} className={clase} />
      <input name="nota" maxLength={200} placeholder="Nota (opcional)"
             className={clase} />

      {estado.error && (
        <p className="text-sm text-destructive" role="alert">{estado.error}</p>
      )}
      {estado.ok && (
        <p className="text-sm text-positivo" role="status">{estado.ok}</p>
      )}

      <button type="submit" disabled={enviando}
              className="w-full rounded-lg bg-foreground py-2.5 text-sm
                         font-medium text-background disabled:opacity-50">
        {enviando
          ? 'Registrando…'
          : meDeben
            ? `Registrar cobro de ${formatearCOP(Math.abs(balance))}`
            : `Registrar pago de ${formatearCOP(Math.abs(balance))}`}
      </button>
    </form>
  )
}