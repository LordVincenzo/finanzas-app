'use client'

import { useActionState, useMemo, useState } from 'react'
import { crearPrestamo, type EstadoPrestamo } from '@/app/(app)/prestamos/actions'
import { formatearCOP, parsearCOP } from '@/lib/format'

type Cuenta = { id: string; name: string }
type Cuota = { fecha: string; monto: number }

const estadoInicial: EstadoPrestamo = {}

/** Suma meses a una fecha ISO conservando el día cuando es posible. */
function sumarMeses(iso: string, meses: number): string {
  const [a, m, d] = iso.split('-').map(Number)
  const base = new Date(Date.UTC(a, m - 1 + meses, 1))
  const ultimoDia = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0)).getUTCDate()
  base.setUTCDate(Math.min(d, ultimoDia))
  return base.toISOString().slice(0, 10)
}

export function FormularioPrestamo({
  cuentas, hoy,
}: {
  cuentas: Cuenta[]
  hoy: string
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

  const clase = 'w-full rounded-lg border bg-transparent px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-ring'

  function editarCuota(i: number, campo: 'fecha' | 'monto', valor: string) {
    const copia = [...activas]
    copia[i] = {
      ...copia[i],
      [campo]: campo === 'monto' ? (parsearCOP(valor) ?? 0) : valor,
    }
    setCuotas(copia)
  }

  return (
    <form action={accion} className="mt-6 space-y-5">
      <input type="hidden" name="cuotas" value={JSON.stringify(activas)} />

      <div>
        <label htmlFor="persona" className="mb-1.5 block text-sm font-medium">
          ¿A quién le prestaste?
        </label>
        <input id="persona" name="persona" required maxLength={80}
               placeholder="Juan Pérez" className={clase} />
      </div>

      <div>
        <label htmlFor="monto" className="mb-1.5 block text-sm font-medium">
          Monto prestado
        </label>
        <input
          id="monto" name="monto" inputMode="numeric" required
          value={montoTexto}
          onChange={(e) => { setMontoTexto(e.target.value); setCuotas(null) }}
          placeholder="1.200.000"
          className={`${clase} tabular-nums`}
        />
      </div>

      <div>
        <label htmlFor="cuenta" className="mb-1.5 block text-sm font-medium">
          ¿De qué cuenta salió?
        </label>
        <select id="cuenta" name="cuenta" required className={clase}>
          {cuentas.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="fecha" className="mb-1.5 block text-sm font-medium">
          Fecha del préstamo
        </label>
        <input id="fecha" name="fecha" type="date" required
               defaultValue={hoy} className={clase} />
      </div>

      {/* --- Cuotas --- */}
      <div className="rounded-2xl border p-4">
        <p className="text-sm font-medium">Cuotas</p>

        <div className="mt-3 flex gap-2">
          <div className="flex-1">
            <label htmlFor="num" className="mb-1 block text-xs text-muted-foreground">
              Cantidad
            </label>
            <input
              id="num" type="number" min={1} max={60} value={numCuotas}
              onChange={(e) => {
                setNumCuotas(Math.max(1, Number(e.target.value) || 1))
                setCuotas(null)
              }}
              className={clase}
            />
          </div>
          <div className="flex-[2]">
            <label htmlFor="prim" className="mb-1 block text-xs text-muted-foreground">
              Primera fecha
            </label>
            <input
              id="prim" type="date" value={primeraFecha}
              onChange={(e) => { setPrimeraFecha(e.target.value); setCuotas(null) }}
              className={clase}
            />
          </div>
        </div>

        {activas.length > 0 && (
          <>
            <ul className="mt-4 space-y-2">
              {activas.map((c, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="w-5 shrink-0 text-xs text-muted-foreground">
                    {i + 1}
                  </span>
                  <input
                    type="date" value={c.fecha}
                    onChange={(e) => editarCuota(i, 'fecha', e.target.value)}
                    className="flex-1 rounded-lg border bg-transparent px-2 py-1.5 text-xs"
                  />
                  <input
                    inputMode="numeric"
                    value={c.monto.toLocaleString('es-CO')}
                    onChange={(e) => editarCuota(i, 'monto', e.target.value)}
                    className="w-28 rounded-lg border bg-transparent px-2 py-1.5
                               text-right text-xs tabular-nums"
                  />
                </li>
              ))}
            </ul>

            <div className={`mt-3 flex justify-between border-t pt-2 text-xs
                             tabular-nums ${cuadra ? 'text-muted-foreground' : 'text-destructive'}`}>
              <span>Suma de cuotas</span>
              <span>{formatearCOP(suma)}</span>
            </div>
            {!cuadra && (
              <p className="mt-1 text-xs text-destructive">
                Debe coincidir con {formatearCOP(monto)}
              </p>
            )}
          </>
        )}

        <p className="mt-3 text-xs text-muted-foreground">
          Se generan mensuales. Puedes editar cada fecha y monto.
        </p>
      </div>

      <div>
        <label htmlFor="notas" className="mb-1.5 block text-sm font-medium">
          Notas <span className="font-normal text-muted-foreground">(opcional)</span>
        </label>
        <textarea id="notas" name="notas" rows={2} maxLength={500} className={clase} />
      </div>

      {estado.error && (
        <p className="text-sm text-destructive" role="alert">{estado.error}</p>
      )}

      <button type="submit" disabled={enviando || !cuadra || monto <= 0}
              className="w-full rounded-lg bg-foreground py-3 font-medium
                         text-background disabled:opacity-50">
        {enviando ? 'Registrando…' : 'Registrar préstamo'}
      </button>
    </form>
  )
}