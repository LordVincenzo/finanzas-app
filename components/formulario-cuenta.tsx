'use client'

import { useActionState, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { crearCuenta, type EstadoCuenta } from '@/app/(app)/cuentas/actions'
import { TIPOS_CUENTA, VISIBILIDADES, esDeuda } from '@/lib/tipos'
import type { Origen } from '@/lib/interfaz'

const estadoInicial: EstadoCuenta = {}

/**
 * Antes este formulario vivía dentro de app/(app)/cuentas/nueva/page.tsx,
 * así que la vista de escritorio no tenía cómo reusarlo y su enlace
 * "Nueva cuenta" te expulsaba al layout de celular.
 *
 * De paso pasa al sistema visual: los campos eran `rounded-lg` con
 * `py-2.5` y el select salía con la flecha del sistema. La regla es
 * `min-h-12`, `rounded-xl` y chevron propio con `appearance-none`.
 */

const CAMPO = `min-h-12 w-full rounded-xl border bg-transparent px-3.5
               text-[15px] placeholder:text-muted-foreground/50
               focus:outline-none focus:ring-2 focus:ring-ring`

const SELECT = `min-h-12 w-full appearance-none rounded-xl border
                bg-transparent pl-3.5 pr-10 text-[15px]
                focus:outline-none focus:ring-2 focus:ring-ring`

export function FormularioCuenta({ origen = 'celular' }: { origen?: Origen }) {
  const [estado, accion, enviando] = useActionState(crearCuenta, estadoInicial)

  /* Una tarjeta de crédito no se piensa como "cuánto tengo" sino como
     "cuánto debo", así que el campo cambia de pregunta según el tipo. El
     número se escribe SIEMPRE en positivo; convertirlo al negativo que
     necesita el ledger es cosa del servidor, no de este formulario. */
  const [tipo, setTipo] = useState<string>('digital_wallet')
  const deuda = esDeuda(tipo)

  return (
    <form action={accion} className="mt-5 space-y-4">
      {/* A qué lista volver al terminar. La acción lo traduce contra una
          tabla blanca, nunca lo usa tal cual en redirect(). */}
      <input type="hidden" name="origen" value={origen} />

      <div>
        <label htmlFor="nombre" className="mb-1.5 block text-[13px] font-medium">
          Nombre
        </label>
        <input id="nombre" name="nombre" required maxLength={60}
               placeholder="Nu" className={CAMPO} />
      </div>

      <div>
        <label htmlFor="tipo" className="mb-1.5 block text-[13px] font-medium">
          Tipo
        </label>
        <div className="relative">
          <select id="tipo" name="tipo" required value={tipo}
                  onChange={(e) => setTipo(e.target.value)}
                  className={SELECT}>
            {TIPOS_CUENTA.map((t) => (
              <option key={t.valor} value={t.valor}>{t.etiqueta}</option>
            ))}
          </select>
          <ChevronDown
            aria-hidden
            className="pointer-events-none absolute right-3.5 top-1/2 size-4
                       -translate-y-1/2 text-muted-foreground"
          />
        </div>
      </div>

      <div>
        <label htmlFor="institucion"
               className="mb-1.5 block text-[13px] font-medium">
          Institución{' '}
          <span className="font-normal text-muted-foreground">(opcional)</span>
        </label>
        <input id="institucion" name="institucion" maxLength={60}
               placeholder="Nu Colombia" className={CAMPO} />
      </div>

      <div>
        <label htmlFor="saldoInicial"
               className="mb-1.5 block text-[13px] font-medium">
          {deuda ? 'Cuánto debes' : 'Saldo actual'}
        </label>
        <div className="flex items-center rounded-xl border
                        focus-within:ring-2 focus-within:ring-ring">
          <span className="pl-3.5 text-[20px] font-semibold
                           text-muted-foreground">
            $
          </span>
          <input
            id="saldoInicial" name="saldoInicial" inputMode="numeric"
            placeholder={deuda ? '500.000' : '2.430.000'}
            className="min-h-12 w-full rounded-xl bg-transparent pl-1.5 pr-3.5
                       text-[20px] font-semibold tabular-nums
                       placeholder:text-muted-foreground/50
                       focus:outline-none"
          />
        </div>
        <p className="mt-1.5 text-[12px] leading-snug text-muted-foreground">
          {deuda
            ? 'Lo que debes hoy, en positivo. No el cupo de la tarjeta: el cupo no es tuyo, es lo que te prestarían.'
            : 'Cuánto dinero tienes ahí ahora. Puedes escribir 2430k.'}
        </p>
      </div>

      <div>
        <label htmlFor="visibilidad"
               className="mb-1.5 block text-[13px] font-medium">
          Visibilidad
        </label>
        <div className="relative">
          <select id="visibilidad" name="visibilidad" required
                  defaultValue="private" className={SELECT}>
            {VISIBILIDADES.map((v) => (
              <option key={v.valor} value={v.valor}>
                {v.etiqueta} — {v.ayuda}
              </option>
            ))}
          </select>
          <ChevronDown
            aria-hidden
            className="pointer-events-none absolute right-3.5 top-1/2 size-4
                       -translate-y-1/2 text-muted-foreground"
          />
        </div>
      </div>

      {estado.error && (
        <p className="text-[13px] text-destructive" role="alert">
          {estado.error}
        </p>
      )}

      <button type="submit" disabled={enviando}
              className="min-h-12 w-full rounded-xl bg-primary text-[15px]
                         font-medium text-primary-foreground shadow-card
                         transition active:scale-[0.99] disabled:opacity-50">
        {enviando ? 'Creando…' : 'Crear cuenta'}
      </button>
    </form>
  )
}
