import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { formatearCOP } from '@/lib/format'
import { ResumenCategorias, type GastoCategoria } from '@/components/resumen-categorias'

function mesActual(): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Bogota', year: 'numeric', month: '2-digit',
  }).format(new Date()).slice(0, 7)
}

export default async function InicioPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const mes = mesActual()
  const desde = `${mes}-01`
  const [anio, m] = mes.split('-').map(Number)
  const hasta = new Date(Date.UTC(anio, m, 0)).toISOString().slice(0, 10)

  const [{ data: perfil }, { data: patrimonio }, { data: delMes }] =
    await Promise.all([
      supabase.from('profiles').select('display_name').eq('id', user!.id).single(),
      supabase.from('net_worth').select('net_worth').eq('owner_id', user!.id).maybeSingle(),
      supabase.from('movimientos_detalle')
        .select('type, monto, cuenta_origen, cuenta_destino')
        .gte('occurred_on', desde).lte('occurred_on', hasta)
        .in('type', ['expense', 'income']),
    ])

  const total = Number(patrimonio?.net_worth ?? 0)
  const movs = delMes ?? []

  const gastos = movs
    .filter((x) => x.type === 'expense')
    .reduce((s, x) => s + Number(x.monto), 0)
  const ingresos = movs
    .filter((x) => x.type === 'income')
    .reduce((s, x) => s + Number(x.monto), 0)

  // Agrupamos los gastos por categoría de destino.
  // En un gasto, cuenta_destino ES la categoría (Alimentación, etc.).
  const acumulado = new Map<string, number>()
  for (const mov of movs) {
    if (mov.type !== 'expense') continue
    const categoria = mov.cuenta_destino
    acumulado.set(categoria, (acumulado.get(categoria) ?? 0) + Number(mov.monto))
  }

  const categorias: GastoCategoria[] = [...acumulado.entries()]
    .map(([nombre, total]) => ({ nombre, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)   // solo las 5 principales: el dashboard no se satura

  const nombreMes = new Intl.DateTimeFormat('es-CO', {
    month: 'long', timeZone: 'America/Bogota',
  }).format(new Date())

  return (
    <main className="px-5 pt-8">
      <p className="text-sm text-muted-foreground">Hola,</p>
      <h1 className="text-2xl font-semibold">{perfil?.display_name}</h1>

      <section className="mt-8 rounded-2xl border p-5">
        <p className="text-sm text-muted-foreground">Tu patrimonio</p>
        <p className="mt-1 text-3xl font-semibold tabular-nums">
          {formatearCOP(total)}
        </p>
      </section>

      <section className="mt-4 rounded-2xl border p-5">
        <p className="text-sm font-medium capitalize">{nombreMes}</p>
        <dl className="mt-3 space-y-2.5">
          <Linea etiqueta="Ingresos" valor={ingresos} color="text-emerald-600" />
          <Linea etiqueta="Gastos" valor={gastos} />
          <div className="border-t pt-2.5">
            <Linea etiqueta="Ahorro" valor={ingresos - gastos} destacado />
          </div>
        </dl>
      </section>

      <ResumenCategorias categorias={categorias} totalGastos={gastos} />

      <Link
        href="/movimientos"
        className="mt-4 block text-center text-xs text-muted-foreground underline"
      >
        Ver todos los movimientos
      </Link>
    </main>
  )
}

function Linea({
  etiqueta, valor, color, destacado,
}: {
  etiqueta: string
  valor: number
  color?: string
  destacado?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className={`text-sm ${destacado ? 'font-medium' : 'text-muted-foreground'}`}>
        {etiqueta}
      </dt>
      <dd className={`text-sm tabular-nums ${destacado ? 'font-semibold' : ''} ${color ?? ''}`}>
        {formatearCOP(valor)}
      </dd>
    </div>
  )
}