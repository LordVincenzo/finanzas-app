'use client'

import { Eye, EyeOff } from 'lucide-react'
import { cambiarVisibilidad } from '@/app/(app)/pareja/actions'

export function ToggleVisibilidad({
  id, visibilidad,
}: {
  id: string
  visibilidad: string
}) {
  const compartida = visibilidad === 'shared_view'

  return (
    <form action={cambiarVisibilidad}>
      <input type="hidden" name="id" value={id} />
      <input
        type="hidden" name="visibilidad"
        value={compartida ? 'private' : 'shared_view'}
      />
      <button
        type="submit"
        className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1
                    text-xs transition ${
                      compartida
                        ? 'border-emerald-600/30 text-emerald-700'
                        : 'text-muted-foreground'
                    }`}
      >
        {compartida ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
        {compartida ? 'Compartida' : 'Privada'}
      </button>
    </form>
  )
}