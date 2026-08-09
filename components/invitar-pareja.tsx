'use client'

import { useActionState } from 'react'
import { invitar, type EstadoPareja } from '@/app/(app)/pareja/actions'

const estadoInicial: EstadoPareja = {}

export function InvitarPareja() {
  const [estado, accion, enviando] = useActionState(invitar, estadoInicial)

  return (
    <form action={accion} className="mt-6 space-y-3">
      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm font-medium">
          Correo de tu pareja
        </label>
        <input
          id="email" name="email" type="email" required
          placeholder="correo@ejemplo.com"
          className="w-full rounded-lg border bg-transparent px-3 py-2.5
                     focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <p className="mt-1.5 text-xs text-muted-foreground">
          Debe estar registrada con ese correo.
        </p>
      </div>

      {estado.error && (
        <p className="text-sm text-destructive" role="alert">{estado.error}</p>
      )}
      {estado.ok && (
        <p className="text-sm text-emerald-600" role="status">{estado.ok}</p>
      )}

      <button
        type="submit" disabled={enviando}
        className="w-full rounded-lg bg-foreground py-2.5 text-sm font-medium
                   text-background disabled:opacity-50"
      >
        {enviando ? 'Enviando…' : 'Enviar invitación'}
      </button>
    </form>
  )
}