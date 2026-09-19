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
  /** ¿Es la mitad que se esconde de una pareja? Lo decide la vista,
   *  para que la pantalla y el contador de Inicio no puedan discrepar. */
  oculta: boolean
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
      .select('id, fuente, texto, recibido_en, monto, comercio, direccion, cuenta_id, categoria_id, pareja_id, pareja_fuente, pareja_texto, pareja_direccion, pareja_cuenta_id, oculta')
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
     una sola tarjeta: la del lado que SALIÓ. Confirmar esa cierra las
     dos, porque confirmar_pareja_ingesta() marca ambas.

     CUÁL SE ESCONDE LO DICE LA VISTA, en su columna `oculta`. Antes ese
     criterio se calculaba aquí, y el contador de Inicio era otra
     consulta que no lo sabía: decía "2 por confirmar" donde había una
     sola tarjeta. Es el mismo cálculo en dos sitios, otra vez. */
  const todos = (mensajes ?? []) as MensajeBandeja[]

  return {
    mensajes: todos.filter((m) => !m.oculta),
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

/**
 * Solo el número, para el aviso de Inicio, el menú Más y Panorama.
 *
 * CUENTA TARJETAS, NO MENSAJES. Una transferencia entre cuentas propias
 * son dos mensajes y una sola tarjeta; contando mensajes, Inicio decía
 * "2 movimientos por confirmar" y al entrar había uno. Un número que no
 * cuadra con lo que se ve al tocarlo mina la confianza en todos los
 * demás números de la app, que es de lo poco que no se puede permitir
 * una app de finanzas.
 *
 * Se lee de la vista y no de la tabla justo por eso: el criterio de
 * cuál se esconde vive ahí y en un solo sitio.
 */
export async function contarPendientes(): Promise<number> {
  const supabase = await createClient()
  const user = await requerirUsuario(supabase)

  const { count } = await supabase
    .from('bandeja_pendiente')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', user.id)
    .eq('oculta', false)

  return count ?? 0
}
