'use client'

import { useActionState, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { aportar, type EstadoMeta } from '@/app/(app)/ahorros/actions'
import { formatearCOP } from '@/lib/format'

type Cuenta = { account_id: string; name: string; disponible: number }

const estadoInicial: EstadoMeta = {}

export function FormularioAporte({
  metaId, cuentas,
}: {
  metaId: string
  cuentas: Cuenta[]
}) {
  const [signo, setSigno] = useState<'mas' | 'menos'>('mas')
  const [estado, accion, enviando] = useActionState(aportar, estadoInicial)

  if (cuentas.length === 0) return null

  const retirando = signo === 'menos'

  return (
    <section className="mt-3 rounded-2xl bg-card p-4 shadow-card
                        ring-1 ring-border/70">
      <p className="text-[15px] font-medium">Asignar dinero</p>
      <p className="mt-1 text-[12px] leading-snug text-muted-foreground">
        Marca dinero que ya tienes. No se mueve de la cuenta ni cambia tu
        patrimonio.
      </p>

      <form action={accion} className="mt-4 space-y-3.5">
        <input type="hidden" name="meta" value={metaId} />
        {/* El servidor sigue recibiendo el mismo campo que antes. */}
        <input type="hidden" name="signo" value={signo} />

        {/* Añadir o retirar es la decisión más importante del formulario.
            Como <select> quedaba escondida detrás de un toque. */}
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
          {([['mas', 'Añadir'], ['menos', 'Retirar']] as const).map(
            ([valor, etiqueta]) => (
              <button
                key={valor}
                type="button"
                onClick={() => setSigno(valor)}
                aria-pressed={signo === valor}
                className={`min-h-10 rounded-lg text-[13px] font-medium
                            transition ${
                  signo === valor
                    ? 'bg-card shadow-card'
                    : 'text-muted-foreground'
                }`}
              >
                {etiqueta}
              </button>
            )
          )}
        </div>

        <div>
          <label htmlFor="monto-aporte"
                 className="mb-1.5 block text-[13px] font-medium">
            Monto
          </label>
          <div className="flex items-center rounded-xl border
                          focus-within:ring-2 focus-within:ring-ring">
            <span className="pl-3.5 text-[20px] font-semibold
                             text-muted-foreground">
              $
            </span>
            <input
              id="monto-aporte" name="monto" inputMode="numeric" required
              placeholder="300.000"
              className="min-h-12 w-full rounded-xl bg-transparent pl-1.5
                         pr-3.5 text-[20px] font-semibold tabular-nums
                         placeholder:text-muted-foreground/50
                         focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label htmlFor="cuenta-aporte"
                 className="mb-1.5 block text-[13px] font-medium">
            {retirando ? 'Devolver a' : 'Reservar de'}
          </label>
          <div className="relative">
            <select
              id="cuenta-aporte" name="cuenta" required
              className="min-h-12 w-full appearance-none rounded-xl border
                         bg-transparent pl-3.5 pr-10 text-[15px]
                         focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {cuentas.map((c) => (
                <option key={c.account_id} value={c.account_id}>
                  {c.name} — {formatearCOP(Number(c.disponible))} libres
                </option>
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
          <label htmlFor="nota-aporte"
                 className="mb-1.5 block text-[13px] font-medium">
            Nota{' '}
            <span className="font-normal text-muted-foreground">(opcional)</span>
          </label>
          <input
            id="nota-aporte" name="nota" maxLength={200}
            placeholder="Prima de diciembre"
            className="min-h-12 w-full rounded-xl border bg-transparent px-3.5
                       text-[15px] placeholder:text-muted-foreground/50
                       focus:outline-none focus:ring-2 focus:ring-ring"
          />
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
          {enviando ? 'Guardando…' : retirando ? 'Retirar' : 'Reservar'}
        </button>
      </form>
    </section>
  )
}