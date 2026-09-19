'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { parsearCOP } from '@/lib/format'
import { leerOrigen, rutaDe } from '@/lib/interfaz'
import { revalidarLedger, revalidarMeta } from '@/lib/revalidar'

export type EstadoMeta = { error?: string }

function traducir(mensaje: string): string {
  return mensaje.replace(/^.*?:\s*/, '').trim() || 'Algo salió mal'
}

const esquemaMeta = z.object({
  nombre: z.string().trim().min(1, 'Escribe un nombre').max(80),
  fecha: z.string().optional(),
  descripcion: z.string().trim().max(300).optional(),
  visibilidad: z.enum(['private', 'shared_view', 'joint']),
})

export async function crearMeta(
  _previo: EstadoMeta,
  formData: FormData
): Promise<EstadoMeta> {
  const origen = leerOrigen(formData.get('origen'))

  const datos = esquemaMeta.safeParse({
    nombre: formData.get('nombre'),
    fecha: formData.get('fecha') ?? '',
    descripcion: formData.get('descripcion') ?? '',
    visibilidad: formData.get('visibilidad'),
  })
  if (!datos.success) return { error: datos.error.issues[0].message }

  const objetivo = parsearCOP(String(formData.get('objetivo') ?? ''))
  if (objetivo === null || objetivo <= 0) {
    return { error: 'Escribe una meta válida mayor que cero' }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('crear_meta', {
    p_nombre: datos.data.nombre,
    p_objetivo: objetivo,
    p_fecha: datos.data.fecha || null,
    p_descripcion: datos.data.descripcion || null,
    p_visibilidad: datos.data.visibilidad,
  })

  if (error) return { error: traducir(error.message) }

  revalidarLedger()
  redirect(rutaDe(origen, 'ahorros'))
}

/**
 * Aportar no navega: se queda en la misma pantalla en las dos
 * interfaces, así que no necesita saber el origen.
 */
export async function aportar(
  _previo: EstadoMeta,
  formData: FormData
): Promise<EstadoMeta> {
  const meta = String(formData.get('meta') ?? '')
  const cuenta = String(formData.get('cuenta') ?? '')
  const signo = String(formData.get('signo') ?? 'mas')

  if (!meta || !cuenta) return { error: 'Faltan datos' }

  const monto = parsearCOP(String(formData.get('monto') ?? ''))
  if (monto === null || monto <= 0) {
    return { error: 'Escribe un monto válido' }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('aportar_meta', {
    p_meta: meta,
    p_cuenta: cuenta,
    p_monto: signo === 'menos' ? -monto : monto,
    p_nota: String(formData.get('nota') ?? '') || null,
  })

  if (error) return { error: traducir(error.message) }

  revalidarMeta(meta)
  return {}
}

/**
 * Antes descartaba el error del RPC: si el aporte era de otra persona,
 * eliminar_aporte lo rechazaba, la pantalla se recargaba igual y el
 * aporte seguía ahí sin ninguna explicación.
 *
 * Ya no lanza: el botón es un componente cliente (BotonAccion) que pinta
 * el mensaje al lado, que es donde la persona está mirando.
 */
export async function eliminarAporte(
  _previo: EstadoMeta,
  formData: FormData
): Promise<EstadoMeta> {
  const id = String(formData.get('id') ?? '')
  if (!id) return { error: 'No se identificó el aporte' }

  const supabase = await createClient()
  const { error } = await supabase.rpc('eliminar_aporte', { p_id: id })

  if (error) return { error: traducir(error.message) }

  revalidarMeta(String(formData.get('meta') ?? ''))
  return {}
}

/**
 * Eliminar, no archivar.
 *
 * archivar_meta() solo marcaba is_archived. Los aportes seguían vivos y
 * cuentas_disponible los seguía contando, así que el dinero quedaba
 * reservado para siempre en una meta que ya no se veía en ninguna
 * pantalla. Borrar la meta se lleva los aportes en cascada y el
 * disponible se recalcula solo.
 *
 * Devuelve estado en vez de tragarse el error: la RPC rechaza borrar
 * metas ajenas, y eso hay que poder mostrarlo.
 */
export async function eliminarMeta(
  _previo: EstadoMeta,
  formData: FormData
): Promise<EstadoMeta> {
  const origen = leerOrigen(formData.get('origen'))

  const id = String(formData.get('id') ?? '')
  if (!id) return { error: 'No se identificó la meta' }

  const supabase = await createClient()
  const { error } = await supabase.rpc('eliminar_meta', { p_id: id })

  if (error) return { error: traducir(error.message) }

  revalidarLedger()
  redirect(rutaDe(origen, 'ahorros'))
}
