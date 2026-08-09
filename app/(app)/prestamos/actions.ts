'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { parsearCOP } from '@/lib/format'

export type EstadoPrestamo = { error?: string }

function traducir(mensaje: string): string {
  return mensaje.replace(/^.*?:\s*/, '').trim() || 'Algo salió mal'
}

function revalidar(id?: string) {
  revalidatePath('/prestamos')
  revalidatePath('/cuentas')
  revalidatePath('/inicio')
  revalidatePath('/movimientos')
  if (id) revalidatePath(`/prestamos/${id}`)
}

const esquema = z.object({
  persona: z.string().trim().min(1, 'Escribe a quién le prestaste').max(80),
  cuenta: z.string().uuid('Selecciona la cuenta de origen'),
  fecha: z.string().min(1, 'Selecciona la fecha'),
  notas: z.string().trim().max(500).optional(),
})

export async function crearPrestamo(
  _previo: EstadoPrestamo,
  formData: FormData
): Promise<EstadoPrestamo> {
  const datos = esquema.safeParse({
    persona: formData.get('persona'),
    cuenta: formData.get('cuenta'),
    fecha: formData.get('fecha'),
    notas: formData.get('notas') ?? '',
  })
  if (!datos.success) return { error: datos.error.issues[0].message }

  const monto = parsearCOP(String(formData.get('monto') ?? ''))
  if (monto === null || monto <= 0) {
    return { error: 'Escribe un monto válido' }
  }

  // Las cuotas llegan como JSON desde el componente cliente, que ya
  // las generó visualmente. Aquí las validamos otra vez: el servidor
  // no confía en lo que le manda el navegador.
  let cuotas: { fecha: string; monto: number }[] = []
  const crudo = String(formData.get('cuotas') ?? '')
  if (crudo) {
    try {
      cuotas = JSON.parse(crudo)
    } catch {
      return { error: 'Las cuotas no son válidas' }
    }
  }

  if (cuotas.length > 0) {
    const suma = cuotas.reduce((s, c) => s + Number(c.monto), 0)
    if (suma !== monto) {
      return { error: `Las cuotas suman ${suma.toLocaleString('es-CO')} y el préstamo es ${monto.toLocaleString('es-CO')}` }
    }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('crear_prestamo', {
    p_persona: datos.data.persona,
    p_monto: monto,
    p_cuenta_origen: datos.data.cuenta,
    p_fecha: datos.data.fecha,
    p_cuotas: cuotas,
    p_notas: datos.data.notas || null,
  })

  if (error) return { error: traducir(error.message) }

  revalidar()
  redirect('/prestamos')
}

export async function registrarAbono(
  _previo: EstadoPrestamo,
  formData: FormData
): Promise<EstadoPrestamo> {
  const prestamo = String(formData.get('prestamo') ?? '')
  const cuenta = String(formData.get('cuenta') ?? '')
  const cuota = String(formData.get('cuota') ?? '')

  const monto = parsearCOP(String(formData.get('monto') ?? ''))
  if (monto === null || monto <= 0) return { error: 'Escribe un monto válido' }
  if (!cuenta) return { error: 'Selecciona la cuenta donde entra el dinero' }

  const supabase = await createClient()
  const { error } = await supabase.rpc('registrar_pago_prestamo', {
    p_prestamo: prestamo,
    p_monto: monto,
    p_cuenta: cuenta,
    p_cuota: cuota || null,
    p_fecha: String(formData.get('fecha') ?? '') || null,
    p_nota: String(formData.get('nota') ?? '') || null,
  })

  if (error) return { error: traducir(error.message) }

  revalidar(prestamo)
  return {}
}

export async function eliminarAbono(formData: FormData) {
  const id = String(formData.get('id') ?? '')
  const prestamo = String(formData.get('prestamo') ?? '')
  const supabase = await createClient()
  await supabase.rpc('eliminar_pago_prestamo', { p_pago: id })
  revalidar(prestamo)
}

export async function cancelarPrestamo(formData: FormData) {
  const id = String(formData.get('id') ?? '')
  const supabase = await createClient()
  await supabase.rpc('cancelar_prestamo', { p_prestamo: id })
  revalidar(id)
  redirect('/prestamos')
}