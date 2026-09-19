'use client'

import { useSyncExternalStore } from 'react'

/**
 * Hablar con la app de Android desde la web.
 *
 * La misma web corre en dos sitios: en un navegador normal y dentro del
 * APK. Dentro del APK, Android inyecta `window.Oyente` —y solo lo hace
 * si la página viene de nuestro servidor, eso lo garantiza el propio
 * WebView (ver android/.../Puente.kt)—. Si ese objeto existe, la web
 * puede preguntar por el permiso de notificaciones y entregarle el
 * token al oyente sin que nadie copie nada.
 *
 * Si no existe, no pasa nada: la pantalla de siempre, con su token para
 * copiar a mano.
 *
 * EL PROTOCOLO es asíncrono. Se manda {id, accion, datos} y llega
 * {id, ok, datos} con el mismo id, que es lo que permite tener varias
 * preguntas en vuelo sin confundir las respuestas.
 */

export type EstadoPuente = {
  /** ¿Android nos dejó leer notificaciones? */
  permiso: boolean
  /** ¿El oyente ya tiene un token guardado? */
  token: boolean
  servidor: string
  /** "Samsung SM-A346E", para nombrar el dispositivo sin preguntar. */
  modelo: string
  enviadas: number
  /** Mensajes esperando a que haya señal. */
  cola: number
  ultimo: string
  bancos: string
}

type Respuesta = {
  id: number
  ok: boolean
  datos?: unknown
  error?: string
}

type ObjetoPuente = {
  postMessage: (mensaje: string) => void
  onmessage: ((evento: { data: string }) => void) | null
}

declare global {
  interface Window {
    Oyente?: ObjetoPuente
  }
}

/* ── El transporte ──────────────────────────────────────────────── */

let siguienteId = 1
const esperando = new Map<number, (r: Respuesta) => void>()
let escuchando = false

function objeto(): ObjetoPuente | null {
  if (typeof window === 'undefined') return null
  return window.Oyente ?? null
}

function escuchar(o: ObjetoPuente) {
  if (escuchando) return
  escuchando = true
  o.onmessage = (evento) => {
    let r: Respuesta
    try {
      r = JSON.parse(evento.data) as Respuesta
    } catch {
      return
    }
    const resolver = esperando.get(r.id)
    if (!resolver) return
    esperando.delete(r.id)
    resolver(r)
  }
}

/**
 * Una pregunta a la app.
 *
 * Con tiempo límite a propósito: si el lado nativo no contestara —una
 * versión vieja del APK, una acción que no conoce— sin esto la pantalla
 * se quedaría en "Comprobando…" para siempre, que desde fuera es
 * idéntico a que la app esté rota.
 */
function preguntar<T>(accion: string, datos = ''): Promise<T> {
  const o = objeto()
  if (!o) return Promise.reject(new Error('Fuera de la app'))
  escuchar(o)

  const id = siguienteId++
  return new Promise<T>((resolver, rechazar) => {
    const limite = setTimeout(() => {
      esperando.delete(id)
      rechazar(new Error('La app no respondió'))
    }, 10_000)

    esperando.set(id, (r) => {
      clearTimeout(limite)
      if (r.ok) resolver(r.datos as T)
      else rechazar(new Error(r.error ?? 'Falló'))
    })

    try {
      o.postMessage(JSON.stringify({ id, accion, datos }))
    } catch (e) {
      clearTimeout(limite)
      esperando.delete(id)
      rechazar(e instanceof Error ? e : new Error('No se pudo enviar'))
    }
  })
}

/* ── Las acciones ───────────────────────────────────────────────── */

export const puente = {
  estado: () => preguntar<EstadoPuente>('estado'),
  pedirPermiso: () => preguntar<unknown>('pedirPermiso'),
  guardarToken: (token: string) => preguntar<EstadoPuente>('guardarToken', token),
  olvidarToken: () => preguntar<EstadoPuente>('olvidarToken'),
  probar: () => preguntar<{ mensaje: string }>('probar'),
}

/* ── Los hooks ──────────────────────────────────────────────────── */

/**
 * ¿Estamos dentro del APK?
 *
 * Con useSyncExternalStore y no con un useState dentro de un useEffect:
 * el servidor no tiene `window`, así que si se renderizara `true` en el
 * cliente y `false` en el servidor habría un desajuste de hidratación.
 * Devuelve `false` en el servidor y en el primer render, que es lo
 * correcto: hasta que no estamos en el navegador, no lo sabemos.
 */
export function useDentroDeLaApp(): boolean {
  return useSyncExternalStore(
    () => () => {},          // nunca cambia durante la vida de la página
    () => objeto() !== null,
    () => false,             // en el servidor
  )
}

/* ── El estado del oyente, como almacén externo ─────────────────── */

/**
 * El estado del oyente NO es estado de React: vive en el teléfono y
 * cambia por cosas que pasan fuera de la página —conceder el permiso en
 * los ajustes de Android, una notificación que llega y se envía—.
 *
 * Por eso es un almacén externo y no un useState dentro de un useEffect:
 * ese patrón provoca un render en cascada, lo marca
 * react-hooks/set-state-in-effect, y además duplicaría el estado si dos
 * componentes preguntaran a la vez. Aquí hay una sola copia y una sola
 * suscripción, la comparten todos.
 */
type Instantanea = { estado: EstadoPuente | null; error: string | null }

/** La misma referencia en el servidor y en el primer render del
 *  cliente: sin esto habría desajuste de hidratación. */
const VACIO: Instantanea = { estado: null, error: null }

let instantanea: Instantanea = VACIO
const suscriptores = new Set<() => void>()

function avisarACadaUno() {
  for (const avisar of suscriptores) avisar()
}

/** Vuelve a preguntarle a la app. Sustituye la instantánea entera:
 *  useSyncExternalStore compara por identidad. */
export async function recargarEstadoOyente() {
  if (!objeto()) return
  try {
    instantanea = { estado: await puente.estado(), error: null }
  } catch (e) {
    instantanea = {
      estado: instantanea.estado,
      error: e instanceof Error ? e.message : 'Falló',
    }
  }
  avisarACadaUno()
}

/**
 * La primera suscripción enciende el escuchador y pide el estado; la
 * última lo apaga.
 *
 * `visibilitychange` es la señal de que volvimos de los ajustes de
 * Android tras conceder el permiso: la propia app la dispara al
 * reanudarse (ver MainActivity.onResume). Sin ella, la pantalla seguiría
 * diciendo "falta el permiso" después de haberlo dado.
 */
function alVolverAPrimerPlano() {
  if (!document.hidden) recargarEstadoOyente()
}

function suscribir(avisar: () => void): () => void {
  suscriptores.add(avisar)
  if (suscriptores.size === 1) {
    document.addEventListener('visibilitychange', alVolverAPrimerPlano)
    recargarEstadoOyente()
  }
  return () => {
    suscriptores.delete(avisar)
    if (suscriptores.size === 0) {
      document.removeEventListener('visibilitychange', alVolverAPrimerPlano)
    }
  }
}

function suscribirNada(): () => void {
  return () => {}
}

export function useEstadoOyente() {
  const dentro = useDentroDeLaApp()

  const { estado, error } = useSyncExternalStore(
    dentro ? suscribir : suscribirNada,
    () => instantanea,
    () => VACIO,
  )

  return { dentro, estado, error, refrescar: recargarEstadoOyente }
}
