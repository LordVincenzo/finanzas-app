'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { parsearCOP } from '@/lib/format'
import { ladosDelMovimiento } from '@/lib/movimientos'
import { leerOrigen, rutaDe } from '@/lib/interfaz'
import { revalidarLedger } from '@/lib/revalidar'

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

/** Los mensajes de Postgres ya vienen en español; limpiamos el prefijo. */
function traducir(mensaje: string): string {
  return mensaje.replace(/^.*?:\s*/, '').trim() || 'No se pudo registrar el movimiento'
}

export async function registrarMovimiento(
  _previo: EstadoMovimiento,
  formData: FormData
): Promise<EstadoMovimiento> {
  const origen = leerOrigen(formData.get('origen'))

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
    if (monto < 0) return { error: 'Escribe el saldo en positivo' }

    /* En una deuda la persona escribe lo que DEBE, en positivo, y el
       ledger la necesita negativa. La clase se consulta en la base, no
       se acepta del formulario: si el signo dependiera de un campo que
       viaja por la red, manipularlo convertiría una deuda en dinero y
       el patrimonio saldría al revés. */
    const { data: cta } = await supabase
      .from('accounts').select('class').eq('id', cuenta).maybeSingle()

    const saldoReal = cta?.class === 'liability' ? -monto : monto

    const { error } = await supabase.rpc('ajustar_saldo', {
      p_cuenta: cuenta,
      p_saldo_real: saldoReal,
      p_notas: notas || null,
      p_ocurrido_en: ocurridoEn,
    })
    if (error) return { error: traducir(error.message) }

    revalidarLedger()
    redirect(rutaDe(origen, 'movimientos'))
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

  // El servidor decide qué cuenta es origen y cuál destino según el
  // tipo. El formulario nunca envía esa decisión. La regla vive en
  // lib/movimientos.ts porque la bandeja de entrada la necesita igual.
  const { origen: cuentaOrigen, destino: cuentaDestino } =
    ladosDelMovimiento(tipo, cuenta, contraparte)

  const { error } = await supabase.rpc('crear_movimiento', {
    p_tipo: tipo,
    p_monto: monto,
    p_cuenta_origen: cuentaOrigen,
    p_cuenta_destino: cuentaDestino,
    p_descripcion: descripcion,
    p_ocurrido_en: ocurridoEn,
    p_notas: notas || null,
    p_visibilidad: 'private',
  })

  if (error) return { error: traducir(error.message) }

  revalidarLedger()
  redirect(rutaDe(origen, 'movimientos'))
}

/**
 * Antes lanzaba una excepción: el mensaje del RPC se perdía y el usuario
 * veía la pantalla de error de Next.js en vez de saber qué pasó.
 * Ahora devuelve estado, igual que el resto de acciones.
 *
 * No navega (se queda en la lista), así que no necesita el origen.
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

  revalidarLedger()
  return {}
}

/**
 * Corregir un movimiento que ya existe.
 *
 * MISMAS REGLAS QUE CREAR, y a propósito: el tipo, el parseo del monto
 * y quién es origen y quién destino salen de los mismos sitios. Un
 * formulario que valida distinto al editar es un formulario que deja
 * entrar por la puerta de atrás lo que rechaza por la de delante.
 *
 * EL AJUSTE NO SE PUEDE EDITAR, ni convertir un movimiento en ajuste:
 * un ajuste es una corrección de saldo que deja rastro, no un
 * movimiento más. Por eso el tipo se valida contra los tres reales.
 *
 * Lo demás lo comprueba editar_movimiento() en la base: que sea tuyo,
 * que no sea una apertura, y que no sea parte de un gasto compartido,
 * un abono a un préstamo o una liquidación — esos tienen dos
 * transacciones espejo y editar una sola dejaría los dos ledgers en
 * desacuerdo.
 */
export async function editarMovimiento(
  _previo: EstadoMovimiento,
  formData: FormData
): Promise<EstadoMovimiento> {
  const origen = leerOrigen(formData.get('origen'))

  const id = String(formData.get('id') ?? '')
  if (!id) return { error: 'No se identificó el movimiento' }

  const datos = esquema.safeParse({
    tipo: formData.get('tipo'),
    cuenta: formData.get('cuenta'),
    contraparte: formData.get('contraparte') ?? '',
    descripcion: formData.get('descripcion') ?? '',
    fecha: formData.get('fecha'),
    notas: formData.get('notas') ?? '',
  })

  if (!datos.success) return { error: datos.error.issues[0].message }

  const { tipo, cuenta, contraparte, descripcion, fecha, notas } = datos.data

  if (tipo === 'adjustment') {
    return {
      error: 'Un ajuste no se edita. Registra otro ajuste con el saldo correcto.',
    }
  }

  const monto = parsearCOP(String(formData.get('monto') ?? ''))
  if (monto === null || monto <= 0) {
    return { error: 'El monto debe ser mayor que cero' }
  }

  if (!contraparte) {
    return {
      error: tipo === 'transfer'
        ? 'Selecciona la cuenta de destino'
        : 'Selecciona una categoría',
    }
  }
  if (!descripcion) return { error: 'Escribe una descripción' }

  if (tipo === 'transfer' && cuenta === contraparte) {
    return { error: 'El origen y el destino no pueden ser la misma cuenta' }
  }

  const { origen: cuentaOrigen, destino: cuentaDestino } =
    ladosDelMovimiento(tipo, cuenta, contraparte)

  const supabase = await createClient()
  const { error } = await supabase.rpc('editar_movimiento', {
    p_tx: id,
    p_tipo: tipo,
    p_monto: monto,
    p_cuenta_origen: cuentaOrigen,
    p_cuenta_destino: cuentaDestino,
    p_descripcion: descripcion,
    p_ocurrido_en: aInstanteBogota(fecha),
    p_notas: notas || null,
  })

  if (error) return { error: traducir(error.message) }

  revalidarLedger()
  redirect(rutaDe(origen, 'movimientos'))
}
