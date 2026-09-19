'use client'

import { useActionState } from 'react'
import { ConectarDispositivo } from '@/components/conectar-dispositivo'
import { ConectarTelefono } from '@/components/conectar-telefono'
import { useDentroDeLaApp } from '@/lib/puente'
import { revocarDispositivo, type EstadoBandeja } from '@/app/(app)/bandeja/actions'
import type { Dispositivo } from '@/lib/datos-bandeja'

/**
 * Cuál de las dos formas de conectar se enseña.
 *
 * La misma página corre en dos sitios y la respuesta correcta es
 * distinta en cada uno:
 *
 *   - Dentro del APK hay puente: la página acuña el token ella misma y
 *     se lo pasa al oyente. Lo único que se pide es el permiso de
 *     Android. → ConectarTelefono
 *
 *   - En un navegador no hay puente, así que hay que enseñar el token
 *     para copiarlo a otro sitio. → ConectarDispositivo
 *
 * Enseñar las dos a la vez sería peor que enseñar una mal: dentro de la
 * app, un token a la vista para copiar a mano invita a hacer justo el
 * trabajo que esta versión vino a quitar.
 */
export function Conectar({
  dispositivos, urlBase,
}: {
  dispositivos: Dispositivo[]
  urlBase: string
}) {
  const dentro = useDentroDeLaApp()

  if (!dentro) {
    return <ConectarDispositivo dispositivos={dispositivos} urlBase={urlBase} />
  }

  return (
    <div className="space-y-4">
      <ConectarTelefono />
      {dispositivos.length > 0 && <Conectados dispositivos={dispositivos} />}
    </div>
  )
}

/**
 * Los teléfonos ya conectados.
 *
 * Dentro de la app no hace falta el formulario de crear —eso pasa solo—
 * pero sí la lista: el caso que importa es revocar el OTRO teléfono, el
 * que se perdió o el de la pareja que ya no se usa. Por eso el botón
 * está, y por eso avisa de cuál es el de este mismo aparato.
 */
function Conectados({ dispositivos }: { dispositivos: Dispositivo[] }) {
  const [estado, accion] = useActionState(revocarDispositivo, {} as EstadoBandeja)

  return (
    <section className="rounded-2xl bg-card p-5 shadow-card ring-1 ring-border/70">
      <p className="text-[15px] font-medium">Teléfonos conectados</p>
      <p className="mt-0.5 text-[12px] text-muted-foreground">
        Revocar uno lo desconecta al instante. Deja de mandar, no se
        borra nada de lo ya confirmado.
      </p>

      {estado.error && (
        <p className="mt-2 text-[12px] text-destructive" role="alert">
          {estado.error}
        </p>
      )}

      <div className="mt-3 divide-y divide-border/70 border-t border-border/70">
        {dispositivos.map((d) => (
          <div key={d.id} className="flex items-center justify-between gap-3 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-[14px]">{d.nombre}</p>
              <p className="text-[11px] text-muted-foreground">
                {d.last_used_at ? 'Ha enviado mensajes' : 'Todavía no ha enviado nada'}
              </p>
            </div>
            <form action={accion}>
              <input type="hidden" name="id" value={d.id} />
              <button className="shrink-0 text-[12px] font-medium text-destructive">
                Revocar
              </button>
            </form>
          </div>
        ))}
      </div>
    </section>
  )
}
