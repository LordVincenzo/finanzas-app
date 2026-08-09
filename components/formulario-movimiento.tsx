'use client'

import { useActionState, useState } from 'react'
import { registrarMovimiento, type EstadoMovimiento } from '@/app/(app)/movimientos/actions'

type Cuenta = { id: string; name: string }

const TIPOS = [
  { valor: 'expense',    etiqueta: 'Gasto' },
  { valor: 'income',     etiqueta: 'Ingreso' },
  { valor: 'transfer',   etiqueta: 'Transferir' },
  { valor: 'adjustment', etiqueta: 'Ajuste' },
] as const

type Tipo = (typeof TIPOS)[number]['valor']

const estadoInicial: EstadoMovimiento = {}

export function FormularioMovimiento({
  cuentas, categoriasGasto, categoriasIngreso, ahora,
}: {
  cuentas: Cuenta[]
  categoriasGasto: Cuenta[]
  categoriasIngreso: Cuenta[]
  ahora: string
}) {
  const [tipo, setTipo] = useState<Tipo>('expense')
  const [estado, accion, enviando] = useActionState(registrarMovimiento, estadoInicial)

  const esAjuste = tipo === 'adjustment'
  const esTransferencia = tipo === 'transfer'
  const categorias = tipo === 'income' ? categoriasIngreso : categoriasGasto

  return (
    <form action={accion} className="mt-6 space-y-5">
      <input type="hidden" name="tipo" value={tipo} />

      {/* Selector de tipo */}
      <div className="grid grid-cols-4 gap-1 rounded-xl bg-muted p-1">
        {TIPOS.map((t) => (
          <button
            key={t.valor}
            type="button"
            onClick={() => setTipo(t.valor)}
            className={`rounded-lg py-2 text-xs font-medium transition ${
              tipo === t.valor
                ? 'bg-background shadow-sm'
                : 'text-muted-foreground'
            }`}
          >
            {t.etiqueta}
          </button>
        ))}
      </div>

      {/* Monto */}
      <div>
        <label htmlFor="monto" className="mb-1.5 block text-sm font-medium">
          {esAjuste ? 'Saldo real de la cuenta' : 'Monto'}
        </label>
        <input
          id="monto" name="monto" inputMode="numeric" required
          placeholder={esAjuste ? '1.500.000' : '20.000'}
          autoFocus
          className="w-full rounded-lg border bg-transparent px-3 py-3 text-2xl
                     font-semibold tabular-nums focus:outline-none
                     focus:ring-2 focus:ring-ring"
        />
        <p className="mt-1.5 text-xs text-muted-foreground">
          {esAjuste
            ? 'Cuánto dinero hay realmente. Registraremos la diferencia.'
            : 'Puedes escribir 20k.'}
        </p>
      </div>

      {/* Cuenta */}
      <div>
        <label htmlFor="cuenta" className="mb-1.5 block text-sm font-medium">
          {tipo === 'income' ? 'Entra a' : esTransferencia ? 'Sale de' : 'Cuenta'}
        </label>
        <select
          id="cuenta" name="cuenta" required
          className="w-full rounded-lg border bg-transparent px-3 py-2.5
                     focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {cuentas.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* Contraparte: categoría o cuenta destino */}
      {!esAjuste && (
        <div>
          <label htmlFor="contraparte" className="mb-1.5 block text-sm font-medium">
            {esTransferencia ? 'Entra a' : 'Categoría'}
          </label>
          <select
            id="contraparte" name="contraparte" required
            className="w-full rounded-lg border bg-transparent px-3 py-2.5
                       focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {(esTransferencia ? cuentas : categorias).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Descripción */}
      {!esAjuste && (
        <div>
          <label htmlFor="descripcion" className="mb-1.5 block text-sm font-medium">
            Descripción
          </label>
          <input
            id="descripcion" name="descripcion" required maxLength={200}
            placeholder="Almuerzo"
            className="w-full rounded-lg border bg-transparent px-3 py-2.5
                       focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      )}

      {/* Fecha y hora */}
      <div>
        <label htmlFor="fecha" className="mb-1.5 block text-sm font-medium">
          Fecha y hora
        </label>
        <input
          id="fecha" name="fecha" type="datetime-local" required
          defaultValue={ahora}
          className="w-full rounded-lg border bg-transparent px-3 py-2.5
                     focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* Notas */}
      <div>
        <label htmlFor="notas" className="mb-1.5 block text-sm font-medium">
          Notas <span className="font-normal text-muted-foreground">(opcional)</span>
        </label>
        <textarea
          id="notas" name="notas" rows={2} maxLength={500}
          className="w-full rounded-lg border bg-transparent px-3 py-2.5
                     focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {estado.error && (
        <p className="text-sm text-destructive" role="alert">{estado.error}</p>
      )}

      <button
        type="submit" disabled={enviando}
        className="w-full rounded-lg bg-foreground py-3 font-medium
                   text-background disabled:opacity-50"
      >
        {enviando ? 'Registrando…' : 'Registrar'}
      </button>
    </form>
  )
}