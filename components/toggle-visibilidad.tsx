'use client'

import { useActionState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { cambiarVisibilidad, type EstadoPareja } from '@/app/(app)/pareja/actions'

const estadoInicial: EstadoPareja = {}

/**
 * Privada / Compartida, de un toque.
 *
 * Antes la acción descartaba el error, así que un fallo dejaba el botón
 * diciendo lo contrario de lo que era. Ahora se muestra.
 *
 * El color: antes usaba `border-emerald-600/30 text-emerald-700`, colores
 * de Tailwind a pelo. En esta app el verde significa "entra dinero" y
 * nada más; compartir una cuenta no es un ingreso. El estado se distingue
 * por el icono y el texto, y el activo se marca con el color de marca.
 */
export function ToggleVisibilidad({
  id, visibilidad,
}: {
  id: string
  visibilidad: string
}) {
  const [estado, accion, enviando] = useActionState(cambiarVisibilidad, estadoInicial)
  const compartida = visibilidad === 'shared_view'

  return (
    <form action={accion} className="flex flex-col items-end gap-1">
      <input type="hidden" name="id" value={id} />
      <input
        type="hidden" name="visibilidad"
        value={compartida ? 'private' : 'shared_view'}
      />
      <button
        type="submit"
        disabled={enviando}
        aria-label={compartida
          ? 'Hacer privada esta cuenta'
          : 'Compartir el saldo de esta cuenta'}
        className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1
                    text-[12px] transition disabled:opacity-50 ${
                      compartida
                        ? 'border-primary/30 text-primary'
                        : 'border-border text-muted-foreground'
                    }`}
      >
        {compartida ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
        {compartida ? 'Compartida' : 'Privada'}
      </button>

      {estado.error && (
        <span role="alert" className="text-[11px] text-destructive">
          {estado.error}
        </span>
      )}
    </form>
  )
}
