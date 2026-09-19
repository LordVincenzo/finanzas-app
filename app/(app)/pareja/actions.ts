'use server'

import { revalidarLedger } from '@/lib/revalidar'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { parsearCOP } from '@/lib/format'

export type EstadoPareja = { error?: string; ok?: string }

function traducir(mensaje: string): string {
  return mensaje.replace(/^.*?:\s*/, '').trim() || 'Algo salió mal'
}


const esquemaEmail = z.object({
  email: z.string().trim().email('Escribe un correo válido'),
})

export async function invitar(
  _previo: EstadoPareja,
  formData: FormData
): Promise<EstadoPareja> {
  const datos = esquemaEmail.safeParse({ email: formData.get('email') })
  if (!datos.success) return { error: datos.error.issues[0].message }

  const supabase = await createClient()
  const { error } = await supabase.rpc('invitar_pareja', {
    p_email: datos.data.email,
  })

  if (error) return { error: traducir(error.message) }

  revalidarLedger()
  return { ok: 'Invitación enviada' }
}

export async function aceptar(formData: FormData) {
  const id = String(formData.get('id') ?? '')
  const supabase = await createClient()
  const { error } = await supabase.rpc('aceptar_invitacion', { p_id: id })
  if (error) throw new Error(traducir(error.message))
  revalidarLedger()
}

export async function rechazar(formData: FormData) {
  const id = String(formData.get('id') ?? '')
  const supabase = await createClient()
  await supabase.rpc('rechazar_invitacion', { p_id: id })
  revalidarLedger()
}

export async function cancelar(formData: FormData) {
  const id = String(formData.get('id') ?? '')
  const supabase = await createClient()
  await supabase.rpc('cancelar_invitacion', { p_id: id })
  revalidarLedger()
}

export async function salir() {
  const supabase = await createClient()
  const { error } = await supabase.rpc('salir_pareja')
  if (error) throw new Error(traducir(error.message))
  revalidarLedger()
}

/** Cambia una cuenta entre privada y compartida. */
export async function cambiarVisibilidad(formData: FormData) {
  const id = String(formData.get('id') ?? '')
  const nueva = String(formData.get('visibilidad') ?? '')

  if (nueva !== 'private' && nueva !== 'shared_view') return

  const supabase = await createClient()
  // El RLS ya garantiza que solo puedas tocar tus propias cuentas.
  await supabase.from('accounts').update({ visibility: nueva }).eq('id', id)

  revalidarLedger()
}

export async function crearGastoCompartido(
  _previo: EstadoPareja,
  formData: FormData
): Promise<EstadoPareja> {
  const cuenta = String(formData.get('cuenta') ?? '')
  const categoria = String(formData.get('categoria') ?? '')
  const descripcion = String(formData.get('descripcion') ?? '').trim()
  const fecha = String(formData.get('fecha') ?? '')

  if (!cuenta || !categoria) return { error: 'Faltan la cuenta o la categoría' }
  if (!descripcion) return { error: 'Escribe una descripción' }

  const total = parsearCOP(String(formData.get('total') ?? ''))
  if (total === null || total <= 0) return { error: 'Escribe un monto válido' }

  const miParte = parsearCOP(String(formData.get('miParte') ?? ''))
  if (miParte === null || miParte < 0 || miParte > total) {
    return { error: 'Tu parte debe estar entre 0 y el total' }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('crear_gasto_compartido', {
    p_total: total,
    p_cuenta: cuenta,
    p_categoria: categoria,
    p_descripcion: descripcion,
    p_mi_parte: miParte,
    p_fecha: fecha || null,
    p_notas: String(formData.get('notas') ?? '') || null,
  })

  if (error) return { error: traducir(error.message) }

  revalidarLedger()
  return { ok: 'Gasto compartido registrado' }
}

export async function liquidar(
  _previo: EstadoPareja,
  formData: FormData
): Promise<EstadoPareja> {
  const cuenta = String(formData.get('cuenta') ?? '')
  if (!cuenta) return { error: 'Selecciona una cuenta' }

  const monto = parsearCOP(String(formData.get('monto') ?? ''))
  if (monto === null || monto <= 0) return { error: 'Escribe un monto válido' }

  const supabase = await createClient()
  const { error } = await supabase.rpc('liquidar_con_pareja', {
    p_monto: monto,
    p_cuenta: cuenta,
    p_yo_pago: String(formData.get('direccion')) === 'pago',
    p_fecha: String(formData.get('fecha') ?? '') || null,
    p_nota: String(formData.get('nota') ?? '') || null,
  })

  if (error) return { error: traducir(error.message) }

  revalidarLedger()
  return { ok: 'Liquidación registrada' }
}

export async function eliminarGastoCompartido(formData: FormData) {
  const id = String(formData.get('id') ?? '')
  const supabase = await createClient()
  await supabase.rpc('eliminar_gasto_compartido', { p_id: id })
  revalidarLedger()
}

/**
 * Borrar una liquidación mal registrada.
 *
 * Hasta la migración 0021 esto no existía. eliminar_movimiento() la
 * rechazaba diciendo "Borrala desde Pareja", pero no había ni RPC ni
 * botón: el mensaje mandaba a un sitio que no estaba, y una liquidación
 * equivocada no se podía deshacer de ninguna manera.
 *
 * La puede borrar cualquiera de los dos, no solo quien pagó: cualquiera
 * pudo haberla registrado (el formulario cubre "yo pago" y "me pagan").
 */
export async function eliminarLiquidacion(formData: FormData) {
  const id = String(formData.get('id') ?? '')
  const supabase = await createClient()
  const { error } = await supabase.rpc('eliminar_liquidacion', { p_id: id })
  if (error) throw new Error(traducir(error.message))
  revalidarLedger()
}