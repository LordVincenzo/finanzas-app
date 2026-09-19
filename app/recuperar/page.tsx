'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { recuperarPassword, type EstadoAuth } from '@/app/auth/actions'
import { PantallaAuth, CampoAuth, BotonAuth } from '@/components/auth-ui'

const estadoInicial: EstadoAuth = {}

export default function RecuperarPage() {
  const [estado, accion, enviando] = useActionState(recuperarPassword, estadoInicial)

  return (
    <PantallaAuth
      titulo="Recuperar contraseña"
      subtitulo="Te enviaremos un enlace por correo para que la cambies."
    >
      <form action={accion} className="space-y-4">
        <CampoAuth
          id="email" label="Correo" type="email"
          autoComplete="email" placeholder="tu@correo.com"
        />

        {/* Dos campos, dos tratamientos. El aviso de "te enviamos un
            enlace" viajaba antes dentro de `error` y se pintaba en rojo:
            la confirmación se leía como un fallo. Ahora `ok` es
            confirmación (role="status") y `error` es error
            (role="alert"), que es lo que cada uno dice ser. */}
        {estado.ok && (
          <p className="text-[13px] text-muted-foreground" role="status">
            {estado.ok}
          </p>
        )}

        {estado.error && (
          <p className="text-[13px] text-destructive" role="alert">
            {estado.error}
          </p>
        )}

        <BotonAuth enviando={enviando} textoEnviando="Enviando…">
          Enviar enlace
        </BotonAuth>
      </form>

      <p className="mt-5 text-center text-[13px]">
        <Link href="/login" className="font-medium text-primary">
          Volver a iniciar sesión
        </Link>
      </p>
    </PantallaAuth>
  )
}