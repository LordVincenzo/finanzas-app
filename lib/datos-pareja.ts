import { createClient, requerirUsuario } from '@/lib/supabase/server'
import { hoyBogota } from '@/lib/format'

/**
 * Todo lo que necesita la pantalla de Pareja, en un solo sitio.
 *
 * Las dos interfaces muestran los mismos datos con formas distintas: el
 * celular los apila en acordeones porque no cabe nada más, el escritorio
 * los pone en columnas. Lo que NO puede haber son dos copias de estas
 * consultas: son unas quince, con filtros finos (qué clase, qué
 * visibilidad, excluir la cuenta de balance) y cada filtro que se
 * olvidara en una de las copias sería una fuga de privacidad silenciosa.
 */

export type CuentaCompartible = {
  id: string
  name: string
  visibility: string
}

export type CuentaSuya = {
  account_id: string
  name: string
  balance: number
}

export type GastoCompartido = {
  id: string
  description: string
  payer_id: string
  payer_name: string
  total_amount: number
  occurred_on: string
}

export type Liquidacion = {
  id: string
  from_profile: string
  to_profile: string
  amount: number
  occurred_on: string
  note: string | null
}

export type DatosPareja = {
  yo: string
  pareja: { id: string; nombre: string } | null
  recibidas: { id: string; inviter_name: string }[]
  enviadas: { id: string; invitee_email: string }[]
  misCuentas: CuentaCompartible[]
  suyas: CuentaSuya[]
  balance: number
  misCuentasPago: { id: string; name: string }[]
  misCategorias: { id: string; name: string }[]
  compartidos: GastoCompartido[]
  liquidaciones: Liquidacion[]
  /** Saldo de tu cuenta "Pendiente de ubicar". 0 si no hay nada suelto. */
  pendienteUbicar: number
  hoy: string
}

