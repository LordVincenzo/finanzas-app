'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { iniciarSesion, type EstadoAuth } from '@/app/auth/actions'

const estadoInicial: EstadoAuth = {}

export default function LoginPage() {
  const [estado, accion, enviando] = useActionState(iniciarSesion, estadoInicial)

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold mb-1">Iniciar sesión</h1>
        <p className="text-sm text-neutral-500 mb-6">Accede a tus finanzas</p>

        <form action={accion} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm mb-1.5">Correo</label>
            <input
              id="email" name="email" type="email" required autoComplete="email"
              className="w-full rounded-lg border border-neutral-300 px-3 py-2.5
                         focus:outline-none focus:ring-2 focus:ring-neutral-900"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm mb-1.5">Contraseña</label>
            <input
              id="password" name="password" type="password" required
              autoComplete="current-password"
              className="w-full rounded-lg border border-neutral-300 px-3 py-2.5
                         focus:outline-none focus:ring-2 focus:ring-neutral-900"
            />
          </div>

          {estado.error && (
            <p className="text-sm text-red-600" role="alert">{estado.error}</p>
          )}

          <button
            type="submit" disabled={enviando}
            className="w-full rounded-lg bg-neutral-900 text-white py-2.5
                       font-medium disabled:opacity-50"
          >
            {enviando ? 'Entrando…' : 'Entrar'}
          </button>
        </form>

        <p className="text-sm text-neutral-500 mt-6 text-center">
          ¿No tienes cuenta?{' '}
          <Link href="/registro" className="text-neutral-900 underline">Regístrate</Link>
        </p>
        <p className="mt-3 text-center text-sm">
          <Link href="/recuperar" className="text-muted-foreground underline">
            ¿Olvidaste tu contraseña?
          </Link>
        </p>
      </div>
    </main>
  )
}