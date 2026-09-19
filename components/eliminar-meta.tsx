'use client'

import { useActionState, useState } from 'react'
import { eliminarMeta, type EstadoMeta } from '@/app/(app)/ahorros/actions'
import { formatearCOP } from '@/lib/format'
import type { Origen } from '@/lib/interfaz'

const estadoInicial: EstadoMeta = {}

/**
 * Eliminar una meta destruye sus aportes. No se pierde dinero —un
 * aporte solo marcaba cuánto de lo que ya tenías estaba destinado a
 * algo— pero sí el historial de quién puso qué y cuándo.
 *
 * Por eso va en dos pasos y diciendo exactamente cuánto se libera.
 * Antes era un enlace suelto de "Archivar meta" que actuaba al primer
 * toque, sin preguntar.
 *
 * Antes había una copia entera de este archivo
 * (components/eliminar-meta-escritorio.tsx) que solo cambiaba la acción
 * a la que llamaba y el alto de los botones. Ahora `origen` responde las
 * dos cosas: a qué lista volver y con qué densidad dibujarse.
 */
export function EliminarMeta({
  metaId, nombre, acumulado, esConjunta, origen = 'celular',
}: {
  metaId: string
  nombre: string
  acumulado: number
  esConjunta: boolean
  origen?: Origen
}) {
  const [confirmando, setConfirmando] = useState(false)
  const [estado, accion, borrando] = useActionState(eliminarMeta, estadoInicial)

  const esCelular = origen === 'celular'
  // El celular necesita 44px de área táctil; con ratón, 40px sobra.
  const altoBoton = esCelular ? 'min-h-11 text-[14px]' : 'h-10 text-[13px]'

  if (!confirmando) {
    const boton = (
      <button
        type="button"
        onClick={() => setConfirmando(true)}
        className="text-[13px] font-medium text-destructive"
      >
        Eliminar meta
      </button>
    )
    // En el celular va al final de una columna larga y necesita aire;
    // en escritorio lo coloca la pantalla que lo usa.
    return esCelular ? <div className="mt-8 px-1">{boton}</div> : boton
  }

  return (
    <div className={`rounded-2xl bg-card p-4 shadow-card
                     ring-1 ring-destructive/30 ${esCelular ? 'mt-8' : ''}`}>
      <p className="text-[15px] font-medium">
        ¿Eliminar &quot;{nombre}&quot;?
      </p>
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
          <input type="hidden" name="origen" value={origen} />
          <button
            type="submit" disabled={borrando}
            className={`w-full rounded-xl bg-destructive font-medium
                        text-background disabled:opacity-50 ${altoBoton}`}
          >
            {borrando ? 'Eliminando…' : 'Sí, eliminar'}
          </button>
        </form>
        <button
          type="button"
          onClick={() => setConfirmando(false)}
          className={`flex-1 rounded-xl border border-border ${altoBoton}`}
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}
