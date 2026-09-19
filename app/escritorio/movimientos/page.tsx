import Link from 'next/link'
import { Plus } from 'lucide-react'
import { z } from 'zod'
import { createClient, requerirUsuario } from '@/lib/supabase/server'
import { formatearCOP, formatearFecha, formatearHora, mesActualBogota } from '@/lib/format'
import { NOMBRE_TIPO, presentarMovimiento, type Movimiento } from '@/lib/movimientos'
import { FiltrosMovimientosEscritorio } from '@/components/filtros-movimientos-escritorio'

/** Los filtros llegan por la URL, así que no son de fiar hasta comprobarlos. */
const esquemaUuid = z.string().uuid()
const esUuid = (valor: string) => esquemaUuid.safeParse(valor).success

export default async function MovimientosEscritorioPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string; mes?: string; cuenta?: string; categoria?: string }>
}) {
  const {
    tipo = '', mes = mesActualBogota(), cuenta = '', categoria = '',
  } = await searchParams
  const supabase = await createClient()
  const user = await requerirUsuario(supabase)

  const desde = `${mes}-01`
  const [anio, m] = mes.split('-').map(Number)
  const hasta = new Date(Date.UTC(anio, m, 0)).toISOString().slice(0, 10)

  let consulta = supabase
    .from('movimientos_detalle')
    .select('*')
    // Tu historial, no el de la pareja. Ver el comentario del celular.
    .eq('owner_id', user.id)
    .gte('occurred_on', desde).lte('occurred_on', hasta)
    .order('occurred_at', { ascending: false })

  if (tipo) consulta = consulta.eq('type', tipo)

  /* Los dos filtros de abajo se interpolan dentro de la cadena de un
     .or(), que es sintaxis de PostgREST. Un valor con comas o puntos
     cambia la consulta entera, así que no se pasa nada que no sea un
     UUID. No rompía el RLS —eso lo decide Postgres, no la cadena— pero
     un filtro que el usuario puede reescribir no debería existir. */
  const cuentaId = esUuid(cuenta) ? cuenta : ''
  const categoriaId = esUuid(categoria) ? categoria : ''

  if (cuentaId) {
    consulta = consulta.or(
      `cuenta_origen_id.eq.${cuentaId},cuenta_destino_id.eq.${cuentaId}`)
  }
  // Filtro separado del de cuenta: una categoría es una cuenta de clase
  // expense/income (ver CLAUDE.md), no una cuenta de dinero. Al ser dos
  // .or() distintos, Supabase los combina con AND — puedes pedir
  // "Nu" + "Alimentación" a la vez.
  if (categoriaId) {
    consulta = consulta.or(
      `cuenta_origen_id.eq.${categoriaId},cuenta_destino_id.eq.${categoriaId}`)
  }

  const [{ data: cuentas }, { data: categorias }, { data: movsData }] = await Promise.all([
    // Tus cuentas y tus categorías: las de la pareja en un desplegable
    // de filtros no filtrarían nada, porque sus movimientos no están en
    // esta tabla.
    supabase.from('accounts')
      .select('id, name')
      .eq('owner_id', user.id)
      .eq('is_active', true).eq('is_opening', false)
      .in('class', ['asset', 'liability'])
      .order('name'),
    supabase.from('accounts')
      .select('id, name')
      .eq('owner_id', user.id)
      .eq('is_active', true)
      .in('class', ['expense', 'income'])
      .order('name'),
    consulta,
  ])

  const movimientos = (movsData ?? []) as Movimiento[]

  // "Cuánto gastaste/ingresaste de verdad" (monto), no "cuánto se
  // movió" (monto_total) — la misma distinción que ya usa Inicio.
  const ingresos = movimientos
    .filter((m) => m.type === 'income')
    .reduce((s, m) => s + Number(m.monto), 0)
  const gastos = movimientos
    .filter((m) => m.type === 'expense')
    .reduce((s, m) => s + Number(m.monto), 0)

  return (
    <div className="mx-auto max-w-[1400px] px-8 py-10">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight">Movimientos</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Mes, tipo, cuenta y categoría a la vez — en el celular ves un filtro a la vez.
          </p>
        </div>
        <Link href="/escritorio/movimientos/nuevo"
              className="flex h-9 shrink-0 items-center gap-1.5 rounded-full
                         bg-primary px-4 text-[13px] font-medium
                         text-primary-foreground shadow-card transition
                         hover:opacity-90">
          <Plus className="size-4" /> Registrar movimiento
        </Link>
      </div>

      <FiltrosMovimientosEscritorio
        mes={mes} cuentas={cuentas ?? []} categorias={categorias ?? []}
      />

      <div className="mt-6 grid grid-cols-3 gap-4">
        <TarjetaResumen etiqueta="Ingresos" valor={formatearCOP(ingresos)} tono="positivo" />
        <TarjetaResumen etiqueta="Gastos" valor={formatearCOP(gastos)} tono="negativo" />
        <TarjetaResumen etiqueta="Movimientos" valor={String(movimientos.length)} />
      </div>

      <div className="mt-6 overflow-x-auto rounded-2xl bg-card shadow-card
                      ring-1 ring-border/70">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-border/70 text-[12px]
                           text-muted-foreground">
              <th className="whitespace-nowrap px-4 py-3 font-medium">Fecha</th>
              <th className="px-4 py-3 font-medium">Descripción</th>
              <th className="px-4 py-3 font-medium">Sale de</th>
              <th className="px-4 py-3 font-medium">Entra a</th>
              <th className="px-4 py-3 font-medium">Tipo</th>
              <th className="px-4 py-3 text-right font-medium">Monto</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/70">
            {movimientos.map((mov) => {
              const { signo, color } = presentarMovimiento(mov)
              return (
                <tr key={mov.id} className="transition hover:bg-muted/40">
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                    {formatearFecha(mov.occurred_on).replace(/ de \d{4}$/, '')}
                    <span className="ml-1.5 text-[11px]">
                      {formatearHora(mov.occurred_at)}
                    </span>
                  </td>
                  <td className="max-w-[280px] truncate px-4 py-3">
                    {mov.description || '—'}
                  </td>
                  <td className="max-w-[180px] truncate px-4 py-3 text-muted-foreground">
                    {mov.cuenta_origen}
                  </td>
                  <td className="max-w-[180px] truncate px-4 py-3 text-muted-foreground">
                    {mov.cuenta_destino}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px]">
                      {NOMBRE_TIPO[mov.type] ?? mov.type}
                    </span>
                  </td>
                  <td className={`px-4 py-3 text-right font-medium tabular-nums ${color}`}>
                    {signo}{formatearCOP(Math.abs(Number(mov.monto_total)))}
                  </td>
                </tr>
              )
            })}

            {movimientos.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                  No hay movimientos con estos filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function TarjetaResumen({
  etiqueta, valor, tono,
}: {
  etiqueta: string
  valor: string
  tono?: 'positivo' | 'negativo'
}) {
  return (
    <div className="rounded-2xl bg-card p-4 shadow-card ring-1 ring-border/70">
      <p className="text-[12px] text-muted-foreground">{etiqueta}</p>
      <p className={`mt-0.5 text-[20px] font-semibold tabular-nums ${
        tono === 'positivo' ? 'text-positivo' : tono === 'negativo' ? 'text-negativo' : ''
      }`}>
        {valor}
      </p>
    </div>
  )
}
