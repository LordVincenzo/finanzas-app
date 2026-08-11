'use client'

import { useActionState, useState } from 'react'
import { eliminarMeta, type EstadoMeta } from '@/app/(app)/ahorros/actions'
import { formatearCOP } from '@/lib/format'

const estadoInicial: EstadoMeta = {}

/**
 * Eliminar una meta destruye sus aportes. No se pierde dinero —un
 * aporte solo marcaba cuánto de lo que ya tenías estaba destinado a
 * algo— pero sí el historial de quién puso qué y cuándo.
 *
 * Por eso va en dos pasos y diciendo exactamente cuánto se libera.
 * Antes era un enlace suelto de "Archivar meta" que actuaba al primer
 * toque, sin preguntar.
 */
export function EliminarMeta({
  metaId, nombre, acumulado, esConjunta,
}: {
  metaId: string
  nombre: string
  acumulado: number
  esConjunta: boolean
}) {
  const [confirmando, setConfirmando] = useState(false)
  const [estado, accion, borrando] = useActionState(eliminarMeta, estadoInicial)

  if (!confirmando) {
    return (
      <div className="mt-8 px-1">
        <button
          type="button"
          onClick={() => setConfirmando(true)}
          className="text-[13px] font-medium text-destructive"
        >
          Eliminar meta
        </button>
      </div>
    )
  }

  return (
    <div className="mt-8 rounded-2xl bg-card p-4 shadow-card
                    ring-1 ring-destructive/30">
      <p className="text-[15px] font-medium">¿Eliminar "{nombre}"?</p>
      <p className="mt-1.5 text-[13px] leading-snug text-muted-foreground">
        {acumulado > 0 ? (
          <>
            Se liberarán {formatearCOP(acumulado)} que quedarán otra vez
            disponibles para gastar. El dinero no se mueve de tus cuentas:
            nunca salió de ellas.
            {esConjunta && ' También se borran los aportes de tu pareja.'}
          </>
        ) : (
          'La meta y su historial se borran definitivamente.'
        )}
      </p>

      {estado.error && (
        <p className="mt-3 text-[13px] text-destructive" role="alert">
          {estado.error}
        </p>
      )}

      <div className="mt-4 flex gap-2">
        <form action={accion} className="flex-1">
          <input type="hidden" name="id" value={metaId} />
          <button
            type="submit" disabled={borrando}
            className="min-h-11 w-full rounded-xl bg-destructive text-[14px]
                       font-medium text-background disabled:opacity-50"
          >
            {borrando ? 'Eliminando…' : 'Sí, eliminar'}
          </button>
        </form>
        <button
          type="button"
          onClick={() => setConfirmando(false)}
          className="min-h-11 flex-1 rounded-xl border text-[14px]"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}