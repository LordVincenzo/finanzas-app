'use client'

import { useActionState, useState } from 'react'
import { Camera } from 'lucide-react'
import { actualizarPerfil, type EstadoPerfil } from '@/app/(app)/mas/perfil/actions'
import { AvatarPerfil } from '@/components/avatar-perfil'
import type { Origen } from '@/lib/interfaz'

const estadoInicial: EstadoPerfil = {}

export function FormularioPerfil({
  nombreActual, fotoActual, origen = 'celular',
}: {
  nombreActual: string
  fotoActual: string | null
  origen?: Origen
}) {
  const [estado, accion, enviando] = useActionState(actualizarPerfil, estadoInicial)
  const [previa, setPrevia] = useState<string | null>(null)

  function alElegirFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0]
    if (!archivo) return
    setPrevia(URL.createObjectURL(archivo))
  }

  return (
    <form action={accion} className="mt-6 space-y-6">
      {/* A qué pantalla volver al terminar. Sin esto, guardar el perfil
          desde el escritorio te dejaba en /mas, la ruta del celular. */}
      <input type="hidden" name="origen" value={origen} />

      <div className="flex justify-center">
        <label htmlFor="foto" className="relative cursor-pointer">
          {previa ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previa} alt=""
              className="size-24 rounded-full object-cover ring-1 ring-border/70"
            />
          ) : (
            <AvatarPerfil
              nombre={nombreActual} url={fotoActual}
              className="size-24 text-2xl"
            />
          )}
          <span className="absolute bottom-0 right-0 flex size-8
                           items-center justify-center rounded-full
                           bg-primary text-primary-foreground
                           ring-2 ring-background">
            <Camera className="size-4" />
          </span>
          <input
            id="foto" name="foto" type="file" accept="image/*"
            onChange={alElegirFoto}
            className="sr-only"
          />
        </label>
      </div>

      <div>
        <label htmlFor="nombre" className="mb-1.5 block text-sm font-medium">
          Nombre
        </label>
        <input
          id="nombre" name="nombre" required maxLength={80}
          defaultValue={nombreActual}
          className="min-h-12 w-full rounded-lg border bg-transparent px-3.5
                     text-[15px] focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {estado.error && (
        <p className="text-sm text-destructive" role="alert">{estado.error}</p>
      )}

      <button
        type="submit" disabled={enviando}
        className="min-h-12 w-full rounded-xl bg-primary text-[15px]
                   font-medium text-primary-foreground shadow-card
                   transition active:scale-[0.99] disabled:opacity-50"
      >
        {enviando ? 'Guardando…' : 'Guardar cambios'}
      </button>
    </form>
  )
}
