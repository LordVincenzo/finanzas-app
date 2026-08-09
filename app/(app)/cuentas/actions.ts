'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { parsearCOP } from '@/lib/format'

export type EstadoCuenta = { error?: string }

const esquema = z.object({
  nombre: z.string().trim().min(1, 'Escribe un nombre').max(60),
  tipo: z.enum([
    'digital_wallet', 'checking', 'savings', 'cash', 'investment', 'other',
  ]),
  institucion: z.string().trim().max(60).optional(),
  visibilidad: z.enum(['private', 'shared_view']),
})

export async function crearCuenta(
  _previo: EstadoCuenta,
  formData: FormData
): Promise<EstadoCuenta> {
  const datos = esquema.safeParse({
    nombre: formData.get('nombre'),
    tipo: formData.get('tipo'),
    institucion: formData.get('institucion') ?? '',
    visibilidad: formData.get('visibilidad'),
  })

  if (!datos.success) {
    return { error: datos.error.issues[0].message }
  }

  // El monto llega como texto ("2.430.000", "2430k"). Lo convertimos
  // a entero de pesos AQUÍ, en el servidor. Nunca confiamos en el
  // número que venga del navegador.
  const textoSaldo = String(formData.get('saldoInicial') ?? '').trim()
  let saldo = 0
  if (textoSaldo) {
    const valor = parsearCOP(textoSaldo)
    if (valor === null) return { error: 'El saldo inicial no es un número válido' }
    if (valor < 0) return { error: 'El saldo inicial no puede ser negativo' }
    saldo = valor
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('crear_cuenta', {
    p_nombre: datos.data.nombre,
    p_tipo: datos.data.tipo,
    p_institucion: datos.data.institucion || null,
    p_saldo_inicial: saldo,
    p_visibilidad: datos.data.visibilidad,
  })

  if (error) {
    if (error.message.includes('uq_account_name_per_owner')) {
      return { error: 'Ya tienes una cuenta con ese nombre' }
    }
    return { error: error.message }
  }

  revalidatePath('/cuentas')
  revalidatePath('/inicio')
  redirect('/cuentas')
}