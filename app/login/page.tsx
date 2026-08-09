'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { iniciarSesion, type EstadoAuth } from '@/app/auth/actions'

const estadoInicial: EstadoAuth = {}

export default function LoginPage() {
  const [estado, accion, enviando] = useActionState(iniciarSesion, estadoInicial)

  return (
    <main className="flex min-h-screen flex-col justify-center px-6 py-12">
      <div className="mx-auto w-full max-w-sm">
        {/* La marca: una cifra. Es lo que la app hace y lo primero que ves. */}
        <p className="text-[15px] uppercase tracking-[0.2em] text-muted-foreground">
          Finanzas
        </p>
        <p className="mt-2 text-[18px] font-semibold leading-none tracking-tight
                      tabular-nums text-muted-foreground/30 select-none">
          "Una meta sin un plan es solo un deseo"
        </p>

        <h1 className="mt-10 text-[22px] font-semibold leading-tight">
          Bienvenido de vuelta
        </h1>

        <form action={accion} className="mt-8 space-y-5">
          <Campo
            id="email" label="Correo" type="email" autoComplete="email"
          />
          <Campo
            id="password" label="Contraseña" type="password"
            autoComplete="current-password"
          />

          {estado.error && (
            <p className="text-[13px] text-destructive" role="alert">
              {estado.error}
            </p>
          )}

          <button
            type="submit" disabled={enviando}
            className="w-full rounded-full bg-foreground py-3 text-[15px]
                       font-medium text-background transition
                       active:scale-[0.99] disabled:opacity-40"
          >
            {enviando ? 'Entrando…' : 'Entrar'}
          </button>
        </form>

        <div className="mt-8 flex items-center justify-between text-[12px]">
          <Link href="/recuperar" className="text-muted-foreground underline">
            Olvidé mi contraseña
          </Link>
          <Link href="/registro" className="font-medium underline">
            Crear cuenta
          </Link>
        </div>
      </div>
    </main>
  )
}

/**
 * Campo con la etiqueta encima de una línea, sin caja.
 * Menos bordes = menos ruido, y el foco se ve mejor.
 */
function Campo({
  id, label, type, autoComplete, minLength, ayuda,
}: {
  id: string
  label: string
  type: string
  autoComplete: string
  minLength?: number
  ayuda?: string
}) {
  return (
    <div>
      <label htmlFor={id}
             className="text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      <input
        id={id} name={id} type={type} required
        autoComplete={autoComplete} minLength={minLength}
        className="mt-1 w-full border-b bg-transparent pb-2 text-[15px]
                   outline-none transition focus:border-foreground"
      />
      {ayuda && (
        <p className="mt-1.5 text-[11px] text-muted-foreground">{ayuda}</p>
      )}
    </div>
  )
}