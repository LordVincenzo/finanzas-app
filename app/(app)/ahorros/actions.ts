'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { parsearCOP } from '@/lib/format'

export type EstadoMeta = { error?: string }

function traducir(mensaje: string): string {
  return mensaje.replace(/^.*?:\s*/, '').trim() || 'Algo salió mal'
}

function revalidar() {
  revalidatePath('/ahorros')
  revalidatePath('/inicio')
  revalidatePath('/cuentas')
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

  revalidar()
  redirect('/ahorros')
}

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

  revalidar()
  revalidatePath(`/ahorros/${meta}`)
  return {}
}

export async function eliminarAporte(formData: FormData) {
  const id = String(formData.get('id') ?? '')
  const supabase = await createClient()
  await supabase.rpc('eliminar_aporte', { p_id: id })
  revalidar()
  revalidatePath(`/ahorros/${formData.get('meta')}`)
}

export async function archivarMeta(formData: FormData) {
  const id = String(formData.get('id') ?? '')
  const supabase = await createClient()
  await supabase.rpc('archivar_meta', { p_id: id })
  revalidar()
  redirect('/ahorros')
}