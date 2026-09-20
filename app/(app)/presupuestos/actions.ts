'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { parsearCOP } from '@/lib/format'

export type EstadoPresupuesto = { error?: string; ok?: boolean }

function traducir(mensaje: string): string {
  return mensaje.replace(/^.*?:\s*/, '').trim() || 'Algo salió mal'
}

/** Las pantallas donde se ve un presupuesto o lo que queda de él. */
function revalidar() {
  revalidatePath('/presupuestos')
  revalidatePath('/inicio')
  revalidatePath('/escritorio')
  revalidatePath('/escritorio/presupuestos')
}

const esquema = z.object({
  categoria: z.string().uuid('Elige una categoría'),
})

/**
 * Poner o cambiar el tope de una categoría.
 *
 * El monto se vuelve a parsear aquí y no se confía en el número que
 * llegue del formulario, igual que en el resto de la app: lo que
 * escribe una persona es texto —"600k", "600.000"— hasta que el
 * servidor lo convierte.
 */
export async function ponerPresupuesto(
  _previo: EstadoPresupuesto,
  formData: FormData
): Promise<EstadoPresupuesto> {
  const datos = esquema.safeParse({ categoria: formData.get('categoria') })
  if (!datos.success) return { error: datos.error.issues[0].message }

  const monto = parsearCOP(String(formData.get('monto') ?? ''))
  if (monto === null || monto <= 0) {
    return { error: 'Escribe un tope mayor que cero' }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('poner_presupuesto', {
    p_categoria: datos.data.categoria,
    p_monto: monto,
  })

  if (error) return { error: traducir(error.message) }

  revalidar()
  return { ok: true }
}

export async function quitarPresupuesto(
  _previo: EstadoPresupuesto,
  formData: FormData
): Promise<EstadoPresupuesto> {
  const categoria = String(formData.get('categoria') ?? '')
  if (!categoria) return { error: 'No se identificó la categoría' }

  const supabase = await createClient()
  const { error } = await supabase.rpc('quitar_presupuesto', {
    p_categoria: categoria,
  })

  if (error) return { error: traducir(error.message) }

  revalidar()
  return { ok: true }
}
