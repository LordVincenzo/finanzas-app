'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { iniciarSesion, type EstadoAuth } from '@/app/auth/actions'
import { PantallaAuth, CampoAuth, BotonAuth } from '@/components/auth-ui'

const estadoInicial: EstadoAuth = {}

export default function LoginPage() {
  const [estado, accion, enviando] = useActionState(iniciarSesion, estadoInicial)

  return (
    <PantallaAuth
      titulo="Bienvenido de vuelta"
      subtitulo="Tu dinero y el de ella, cada uno en su sitio."
    >
      <form action={accion} className="space-y-4">
        <CampoAuth
          id="email" label="Correo" type="email"
          autoComplete="email" placeholder="tu@correo.com"
        />
        <CampoAuth
          id="password" label="Contraseña" type="password"
          autoComplete="current-password"
        />

        {estado.error && (
          <p className="text-[13px] text-destructive" role="alert">
            {estado.error}
          </p>
        )}

        <BotonAuth enviando={enviando} textoEnviando="Entrando…">
          Entrar
        </BotonAuth>
      </form>

      <div className="mt-5 flex items-center justify-between gap-3 text-[13px]">
        <Link href="/recuperar" className="text-muted-foreground">
          Olvidé mi contraseña
        </Link>
        <Link href="/registro" className="font-medium text-primary">
          Crear cuenta
        </Link>
      </div>
    </PantallaAuth>
  )
}