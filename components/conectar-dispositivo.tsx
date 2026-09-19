'use client'

import { useActionState, useState } from 'react'
import { Smartphone, Check, Copy } from 'lucide-react'
import {
  conectarDispositivo, revocarDispositivo, type EstadoBandeja,
} from '@/app/(app)/bandeja/actions'
import type { Dispositivo } from '@/lib/datos-bandeja'

const estadoInicial: EstadoBandeja = {}

/**
 * Conectar un celular a la bandeja.
 *
 * El token se muestra UNA sola vez, justo después de crearlo. La base
 * guarda solo su sha256, así que ni nosotros podemos recuperarlo: quien
 * lo pierda crea otro y revoca el anterior. Es el mismo trato que hace
 * GitHub con sus tokens, y la razón de que aquí haya un aviso tan
 * insistente en copiarlo ahora.
 *
 * Vive en la pantalla de la bandeja, no enterrado en ajustes: es justo
 * lo que hace falta cuando la bandeja está vacía y uno se pregunta cómo
 * se llena.
 */
export function ConectarDispositivo({
  dispositivos, urlBase,
}: {
  dispositivos: Dispositivo[]
  /** La URL pública de la app, para armar el ejemplo de la petición. */
  urlBase: string
}) {
  const [estado, accion, enviando] = useActionState(conectarDispositivo, estadoInicial)
  const [revocar, accionRevocar] = useActionState(revocarDispositivo, estadoInicial)
  const [copiado, setCopiado] = useState(false)

  const token = estado.ok

  async function copiar(texto: string) {
    try {
      await navigator.clipboard.writeText(texto)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      // Sin permiso de portapapeles: el token está a la vista igual.
    }
  }

  return (
    <section className="rounded-2xl bg-card p-5 shadow-card ring-1 ring-border/70">
      <div className="flex items-center gap-2.5">
        <span className="flex size-9 shrink-0 items-center justify-center
                         rounded-xl bg-muted">
          <Smartphone className="size-[17px] text-muted-foreground" />
        </span>
        <div>
          <p className="text-[15px] font-medium">Conectar un celular</p>
          <p className="text-[12px] text-muted-foreground">
            Para que las notificaciones de tus bancos lleguen aquí solas.
          </p>
        </div>
      </div>

      {/* El token recién creado. Se enseña una vez y ya. */}
      {token && (
        <div className="mt-4 rounded-xl bg-muted p-3">
          <p className="text-[12px] font-medium">
            Cópialo ahora: no se vuelve a mostrar.
          </p>
          <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
            Guardamos solo una huella suya, así que nadie —ni nosotros—
            puede recuperarlo. Si lo pierdes, creas otro y revocas este.
          </p>
          <div className="mt-2.5 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg bg-background
                             px-2.5 py-2 font-mono text-[12px]">
              {token}
            </code>
            <button
              type="button"
              onClick={() => copiar(token)}
              className="flex size-9 shrink-0 items-center justify-center
                         rounded-lg bg-background transition active:scale-95"
              aria-label="Copiar el token"
            >
              {copiado
                ? <Check className="size-4 text-positivo" />
                : <Copy className="size-4 text-muted-foreground" />}
            </button>
          </div>

          <p className="mt-3 text-[12px] font-medium">Dónde ponerlo</p>
          <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
            En MacroDroid: disparador «Notificación recibida» de la app de
            tu banco, y acción «HTTP Request» con método POST.
          </p>
          <code className="mt-2 block overflow-x-auto whitespace-pre rounded-lg
                           bg-background px-2.5 py-2 font-mono text-[11px]
                           leading-relaxed">
{`URL       ${urlBase}/api/ingesta?app=nequi
Cabecera  X-Token: ${token}
Tipo      text/plain
Cuerpo    [notification_text]`}
          </code>
          <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
            El token va en la cabecera y el texto va solo en el cuerpo, sin
            comillas alrededor: así una notificación con comillas no rompe
            nada. Cambia <span className="font-mono">app=nequi</span> por{' '}
            <span className="font-mono">nu</span>,{' '}
            <span className="font-mono">daviplata</span> o{' '}
            <span className="font-mono">davivienda</span> en cada macro.
          </p>
        </div>
      )}

      <form action={accion} className="mt-4 flex items-start gap-2">
        <input
          name="nombre" required maxLength={60}
          placeholder="Mi celular"
          aria-label="Nombre del dispositivo"
          className="min-h-11 min-w-0 flex-1 rounded-xl border bg-transparent
                     px-3 text-[14px] placeholder:text-muted-foreground/50
                     focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          type="submit" disabled={enviando}
          className="min-h-11 shrink-0 rounded-xl bg-primary px-4 text-[14px]
                     font-medium text-primary-foreground shadow-card
                     transition active:scale-[0.99] disabled:opacity-50"
        >
          {enviando ? 'Creando…' : 'Conectar'}
        </button>
      </form>

      {estado.error && (
        <p className="mt-2 text-[12px] text-destructive" role="alert">
          {estado.error}
        </p>
      )}
      {revocar.error && (
        <p className="mt-2 text-[12px] text-destructive" role="alert">
          {revocar.error}
        </p>
      )}

      {dispositivos.length > 0 && (
        <div className="mt-4 divide-y divide-border/70 border-t border-border/70">
          {dispositivos.map((d) => (
            <div key={d.id}
                 className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-[14px]">{d.nombre}</p>
                <p className="text-[11px] text-muted-foreground">
                  {d.last_used_at
                    ? 'Ha enviado mensajes'
                    : 'Todavía no ha enviado nada'}
                </p>
              </div>
              <form action={accionRevocar}>
                <input type="hidden" name="id" value={d.id} />
                <button className="-my-3 shrink-0 px-2 py-3 text-[12px]
                                   font-medium text-destructive">
                  Revocar
                </button>
              </form>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
