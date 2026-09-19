'use client'

import { useActionState, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { registrarMovimiento, type EstadoMovimiento } from '@/app/(app)/movimientos/actions'
import type { Origen } from '@/lib/interfaz'

type Cuenta = { id: string; name: string }

const TIPOS = [
  { valor: 'expense',    etiqueta: 'Gasto' },
  { valor: 'income',     etiqueta: 'Ingreso' },
  { valor: 'transfer',   etiqueta: 'Transferir' },
  { valor: 'adjustment', etiqueta: 'Ajuste' },
] as const

export type TipoMovimiento = (typeof TIPOS)[number]['valor']
type Tipo = TipoMovimiento

const estadoInicial: EstadoMovimiento = {}

/**
 * "2026-08-09T16:09" → "Hoy, 4:09 p. m."
 * Se parsea a mano: `new Date("2026-08-09T16:09")` interpreta la cadena en la
 * zona del navegador, y en un celular configurado fuera de Colombia eso
 * mostraría una hora distinta a la que se va a guardar.
 */
function resumenFecha(valor: string, ahora: string): string {
  const [fecha, hora] = valor.split('T')
  if (!fecha || !hora) return 'Sin fecha'

  const [h, min] = hora.split(':').map(Number)
  const sufijo = h < 12 ? 'a. m.' : 'p. m.'
  const h12 = h % 12 === 0 ? 12 : h % 12
  const reloj = `${h12}:${String(min).padStart(2, '0')} ${sufijo}`

  const hoy = ahora.split('T')[0]
  if (fecha === hoy) return `Hoy, ${reloj}`

  const [a, m, d] = fecha.split('-').map(Number)
  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun',
                 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  const anioHoy = Number(hoy.split('-')[0])
  const anio = a === anioHoy ? '' : ` ${a}`
  return `${d} ${MESES[m - 1]}${anio}, ${reloj}`
}

export function FormularioMovimiento({
  cuentas, categoriasGasto, categoriasIngreso, ahora, tipoInicial,
  origen = 'celular',
}: {
  cuentas: Cuenta[]
  categoriasGasto: Cuenta[]
  categoriasIngreso: Cuenta[]
  ahora: string
  tipoInicial?: TipoMovimiento
  origen?: Origen
}) {
  const [tipo, setTipo] = useState<Tipo>(tipoInicial ?? 'expense')
  const [fecha, setFecha] = useState(ahora)
  const [editarFecha, setEditarFecha] = useState(false)
  const [estado, accion, enviando] = useActionState(registrarMovimiento, estadoInicial)

  const esAjuste = tipo === 'adjustment'
  const esTransferencia = tipo === 'transfer'
  const categorias = tipo === 'income' ? categoriasIngreso : categoriasGasto

  return (
    <form action={accion} className="mt-6 space-y-5">
      <input type="hidden" name="tipo" value={tipo} />
      {/* A qué lista volver al terminar. La acción lo traduce contra una
          tabla blanca, nunca lo usa tal cual en redirect(). */}
      <input type="hidden" name="origen" value={origen} />

      {/* Selector de tipo */}
      <div className="grid grid-cols-4 gap-1 rounded-xl bg-muted p-1">
        {TIPOS.map((t) => (
          <button
            key={t.valor}
            type="button"
            onClick={() => setTipo(t.valor)}
            aria-pressed={tipo === t.valor}
            className={`min-h-10 rounded-lg text-[13px] font-medium transition ${
              tipo === t.valor
                ? 'bg-background shadow-sm'
                : 'text-muted-foreground'
            }`}
          >
            {t.etiqueta}
          </button>
        ))}
      </div>

      {/* Monto: el campo protagonista, con el signo de peso siempre visible */}
      <div>
        <label htmlFor="monto" className="mb-1.5 block text-sm font-medium">
          {esAjuste ? 'Saldo real de la cuenta' : 'Monto'}
        </label>
        <div className="flex items-center rounded-lg border
                        focus-within:ring-2 focus-within:ring-ring">
          <span className="pl-3.5 text-2xl font-semibold text-muted-foreground">
            $
          </span>
          <input
            id="monto" name="monto" inputMode="numeric" required
            placeholder={esAjuste ? '1.500.000' : '20.000'}
            autoFocus
            className="min-h-14 w-full rounded-lg bg-transparent pl-1.5 pr-3.5
                       text-2xl font-semibold tabular-nums
                       placeholder:text-muted-foreground/50
                       focus:outline-none"
          />
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">
          {esAjuste
            ? 'Cuánto dinero hay realmente. Registraremos la diferencia.'
            : 'Puedes escribir 20k.'}
        </p>
      </div>

      {/* Cuenta */}
      <Campo
        id="cuenta"
        etiqueta={tipo === 'income' ? 'Entra a' : esTransferencia ? 'Sale de' : 'Cuenta'}
      >
        <Selector id="cuenta" nombre="cuenta" opciones={cuentas} />
      </Campo>

      {/* Contraparte: categoría o cuenta destino */}
      {!esAjuste && (
        <Campo
          id="contraparte"
          etiqueta={esTransferencia ? 'Entra a' : 'Categoría'}
        >
          <Selector
            id="contraparte" nombre="contraparte"
            opciones={esTransferencia ? cuentas : categorias}
          />
        </Campo>
      )}

      {/* Descripción */}
      {!esAjuste && (
        <Campo id="descripcion" etiqueta="Descripción">
          <input
            id="descripcion" name="descripcion" required maxLength={200}
            placeholder="Almuerzo"
            className="min-h-12 w-full rounded-lg border bg-transparent px-3.5
                       text-[15px] placeholder:text-muted-foreground/50
                       focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </Campo>
      )}

      {/* Fecha y hora.
          Casi siempre es "ahora", así que por defecto solo se resume.
          El input no se desmonta al colapsar: si lo hiciera, el campo `fecha`
          llegaría vacío al Server Action. */}
      <div>
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-medium">Fecha y hora</span>
          {!editarFecha && (
            <button
              type="button"
              onClick={() => setEditarFecha(true)}
              className="text-[13px] text-muted-foreground underline"
            >
              Cambiar
            </button>
          )}
        </div>

        {!editarFecha && (
          <p className="mt-1.5 text-[15px] tabular-nums">
            {resumenFecha(fecha, ahora)}
          </p>
        )}

        <div className={editarFecha ? 'mt-1.5' : 'hidden'}>
          <input
            id="fecha" name="fecha" type="datetime-local" required
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="min-h-12 w-full rounded-lg border bg-transparent px-3.5
                       text-[15px] tabular-nums
                       focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      {/* Notas */}
      <Campo
        id="notas"
        etiqueta={
          <>
            Notas{' '}
            <span className="font-normal text-muted-foreground">(opcional)</span>
          </>
        }
      >
        <textarea
          id="notas" name="notas" rows={2} maxLength={500}
          className="w-full rounded-lg border bg-transparent px-3.5 py-3
                     text-[15px] focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </Campo>

      {estado.error && (
        <p className="text-sm text-destructive" role="alert">{estado.error}</p>
      )}

      <button
        type="submit" disabled={enviando}
        className="min-h-12 w-full rounded-xl bg-primary text-[15px]
                   font-medium text-primary-foreground shadow-card
                   transition active:scale-[0.99] disabled:opacity-50"
      >
        {enviando ? 'Registrando…' : 'Registrar'}
      </button>
    </form>
  )
}

/** Etiqueta + control. Mantiene el mismo ritmo en todos los campos. */
function Campo({
  id, etiqueta, children,
}: {
  id: string
  etiqueta: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        {etiqueta}
      </label>
      {children}
    </div>
  )
}

/**
 * Select nativo con apariencia propia.
 * Sigue siendo un <select>: envía su valor solo, abre el selector del sistema
 * en el celular y es accesible sin que tengamos que reimplementarlo.
 */
function Selector({
  id, nombre, opciones,
}: {
  id: string
  nombre: string
  opciones: Cuenta[]
}) {
  return (
    <div className="relative">
      <select
        id={id} name={nombre} required
        className="min-h-12 w-full appearance-none rounded-lg border
                   bg-transparent pl-3.5 pr-10 text-[15px]
                   focus:outline-none focus:ring-2 focus:ring-ring"
      >
        {opciones.map((o) => (
          <option key={o.id} value={o.id}>{o.name}</option>
        ))}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute right-3.5 top-1/2 size-4
                   -translate-y-1/2 text-muted-foreground"
      />
    </div>
  )
}