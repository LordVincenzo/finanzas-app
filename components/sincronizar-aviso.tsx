'use client'

import { useEffect } from 'react'
import { puente, useDentroDeLaApp } from '@/lib/puente'

/**
 * Le dice al teléfono cuántas quedan por confirmar.
 *
 * POR QUÉ HACE FALTA. El aviso de Android («3 movimientos por
 * confirmar») lo pone el servidor cuando llega una notificación del
 * banco, que es cuando el número SUBE. Pero nadie le dice cuándo baja:
 * confirmar pasa por el servidor con la sesión de la web, no por el
 * teléfono, así que el aviso se quedaría contando movimientos ya
 * resueltos. Un recordatorio que no desaparece al hacer la tarea es
 * exactamente el que enseña a ignorar los recordatorios.
 *
 * Se monta en la pantalla de la bandeja: cada vez que se redibuja
 * —después de confirmar o ignorar, porque la acción revalida— llega con
 * el número nuevo y lo manda.
 *
 * Fuera de la app de Android no hace nada: no hay puente al que hablar.
 */
export function SincronizarAviso({ pendientes }: { pendientes: number }) {
  const dentro = useDentroDeLaApp()

  useEffect(() => {
    if (!dentro) return
    // Sin await ni manejo de error: esto es un aviso, no un dato. Si la
    // app no contesta, la pantalla no tiene nada que decir al respecto.
    puente.pendientes(pendientes).catch(() => {})
  }, [dentro, pendientes])

  return null
}
