import Link from 'next/link'
import { ChevronRight, Users, AlertCircle } from 'lucide-react'
import { createClient, requerirUsuario } from '@/lib/supabase/server'
import {
  formatearCOP, formatearFecha, formatearHora, mesActualBogota, hoyBogota,
} from '@/lib/format'
import { NOMBRE_TIPO, presentarMovimiento, type Movimiento } from '@/lib/movimientos'
import { BarraProgreso } from '@/components/barra-progreso'
import {
  TarjetaDestacada, Reparto, TresRepartos, CuatroRepartos,
} from '@/components/tarjeta-destacada'
import { GraficaBarrasComparadas } from '@/components/grafica-barras-comparadas'

const MAX_MOVIMIENTOS = 8
const MAX_METAS = 3
const MAX_PRESTAMOS = 3

const NOMBRE_MES_ACTUAL = new Intl.DateTimeFormat('es-CO', {
  month: 'long', timeZone: 'America/Bogota',
}).format(new Date())

export default async function PanoramaPage() {
  const supabase = await createClient()
  const user = await requerirUsuario(supabase)

  const mes = mesActualBogota()
  const desde = `${mes}-01`
  const hoy = hoyBogota()
  const diaHoy = Number(hoy.slice(8, 10))

  const [
    { data: patri },
    { data: cuentas },
    { data: metas },
    { data: prestamos },
    { data: movs },
    { data: movsDelMes },
  ] = await Promise.all([
    supabase.from('patrimonio_detalle')
      .select('por_cobrar, patrimonio, deudas')
      .eq('owner_id', user.id).maybeSingle(),
    supabase.from('cuentas_disponible')
      .select('saldo, asignado, disponible').eq('owner_id', user.id),
    /* SIN owner_id a propósito: una meta conjunta pertenece a la pareja y
       las dos personas tienen que verla. El RLS ya recorta a las tuyas
       más las shared_view/joint de ella. No lo "arregles" añadiendo el
       filtro: escondería las metas compartidas. */
    supabase.from('metas_resumen')
      .select('id, name, target_amount, acumulado, progreso, visibility')
      .eq('is_archived', false)
      .order('created_at', { ascending: false })
      .limit(MAX_METAS),
    // Sin límite: el total "por cobrar" tiene que salir de TODOS los
    // préstamos activos, no solo de los que se muestran en la vista
    // previa — si no, el número deja de cuadrar con el de Patrimonio.
    supabase.from('prestamos_resumen')
      .select('id, person_name, principal, pagado, pendiente, status, cuotas_vencidas')
      .neq('status', 'cancelled')
      .order('loan_date', { ascending: false }),
    // owner_id explícito en las dos: son tus movimientos y tus cifras
    // del mes, no las de la pareja. Ver el comentario de /inicio.
    supabase.from('movimientos_detalle')
      .select('*')
      .eq('owner_id', user.id)
      .order('occurred_at', { ascending: false })
      .limit(MAX_MOVIMIENTOS),
    // Mes actual, día a día: con una sola cuenta creada hace poco, un
    // año de meses vacíos no dice nada. El detalle de varios meses vive
    // en /escritorio/estadisticas.
    supabase.from('movimientos_detalle')
      .select('occurred_on, type, monto, cuenta_origen, cuenta_destino')
      .eq('owner_id', user.id)
      .gte('occurred_on', desde).lte('occurred_on', hoy)
      .in('type', ['expense', 'income']),
  ])

  const patrimonio = Number(patri?.patrimonio ?? 0)
  const porCobrarPatrimonio = Number(patri?.por_cobrar ?? 0)
  const deudas = Number(patri?.deudas ?? 0)

  const filasCuentas = cuentas ?? []
  const disponible = filasCuentas.reduce((s, c) => s + Number(c.disponible), 0)
  const asignado = filasCuentas.reduce((s, c) => s + Number(c.asignado), 0)

  const listaMetas = metas ?? []

  const todosPrestamos = prestamos ?? []
  const activosPrestamos = todosPrestamos.filter((p) => p.status === 'active')
  const porCobrarPrestamos = activosPrestamos.reduce((s, p) => s + Number(p.pendiente), 0)
  const listaPrestamos = todosPrestamos.slice(0, MAX_PRESTAMOS)

  const movimientos = (movs ?? []) as Movimiento[]

  // Un punto por día transcurrido del mes, para que se vea justo en
  // qué días hubo movimiento — no un mes entero de barras vacías.
  //
  // Por día guardamos el total Y el desglose por categoría: la barra
  // sola solo decía "Gastos · 26", sin decir de qué — para eso hace
  // falta la categoría de cada movimiento (cuenta_destino en gastos,
  // cuenta_origen en ingresos, la misma regla que ya usa
  // presentarMovimiento en lib/movimientos.ts).
  const ingresosPorDia = new Map<number, number>()
  const gastosPorDia = new Map<number, number>()
  const categoriasIngresoPorDia = new Map<number, Map<string, number>>()
  const categoriasGastoPorDia = new Map<number, Map<string, number>>()
  for (const fila of movsDelMes ?? []) {
    const dia = Number(fila.occurred_on.slice(8, 10))
    const esIngreso = fila.type === 'income'
    const mapaTotal = esIngreso ? ingresosPorDia : gastosPorDia
    mapaTotal.set(dia, (mapaTotal.get(dia) ?? 0) + Number(fila.monto))

    const categoria = esIngreso ? fila.cuenta_origen : fila.cuenta_destino
    const mapaPorDia = esIngreso ? categoriasIngresoPorDia : categoriasGastoPorDia
    const categorias = mapaPorDia.get(dia) ?? new Map<string, number>()
    categorias.set(categoria, (categorias.get(categoria) ?? 0) + Number(fila.monto))
    mapaPorDia.set(dia, categorias)
  }
  const desglose = (mapaPorDia: Map<number, Map<string, number>>, dia: number) =>
    Array.from(mapaPorDia.get(dia)?.entries() ?? [])
      .map(([etiqueta, monto]) => ({ etiqueta, monto }))
      .sort((a, b) => b.monto - a.monto)
  const datosChart = Array.from({ length: diaHoy }, (_, i) => {
    const dia = i + 1
    return {
      etiqueta: String(dia),
      ingresos: ingresosPorDia.get(dia) ?? 0,
      gastos: gastosPorDia.get(dia) ?? 0,
      detalleIngresos: desglose(categoriasIngresoPorDia, dia),
      detalleGastos: desglose(categoriasGastoPorDia, dia),
    }
  })
  const hayDatosChart = (movsDelMes ?? []).length > 0

  const sinNada = patrimonio === 0 && filasCuentas.length === 0
    && listaMetas.length === 0 && todosPrestamos.length === 0
    && movimientos.length === 0

  return (
    <main className="mx-auto max-w-[1400px] px-8 py-10">
      <h1 className="text-[26px] font-semibold tracking-tight">Panorama</h1>
      <p className="mb-3 mt-1 text-[13px] text-muted-foreground">
        Todo de un vistazo. Entra a cualquier sección para ver el detalle.
      </p>

      {sinNada ? (
        <div className="mt-10 rounded-2xl border border-dashed border-border px-6 py-12 text-center">
          <p className="text-[15px] font-medium">Todavía no hay nada que resumir</p>
          <p className="mx-auto mt-1.5 max-w-[40ch] text-[13px] text-muted-foreground">
            Registra tu primera cuenta o movimiento desde la app del celular y
            aquí aparecerá el resumen.
          </p>
        </div>
      ) : (
        <>
          <TarjetaDestacada etiqueta="Patrimonio" valor={formatearCOP(patrimonio)}>
            {/* La cuarta columna solo aparece si debes algo. Hasta que
                se pudieron crear tarjetas de crédito, patrimonio_detalle
                .deudas existía desde 0012 sin que ninguna pantalla lo
                pintara — y una deuda baja el patrimonio sin decir por
                qué. Si no debes nada, una columna con $0 solo estorba. */}
            {deudas !== 0 ? (
              <CuatroRepartos>
                <Reparto etiqueta="Disponible" valor={formatearCOP(disponible)} />
                <Reparto etiqueta="En metas" valor={formatearCOP(asignado)} />
                <Reparto etiqueta="Por cobrar" valor={formatearCOP(porCobrarPatrimonio)} />
                <Reparto etiqueta="Debes" valor={formatearCOP(Math.abs(deudas))} />
              </CuatroRepartos>
            ) : (
              <TresRepartos>
                <Reparto etiqueta="Disponible" valor={formatearCOP(disponible)} />
                <Reparto etiqueta="Comprometido en metas" valor={formatearCOP(asignado)} />
                <Reparto etiqueta="Por cobrar" valor={formatearCOP(porCobrarPatrimonio)} />
              </TresRepartos>
            )}
          </TarjetaDestacada>

          <div className="mt-6">
            <SeccionPanorama
              titulo={`Estadísticas de ${NOMBRE_MES_ACTUAL}`}
              href="/escritorio/estadisticas"
            >
              {hayDatosChart ? (
                <GraficaBarrasComparadas datos={datosChart} alto={150} />
              ) : (
                <p className="text-[13px] text-muted-foreground">
                  Todavía no hay movimientos este mes.
                </p>
              )}
            </SeccionPanorama>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
            <SeccionPanorama titulo="Cuentas" href="/escritorio/cuentas">
              <p className="text-[12px] text-muted-foreground">Disponible</p>
              <p className="mt-0.5 text-[22px] font-semibold tabular-nums">
                {formatearCOP(disponible)}
              </p>
              {asignado > 0 && (
                <p className="mt-1 text-[12px] text-muted-foreground">
                  {formatearCOP(asignado)} reservados en metas
                </p>
              )}
            </SeccionPanorama>

            <SeccionPanorama titulo="Ahorros" href="/escritorio/ahorros">
              {listaMetas.length === 0 ? (
                <p className="text-[13px] text-muted-foreground">
                  Todavía no tienes metas de ahorro.
                </p>
              ) : (
                <>
                  <p className="text-[12px] text-muted-foreground">Comprometido</p>
                  <p className="mt-0.5 text-[22px] font-semibold tabular-nums">
                    {formatearCOP(asignado)}
                  </p>
                  <div className="mt-3 space-y-3">
                    {listaMetas.map((m) => (
                      <div key={m.id}>
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-[13px]">
                            {m.name}
                            {m.visibility === 'joint' && (
                              <Users className="ml-1.5 inline size-3 text-muted-foreground" />
                            )}
                          </p>
                          <span className="shrink-0 text-[13px] font-medium tabular-nums">
                            {m.progreso}%
                          </span>
                        </div>
                        <div className="mt-1.5">
                          <BarraProgreso progreso={Number(m.progreso)} />
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </SeccionPanorama>

            <SeccionPanorama titulo="Préstamos" href="/escritorio/prestamos">
              {todosPrestamos.length === 0 ? (
                <p className="text-[13px] text-muted-foreground">
                  No has registrado préstamos.
                </p>
              ) : (
                <>
                  <p className="text-[12px] text-muted-foreground">Por cobrar</p>
                  <p className="mt-0.5 text-[22px] font-semibold tabular-nums">
                    {formatearCOP(porCobrarPrestamos)}
                  </p>
                  <div className="mt-3 space-y-2">
                    {listaPrestamos.map((p) => (
                      <div key={p.id} className="flex items-center justify-between gap-2 text-[13px]">
                        <span className="truncate">{p.person_name}</span>
                        {p.status === 'paid' ? (
                          <span className="shrink-0 text-positivo">Pagado</span>
                        ) : (
                          <span className="flex shrink-0 items-center gap-1 tabular-nums">
                            {Number(p.cuotas_vencidas) > 0 && (
                              <AlertCircle className="size-3.5 text-destructive" />
                            )}
                            {formatearCOP(Number(p.pendiente))}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </SeccionPanorama>
          </div>

          <div className="mt-6">
            <SeccionPanorama titulo="Movimientos recientes" href="/escritorio/movimientos">
              {movimientos.length === 0 ? (
                <p className="text-[13px] text-muted-foreground">
                  Todavía no hay movimientos.
                </p>
              ) : (
                <div className="divide-y divide-border/70">
                  {movimientos.map((mov) => {
                    const { signo, color, contexto } = presentarMovimiento(mov)
                    return (
                      <div key={mov.id}
                           className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-3
                                      transition hover:bg-muted/40">
                        <div className="w-28 shrink-0 text-[12px] text-muted-foreground">
                          {formatearFecha(mov.occurred_on).replace(/ de \d{4}$/, '')}
                          <span className="ml-1">{formatearHora(mov.occurred_at)}</span>
                        </div>
                        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5
                                         text-[11px] text-muted-foreground">
                          {NOMBRE_TIPO[mov.type] ?? mov.type}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-medium">
                            {mov.description || NOMBRE_TIPO[mov.type] || mov.type}
                          </p>
                          <p className="truncate text-[12px] text-muted-foreground">
                            {contexto}
                          </p>
                        </div>
                        <div className={`shrink-0 text-[13px] font-medium tabular-nums ${color}`}>
                          {signo}{formatearCOP(Math.abs(Number(mov.monto_total)))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </SeccionPanorama>
          </div>
        </>
      )}
    </main>
  )
}

function SeccionPanorama({
  titulo, href, className = '', children,
}: {
  titulo: string
  href: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <section className={`rounded-2xl bg-card p-6 shadow-card ring-1 ring-border/70 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-semibold">{titulo}</h2>
        <Link href={href}
              className="flex items-center gap-0.5 text-[12px] font-medium
                         text-primary transition hover:opacity-80">
          Ver detalle <ChevronRight className="size-3.5" />
        </Link>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  )
}
