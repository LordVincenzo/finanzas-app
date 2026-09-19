'use client'

import { useActionState } from 'react'
import { CheckCheck } from 'lucide-react'
import { confirmarTodas, type EstadoBandeja } from '@/app/(app)/bandeja/actions'
import { propuestaDe } from '@/lib/bandeja-propuesta'
import type { MensajeBandeja, Opcion } from '@/lib/datos-bandeja'

const estadoInicial: EstadoBandeja = {}

/**
 * Confirmar de una vez las que no hace falta mirar.
 *
 * Si vuelves después de dos días hay seis esperando, y seis toques para
 * seis movimientos que la app ya tenía resueltos es una tarea
 * inventada.
 *
 * NO APARECE SIEMPRE, y eso es parte del diseño:
 *
 *   - Con una sola lista, sobra: el botón de esa fila hace lo mismo con
 *     el mismo número de toques, y uno de más solo es una decisión más
 *     que tomar.
 *   - Si ninguna está resuelta, tampoco: un botón que no puede hacer
 *     nada es peor que no ponerlo.
 *
 * Manda la lista de ids que está viendo, no un "confirma todo". Así un
 * mensaje que llegue entre que se dibuja esto y se toca el botón NO
 * entra: nada llega al ledger sin que alguien lo haya tenido delante.
 */
export function ConfirmarTodas({
  mensajes, cuentas, categoriasGasto, categoriasIngreso,
}: {
  mensajes: MensajeBandeja[]
  cuentas: Opcion[]
  categoriasGasto: Opcion[]
  categoriasIngreso: Opcion[]
}) {
  const [estado, accion, enviando] = useActionState(confirmarTodas, estadoInicial)

  const listas = mensajes.filter(
    (m) => propuestaDe(m, cuentas, categoriasGasto, categoriasIngreso) !== null
  )

  if (listas.length < 2) return null

  return (
    <form action={accion} className="mt-4">
      {listas.map((m) => (
        <input key={m.id} type="hidden" name="ids" value={m.id} />
      ))}

      <button
        type="submit"
        disabled={enviando}
        className="flex min-h-12 w-full items-center justify-center gap-2
                   rounded-xl bg-primary text-[14px] font-medium
                   text-primary-foreground shadow-card transition
                   active:scale-[0.99] disabled:opacity-50"
      >
        <CheckCheck className="size-4" />
        {enviando
          ? 'Registrando…'
          : `Confirmar las ${listas.length} que están listas`}
      </button>

      <p className="mt-1.5 text-center text-[11px] leading-snug
                    text-muted-foreground">
        {listas.length === mensajes.length
          ? 'Todas tienen cuenta y categoría resueltas.'
          : `Las otras ${mensajes.length - listas.length} necesitan que elijas algo.`}
      </p>

      {estado.error && (
        <p className="mt-2 text-center text-[12px] text-destructive" role="alert">
          {estado.error}
        </p>
      )}
    </form>
  )
}
