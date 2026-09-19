import { createClient, requerirUsuario } from '@/lib/supabase/server'

/**
 * Lo que necesita la pantalla de la bandeja, para las dos interfaces.
 *
 * Mismo motivo que lib/datos-pareja.ts: dos pantallas con la misma
 * forma de datos y distinta presentación no pueden tener dos copias de
 * las consultas.
 */

export type MensajeBandeja = {
  id: string
  fuente: string
  texto: string
  recibido_en: string
  /** Lo que el lector consiguió sacar del texto. Null si no hay lector
   *  todavía para esa entidad: entonces se rellena a mano. */
  monto: number | null
  comercio: string | null
  direccion: 'salida' | 'entrada' | null
  cuenta_id: string | null
  categoria_id: string | null
}

export type Dispositivo = {
  id: string
  nombre: string
  created_at: string
  last_used_at: string | null
}

export type Opcion = { id: string; name: string }

export type DatosBandeja = {
  mensajes: MensajeBandeja[]
  dispositivos: Dispositivo[]
  cuentas: Opcion[]
  categoriasGasto: Opcion[]
  categoriasIngreso: Opcion[]
}

export async function cargarBandeja(): Promise<DatosBandeja> {
  const supabase = await createClient()
  const user = await requerirUsuario(supabase)

  const [
    { data: mensajes },
    { data: dispositivos },
    { data: todas },
  ] = await Promise.all([
    supabase.from('bandeja_pendiente')
      .select('id, fuente, texto, recibido_en, monto, comercio, direccion, cuenta_id, categoria_id')
      .eq('owner_id', user.id),
    supabase.from('ingest_tokens')
      .select('id, nombre, created_at, last_used_at')
      .eq('owner_id', user.id)
      .is('revoked_at', null)
      .order('created_at', { ascending: false }),
    /* Las mismas cuentas que ofrece el formulario de movimiento: las
       tuyas, activas, sin las de sistema que se mueven desde su propia
       pantalla. "Pendiente de ubicar" sí entra, porque una notificación
       podría corresponder justo a ese dinero. */
    supabase.from('accounts')
      .select('id, name, class, type')
      .eq('owner_id', user.id)
      .eq('is_active', true)
      .eq('is_opening', false)
      .order('name'),
  ])

  const cuentas = (todas ?? []).filter(
    (a) => (a.class === 'asset' || a.class === 'liability')
        && !['receivable', 'partner_receivable'].includes(a.type)
  )

  return {
    mensajes: (mensajes ?? []) as MensajeBandeja[],
    dispositivos: (dispositivos ?? []) as Dispositivo[],
    cuentas: cuentas.map((a) => ({ id: a.id, name: a.name })),
    categoriasGasto: (todas ?? [])
      .filter((a) => a.class === 'expense')
      .map((a) => ({ id: a.id, name: a.name })),
    categoriasIngreso: (todas ?? [])
      .filter((a) => a.class === 'income')
      .map((a) => ({ id: a.id, name: a.name })),
  }
}

/** Solo el número, para el aviso de Inicio y Panorama. */
export async function contarPendientes(): Promise<number> {
  const supabase = await createClient()
  const user = await requerirUsuario(supabase)

  const { count } = await supabase
    .from('ingest_messages')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', user.id)
    .eq('estado', 'pendiente')

  return count ?? 0
}
