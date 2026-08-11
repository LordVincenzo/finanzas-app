'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { registrarse, type EstadoAuth } from '@/app/auth/actions'
import { PantallaAuth, CampoAuth, BotonAuth } from '@/components/auth-ui'

const estadoInicial: EstadoAuth = {}

export default function RegistroPage() {
  const [estado, accion, enviando] = useActionState(registrarse, estadoInicial)

  return (
    <PantallaAuth
      titulo="Crea tu espacio"
      subtitulo="Privado por defecto. Tú decides qué compartir y cuándo."
    >
      <form action={accion} className="space-y-4">
        <CampoAuth
          id="nombre" label="Nombre" type="text"
          autoComplete="name" 
        />
        <CampoAuth
          id="email" label="Correo" type="email"
          autoComplete="email" placeholder="tu@correo.com"
        />
        <CampoAuth
          id="password" label="Contraseña" type="password"
          autoComplete="new-password" minLength={8}
          ayuda="Mínimo 8 caracteres"
        />

        {estado.error && (
          <p className="text-[13px] text-destructive" role="alert">
            {estado.error}
          </p>
        )}

        <BotonAuth enviando={enviando} textoEnviando="Creando cuenta…">
          Crear cuenta
        </BotonAuth>
      </form>

      <p className="mt-5 text-center text-[13px] text-muted-foreground">
        ¿Ya tienes cuenta?{' '}
        <Link href="/login" className="font-medium text-primary">
          Inicia sesión
        </Link>
      </p>
    </PantallaAuth>
  )
}