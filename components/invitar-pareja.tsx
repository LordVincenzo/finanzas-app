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
        <p className="text-sm text-positivo" role="status">{estado.ok}</p>
      )}

      <button
        type="submit" disabled={enviando}
        className="min-h-12 w-full rounded-xl bg-primary text-[15px]
                   font-medium text-primary-foreground shadow-card
                   transition active:scale-[0.99] disabled:opacity-50"
      >
        {enviando ? 'Enviando…' : 'Enviar invitación'}
      </button>
    </form>
  )
}