import { createClient } from '@/lib/supabase/server'
import { formatearCOP, formatearFecha, formatearHora, mesActualBogota } from '@/lib/format'
import { NOMBRE_TIPO, presentarMovimiento, type Movimiento } from '@/lib/movimientos'
import { FiltrosMovimientosEscritorio } from '@/components/filtros-movimientos-escritorio'

export default async function MovimientosEscritorioPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string; mes?: string; cuenta?: string; categoria?: string }>
}) {
  const {
    tipo = '', mes = mesActualBogota(), cuenta = '', categoria = '',
  } = await searchParams
  const supabase = await createClient()

  const desde = `${mes}-01`
  const [anio, m] = mes.split('-').map(Number)
  const hasta = new Date(Date.UTC(anio, m, 0)).toISOString().slice(0, 10)

  let consulta = supabase
    .from('movimientos_detalle')
    .select('*')
    .gte('occurred_on', desde).lte('occurred_on', hasta)
    .order('occurred_at', { ascending: false })

  if (tipo) consulta = consulta.eq('type', tipo)
  if (cuenta) consulta = consulta.or(`cuenta_origen_id.eq.${cuenta},cuenta_destino_id.eq.${cuenta}`)
  // Filtro separado del de cuenta: una categoría es una cuenta de clase
  // expense/income (ver CLAUDE.md), no una cuenta de dinero. Al ser dos
  // .or() distintos, Supabase los combina con AND — puedes pedir
  // "Nu" + "Alimentación" a la vez.
  if (categoria) {
    consulta = consulta.or(`cuenta_origen_id.eq.${categoria},cuenta_destino_id.eq.${categoria}`)
  }

  const [{ data: cuentas }, { data: categorias }, { data: movsData }] = await Promise.all([
    supabase.from('accounts')
      .select('id, name')
      .eq('is_active', true).eq('is_opening', false)
      .in('class', ['asset', 'liability'])
      .order('name'),
    supabase.from('accounts')
      .select('id, name')
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
      <h1 className="text-[26px] font-semibold tracking-tight">Movimientos</h1>
      <p className="mt-1 text-[13px] text-muted-foreground">
        Mes, tipo, cuenta y categoría a la vez — en el celular ves un filtro a la vez.
      </p>

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
