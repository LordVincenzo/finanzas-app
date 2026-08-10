'use client'

import { useActionState, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { crearGastoCompartido, type EstadoPareja } from '@/app/(app)/pareja/actions'
import { formatearCOP, parsearCOP } from '@/lib/format'

type Opcion = { id: string; name: string }

const estadoInicial: EstadoPareja = {}

const MODOS = [
  { valor: 'mitad',      etiqueta: '50/50' },
  { valor: 'porcentaje', etiqueta: '%' },
  { valor: 'exacto',     etiqueta: 'Monto' },
] as const

type Modo = (typeof MODOS)[number]['valor']

const CAMPO = `min-h-12 w-full rounded-xl border bg-transparent px-3.5
               text-[15px] placeholder:text-muted-foreground/50
               focus:outline-none focus:ring-2 focus:ring-ring`

export function FormularioGastoCompartido({
  cuentas, categorias, nombrePareja, hoy,
}: {
  cuentas: Opcion[]
  categorias: Opcion[]
  nombrePareja: string
  hoy: string
}) {
  const [estado, accion, enviando] = useActionState(crearGastoCompartido, estadoInicial)
  const [totalTexto, setTotalTexto] = useState('')
  const [modo, setModo] = useState<Modo>('mitad')
  const [porcentaje, setPorcentaje] = useState(50)
  const [exacto, setExacto] = useState('')

  const total = parsearCOP(totalTexto) ?? 0

  // El resto de la división entera va a MI parte, de forma determinista.
  // 100.001 al 50/50 -> yo 50.001, pareja 50.000. Nunca se pierde un peso.
  let miParte = 0
  if (total > 0) {
    if (modo === 'mitad') {
      miParte = total - Math.floor(total / 2)
    } else if (modo === 'porcentaje') {
      miParte = Math.round((total * porcentaje) / 100)
    } else {
      miParte = Math.min(total, Math.max(0, parsearCOP(exacto) ?? 0))
    }
  }
  const suParte = total - miParte

  /* Con el modo "Monto" y el campo vacío, tu parte sale 0: registraría
     que tu pareja paga el gasto entero y te lo debe todo. Es una
     operación legítima, pero no debería ocurrir por descuido. */
  const faltaExacto = modo === 'exacto' && (parsearCOP(exacto) ?? 0) <= 0

  return (
    <form action={accion} className="mt-4 space-y-4">
      <input type="hidden" name="miParte" value={miParte} />

      <div>
        <label htmlFor="total-gc" className="mb-1.5 block text-[13px] font-medium">
          Monto total
        </label>
        <div className="flex items-center rounded-xl border
                        focus-within:ring-2 focus-within:ring-ring">
          <span className="pl-3.5 text-[20px] font-semibold
                           text-muted-foreground">
            $
          </span>
          <input
            id="total-gc" name="total" inputMode="numeric" required
            value={totalTexto} onChange={(e) => setTotalTexto(e.target.value)}
            placeholder="120.000"
            className="min-h-12 w-full rounded-xl bg-transparent pl-1.5 pr-3.5
                       text-[20px] font-semibold tabular-nums
                       placeholder:text-muted-foreground/50
                       focus:outline-none"
          />
        </div>
      </div>

      <div>
        <label htmlFor="desc-gc" className="mb-1.5 block text-[13px] font-medium">
          Descripción
        </label>
        <input id="desc-gc" name="descripcion" required maxLength={200}
               placeholder="Cena" className={CAMPO} />
      </div>

      {/* --- División --- */}
      <div className="rounded-xl bg-muted/50 p-3">
        <p className="text-[13px] font-medium">Cómo se divide</p>

        <div className="mt-2.5 grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
          {MODOS.map((m) => (
            <button
              key={m.valor} type="button" onClick={() => setModo(m.valor)}
              aria-pressed={modo === m.valor}
              className={`min-h-10 rounded-md text-[13px] font-medium
                          transition ${
                modo === m.valor
                  ? 'bg-card shadow-card'
                  : 'text-muted-foreground'
              }`}
            >
              {m.etiqueta}
            </button>
          ))}
        </div>

        {modo === 'porcentaje' && (
          <div className="mt-3">
            <label htmlFor="pct-gc"
                   className="mb-1.5 block text-[12px] text-muted-foreground">
              Tu porcentaje: {porcentaje}%
            </label>
            <input
              id="pct-gc" type="range" min={0} max={100} step={5}
              value={porcentaje}
              onChange={(e) => setPorcentaje(Number(e.target.value))}
              className="w-full accent-[var(--primary)]"
            />
          </div>
        )}

        {modo === 'exacto' && (
          <div className="mt-3">
            <label htmlFor="ex-gc"
                   className="mb-1.5 block text-[12px] text-muted-foreground">
              Cuánto te corresponde a ti
            </label>
            <input
              id="ex-gc" inputMode="numeric" value={exacto}
              onChange={(e) => setExacto(e.target.value)}
              placeholder="60.000"
              className={`${CAMPO} bg-card tabular-nums`}
            />
          </div>
        )}

        {total > 0 && !faltaExacto && (
          <dl className="mt-3 space-y-1.5 border-t border-border/70 pt-2.5
                         text-[14px]">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Tu parte</dt>
              <dd className="font-medium tabular-nums">
                {formatearCOP(miParte)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">
                Parte de {nombrePareja}
              </dt>
              <dd className="font-medium tabular-nums">
                {formatearCOP(suParte)}
              </dd>
            </div>
            {suParte > 0 && (
              <p className="pt-1 text-[12px] text-muted-foreground tabular-nums">
                {nombrePareja} te deberá {formatearCOP(suParte)}.
              </p>
            )}
          </dl>
        )}
      </div>

      <div>
        <label htmlFor="cuenta-gc" className="mb-1.5 block text-[13px] font-medium">
          Pagaste desde
        </label>
        <div className="relative">
          <select id="cuenta-gc" name="cuenta" required
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
        <label htmlFor="cat-gc" className="mb-1.5 block text-[13px] font-medium">
          Categoría
        </label>
        <div className="relative">
          <select id="cat-gc" name="categoria" required
                  className="min-h-12 w-full appearance-none rounded-xl border
                             bg-transparent pl-3.5 pr-10 text-[15px]
                             focus:outline-none focus:ring-2 focus:ring-ring">
            {categorias.map((c) => (
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
        <label htmlFor="fecha-gc" className="mb-1.5 block text-[13px] font-medium">
          Fecha
        </label>
        <input id="fecha-gc" name="fecha" type="date" defaultValue={hoy}
               className={`${CAMPO} tabular-nums`} />
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
        type="submit" disabled={enviando || total <= 0 || faltaExacto}
        className="min-h-12 w-full rounded-xl bg-primary text-[15px]
                   font-medium text-primary-foreground shadow-card
                   transition active:scale-[0.99] disabled:opacity-50"
      >
        {enviando ? 'Registrando…' : 'Registrar gasto compartido'}
      </button>

      <p className="text-[11px] leading-snug text-muted-foreground">
        Se escriben dos movimientos: uno en tu historial y otro en el de{' '}
        {nombrePareja}, cada uno con su parte.
      </p>
    </form>
  )
}