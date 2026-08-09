'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { registrarse, type EstadoAuth } from '@/app/auth/actions'

const estadoInicial: EstadoAuth = {}

export default function RegistroPage() {
  const [estado, accion, enviando] = useActionState(registrarse, estadoInicial)

  return (
    <main className="flex min-h-screen flex-col justify-center px-6 py-12">
      <div className="mx-auto w-full max-w-sm">
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          Finanzas
        </p>
        <p className="mt-2 text-[34px] font-semibold leading-none tracking-tight
                      tabular-nums text-muted-foreground/25 select-none">
          $0.000.000
        </p>

        <h1 className="mt-10 text-[22px] font-semibold leading-tight">
          Crea tu espacio
        </h1>
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
          Privado por defecto. Tú decides qué compartir y cuándo.
        </p>

        <form action={accion} className="mt-8 space-y-5">
          <Campo id="nombre" label="Nombre" type="text" autoComplete="name" />
          <Campo id="email" label="Correo" type="email" autoComplete="email" />
          <Campo
            id="password" label="Contraseña" type="password"
            autoComplete="new-password" minLength={8}
            ayuda="Mínimo 8 caracteres"
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
            {enviando ? 'Creando cuenta…' : 'Crear cuenta'}
          </button>
        </form>

        <p className="mt-8 text-center text-[12px] text-muted-foreground">
          ¿Ya tienes cuenta?{' '}
          <Link href="/login" className="font-medium text-foreground underline">
            Inicia sesión
          </Link>
        </p>
      </div>
    </main>
  )
}

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