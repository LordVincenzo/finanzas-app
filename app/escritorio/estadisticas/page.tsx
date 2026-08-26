import { createClient } from '@/lib/supabase/server'
import { mesActualBogota, restarMeses } from '@/lib/format'
import { GraficaBarrasComparadas } from '@/components/grafica-barras-comparadas'
import { GraficaPatrimonio } from '@/components/grafica-patrimonio'
import { GraficaCategoriasMensual } from '@/components/grafica-categorias-mensual'

const MAX_CATEGORIAS = 5

export default async function EstadisticasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const mesActual = mesActualBogota()
  const meses = Array.from({ length: 12 }, (_, i) => restarMeses(mesActual, 11 - i))
  const desde = meses[0]

  const [{ data: movs }, { data: cats }, { data: patri }] = await Promise.all([
    supabase.from('movimientos_mensuales')
      .select('mes, type, monto')
      .eq('owner_id', user!.id).gte('mes', desde),
    supabase.from('categorias_mensuales')
      .select('mes, categoria, monto')
      .eq('owner_id', user!.id).gte('mes', desde),
    supabase.from('patrimonio_mensual')
      .select('mes, patrimonio')
      .eq('owner_id', user!.id).gte('mes', desde),
  ])

  // Ingresos y gastos: un mapa por mes, en 0 si ese mes no tuvo filas.
  const ingresosPorMes = new Map(meses.map((m) => [m, 0]))
  const gastosPorMes = new Map(meses.map((m) => [m, 0]))
  for (const fila of movs ?? []) {
    const mapa = fila.type === 'income' ? ingresosPorMes : gastosPorMes
    mapa.set(fila.mes, Number(fila.monto))
  }
  const datosIngresosGastos = meses.map((mes) => ({
    mes,
    ingresos: ingresosPorMes.get(mes) ?? 0,
    gastos: gastosPorMes.get(mes) ?? 0,
  }))

  // Patrimonio: ya viene un valor por mes desde la vista.
  const patrimonioPorMes = new Map((patri ?? []).map((f) => [f.mes, Number(f.patrimonio)]))
  const datosPatrimonio = meses.map((mes) => ({
    mes, patrimonio: patrimonioPorMes.get(mes) ?? 0,
  }))

  // Categorías: las 5 con más gasto en TODO el año se quedan con su
  // propio color; el resto se agrupa en "Otras". El orden se decide
  // una sola vez con el total del año, no mes a mes — si no, el mismo
  // color saltaría de categoría en categoría según quién gastó más ese
  // mes en particular.
  const totalPorCategoria = new Map<string, number>()
  for (const fila of cats ?? []) {
    totalPorCategoria.set(
      fila.categoria, (totalPorCategoria.get(fila.categoria) ?? 0) + Number(fila.monto),
    )
  }
  const top = [...totalPorCategoria.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_CATEGORIAS)
    .map(([nombre]) => nombre)
  const hayOtras = totalPorCategoria.size > top.length
  const nombresCategorias = hayOtras ? [...top, 'Otras'] : top

  const porMesYCategoria = new Map<string, Map<string, number>>()
  for (const fila of cats ?? []) {
    const nombre = top.includes(fila.categoria) ? fila.categoria : 'Otras'
    const deEsteMes = porMesYCategoria.get(fila.mes) ?? new Map<string, number>()
    deEsteMes.set(nombre, (deEsteMes.get(nombre) ?? 0) + Number(fila.monto))
    porMesYCategoria.set(fila.mes, deEsteMes)
  }
  const datosCategorias = meses.map((mes) => ({
    mes,
    categorias: nombresCategorias.map((nombre) => ({
      nombre, monto: porMesYCategoria.get(mes)?.get(nombre) ?? 0,
    })),
  }))

  const sinDatos = (movs ?? []).length === 0 && (cats ?? []).length === 0

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight">Estadísticas</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Últimos 12 meses. Esta pantalla no está pensada para el
            celular — se ve mejor en una ventana ancha.
          </p>
        </div>
      </div>

      {sinDatos ? (
        <div className="mt-10 rounded-2xl border border-dashed border-border px-6 py-12 text-center">
          <p className="text-[15px] font-medium">Todavía no hay suficientes movimientos</p>
          <p className="mx-auto mt-1.5 max-w-[40ch] text-[13px] text-muted-foreground">
            Cuando registres ingresos y gastos, aquí aparecerán las tendencias
            de los últimos 12 meses.
          </p>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <section className="rounded-2xl bg-card p-6 shadow-card ring-1 ring-border/70">
            <h2 className="text-[15px] font-semibold">Ingresos y gastos</h2>
            <div className="mt-4">
              <GraficaBarrasComparadas datos={datosIngresosGastos} />
            </div>
          </section>

          <section className="rounded-2xl bg-card p-6 shadow-card ring-1 ring-border/70">
            <h2 className="text-[15px] font-semibold">Evolución del patrimonio</h2>
            <div className="mt-4">
              <GraficaPatrimonio datos={datosPatrimonio} />
            </div>
          </section>

          <section className="rounded-2xl bg-card p-6 shadow-card ring-1 ring-border/70
                              lg:col-span-2">
            <h2 className="text-[15px] font-semibold">En qué gastaste, mes a mes</h2>
            {nombresCategorias.length === 0 ? (
              <p className="mt-4 text-[13px] text-muted-foreground">
                Todavía no hay gastos por categoría para comparar.
              </p>
            ) : (
              <div className="mt-4">
                <GraficaCategoriasMensual
                  datos={datosCategorias}
                  nombresCategorias={nombresCategorias}
                />
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  )
}
