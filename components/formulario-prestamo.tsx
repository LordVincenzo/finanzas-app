'use client'

import { useActionState, useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { crearPrestamo, type EstadoPrestamo } from '@/app/(app)/prestamos/actions'
import { formatearCOP, parsearCOP } from '@/lib/format'
import type { Origen } from '@/lib/interfaz'

type Cuenta = { id: string; name: string }
type Cuota = { fecha: string; monto: number }

const estadoInicial: EstadoPrestamo = {}

const CAMPO = `min-h-12 w-full rounded-xl border bg-transparent px-3.5
               text-[15px] placeholder:text-muted-foreground/50
               focus:outline-none focus:ring-2 focus:ring-ring`

/** Suma meses a una fecha ISO conservando el día cuando es posible. */
function sumarMeses(iso: string, meses: number): string {
  const [a, m, d] = iso.split('-').map(Number)
  const base = new Date(Date.UTC(a, m - 1 + meses, 1))
  const ultimoDia = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0)).getUTCDate()
  base.setUTCDate(Math.min(d, ultimoDia))
  return base.toISOString().slice(0, 10)
}

export function FormularioPrestamo({
  cuentas, hoy, origen = 'celular',
}: {
  cuentas: Cuenta[]
  hoy: string
  origen?: Origen
}) {
  const [estado, accion, enviando] = useActionState(crearPrestamo, estadoInicial)
  const [montoTexto, setMontoTexto] = useState('')
  const [numCuotas, setNumCuotas] = useState(1)
  const [primeraFecha, setPrimeraFecha] = useState(sumarMeses(hoy, 1))
  const [cuotas, setCuotas] = useState<Cuota[] | null>(null)

  const monto = parsearCOP(montoTexto) ?? 0

  /** Reparte el monto en N cuotas mensuales. El resto va a la última. */
  const generadas = useMemo<Cuota[]>(() => {
    if (monto <= 0 || numCuotas < 1) return []
    const base = Math.floor(monto / numCuotas)
    const resto = monto - base * numCuotas
    return Array.from({ length: numCuotas }, (_, i) => ({
      fecha: sumarMeses(primeraFecha, i),
      monto: i === numCuotas - 1 ? base + resto : base,
    }))
  }, [monto, numCuotas, primeraFecha])

  const activas = cuotas ?? generadas
  const suma = activas.reduce((s, c) => s + c.monto, 0)
  const cuadra = suma === monto

  function editarCuota(i: number, campo: 'fecha' | 'monto', valor: string) {
    const copia = [...activas]
    copia[i] = {
      ...copia[i],
      [campo]: campo === 'monto' ? (parsearCOP(valor) ?? 0) : valor,
    }
    setCuotas(copia)
  }

  return (
    <form action={accion} className="mt-5 space-y-4">
      <input type="hidden" name="cuotas" value={JSON.stringify(activas)} />
      {/* A qué lista volver al terminar. La acción lo traduce contra una
          tabla blanca, nunca lo usa tal cual en redirect(). */}
      <input type="hidden" name="origen" value={origen} />

      <div>
        <label htmlFor="persona" className="mb-1.5 block text-[13px] font-medium">
          ¿A quién le prestaste?
        </label>
        <input id="persona" name="persona" required maxLength={80}
               placeholder="Juan Pérez" className={CAMPO} />
      </div>

      <div>
        <label htmlFor="monto-pr" className="mb-1.5 block text-[13px] font-medium">
          Monto prestado
        </label>
        <div className="flex items-center rounded-xl border
                        focus-within:ring-2 focus-within:ring-ring">
          <span className="pl-3.5 text-[20px] font-semibold
                           text-muted-foreground">
            $
          </span>
          <input
            id="monto-pr" name="monto" inputMode="numeric" required
            value={montoTexto}
            onChange={(e) => { setMontoTexto(e.target.value); setCuotas(null) }}
            placeholder="1.200.000"
            className="min-h-12 w-full rounded-xl bg-transparent pl-1.5 pr-3.5
                       text-[20px] font-semibold tabular-nums
                       placeholder:text-muted-foreground/50
                       focus:outline-none"
          />
        </div>
        <p className="mt-1.5 text-[12px] text-muted-foreground">
          Prestar no reduce tu patrimonio: pasa a «por cobrar».
        </p>
      </div>

      <div>
        <label htmlFor="cuenta-pr" className="mb-1.5 block text-[13px] font-medium">
          ¿De qué cuenta salió?
        </label>
        <div className="relative">
          <select id="cuenta-pr" name="cuenta" required
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
        <label htmlFor="fecha-pr" className="mb-1.5 block text-[13px] font-medium">
          Fecha del préstamo
        </label>
        <input id="fecha-pr" name="fecha" type="date" required
               defaultValue={hoy} className={`${CAMPO} tabular-nums`} />
      </div>

      {/* --- Cuotas --- */}
      <div className="rounded-xl bg-muted/50 p-3">
        <p className="text-[13px] font-medium">Cuotas</p>

        <div className="mt-2.5 flex gap-2">
          <div className="flex-1">
            <label htmlFor="num-cuotas"
                   className="mb-1.5 block text-[12px] text-muted-foreground">
              Cantidad
            </label>
            <input
              id="num-cuotas" type="number" min={1} max={60} value={numCuotas}
              onChange={(e) => {
                setNumCuotas(Math.max(1, Number(e.target.value) || 1))
                setCuotas(null)
              }}
              className={`${CAMPO} bg-card tabular-nums`}
            />
          </div>
          <div className="flex-[2]">
            <label htmlFor="prim-fecha"
                   className="mb-1.5 block text-[12px] text-muted-foreground">
              Primera fecha
            </label>
            <input
              id="prim-fecha" type="date" value={primeraFecha}
              onChange={(e) => { setPrimeraFecha(e.target.value); setCuotas(null) }}
              className={`${CAMPO} bg-card tabular-nums`}
            />
          </div>
        </div>

        {activas.length > 0 && (
          <>
            <ul className="mt-3 space-y-1.5">
              {activas.map((c, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="w-5 shrink-0 text-[12px]
                                   text-muted-foreground tabular-nums">
                    {i + 1}
                  </span>
                  <input
                    type="date" value={c.fecha}
                    onChange={(e) => editarCuota(i, 'fecha', e.target.value)}
                    aria-label={`Fecha de la cuota ${i + 1}`}
                    className="min-h-10 flex-1 rounded-lg border bg-card px-2
                               text-[13px] tabular-nums focus:outline-none
                               focus:ring-2 focus:ring-ring"
                  />
                  <input
                    inputMode="numeric"
                    value={c.monto.toLocaleString('es-CO')}
                    onChange={(e) => editarCuota(i, 'monto', e.target.value)}
                    aria-label={`Monto de la cuota ${i + 1}`}
                    className="min-h-10 w-28 rounded-lg border bg-card px-2
                               text-right text-[13px] tabular-nums
                               focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </li>
              ))}
            </ul>

            <div className={`mt-3 flex justify-between border-t
                             border-border/70 pt-2.5 text-[13px] tabular-nums
                             ${cuadra ? 'text-muted-foreground' : 'text-destructive'}`}>
              <span>Suma de cuotas</span>
              <span className="font-medium">{formatearCOP(suma)}</span>
            </div>
            {!cuadra && (
              <p className="mt-1 text-[12px] text-destructive tabular-nums">
                Debe coincidir con {formatearCOP(monto)}
              </p>
            )}
          </>
        )}

        <p className="mt-2.5 text-[12px] leading-snug text-muted-foreground">
          Se generan mensuales. Puedes editar cada fecha y monto.
        </p>
      </div>

      <div>
        <label htmlFor="notas-pr" className="mb-1.5 block text-[13px] font-medium">
          Notas{' '}
          <span className="font-normal text-muted-foreground">(opcional)</span>
        </label>
        <textarea id="notas-pr" name="notas" rows={2} maxLength={500}
                  className="w-full rounded-xl border bg-transparent px-3.5 py-3
                             text-[15px] focus:outline-none focus:ring-2
                             focus:ring-ring" />
      </div>

      {estado.error && (
        <p className="text-[13px] text-destructive" role="alert">
          {estado.error}
        </p>
      )}

      <button
        type="submit" disabled={enviando || !cuadra || monto <= 0}
        className="min-h-12 w-full rounded-xl bg-primary text-[15px]
                   font-medium text-primary-foreground shadow-card
                   transition active:scale-[0.99] disabled:opacity-50"
      >
        {enviando ? 'Registrando…' : 'Registrar préstamo'}
      </button>
    </form>
  )
}