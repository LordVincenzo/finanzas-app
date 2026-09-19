import Link from 'next/link'
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
  searchParams: Promise<{ tipo?: string; mes?: string; q?: string }>
}) {
  const { tipo = '', mes = mesActualBogota(), q = '' } = await searchParams
  const supabase = await createClient()
  const user = await requerirUsuario(supabase)

  const busqueda = q.trim().slice(0, 60)
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
  } else {
    consulta = consulta.gte('occurred_on', desde).lte('occurred_on', hasta)
  }

  if (tipo) consulta = consulta.eq('type', tipo)

  const { data } = await consulta
  const movimientos = (data ?? []) as Movimiento[]

  /* Cuánto suma lo encontrado. Es la respuesta a "¿cuánto llevo gastado
     en el Éxito?", que es para lo que uno busca — la lista sola obliga
     a sumar de cabeza. Se usa `monto` y no `monto_total`: lo que se
     gastó, no lo que se movió. */
  const sumaBusqueda = buscando
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
      <div className="aparece flex items-center justify-between gap-3 px-1">
        <h1 className="text-[22px] font-semibold tracking-tight">Movimientos</h1>
        {/* El selector de mes se va mientras hay búsqueda: seguiría ahí
            sin aplicarse, que es peor que no estar. */}
        {!buscando && <SelectorMes mes={mes} tipo={tipo} />}
      </div>

      <div className="aparece mt-3"
           style={{ '--retraso': '40ms' } as React.CSSProperties}>
        <BuscadorMovimientos valor={busqueda} tipo={tipo} />
      </div>

      {/* Lo encontrado, sumado. La lista sola obliga a sumar de cabeza,
          y "cuánto llevo gastado en esto" es justo para lo que se
          busca. */}
      {buscando && movimientos.length > 0 && (
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
            href={buscando
              ? `/movimientos?q=${encodeURIComponent(busqueda)}${f.valor ? `&tipo=${f.valor}` : ''}`
              : `/movimientos?mes=${mes}${f.valor ? `&tipo=${f.valor}` : ''}`}
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
            {buscando
              ? `Nada que diga «${busqueda}»`
              : 'No hay movimientos en este periodo'}
          </p>
          <p className="mx-auto mt-1.5 max-w-[28ch] text-[13px] leading-snug
                        text-muted-foreground">
            {buscando
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