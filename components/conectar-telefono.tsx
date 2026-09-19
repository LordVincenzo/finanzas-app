'use client'

import { useEffect, useRef, useState } from 'react'
import { BellRing, Check, Loader2, TriangleAlert } from 'lucide-react'
import { conectarDispositivo } from '@/app/(app)/bandeja/actions'
import { puente, useEstadoOyente } from '@/lib/puente'

/**
 * Activar la lectura de notificaciones, dentro de la app de Android.
 *
 * POR QUÉ NO PIDE UN TOKEN. Cuando esta pantalla corre dentro del APK,
 * la sesión ya está iniciada: la página puede pedir el token ella misma
 * y entregárselo al oyente por el puente. Copiar 64 caracteres de una
 * pantalla a otra era una tarea que solo existía porque eran dos
 * programas que no se conocían.
 *
 * Lo único que hace falta de la persona es el permiso de Android, que
 * ninguna app puede concederse a sí misma.
 *
 * En un navegador normal esto no se dibuja: no hay puente y se muestra
 * ConectarDispositivo, con su token para copiar a mano.
 */
export function ConectarTelefono() {
  const { dentro, estado, error, refrescar } = useEstadoOyente()
  const [trabajando, setTrabajando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const [fallo, setFallo] = useState<string | null>(null)

  /* El token se acuña solo, una vez. El guardia es para que un
     refresco en mitad del proceso no cree dos, que dejaría un
     dispositivo fantasma en la lista para siempre. */
  const acunando = useRef(false)

  useEffect(() => {
    if (!estado || !estado.permiso || estado.token) return
    if (acunando.current) return
    acunando.current = true

    ;(async () => {
      setTrabajando(true)
      setFallo(null)
      try {
        const datos = new FormData()
        datos.set('nombre', estado.modelo || 'Celular')
        const r = await conectarDispositivo({}, datos)

        if (r.error || !r.ok) {
          setFallo(r.error ?? 'No se pudo crear la conexión')
          acunando.current = false
          return
        }

        await puente.guardarToken(r.ok)
        await refrescar()
      } catch (e) {
        setFallo(e instanceof Error ? e.message : 'No se pudo conectar')
        acunando.current = false
      } finally {
        setTrabajando(false)
      }
    })()
  }, [estado, refrescar])

  if (!dentro) return null

  const listo = estado?.permiso && estado.token

  return (
    <section className="rounded-2xl bg-card p-5 shadow-card ring-1 ring-border/70">
      <div className="flex items-center gap-2.5">
        <span className={`flex size-9 shrink-0 items-center justify-center
                          rounded-xl ${listo ? 'bg-positivo/10' : 'bg-muted'}`}>
          {listo
            ? <Check className="size-[17px] text-positivo" />
            : <BellRing className="size-[17px] text-muted-foreground" />}
        </span>
        <div className="min-w-0">
          <p className="text-[15px] font-medium">
            {listo ? 'Leyendo tus bancos' : 'Activar lectura de notificaciones'}
          </p>
          <p className="text-[12px] text-muted-foreground">
            {listo
              ? 'Los movimientos aparecerán aquí solos.'
              : 'Para que los movimientos lleguen aquí sin escribirlos.'}
          </p>
        </div>
      </div>

      {/* Todavía preguntando a la app. */}
      {!estado && !error && (
        <p className="mt-4 flex items-center gap-2 text-[13px] text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Comprobando…
        </p>
      )}

      {error && (
        <p className="mt-4 text-[13px] text-muted-foreground">
          No se pudo hablar con la app. Ciérrala del todo y vuelve a abrirla.
        </p>
      )}

      {/* Falta el permiso: es lo único que no podemos hacer por ti. */}
      {estado && !estado.permiso && (
        <>
          <p className="mt-4 text-[13px] leading-snug text-muted-foreground">
            Android tiene que autorizarlo. Te lleva a una lista del
            sistema: busca <span className="font-medium text-foreground">Finanzas</span>{' '}
            y actívalo.
          </p>
          <button
            type="button"
            onClick={() => puente.pedirPermiso()}
            className="mt-3 min-h-11 w-full rounded-xl bg-primary px-4 text-[14px]
                       font-medium text-primary-foreground shadow-card
                       transition active:scale-[0.99]"
          >
            Dar permiso
          </button>
          <p className="mt-3 text-[11px] leading-snug text-muted-foreground">
            El permiso es de todas las notificaciones porque Android no
            deja pedir menos. La app solo mira las de{' '}
            {estado.bancos.replace(/^Apps:\s*/, '').split('\n')[0]} y
            descarta el resto sin leerlo.
          </p>
        </>
      )}

      {/* Permiso dado, creando la conexión. */}
      {estado?.permiso && !estado.token && (
        <p className="mt-4 flex items-center gap-2 text-[13px] text-muted-foreground">
          {trabajando && <Loader2 className="size-4 animate-spin" />}
          {fallo ?? 'Conectando este teléfono…'}
        </p>
      )}

      {fallo && estado?.permiso && !estado.token && (
        <button
          type="button"
          onClick={() => { acunando.current = false; setFallo(null); refrescar() }}
          className="mt-3 min-h-11 w-full rounded-xl bg-primary px-4 text-[14px]
                     font-medium text-primary-foreground shadow-card
                     transition active:scale-[0.99]"
        >
          Reintentar
        </button>
      )}

      {/* Funcionando. */}
      {listo && estado && (
        <>
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-[13px]">
            <dt className="text-muted-foreground">Este teléfono</dt>
            <dd className="text-right">{estado.modelo}</dd>

            <dt className="text-muted-foreground">Enviadas</dt>
            <dd className="text-right tabular-nums">{estado.enviadas}</dd>

            {estado.cola > 0 && (
              <>
                <dt className="text-muted-foreground">Esperando señal</dt>
                <dd className="text-right tabular-nums">{estado.cola}</dd>
              </>
            )}
          </dl>

          {estado.cola > 0 && (
            <p className="mt-2 flex items-start gap-1.5 text-[11px]
                          leading-snug text-muted-foreground">
              <TriangleAlert className="mt-px size-3.5 shrink-0" />
              Guardadas en el teléfono. Se mandan solas cuando vuelva la
              conexión; no se pierde ninguna.
            </p>
          )}

          <button
            type="button"
            disabled={trabajando}
            onClick={async () => {
              setTrabajando(true)
              setAviso(null)
              try {
                const r = await puente.probar()
                setAviso(r.mensaje)
              } catch (e) {
                setAviso(e instanceof Error ? e.message : 'No se pudo probar')
              } finally {
                setTrabajando(false)
                refrescar()
              }
            }}
            className="mt-4 min-h-11 w-full rounded-xl border text-[14px]
                       font-medium transition active:scale-[0.99]
                       disabled:opacity-50"
          >
            {trabajando ? 'Probando…' : 'Probar el envío'}
          </button>

          {aviso && (
            <p className="mt-2 text-[12px] leading-snug text-muted-foreground">
              {aviso}
            </p>
          )}
        </>
      )}
    </section>
  )
}
