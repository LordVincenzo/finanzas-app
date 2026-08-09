import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { formatearCOP } from '@/lib/format'
import { Seccion, Lista, Fila, Tarjeta } from '@/components/seccion'

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

  const [{ data: perfil }, { data: detalle }, { data: delMes }] =
    await Promise.all([
      supabase.from('profiles')
        .select('display_name').eq('id', user!.id).single(),
      supabase.from('patrimonio_detalle')
        .select('liquido, ahorros, inversiones, por_cobrar, deudas, patrimonio')
        .eq('owner_id', user!.id).maybeSingle(),
      supabase.from('movimientos_detalle')
        .select('type, monto, cuenta_destino')
        .gte('occurred_on', desde).lte('occurred_on', hasta)
        .in('type', ['expense', 'income']),
    ])

  const total = Number(detalle?.patrimonio ?? 0)
  const disponible =
    Number(detalle?.liquido ?? 0) +
    Number(detalle?.ahorros ?? 0) +
    Number(detalle?.inversiones ?? 0)
  const porCobrar = Number(detalle?.por_cobrar ?? 0)

  const movs = delMes ?? []
  const gastos = movs.filter((x) => x.type === 'expense')
    .reduce((s, x) => s + Number(x.monto), 0)
  const ingresos = movs.filter((x) => x.type === 'income')
    .reduce((s, x) => s + Number(x.monto), 0)

  const acumulado = new Map<string, number>()
  for (const mov of movs) {
    if (mov.type !== 'expense') continue
    acumulado.set(mov.cuenta_destino,
      (acumulado.get(mov.cuenta_destino) ?? 0) + Number(mov.monto))
  }
  const categorias = [...acumulado.entries()]
    .map(([nombre, valor]) => ({ nombre, valor }))
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 4)

  const nombreMes = new Intl.DateTimeFormat('es-CO', {
    month: 'long', timeZone: 'America/Bogota',
  }).format(new Date())

  return (
    <main className="px-4 pt-6">
      <header>
        <p className="text-[14px] text-muted-foreground">
          Hola, {perfil?.display_name}
        </p>
        <p className="mt-3 text-[12px] uppercase tracking-wider text-muted-foreground">
          Patrimonio
        </p>
        <p className="mt-0.5 text-[38px] font-semibold leading-none tracking-tight
                      tabular-nums">
          {formatearCOP(total)}
        </p>

        {/* El patrimonio no es lo que puedes gastar: hay que separarlo. */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-xl border p-3">
            <p className="text-[12px] text-muted-foreground">Disponible</p>
            <p className="mt-0.5 text-[17px] font-medium tabular-nums">
              {formatearCOP(disponible)}
            </p>
          </div>
          <div className="rounded-xl border p-3">
            <p className="text-[12px] text-muted-foreground">Por cobrar</p>
            <p className="mt-0.5 text-[17px] font-medium tabular-nums">
              {formatearCOP(porCobrar)}
            </p>
          </div>
        </div>
      </header>

      <Seccion titulo={nombreMes}>
        <Tarjeta>
          <div className="grid grid-cols-3 gap-2 text-center">
            <Dato etiqueta="Ingresos" valor={ingresos} color="text-positivo" />
            <Dato etiqueta="Gastos" valor={gastos} />
            <Dato etiqueta="Ahorro" valor={ingresos - gastos} destacado />
          </div>
        </Tarjeta>
      </Seccion>

      {categorias.length > 0 && (
        <Seccion
          titulo="En qué gastaste"
          accion={
            <Link href="/movimientos"
                  className="text-[12px] text-muted-foreground underline">
              Ver todo
            </Link>
          }
        >
          <Lista>
            {categorias.map((c) => (
              <Fila
                key={c.nombre}
                titulo={c.nombre}
                detalle={`${Math.round((c.valor / gastos) * 100)}% del mes`}
                valor={formatearCOP(c.valor)}
              />
            ))}
          </Lista>
        </Seccion>
      )}

      <Seccion titulo="Ir a">
        <div className="grid grid-cols-3 gap-2">
          <Atajo href="/cuentas" etiqueta="Cuentas" />
          <Atajo href="/prestamos" etiqueta="Préstamos" />
          <Atajo href="/pareja" etiqueta="Pareja" />
        </div>
      </Seccion>
    </main>
  )
}

function Dato({
  etiqueta, valor, color, destacado,
}: {
  etiqueta: string
  valor: number
  color?: string
  destacado?: boolean
}) {
  return (
    <div>
      <p className="text-[12px] text-muted-foreground">{etiqueta}</p>
      <p className={`mt-0.5 text-[14px] leading-tight tabular-nums
                     ${destacado ? 'font-semibold' : ''} ${color ?? ''}`}>
        {formatearCOP(valor)}
      </p>
    </div>
  )
}

function Atajo({ href, etiqueta }: { href: string; etiqueta: string }) {
  return (
    <Link href={href}
          className="rounded-xl border px-3 py-3 text-center text-[13px]">
      {etiqueta}
    </Link>
  )
}