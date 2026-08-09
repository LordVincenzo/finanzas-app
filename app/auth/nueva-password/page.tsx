'use client'

import { useActionState } from 'react'
import { cambiarPassword, type EstadoAuth } from '@/app/auth/actions'

const estadoInicial: EstadoAuth = {}

export default function NuevaPasswordPage() {
  const [estado, accion, enviando] = useActionState(cambiarPassword, estadoInicial)

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold">Nueva contraseña</h1>

        <form action={accion} className="mt-6 space-y-4">
          <input
            name="password" type="password" required minLength={8}
            autoComplete="new-password" placeholder="Mínimo 8 caracteres"
            className="w-full rounded-lg border bg-transparent px-3 py-2.5
                       focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {estado.error && (
            <p className="text-sm text-destructive" role="alert">{estado.error}</p>
          )}
          <button type="submit" disabled={enviando}
                  className="w-full rounded-lg bg-foreground py-2.5 font-medium
                             text-background disabled:opacity-50">
            {enviando ? 'Guardando…' : 'Cambiar contraseña'}
          </button>
        </form>
      </div>
    </main>
  )
}