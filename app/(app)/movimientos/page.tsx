import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { createClient, requerirUsuario } from '@/lib/supabase/server'
import { formatearCOP, formatearFecha, mesActualBogota } from '@/lib/format'
import { FilaMovimiento, type Movimiento } from '@/components/fila-movimiento'
import { Seccion, Lista, Monto } from '@/components/seccion'
import { SelectorMes } from '@/components/selector-mes'
import { BuscadorMovimientos } from '@/components/buscador-movimientos'

const FILTROS = [
  { valor: '',           etiqueta: 'Todos' },
  { valor: 'expense',    etiqueta: 'Gastos' },
  { valor: 'income',     etiqueta: 'Ingresos' },
  { valor: 'transfer',   etiqueta: 'Traslados' },
  { valor: 'adjustment', etiqueta: 'Ajustes' },
]

export default async function MovimientosPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string; mes?: string; q?: string; cuenta?: string }>
}) {
  const { tipo = '', mes = mesActualBogota(), q = '', cuenta = '' } = await searchParams
  const supabase = await createClient()
  const user = await requerirUsuario(supabase)

  const busqueda = q.trim().slice(0, 60)

  /* Entrar a una cuenta o a una categoría.

     Es lo mismo para las dos: en este modelo una categoría ES una
     cuenta, de clase expense o income. Un solo parámetro y un solo
     filtro, en vez de dos caminos que hacen lo mismo.

     Como la búsqueda, ignora el mes: entrar a "Alimentación" para
     ver solo lo de este mes deja fuera la pregunta que se viene a
     hacer, que es en qué se ha ido el dinero. */
  /* Tiene que ser un uuid. Va dentro de un filtro `or`, que se arma
     como texto: un valor con comas o puntos partiría la expresión, el
     mismo agujero que se cierra a mano en la búsqueda. Aquí la forma
     del dato lo cierra solo — y si no es un uuid, no puede ser el id de
     ninguna cuenta, así que no hay nada que enseñar. */
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const enCuenta = UUID.test(cuenta.trim()) ? cuenta.trim() : ''
  const filtrando = enCuenta.length > 0
  const buscando = busqueda.length > 0

  const desde = `${mes}-01`
  const [anio, m] = mes.split('-').map(Number)
  const hasta = new Date(Date.UTC(anio, m, 0)).toISOString().slice(0, 10)

  let consulta = supabase
    .from('movimientos_detalle')
    // monto_total es el dinero que se movió; monto es lo que de verdad
    // gastaste. Solo difieren en un gasto compartido, donde parte del
    // pago no es tuyo sino algo que te deben.
    .select('id, type, description, occurred_at, occurred_on, monto, monto_total, cuenta_origen, cuenta_destino, clase_origen, clase_destino')
    // Tu historial, no el de la pareja. Un gasto compartido escribe dos
    // transacciones espejo, una en cada ledger: aquí tiene que salir la
    // tuya y solo la tuya, o el mismo gasto aparecería dos veces.
    .eq('owner_id', user.id)
    .order('occurred_at', { ascending: false })

  if (buscando) {
    /* Buscar ignora el mes: si no recuerdas cuándo fue, tampoco vas a
       acertar el mes, y filtrar por los dos deja fuera justo lo que
       buscas.

       EL TEXTO VA ENTRE COMILLAS. El filtro `or` de PostgREST separa
       condiciones por comas, así que buscar "pan, leche" partiría la
       expresión por la mitad y el resto se interpretaría como otra
       condición. Entrecomillar lo evita; las comillas y las barras del
       propio texto se quitan antes, porque son lo único que puede
       cerrar la comilla desde dentro.

       Se busca también en las cuentas: "Nu" o "Alimentación" son tan
       válidos como el nombre del comercio. */
    const limpio = busqueda.replace(/["\\]/g, '')
    const patron = `"%${limpio}%"`
    consulta = consulta.or(
      `description.ilike.${patron},` +
      `cuenta_origen.ilike.${patron},` +
      `cuenta_destino.ilike.${patron}`
    )
    // Un tope: el historial crece solo y nadie mira 500 resultados.
    consulta = consulta.limit(200)
  } else if (filtrando) {
    // En cualquiera de los dos lados: un traslado a esa cuenta
    // cuenta tanto como uno desde ella.
    consulta = consulta.or(
      `cuenta_origen_id.eq.${enCuenta},cuenta_destino_id.eq.${enCuenta}`
    ).limit(200)
  } else {
    consulta = consulta.gte('occurred_on', desde).lte('occurred_on', hasta)
  }

  if (tipo) consulta = consulta.eq('type', tipo)

  /* Cómo se llama la cuenta en la que entramos. Sin esto la pantalla
     diría "Movimientos" a secas y no habría forma de saber qué se
     está mirando ni cómo salir. */
  const { data: laCuenta } = filtrando
    ? await supabase.from('accounts').select('name, class')
        .eq('id', enCuenta).eq('owner_id', user.id).maybeSingle()
    : { data: null }

  const { data } = await consulta
  const movimientos = (data ?? []) as Movimiento[]

  /* Cuánto suma lo encontrado. Es la respuesta a "¿cuánto llevo gastado
     en el Éxito?", que es para lo que uno busca — la lista sola obliga
     a sumar de cabeza. Se usa `monto` y no `monto_total`: lo que se
     gastó, no lo que se movió. */
  const sumaBusqueda = (buscando || filtrando)
    ? movimientos.reduce((s, x) => {
        if (x.type === 'expense') return s - Number(x.monto)
        if (x.type === 'income') return s + Number(x.monto)
        return s
      }, 0)
    : 0

  const porDia = new Map<string, typeof movimientos>()
  for (const mov of movimientos) {
    const lista = porDia.get(mov.occurred_on) ?? []
    lista.push(mov)
    porDia.set(mov.occurred_on, lista)
  }

  return (
    <main className="px-4 pt-4 pb-[calc(8rem+env(safe-area-inset-bottom))]">
      {/* Dentro de una cuenta o categoría, la cabecera es su nombre y
          hay una salida visible. Un filtro del que no se ve cómo salir
          se siente como que la app se rompió. */}
      {filtrando ? (
        <div className="aparece px-1">
          <Link href="/movimientos"
                className="-my-2.5 -ml-1 inline-flex items-center gap-1 px-2
                           py-2.5 text-[13px] text-muted-foreground">
            <ChevronLeft className="size-4" /> Movimientos
          </Link>
          <h1 className="mt-1 text-[22px] font-semibold tracking-tight">
            {laCuenta?.name ?? 'Esta cuenta'}
          </h1>
        </div>
      ) : (
        <>
          <div className="aparece flex items-center justify-between gap-3 px-1">
            <h1 className="text-[22px] font-semibold tracking-tight">
              Movimientos
            </h1>
            {/* El selector de mes se va mientras hay búsqueda: seguiría
                ahí sin aplicarse, que es peor que no estar. */}
            {!buscando && <SelectorMes mes={mes} tipo={tipo} />}
          </div>

          <div className="aparece mt-3"
               style={{ '--retraso': '40ms' } as React.CSSProperties}>
            <BuscadorMovimientos valor={busqueda} tipo={tipo} />
          </div>
        </>
      )}

      {/* Lo encontrado, sumado. La lista sola obliga a sumar de cabeza,
          y "cuánto llevo gastado en esto" es justo para lo que se
          busca. */}
      {(buscando || filtrando) && movimientos.length > 0 && (
        <div className="aparece mt-3 flex items-baseline justify-between gap-3
                        rounded-xl bg-muted px-3.5 py-2.5"
             style={{ '--retraso': '60ms' } as React.CSSProperties}>
          <p className="text-[12px] text-muted-foreground">
            {movimientos.length}{' '}
            {movimientos.length === 1 ? 'movimiento' : 'movimientos'}
            {movimientos.length === 200 && ' (los más recientes)'}
          </p>
          <Monto
            valor={sumaBusqueda}
            tono="auto"
            formato={formatearCOP}
            className="text-[15px] font-semibold"
          />
        </div>
      )}

      {/* Filtros: chips que caben en una sola línea deslizable */}
      <div className="aparece -mx-4 mt-3 flex gap-1.5 overflow-x-auto px-4 pb-1"
           style={{ '--retraso': '60ms' } as React.CSSProperties}>
        {FILTROS.map((f) => (
          <Link
            key={f.valor}
            href={
              filtrando
                ? `/movimientos?cuenta=${enCuenta}${f.valor ? `&tipo=${f.valor}` : ''}`
                : buscando
                  ? `/movimientos?q=${encodeURIComponent(busqueda)}${f.valor ? `&tipo=${f.valor}` : ''}`
                  : `/movimientos?mes=${mes}${f.valor ? `&tipo=${f.valor}` : ''}`
            }
            className={`flex h-11 shrink-0 items-center rounded-full px-4
                        text-[13px] font-medium transition ${
              tipo === f.valor
                ? 'bg-primary text-primary-foreground shadow-card'
                : 'bg-card text-muted-foreground ring-1 ring-border/70'
            }`}
          >
            {f.etiqueta}
          </Link>
        ))}
      </div>

      {movimientos.length === 0 ? (
        <div className="aparece mt-8 rounded-2xl border border-dashed
                        border-border px-5 py-7 text-center"
             style={{ '--retraso': '120ms' } as React.CSSProperties}>
          <p className="text-[15px] font-medium">
            {filtrando
              ? 'Sin movimientos todavía'
              : buscando
                ? `Nada que diga «${busqueda}»`
                : 'No hay movimientos en este periodo'}
          </p>
          <p className="mx-auto mt-1.5 max-w-[28ch] text-[13px] leading-snug
                        text-muted-foreground">
            {filtrando
              ? 'Aquí saldrá todo lo que entre o salga de esta cuenta.'
              : buscando
                ? 'Se buscó en la descripción y en los nombres de las cuentas, en todos los meses.'
                : 'Prueba con otro mes o registra el primero.'}
          </p>
          <Link href="/movimientos/nuevo"
                className="mt-4 inline-flex min-h-11 items-center rounded-xl
                           bg-primary px-5 text-[14px] font-medium
                           text-primary-foreground shadow-card">
            Registrar uno
          </Link>
        </div>
      ) : (
        [...porDia.entries()].map(([dia, lista], i) => (
          <Seccion key={dia} titulo={formatearFecha(dia)}>
            <div className="aparece"
                 style={{ '--retraso': `${120 + i * 60}ms` } as React.CSSProperties}>
              <Lista>
                {lista.map((mov) => (
                  <FilaMovimiento key={mov.id} mov={mov} />
                ))}
              </Lista>
            </div>
          </Seccion>
        ))
      )}
    </main>
  )
}