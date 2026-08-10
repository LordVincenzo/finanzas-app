'use client'

import { useActionState, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { liquidar, type EstadoPareja } from '@/app/(app)/pareja/actions'
import { formatearCOP, parsearCOP } from '@/lib/format'

type Opcion = { id: string; name: string }

const estadoInicial: EstadoPareja = {}

const CAMPO = `min-h-12 w-full rounded-xl border bg-transparent px-3.5
               text-[15px] placeholder:text-muted-foreground/50
               focus:outline-none focus:ring-2 focus:ring-ring`

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

  /* El monto es editable, así que el botón tiene que leerlo de aquí.
     Antes se construía siempre con `balance`: al liquidar una parte, el
     botón anunciaba el total mientras se registraba otra cifra. En el
     botón que confirma un movimiento de dinero eso no puede pasar. */
  const [montoTexto, setMontoTexto] = useState(String(Math.abs(balance)))
  const monto = parsearCOP(montoTexto) ?? 0
  const parcial = monto > 0 && monto < Math.abs(balance)

  return (
    <form action={accion} className="mt-4 space-y-3.5">
      <input type="hidden" name="direccion" value={meDeben ? 'cobro' : 'pago'} />

      <div>
        <label htmlFor="monto-liq"
               className="mb-1.5 block text-[13px] font-medium">
          Cuánto se liquida
        </label>
        <div className="flex items-center rounded-xl border
                        focus-within:ring-2 focus-within:ring-ring">
          <span className="pl-3.5 text-[20px] font-semibold
                           text-muted-foreground">
            $
          </span>
          <input
            id="monto-liq" name="monto" inputMode="numeric" required
            value={montoTexto}
            onChange={(e) => setMontoTexto(e.target.value)}
            className="min-h-12 w-full rounded-xl bg-transparent pl-1.5 pr-3.5
                       text-[20px] font-semibold tabular-nums
                       focus:outline-none"
          />
        </div>
        <p className="mt-1.5 text-[12px] text-muted-foreground tabular-nums">
          {parcial
            ? `Quedarán ${formatearCOP(Math.abs(balance) - monto)} pendientes.`
            : 'Puede ser menos: quedará un saldo pendiente.'}
        </p>
      </div>

      <div>
        <label htmlFor="cta-liq" className="mb-1.5 block text-[13px] font-medium">
          {meDeben ? '¿A qué cuenta te entró?' : '¿De qué cuenta pagaste?'}
        </label>
        <div className="relative">
          <select id="cta-liq" name="cuenta" required
                  className="min-h-12 w-full appearance-none rounded-xl border
                             bg-transparent pl-3.5 pr-10 text-[15px]
                             focus:outline-none focus:ring-2 focus:ring-ring">
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
        {/* Antes este campo no tenía etiqueta: solo un input de fecha suelto
            entre otros dos, sin decir de qué fecha hablaba. */}
        <label htmlFor="fecha-liq"
               className="mb-1.5 block text-[13px] font-medium">
          Fecha
        </label>
        <input id="fecha-liq" name="fecha" type="date" defaultValue={hoy}
               className={`${CAMPO} tabular-nums`} />
      </div>

      <div>
        <label htmlFor="nota-liq"
               className="mb-1.5 block text-[13px] font-medium">
          Nota{' '}
          <span className="font-normal text-muted-foreground">(opcional)</span>
        </label>
        <input id="nota-liq" name="nota" maxLength={200}
               placeholder="Transferencia Nequi" className={CAMPO} />
      </div>

      {estado.error && (
        <p className="text-[13px] text-destructive" role="alert">
          {estado.error}
        </p>
      )}
      {estado.ok && (
        <p className="text-[13px] text-positivo" role="status">{estado.ok}</p>
      )}

      <button
        type="submit" disabled={enviando || monto <= 0}
        className="min-h-12 w-full rounded-xl bg-primary text-[15px]
                   font-medium text-primary-foreground shadow-card
                   transition active:scale-[0.99] disabled:opacity-50"
      >
        {enviando
          ? 'Registrando…'
          : meDeben
            ? `Registrar cobro de ${formatearCOP(monto)}`
            : `Registrar pago de ${formatearCOP(monto)}`}
      </button>

      <p className="text-[11px] leading-snug text-muted-foreground">
        {nombrePareja} verá el movimiento en su balance. El saldo de su
        cuenta lo ajusta ella.
      </p>
    </form>
  )
}