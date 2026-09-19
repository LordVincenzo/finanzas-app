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
  /* Cuando una transferencia entre cuentas propias dispara dos avisos,
     la 0024 los enlaza. Aquí viene el otro lado, para poder ofrecer
     "esto es una sola transferencia" sin otra consulta. */
  pareja_id: string | null
  pareja_fuente: string | null
  pareja_texto: string | null
  pareja_direccion: 'salida' | 'entrada' | null
  /** La cuenta que corresponde al banco del otro aviso. Con esto, una
   *  transferencia entre cuentas propias llega con los dos lados
   *  resueltos y confirmarla es un solo toque. */
  pareja_cuenta_id: string | null
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
      .select('id, fuente, texto, recibido_en, monto, comercio, direccion, cuenta_id, categoria_id, pareja_id, pareja_fuente, pareja_texto, pareja_direccion, pareja_cuenta_id')
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

  /* Una pareja son dos avisos del MISMO movimiento, así que se enseña
     una sola tarjeta: la del lado que SALIÓ. Es la que suele traer el
     nombre de quien recibe ("a Juan Pérez"), y "enviaste" es la acción
     que hiciste tú. Confirmar esa cierra las dos, porque
     confirmar_pareja_ingesta() marca ambas.

     Si por lo que sea las dos fueran del mismo sentido, no se esconde
     ninguna: mejor dos tarjetas de más que un movimiento desaparecido. */
  const todos = (mensajes ?? []) as MensajeBandeja[]
  const ocultas = new Set(
    todos
      .filter((m) => m.pareja_id && m.direccion === 'entrada'
                  && m.pareja_direccion === 'salida')
      .map((m) => m.id)
  )

  return {
    mensajes: todos.filter((m) => !ocultas.has(m.id)),
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
