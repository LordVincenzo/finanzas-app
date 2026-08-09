'use client'

import { useActionState, useState } from 'react'
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

  const clase = 'w-full rounded-lg border bg-transparent px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-ring'

  return (
    <form action={accion} className="mt-4 space-y-4">
      <input type="hidden" name="miParte" value={miParte} />

      <div>
        <label htmlFor="total" className="mb-1.5 block text-sm font-medium">
          Monto total
        </label>
        <input
          id="total" name="total" inputMode="numeric" required
          value={totalTexto} onChange={(e) => setTotalTexto(e.target.value)}
          placeholder="120.000"
          className={`${clase} tabular-nums`}
        />
      </div>

      <div>
        <label htmlFor="descripcion" className="mb-1.5 block text-sm font-medium">
          Descripción
        </label>
        <input id="descripcion" name="descripcion" required maxLength={200}
               placeholder="Cena" className={clase} />
      </div>

      {/* --- División --- */}
      <div className="rounded-xl border p-4">
        <p className="text-sm font-medium">Cómo se divide</p>

        <div className="mt-3 grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
          {MODOS.map((m) => (
            <button
              key={m.valor} type="button" onClick={() => setModo(m.valor)}
              className={`rounded-md py-1.5 text-xs font-medium transition ${
                modo === m.valor ? 'bg-background shadow-sm' : 'text-muted-foreground'
              }`}
            >
              {m.etiqueta}
            </button>
          ))}
        </div>

        {modo === 'porcentaje' && (
          <div className="mt-3">
            <label htmlFor="pct" className="mb-1 block text-xs text-muted-foreground">
              Tu porcentaje: {porcentaje}%
            </label>
            <input
              id="pct" type="range" min={0} max={100} step={5}
              value={porcentaje}
              onChange={(e) => setPorcentaje(Number(e.target.value))}
              className="w-full"
            />
          </div>
        )}

        {modo === 'exacto' && (
          <div className="mt-3">
            <label htmlFor="ex" className="mb-1 block text-xs text-muted-foreground">
              Cuánto te corresponde a ti
            </label>
            <input
              id="ex" inputMode="numeric" value={exacto}
              onChange={(e) => setExacto(e.target.value)}
              placeholder="60.000"
              className={`${clase} tabular-nums`}
            />
          </div>
        )}

        {total > 0 && (
          <dl className="mt-4 space-y-1.5 border-t pt-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Tu parte</dt>
              <dd className="tabular-nums">{formatearCOP(miParte)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Parte de {nombrePareja}</dt>
              <dd className="tabular-nums">{formatearCOP(suParte)}</dd>
            </div>
            {suParte > 0 && (
              <p className="pt-1 text-xs text-muted-foreground">
                {nombrePareja} te deberá {formatearCOP(suParte)}.
              </p>
            )}
          </dl>
        )}
      </div>

      <div>
        <label htmlFor="cuenta" className="mb-1.5 block text-sm font-medium">
          Pagaste desde
        </label>
        <select id="cuenta" name="cuenta" required className={clase}>
          {cuentas.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="categoria" className="mb-1.5 block text-sm font-medium">
          Categoría
        </label>
        <select id="categoria" name="categoria" required className={clase}>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="fecha" className="mb-1.5 block text-sm font-medium">
          Fecha
        </label>
        <input id="fecha" name="fecha" type="date" defaultValue={hoy}
               className={clase} />
      </div>

      {estado.error && (
        <p className="text-sm text-destructive" role="alert">{estado.error}</p>
      )}
      {estado.ok && (
        <p className="text-sm text-emerald-600" role="status">{estado.ok}</p>
      )}

      <button type="submit" disabled={enviando || total <= 0}
              className="w-full rounded-lg bg-foreground py-2.5 text-sm
                         font-medium text-background disabled:opacity-50">
        {enviando ? 'Registrando…' : 'Registrar gasto compartido'}
      </button>
    </form>
  )
}