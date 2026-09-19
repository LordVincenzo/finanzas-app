'use client'

import { useCallback, useSyncExternalStore } from 'react'

/**
 * Leer cosas que solo existen en el navegador, sin romper la hidratación.
 *
 * El patrón fácil es `useState(false)` + `useEffect(() => setX(real))`.
 * Funciona, pero provoca un render en cascada en cada montaje y la regla
 * react-hooks/set-state-in-effect lo marca como error — con razón: React
 * tiene una herramienta para esto, useSyncExternalStore, que existe justo
 * para leer un estado que vive fuera de React.
 *
 * Cada hook da tres cosas: cómo suscribirse a los cambios, qué valor hay
 * en el navegador, y qué valor asumir en el servidor (donde no hay
 * navegador). React usa el tercero al renderizar en el servidor y al
 * hidratar, así que el HTML coincide y no hay aviso de desajuste.
 */

/** Suscripción que nunca notifica: el valor no cambia en toda la vida. */
const NUNCA_CAMBIA = () => () => {}

/**
 * ¿Ya estamos en el navegador? Para lo que no se puede saber en el
 * servidor, como qué tema tiene puesto la persona.
 */
export function useHidratado(): boolean {
  return useSyncExternalStore(NUNCA_CAMBIA, () => true, () => false)
}

const CONSULTA_REDUCIDO = '(prefers-reduced-motion: reduce)'

/**
 * ¿La persona pidió menos animación en los ajustes de su sistema?
 *
 * Sí cambia en caliente (se puede activar con la app abierta), así que la
 * suscripción escucha de verdad al media query. En el servidor asumimos
 * que no, que es el caso común; si resulta que sí, el primer render del
 * navegador lo corrige antes de que ninguna animación empiece.
 */
export function useReducido(): boolean {
  return useSyncExternalStore(
    (avisar) => {
      const mq = window.matchMedia(CONSULTA_REDUCIDO)
      mq.addEventListener('change', avisar)
      return () => mq.removeEventListener('change', avisar)
    },
    () => window.matchMedia(CONSULTA_REDUCIDO).matches,
    () => false,
  )
}

/* localStorage no avisa a la propia pestaña cuando tú mismo escribes
   (el evento `storage` solo lo reciben las OTRAS pestañas), así que
   hace falta un aviso propio. */
const oyentes = new Set<() => void>()

/**
 * Una preferencia de sí/no guardada en el navegador, por persona y por
 * dispositivo. Para conveniencias, nunca para datos: si el navegador la
 * borra o está en modo privado, se cae al valor por defecto sin ruido.
 *
 * Todos los accesos van en try/catch porque en algunos contextos
 * (ventana privada, sitio con datos bloqueados) el simple hecho de
 * tocar localStorage lanza una excepción.
 */
export function usePreferenciaLocal(
  clave: string,
): [boolean, (nuevo: boolean) => void] {
  const valor = useSyncExternalStore(
    (avisar) => {
      oyentes.add(avisar)
      window.addEventListener('storage', avisar)
      return () => {
        oyentes.delete(avisar)
        window.removeEventListener('storage', avisar)
      }
    },
    () => {
      try {
        return localStorage.getItem(clave) === '1'
      } catch {
        return false
      }
    },
    () => false,
  )

  const establecer = useCallback((nuevo: boolean) => {
    try {
      localStorage.setItem(clave, nuevo ? '1' : '0')
    } catch {
      // Sin almacenamiento: la preferencia no sobrevive a la recarga.
    }
    for (const avisar of oyentes) avisar()
  }, [clave])

  return [valor, establecer]
}
