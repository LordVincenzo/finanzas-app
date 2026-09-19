'use client'

import { useState, useTransition } from 'react'
import { formatearCOP, parsearCOP } from '@/lib/format'
import { ajustarSaldoEscritorio } from '@/app/escritorio/cuentas/actions'

/**
 * Saldo que se edita haciendo clic encima, sin salir de la tabla.
 *
 * Muestra y edita el DISPONIBLE (saldo real menos lo comprometido en
 * metas), no el saldo real de la cuenta — mostrar el saldo real hacía
 * pensar que ese dinero comprometido también estaba libre para gastar.
 * `ajustar_saldo` sigue necesitando el saldo real, así que al guardar
 * se le vuelve a sumar `asignado` antes de llamarlo.
 */
export function SaldoEditable({
  cuentaId, disponible, asignado = 0, deuda = false,
}: {
  cuentaId: string
  disponible: number
  asignado?: number
  /** Una deuda se muestra y se edita en positivo: "cuánto debes". */
  deuda?: boolean
}) {
  const [editando, setEditando] = useState(false)
  const [texto, setTexto] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  /* En una deuda el saldo del ledger es negativo (así resta del
     patrimonio), pero nadie piensa su tarjeta como "-500.000": se
     muestra y se escribe lo que debes, en positivo. La acción vuelve a
     ponerle el signo, consultando la clase en la base. */
  const mostrado = deuda ? Math.abs(disponible) : disponible

  function empezar() {
    setTexto(String(mostrado))
    setError(null)
    setEditando(true)
  }

  function guardar() {
    if (pending) return

    const valor = parsearCOP(texto)
    if (valor === null) {
      setError('Número inválido')
      return
    }
    if (valor === mostrado) {
      setEditando(false)
      return
    }

    startTransition(async () => {
      const resultado = await ajustarSaldoEscritorio(cuentaId, valor + asignado)
      if (resultado.error) {
        setError(resultado.error)
      } else {
        setEditando(false)
      }
    })
  }

  if (!editando) {
    return (
      <button
        type="button"
        onClick={empezar}
        title={deuda
          ? 'Clic para ajustar lo que debes'
          : asignado > 0
            ? `Saldo real de la cuenta: ${formatearCOP(disponible + asignado)}`
            : 'Clic para ajustar el saldo'}
        className="rounded-md px-2 py-1 tabular-nums transition hover:bg-muted"
      >
        {formatearCOP(mostrado)}
      </button>
    )
  }

  return (
    <div className="flex items-center justify-end gap-2">
      {error && <span className="text-[11px] text-destructive">{error}</span>}
      <input
        autoFocus
        value={texto}
        onChange={(e) => { setTexto(e.target.value); setError(null) }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') guardar()
          if (e.key === 'Escape') setEditando(false)
        }}
        onBlur={guardar}
        className="h-8 w-32 rounded-md border border-border bg-transparent px-2
                   text-right text-[13px] tabular-nums focus:outline-none
                   focus:ring-2 focus:ring-ring"
      />
    </div>
  )
}
