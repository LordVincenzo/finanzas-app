'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { nombreDelMes } from '@/lib/format'
import { useState } from 'react'
import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react'

const FILTROS_TIPO = [
  { valor: '', etiqueta: 'Todos' },
  { valor: 'expense', etiqueta: 'Gastos' },
  { valor: 'income', etiqueta: 'Ingresos' },
  { valor: 'transfer', etiqueta: 'Traslados' },
  { valor: 'adjustment', etiqueta: 'Ajustes' },
]

/** "2026-08" -> "2026-09" */
function moverMes(mes: string, delta: number): string {
  const [anio, m] = mes.split('-').map(Number)
  const d = new Date(Date.UTC(anio, m - 1 + delta, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}


/**
 * Cuatro filtros a la vez (mes, tipo, cuenta, categoría) — en el
 * celular (SelectorMes) solo hay uno visible por vez. Todos escriben
 * en la misma URL, así que se combinan y se pueden compartir/recargar.
 *
 * "Cuenta" y "categoría" son dos listas separadas aunque las dos
 * filtran por las mismas columnas de la base: una cuenta es dinero
 * (Nu, Efectivo), una categoría es una cuenta de clase expense/income
 * (Alimentación, Sueldo) — mezclarlas en un solo selector es lo que
 * hacía difícil encontrar algo ahí.
 */
export function FiltrosMovimientosEscritorio({
  mes, cuentas, categorias,
}: {
  mes: string
  cuentas: { id: string; name: string }[]
  categorias: { id: string; name: string }[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const tipoActual = searchParams.get('tipo') ?? ''
  const cuentaActual = searchParams.get('cuenta') ?? ''
  const categoriaActual = searchParams.get('categoria') ?? ''
  const busquedaActual = searchParams.get('q') ?? ''

  function irA(cambios: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString())
    for (const [clave, valor] of Object.entries(cambios)) {
      if (valor) params.set(clave, valor)
      else params.delete(clave)
    }
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="mt-6 flex flex-wrap items-center gap-3">
      {/* Buscar va primero porque gana a todo lo demás: cuando hay
          texto, el mes deja de aplicarse. */}
      <Busqueda valor={busquedaActual} alBuscar={(v) => irA({ q: v })} />

      <div className="flex items-center gap-1 rounded-full border border-border/70 px-1">
        <button
          type="button" onClick={() => irA({ mes: moverMes(mes, -1) })}
          aria-label="Mes anterior"
          className="flex size-8 items-center justify-center rounded-full
                     text-muted-foreground transition hover:bg-muted"
        >
          <ChevronLeft className="size-4" />
        </button>
        <span className="min-w-[130px] text-center text-[13px]">
          {nombreDelMes(mes)}
        </span>
        <button
          type="button" onClick={() => irA({ mes: moverMes(mes, 1) })}
          aria-label="Mes siguiente"
          className="flex size-8 items-center justify-center rounded-full
                     text-muted-foreground transition hover:bg-muted"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {FILTROS_TIPO.map((f) => (
          <button
            key={f.valor}
            type="button"
            onClick={() => irA({ tipo: f.valor })}
            className={`h-8 rounded-full px-3 text-[13px] font-medium transition ${
              tipoActual === f.valor
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            {f.etiqueta}
          </button>
        ))}
      </div>

      <div className="relative">
        <select
          value={cuentaActual}
          onChange={(e) => irA({ cuenta: e.target.value })}
          className="h-8 appearance-none rounded-full border border-border/70
                     bg-transparent pl-3 pr-8 text-[13px]
                     focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Todas las cuentas</option>
          {cuentas.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <div className="relative">
        <select
          value={categoriaActual}
          onChange={(e) => irA({ categoria: e.target.value })}
          className="h-8 appearance-none rounded-full border border-border/70
                     bg-transparent pl-3 pr-8 text-[13px]
                     focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Todas las categorías</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>
    </div>
  )
}

/**
 * El campo de búsqueda.
 *
 * Con estado propio y submit, no con un push en cada tecla: cada
 * pulsación sería una consulta a la base y una navegación, y aquí se
 * escribe, se borra y se vuelve a escribir.
 */
function Busqueda({
  valor, alBuscar,
}: {
  valor: string
  alBuscar: (v: string) => void
}) {
  const [texto, setTexto] = useState(valor)

  return (
    <form
      role="search"
      onSubmit={(e) => { e.preventDefault(); alBuscar(texto.trim()) }}
      className="relative"
    >
      <Search aria-hidden
        className="pointer-events-none absolute left-3 top-1/2 size-4
                   -translate-y-1/2 text-muted-foreground" />
      <input
        type="search"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Buscar en todo el historial"
        aria-label="Buscar movimientos"
        maxLength={60}
        className="h-9 w-64 rounded-full border border-border/70
                   bg-transparent pl-9 pr-8 text-[13px]
                   placeholder:text-muted-foreground/60
                   focus:outline-none focus:ring-2 focus:ring-ring
                   [&::-webkit-search-cancel-button]:hidden"
      />
      {texto && (
        <button
          type="button"
          aria-label="Borrar la búsqueda"
          onClick={() => { setTexto(''); alBuscar('') }}
          className="absolute right-2 top-1/2 -translate-y-1/2
                     text-muted-foreground transition hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      )}
    </form>
  )
}
