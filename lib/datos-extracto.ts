import { createClient, requerirUsuario } from '@/lib/supabase/server'
import { mesActualBogota, moverMes } from '@/lib/format'
import { ORDEN_TIPOS_CUENTA, cuentaVisible } from '@/lib/tipos'

/**
 * Los datos del extracto de un mes, para las dos interfaces.
 *
 * ESTABA DUPLICADO. La misma consulta vivía copiada en la pantalla del
 * celular y en la del escritorio, y la primera vez que hubo que añadir
 * algo —el resumen por cuenta— había que añadirlo dos veces sin que
 * nada avisara si se olvidaba una. Es exactamente de donde salieron los
 * cuatro bugs que el proyecto lleva contados.
 */

export type MovimientoExtracto = {
  id: string
  type: string
  description: string
  occurred_on: string
  occurred_at: string
  monto: number
  cuenta_origen: string
  cuenta_destino: string
}

export type CuentaExtracto = {
  cuenta: string
  tipo: string
  saldo_inicial: number
  entro: number
  salio: number
  saldo_final: number
}

export type DiaExtracto = {
  dia: string
  movimientos: MovimientoExtracto[]
}

/** El mes que se va a mostrar: el pedido si es válido, si no el anterior. */
export function mesDelExtracto(pedido?: string): string {
  /* El anterior por defecto, no el actual: un extracto es de algo que ya
     terminó. El de este mes todavía está cambiando. */
  return /^\d{4}-\d{2}$/.test(pedido ?? '') ? pedido! : moverMes(mesActualBogota(), -1)
}

export async function datosDelExtracto(mesPedido?: string) {
  const mes = mesDelExtracto(mesPedido)
  const supabase = await createClient()
  const user = await requerirUsuario(supabase)

  const desde = `${mes}-01`
  const [anio, m] = mes.split('-').map(Number)
  const hasta = new Date(Date.UTC(anio, m, 0)).toISOString().slice(0, 10)

  const [{ data: perfil }, { data: movs }, { data: cats }, { data: cuentas }] =
    await Promise.all([
      supabase.from('profiles').select('display_name').eq('id', user.id).single(),
      supabase.from('movimientos_detalle')
        .select('id, type, description, occurred_on, occurred_at, monto, cuenta_origen, cuenta_destino')
        .eq('owner_id', user.id)
        .gte('occurred_on', desde).lte('occurred_on', hasta)
        .order('occurred_at', { ascending: true }),
      supabase.from('categorias_mensuales')
        .select('categoria, monto')
        .eq('owner_id', user.id).eq('mes', mes)
        .order('monto', { ascending: false }),
      supabase.from('extracto_por_cuenta')
        .select('cuenta, tipo, es_pendiente_ubicar, saldo_inicial, entro, salio, saldo_final')
        .eq('owner_id', user.id).eq('mes', mes),
    ])

  const movimientos = (movs ?? []) as unknown as MovimientoExtracto[]

  /* Entró y Salió son ingresos y gastos DE VERDAD: un traslado de Nu a
     Nequi no es ninguna de las dos cosas, y contarlo inflaría las dos
     cifras a la vez. Los traslados sí aparecen más abajo, en el saldo
     de cada cuenta, que es donde significan algo. */
  const ingresos = movimientos
    .filter((x) => x.type === 'income')
    .reduce((s, x) => s + Number(x.monto), 0)
  const gastos = movimientos
    .filter((x) => x.type === 'expense')
    .reduce((s, x) => s + Number(x.monto), 0)

  /* Una cuenta entra al extracto si tuvo movimiento o si tenía o quedó
     con algo. Las que estuvieron en cero todo el mes solo alargan la
     hoja. `cuentaVisible` es la misma regla de /cuentas: una por cobrar
     saldada no se enseña. */
  const porCuenta = ((cuentas ?? []) as unknown as (CuentaExtracto & {
    es_pendiente_ubicar: boolean
  })[])
    .filter((c) =>
      cuentaVisible(c.tipo, Number(c.saldo_final), c.es_pendiente_ubicar) &&
      (Number(c.entro) || Number(c.salio) ||
       Number(c.saldo_inicial) || Number(c.saldo_final)))
    .map((c) => ({
      cuenta: c.cuenta,
      tipo: c.tipo,
      saldo_inicial: Number(c.saldo_inicial),
      entro: Number(c.entro),
      salio: Number(c.salio),
      saldo_final: Number(c.saldo_final),
    }))
    .sort((a, b) => {
      const oa = ORDEN_TIPOS_CUENTA.indexOf(a.tipo)
      const ob = ORDEN_TIPOS_CUENTA.indexOf(b.tipo)
      if (oa !== ob) return (oa < 0 ? 99 : oa) - (ob < 0 ? 99 : ob)
      return a.cuenta.localeCompare(b.cuenta, 'es')
    })

  /* La fecha, una vez por día y no una vez por fila. En un mes de 73
     movimientos eso son 73 repeticiones de "26 de agosto" que no dicen
     nada nuevo y que es justo lo que hace que la hoja parezca un muro. */
  const dias: DiaExtracto[] = []
  for (const x of movimientos) {
    const ultimo = dias[dias.length - 1]
    if (ultimo && ultimo.dia === x.occurred_on) ultimo.movimientos.push(x)
    else dias.push({ dia: x.occurred_on, movimientos: [x] })
  }

  return {
    mes,
    nombre: perfil?.display_name as string | undefined,
    movimientos,
    dias,
    porCuenta,
    categorias: (cats ?? []).map((c) => ({
      categoria: c.categoria as string,
      monto: Number(c.monto),
    })),
    ingresos,
    gastos,
  }
}
