import { NextResponse } from 'next/server'
import { createClient, } from '@/lib/supabase/server'
import { hoyEnBogota } from '@/lib/format'

/**
 * Todo tu historial, en un CSV.
 *
 * POR QUÉ EXISTE. Todo vive en Supabase y no había forma de sacarlo. En
 * algo que se lleva años, y donde el valor está justo en el historial
 * acumulado, eso es un riesgo que no depende de hacer nada mal: basta
 * un error de plataforma o borrar el proyecto sin querer.
 *
 * ES DISTINTO DEL EXTRACTO. El extracto es para leer un mes; esto es
 * para no perder nada. El extracto de septiembre no te devuelve agosto.
 *
 * EN PESOS ENTEROS, como en la base. Exportar "45.000" obligaría a
 * adivinar si el punto separa miles o decimales al volver a leerlo.
 * 45000 no tiene esa duda.
 */

export const dynamic = 'force-dynamic'

/**
 * Un valor, listo para CSV.
 *
 * LAS COMILLAS Y LOS SALTOS de línea se escapan, que es lo obvio. Lo
 * que no es obvio: una descripción que empiece por =, +, - o @ la
 * ejecuta Excel como una fórmula al abrir el archivo. Se llama
 * inyección CSV y es una forma real de que un archivo de datos se
 * convierta en código — aquí las descripciones las escribe la persona,
 * pero también llegan del texto de una notificación bancaria, que viene
 * de fuera.
 *
 * El apóstrofo delante es lo que Excel entiende como "esto es texto".
 */
function campo(valor: unknown): string {
  const texto = valor === null || valor === undefined ? '' : String(valor)
  const seguro = /^[=+\-@\t\r]/.test(texto) ? `'${texto}` : texto
  return `"${seguro.replace(/"/g, '""')}"`
}

const COLUMNAS = [
  'fecha', 'hora', 'tipo', 'descripcion', 'monto',
  'sale_de', 'entra_a', 'notas', 'id',
] as const

const NOMBRE_TIPO: Record<string, string> = {
  expense: 'Gasto',
  income: 'Ingreso',
  transfer: 'Traslado',
  adjustment: 'Ajuste',
  opening: 'Saldo inicial',
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  /* Sin sesión no se exporta nada. Un 401 en vez de un redirect: esto
     lo pide una descarga, no una navegación, y devolver el HTML del
     login como si fuera el CSV es peor que decir que no. */
  if (!user) {
    return NextResponse.json({ error: 'Inicia sesión' }, { status: 401 })
  }

  /* TODO el historial, sin límite ni filtro de mes: para eso es. Las
     aperturas también — son parte de cómo llegó cada cuenta a su saldo,
     y sin ellas los números no se pueden reconstruir. */
  const { data, error } = await supabase
    .from('movimientos_detalle')
    .select('id, type, description, notes, occurred_at, occurred_on, monto, cuenta_origen, cuenta_destino')
    .eq('owner_id', user.id)
    .order('occurred_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: 'No se pudo exportar' }, { status: 500 })
  }

  const filas = (data ?? []).map((m) => {
    const hora = new Intl.DateTimeFormat('es-CO', {
      hour: '2-digit', minute: '2-digit', hour12: false,
      timeZone: 'America/Bogota',
    }).format(new Date(m.occurred_at as string))

    return [
      m.occurred_on,
      hora,
      NOMBRE_TIPO[m.type as string] ?? m.type,
      m.description,
      m.monto,
      m.cuenta_origen,
      m.cuenta_destino,
      m.notes,
      m.id,
    ].map(campo).join(',')
  })

  /* El BOM es lo que hace que Excel abra el archivo como UTF-8. Sin él,
     "Alimentación" se ve "AlimentaciÃ³n" — y un respaldo que se lee mal
     es medio respaldo. */
  const csv = '﻿' + [COLUMNAS.join(','), ...filas].join('\r\n')

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition':
        `attachment; filename="finanzas-${hoyEnBogota()}.csv"`,
      // Un respaldo no se cachea: siempre lo último.
      'Cache-Control': 'no-store',
    },
  })
}
