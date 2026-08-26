'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'

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

/** "2026-08" -> "agosto 2026" */
function nombreMes(mes: string): string {
  const [anio, m] = mes.split('-').map(Number)
  const texto = new Intl.DateTimeFormat('es-CO', {
    month: 'long', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(Date.UTC(anio, m - 1, 1)))
  return texto
}

/**
 * Tres filtros a la vez (mes, tipo, cuenta) — en el celular
 * (SelectorMes) solo hay uno visible por vez. Todos escriben en la
 * misma URL, así que se combinan y se pueden compartir/recargar.
 */
export function FiltrosMovimientosEscritorio({
  mes, cuentas,
}: {
  mes: string
  cuentas: { id: string; name: string }[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const tipoActual = searchParams.get('tipo') ?? ''
  const cuentaActual = searchParams.get('cuenta') ?? ''

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
      <div className="flex items-center gap-1 rounded-full border border-border/70 px-1">
        <button
          type="button" onClick={() => irA({ mes: moverMes(mes, -1) })}
          aria-label="Mes anterior"
          className="flex size-8 items-center justify-center rounded-full
                     text-muted-foreground transition hover:bg-muted"
        >
          <ChevronLeft className="size-4" />
        </button>
        <span className="min-w-[130px] text-center text-[13px] capitalize">
          {nombreMes(mes)}
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
    </div>
  )
}
