'use client'

import { useActionState } from 'react'
import { aportar, type EstadoMeta } from '@/app/(app)/ahorros/actions'
import { formatearCOP } from '@/lib/format'

type Cuenta = { account_id: string; name: string; disponible: number }

const estadoInicial: EstadoMeta = {}

export function FormularioAporte({
  metaId, cuentas,
}: {
  metaId: string
  cuentas: Cuenta[]
}) {
  const [estado, accion, enviando] = useActionState(aportar, estadoInicial)
  const clase = 'w-full rounded-lg border bg-transparent px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-ring'

  if (cuentas.length === 0) return null

  return (
    <section className="mt-4 rounded-2xl border p-5">
      <p className="text-sm font-medium">Asignar dinero</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Marca dinero que ya tienes. No se mueve de la cuenta ni cambia tu patrimonio.
      </p>

      <form action={accion} className="mt-4 space-y-3">
        <input type="hidden" name="meta" value={metaId} />

        <div className="flex gap-2">
          <select name="signo" defaultValue="mas"
                  className="rounded-lg border bg-transparent px-2 py-2.5 text-sm">
            <option value="mas">Añadir</option>
            <option value="menos">Retirar</option>
          </select>
          <input name="monto" inputMode="numeric" required placeholder="300.000"
                 className={`${clase} tabular-nums`} />
        </div>

        <select name="cuenta" required className={clase}>
          {cuentas.map((c) => (
            <option key={c.account_id} value={c.account_id}>
              {c.name} — {formatearCOP(Number(c.disponible))} libres
            </option>
          ))}
        </select>

        <input name="nota" maxLength={200} placeholder="Nota (opcional)"
               className={clase} />

        {estado.error && (
          <p className="text-sm text-destructive" role="alert">{estado.error}</p>
        )}

        <button type="submit" disabled={enviando}
                className="w-full rounded-lg bg-foreground py-2.5 text-sm
                           font-medium text-background disabled:opacity-50">
          {enviando ? 'Guardando…' : 'Guardar'}
        </button>
      </form>
    </section>
  )
}