export async function cargarPareja(): Promise<DatosPareja> {
  const supabase = await createClient()
  const user = await requerirUsuario(supabase)
  const yo = user.id

  // ¿Tengo pareja activa?
  const { data: miMembresia } = await supabase
    .from('couple_members')
    .select('couple_id')
    .eq('profile_id', yo)
    .eq('status', 'active')
    .maybeSingle()

  const coupleId = miMembresia?.couple_id ?? null

  const { data: recibidas } = await supabase.rpc('invitaciones_recibidas')

  // El otro miembro (si lo hay)
  let pareja: { id: string; nombre: string } | null = null
  if (coupleId) {
    const { data: otros } = await supabase
      .from('couple_members')
      .select('profile_id')
      .eq('couple_id', coupleId)
      .eq('status', 'active')
      .neq('profile_id', yo)

    const otroId = otros?.[0]?.profile_id
    if (otroId) {
      const { data: perfil } = await supabase
        .from('profiles').select('display_name').eq('id', otroId).maybeSingle()
      pareja = { id: otroId, nombre: perfil?.display_name ?? 'Tu pareja' }
    }
  }

  // Invitaciones que YO envié y siguen pendientes
  const { data: enviadas } = coupleId
    ? await supabase
        .from('couple_invitations')
        .select('id, invitee_email')
        .eq('inviter_id', yo)
        .eq('status', 'pending')
    : { data: null }

  /* Mis cuentas, para elegir qué comparto.
     is_partner_balance queda fuera: "Balance con <pareja>" es una cuenta
     de sistema que lleva la cuenta de lo que se deben, no un sitio donde
     tengas dinero. Ofrecer compartirla no significaba nada, y el saldo
     que muestra ya lo ven los dos en la tarjeta de arriba. */
  const { data: misCuentas } = await supabase
    .from('accounts')
    .select('id, name, visibility')
    .eq('owner_id', yo)
    .in('class', ['asset', 'liability'])
    .eq('is_active', true)
    .eq('is_partner_balance', false)
    .order('name')

  /* Lo que mi pareja comparte conmigo.
     Antes esta consulta pedía TODAS las cuentas ajenas y confiaba en que
     el RLS recortara el resultado. Dos filtros faltaban:
       - class: sin él, una categoría de gasto suya podría acabar en esta
         lista. Las categorías dicen en qué gasta, y el modelo de
         privacidad promete mostrar el saldo, no los movimientos.
       - visibility: la sección se llama "qué comparte contigo", así que
         debe pedir exactamente eso. */
  const { data: cuentasSuyas } = pareja
    ? await supabase
        .from('accounts')
        .select('id, name')
        .neq('owner_id', yo)
        .in('class', ['asset', 'liability'])
        .in('visibility', ['shared_view', 'joint'])
        .eq('is_active', true)
        .order('name')
    : { data: null }

  /* El saldo se pide con la función, que valida el permiso aparte.
     PENDIENTE: es una llamada por cuenta. Con dos o tres no se nota,
     pero lo correcto sería una función que devuelva `setof`. */
  const suyas = await Promise.all(
    (cuentasSuyas ?? []).map(async (c) => {
      const { data: saldo } = await supabase.rpc('saldo_cuenta_visible', {
        p_cuenta: c.id,
      })
      return { account_id: c.id, name: c.name, balance: Number(saldo ?? 0) }
    })
  )

  // Balance con la pareja: positivo = te deben, negativo = debes.
  const { data: balanceRow } = pareja
    ? await supabase.from('account_balances')
        .select('balance')
        .eq('owner_id', yo)
        .eq('type', 'partner_receivable')
        .maybeSingle()
    : { data: null }

  /* Cuentas desde las que se puede pagar un gasto compartido o liquidar.
     "Pendiente de ubicar" queda fuera: es dinero real, pero pagar DESDE
     el cajón de lo que todavía no sabes dónde está no tiene sentido —
     primero se ubica con una transferencia, y luego se usa. */
  const { data: misCuentasPago } = await supabase
    .from('accounts').select('id, name')
    .eq('owner_id', yo).eq('class', 'asset').eq('is_active', true)
    .eq('is_partner_balance', false).eq('is_opening', false)
    .eq('is_pending_location', false)
    .neq('type', 'receivable').order('name')

  const { data: misCategorias } = await supabase
    .from('accounts').select('id, name')
    .eq('owner_id', yo).eq('class', 'expense').order('name')

  const { data: compartidos } = pareja
    ? await supabase.from('gastos_compartidos_detalle')
        .select('*').order('occurred_on', { ascending: false }).limit(20)
    : { data: null }

  /* Las liquidaciones no se listaban en ninguna pantalla, y por tanto no
     había dónde poner un botón para deshacer una mal registrada.
     eliminar_movimiento() las rechazaba diciendo "Borrala desde Pareja"
     y en Pareja no estaban. Sin join a profiles: la pantalla ya sabe
     quién eres tú y cómo se llama tu pareja, así que from_profile y
     to_profile bastan para escribir "Tú → Marina". */
  const { data: liquidaciones } = pareja
    ? await supabase.from('couple_settlements')
        .select('id, from_profile, to_profile, amount, occurred_on, note')
        .order('occurred_on', { ascending: false }).limit(20)
    : { data: null }

  /* "Pendiente de ubicar" (migración 0021): dinero de una liquidación
     que entró o salió de verdad, pero cuya cuenta real no conocemos —
     quien registra la liquidación sabe de qué cuenta suya salió, no a
     cuál de las tuyas entró. El patrimonio ya está bien; lo que falta es
     decir dónde está. La pantalla avisa para que no se quede ahí. */
  /* Dos consultas y no una porque account_balances (creada en 0001) no
     expone is_pending_location, y añadir la columna a la vista significa
     un CREATE OR REPLACE sobre ella — algo que no conviene hacer hasta
     recuperar las migraciones 0013 y 0014, que están en la base y no en
     el repo. Dos consultas baratas hoy valen más que arriesgarse a
     revertir un cambio que no podemos leer. */
  const { data: cuentaPendiente } = await supabase
    .from('accounts')
    .select('id')
    .eq('owner_id', yo)
    .eq('is_pending_location', true)
    .maybeSingle()

  const { data: pendiente } = cuentaPendiente
    ? await supabase.from('account_balances')
        .select('balance').eq('account_id', cuentaPendiente.id).maybeSingle()
    : { data: null }

  return {
    yo,
    pareja,
    recibidas: (recibidas ?? []) as DatosPareja['recibidas'],
    enviadas: (enviadas ?? []) as DatosPareja['enviadas'],
    misCuentas: (misCuentas ?? []) as CuentaCompartible[],
    suyas,
    balance: Number(balanceRow?.balance ?? 0),
    misCuentasPago: misCuentasPago ?? [],
    misCategorias: misCategorias ?? [],
    compartidos: (compartidos ?? []) as GastoCompartido[],
    liquidaciones: (liquidaciones ?? []) as Liquidacion[],
    pendienteUbicar: Number(pendiente?.balance ?? 0),
    hoy: hoyBogota(),
  }
}
