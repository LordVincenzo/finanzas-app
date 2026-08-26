'use client'

import { useActionState, useState } from 'react'
import { eliminarMetaEscritorio, type EstadoMetaEscritorio } from '@/app/escritorio/ahorros/actions'
import { formatearCOP } from '@/lib/format'

const estadoInicial: EstadoMetaEscritorio = {}

/** Igual que components/eliminar-meta.tsx, pero llama a la acción de
 *  escritorio (redirige a /escritorio/ahorros, no a /ahorros). */
export function EliminarMetaEscritorio({
  metaId, nombre, acumulado, esConjunta,
}: {
  metaId: string
  nombre: string
  acumulado: number
  esConjunta: boolean
}) {
  const [confirmando, setConfirmando] = useState(false)
  const [estado, accion, borrando] = useActionState(eliminarMetaEscritorio, estadoInicial)

  if (!confirmando) {
    return (
      <button
        type="button"
        onClick={() => setConfirmando(true)}
        className="text-[13px] font-medium text-destructive"
      >
        Eliminar meta
      </button>
    )
  }

  return (
    <div className="rounded-2xl bg-card p-4 shadow-card ring-1 ring-destructive/30">
      <p className="text-[15px] font-medium">¿Eliminar &quot;{nombre}&quot;?</p>
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
            className="h-10 w-full rounded-xl bg-destructive text-[13px]
                       font-medium text-background disabled:opacity-50"
          >
            {borrando ? 'Eliminando…' : 'Sí, eliminar'}
          </button>
        </form>
        <button
          type="button"
          onClick={() => setConfirmando(false)}
          className="h-10 flex-1 rounded-xl border border-border text-[13px]"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}
