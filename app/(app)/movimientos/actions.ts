'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { parsearCOP } from '@/lib/format'

export type EstadoMovimiento = { error?: string }
export type EstadoEliminar = { error?: string }

const esquema = z.object({
  tipo: z.enum(['expense', 'income', 'transfer', 'adjustment']),
  cuenta: z.string().uuid('Selecciona una cuenta'),
  contraparte: z.string().uuid().optional().or(z.literal('')),
  descripcion: z.string().trim().max(200).optional(),
  fecha: z.string().min(1, 'Selecciona una fecha'),
  notas: z.string().trim().max(500).optional(),
})

/**
 * Colombia no tiene horario de verano: siempre UTC-5.
 * El input datetime-local entrega "2026-08-09T12:32" sin zona horaria.
 * Le añadimos el offset para que el instante sea inequívoco.
 * Sin esto, el navegador asumiría la zona del dispositivo y un mismo
 * gasto podría caer en un mes distinto según dónde estés.
 */
function aInstanteBogota(valorLocal: string): string {
  return `${valorLocal}:00-05:00`
}

/** Las pantallas cuyos números dependen del ledger. */
function revalidarTodo() {
  revalidatePath('/movimientos')
  revalidatePath('/cuentas')
  revalidatePath('/inicio')
  revalidatePath('/ahorros')
  revalidatePath('/prestamos')
  revalidatePath('/pareja')
}

export async function registrarMovimiento(
  _previo: EstadoMovimiento,
  formData: FormData
): Promise<EstadoMovimiento> {
  const datos = esquema.safeParse({
    tipo: formData.get('tipo'),
    cuenta: formData.get('cuenta'),
    contraparte: formData.get('contraparte') ?? '',
    descripcion: formData.get('descripcion') ?? '',
    fecha: formData.get('fecha'),
    notas: formData.get('notas') ?? '',
  })

  if (!datos.success) {
    return { error: datos.error.issues[0].message }
  }

  const { tipo, cuenta, contraparte, descripcion, fecha, notas } = datos.data

  const monto = parsearCOP(String(formData.get('monto') ?? ''))
  if (monto === null) {
    return { error: 'Escribe un monto válido' }
  }

  const supabase = await createClient()
  const ocurridoEn = aInstanteBogota(fecha)

  // ---- Ajuste: camino aparte, recibe el saldo real ----------------
  if (tipo === 'adjustment') {
    if (monto < 0) return { error: 'El saldo no puede ser negativo' }

    const { error } = await supabase.rpc('ajustar_saldo', {
      p_cuenta: cuenta,
      p_saldo_real: monto,
      p_notas: notas || null,
      p_ocurrido_en: ocurridoEn,
    })
    if (error) return { error: traducir(error.message) }

    revalidarTodo()
    redirect('/movimientos')
  }

  // ---- Gasto, ingreso y transferencia -----------------------------
  if (monto <= 0) return { error: 'El monto debe ser mayor que cero' }
  if (!contraparte) {
    return {
      error: tipo === 'transfer'
        ? 'Selecciona la cuenta de destino'
        : 'Selecciona una categoría',
    }
  }
  if (!descripcion) return { error: 'Escribe una descripción' }

  // Una transferencia a la misma cuenta produciría dos líneas que se anulan:
  // válida para el trigger de suma cero, pero sin sentido para el usuario.
  if (tipo === 'transfer' && cuenta === contraparte) {
    return { error: 'El origen y el destino no pueden ser la misma cuenta' }
  }

  // El servidor decide qué cuenta es origen y cuál destino según
  // el tipo. El formulario nunca envía esa decisión.
  const [origen, destino] =
    tipo === 'income'
      ? [contraparte, cuenta]   // el dinero viene de la categoría de ingreso
      : [cuenta, contraparte]   // gasto y transferencia salen de la cuenta

  const { error } = await supabase.rpc('crear_movimiento', {
    p_tipo: tipo,
    p_monto: monto,
    p_cuenta_origen: origen,
    p_cuenta_destino: destino,
    p_descripcion: descripcion,
    p_ocurrido_en: ocurridoEn,
    p_notas: notas || null,
    p_visibilidad: 'private',
  })

  if (error) return { error: traducir(error.message) }

  revalidarTodo()
  redirect('/movimientos')
}

/** Los mensajes de Postgres ya vienen en español; limpiamos el prefijo. */
function traducir(mensaje: string): string {
  return mensaje.replace(/^.*?:\s*/, '').trim() || 'No se pudo registrar el movimiento'
}

/**
 * Antes lanzaba una excepción: el mensaje del RPC se perdía y el usuario
 * veía la pantalla de error de Next.js en vez de saber qué pasó.
 * Ahora devuelve estado, igual que el resto de acciones.
 */
export async function eliminarMovimiento(
  _previo: EstadoEliminar,
  formData: FormData
): Promise<EstadoEliminar> {
  const id = String(formData.get('id') ?? '')
  if (!id) return { error: 'No se identificó el movimiento' }

  const supabase = await createClient()
  const { error } = await supabase.rpc('eliminar_movimiento', { p_tx: id })

  if (error) {
    return { error: traducir(error.message) || 'No se pudo eliminar' }
  }

  revalidarTodo()
  return {}
}