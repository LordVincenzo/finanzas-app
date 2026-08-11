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

        {/* Antes esto salía en gris y con role="status", como si todo
            hubiera ido bien. Pero el campo se llama `error`: un fallo
            real se leía como una confirmación.

            Si tu acción usa este campo para el mensaje de "enlace
            enviado", conviene separarlo en dos —`error` y `ok`— como ya
            hace EstadoPareja. Mientras tanto, se muestra como lo que
            dice ser. */}
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