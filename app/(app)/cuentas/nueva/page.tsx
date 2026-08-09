'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { crearCuenta, type EstadoCuenta } from '../actions'
import { TIPOS_CUENTA, VISIBILIDADES } from '@/lib/tipos'

const estadoInicial: EstadoCuenta = {}

export default function NuevaCuentaPage() {
  const [estado, accion, enviando] = useActionState(crearCuenta, estadoInicial)

  return (
    <main className="px-5 pt-6">
      <Link
        href="/cuentas"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground"
      >
        <ChevronLeft className="size-4" /> Cuentas
      </Link>

      <h1 className="mt-4 text-2xl font-semibold">Nueva cuenta</h1>

      <form action={accion} className="mt-6 space-y-5">
        <Campo etiqueta="Nombre" htmlFor="nombre">
          <input
            id="nombre" name="nombre" required maxLength={60}
            placeholder="Nu"
            className="w-full rounded-lg border bg-transparent px-3 py-2.5
                       focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </Campo>

        <Campo etiqueta="Tipo" htmlFor="tipo">
          <select
            id="tipo" name="tipo" required defaultValue="digital_wallet"
            className="w-full rounded-lg border bg-transparent px-3 py-2.5
                       focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {TIPOS_CUENTA.map((t) => (
              <option key={t.valor} value={t.valor}>{t.etiqueta}</option>
            ))}
          </select>
        </Campo>

        <Campo etiqueta="Institución" htmlFor="institucion" opcional>
          <input
            id="institucion" name="institucion" maxLength={60}
            placeholder="Nu Colombia"
            className="w-full rounded-lg border bg-transparent px-3 py-2.5
                       focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </Campo>

        <Campo etiqueta="Saldo actual" htmlFor="saldoInicial">
          <input
            id="saldoInicial" name="saldoInicial" inputMode="numeric"
            placeholder="2.430.000"
            className="w-full rounded-lg border bg-transparent px-3 py-2.5
                       tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <p className="mt-1.5 text-xs text-muted-foreground">
            Cuánto dinero tienes ahí ahora. Puedes escribir 2430k.
          </p>
        </Campo>

        <Campo etiqueta="Visibilidad" htmlFor="visibilidad">
          <select
            id="visibilidad" name="visibilidad" required defaultValue="private"
            className="w-full rounded-lg border bg-transparent px-3 py-2.5
                       focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {VISIBILIDADES.map((v) => (
              <option key={v.valor} value={v.valor}>
                {v.etiqueta} — {v.ayuda}
              </option>
            ))}
          </select>
        </Campo>

        {estado.error && (
          <p className="text-sm text-destructive" role="alert">{estado.error}</p>
        )}

        <button
          type="submit" disabled={enviando}
          className="w-full rounded-lg bg-foreground py-3 font-medium
                     text-background disabled:opacity-50"
        >
          {enviando ? 'Creando…' : 'Crear cuenta'}
        </button>
      </form>
    </main>
  )
}

function Campo({
  etiqueta, htmlFor, opcional, children,
}: {
  etiqueta: string
  htmlFor: string
  opcional?: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium">
        {etiqueta}
        {opcional && (
          <span className="ml-1 font-normal text-muted-foreground">(opcional)</span>
        )}
      </label>
      {children}
    </div>
  )
}