'use client'

import { useEffect, useState } from 'react'
import { Fingerprint, Loader2 } from 'lucide-react'
import { puente, useDentroDeLaApp } from '@/lib/puente'

/**
 * El interruptor del bloqueo por huella.
 *
 * Solo existe dentro del APK: en un navegador no hay huella que pedir,
 * y un interruptor que no hace nada es peor que no ponerlo.
 *
 * Tres estados, y el tercero importa:
 *
 *   disponible      se puede encender y apagar
 *   no disponible   el teléfono no tiene huella NI PIN configurados;
 *                   se dice por qué, en vez de dejar un botón muerto
 *   cargando        mientras la app contesta
 */
export function BloqueoHuella() {
  const dentro = useDentroDeLaApp()
  const [estado, setEstado] = useState<
    { activo: boolean; disponible: boolean } | null
  >(null)
  const [trabajando, setTrabajando] = useState(false)

  useEffect(() => {
    if (!dentro) return
    let vivo = true
    puente.bloqueo()
      .then((b) => { if (vivo) setEstado(b) })
      .catch(() => { if (vivo) setEstado({ activo: false, disponible: false }) })
    return () => { vivo = false }
  }, [dentro])

  if (!dentro) return null

  async function alternar() {
    if (!estado?.disponible || trabajando) return
    setTrabajando(true)
    try {
      setEstado(await puente.ponerBloqueo(!estado.activo))
    } catch {
      // Sin respuesta de la app, el interruptor se queda como estaba.
    } finally {
      setTrabajando(false)
    }
  }

  const activo = estado?.activo ?? false
  const puede = estado?.disponible ?? false

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="flex size-9 shrink-0 items-center justify-center
                       rounded-xl bg-muted">
        <Fingerprint className="size-[17px] text-muted-foreground" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-[15px] leading-tight">Pedir huella al abrir</p>
        <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">
          {estado === null
            ? 'Comprobando…'
            : puede
              ? 'Se bloquea al salir de la app. Vale la huella o el PIN del teléfono.'
              : 'Este teléfono no tiene huella ni PIN configurados.'}
        </p>
      </div>

      {estado === null ? (
        <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
      ) : (
        <button
          type="button"
          role="switch"
          aria-checked={activo}
          aria-label="Pedir huella al abrir"
          disabled={!puede || trabajando}
          onClick={alternar}
          className={`relative h-7 w-12 shrink-0 rounded-full transition
                      disabled:opacity-40 ${
            activo ? 'bg-primary' : 'bg-muted-foreground/30'
          }`}
        >
          <span className={`absolute top-1 size-5 rounded-full bg-background
                            shadow-sm transition-all ${
            activo ? 'left-6' : 'left-1'
          }`} />
        </button>
      )}
    </div>
  )
}
