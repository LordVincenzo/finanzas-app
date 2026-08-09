'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { recuperarPassword, type EstadoAuth } from '@/app/auth/actions'

const estadoInicial: EstadoAuth = {}

export default function RecuperarPage() {
  const [estado, accion, enviando] = useActionState(recuperarPassword, estadoInicial)

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold">Recuperar contraseña</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Te enviaremos un enlace por correo.
        </p>

        <form action={accion} className="mt-6 space-y-4">
          <input
            name="email" type="email" required placeholder="tu@correo.com"
            className="w-full rounded-lg border bg-transparent px-3 py-2.5
                       focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {estado.error && (
            <p className="text-sm text-muted-foreground" role="status">
              {estado.error}
            </p>
          )}
          <button type="submit" disabled={enviando}
                  className="w-full rounded-lg bg-foreground py-2.5 font-medium
                             text-background disabled:opacity-50">
            {enviando ? 'Enviando…' : 'Enviar enlace'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link href="/login" className="underline">Volver a iniciar sesión</Link>
        </p>
      </div>
    </main>
  )
}