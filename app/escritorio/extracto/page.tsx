import { Download } from 'lucide-react'
import { createClient, requerirUsuario } from '@/lib/supabase/server'
import {
  formatearCOP, formatearFecha, formatearHora, mesActualBogota, moverMes,
  nombreDelMes,
} from '@/lib/format'
import { SelectorMesExtracto } from '@/components/selector-mes-extracto'
import { BotonImprimir } from '@/components/boton-imprimir'

/**
 * El extracto de un mes, en escritorio.
 *
 * Mismo contenido que en el celular con otra forma: aquí los
 * movimientos caben en una tabla con columnas, que es como se lee un
 * extracto bancario y como se imprime bien en una hoja A4.
 *
 * La impresión sale de aquí mejor que del teléfono, y es de lo poco que
 * de verdad se hace mejor sentado. Por eso el enlace de "Descargar
 * todo" también vive aquí.
 */
export default async function ExtractoEscritorioPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>
}) {
  const { mes: mesPedido } = await searchParams
  const supabase = await createClient()
  const user = await requerirUsuario(supabase)

  const mes = /^\d{4}-\d{2}$/.test(mesPedido ?? '')
    ? mesPedido!
    : moverMes(mesActualBogota(), -1)

  const desde = `${mes}-01`
  const [anio, m] = mes.split('-').map(Number)
  const hasta = new Date(Date.UTC(anio, m, 0)).toISOString().slice(0, 10)

  const [{ data: perfil }, { data: movs }, { data: categorias }] =
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
    ])

  const movimientos = movs ?? []
  const ingresos = movimientos
    .filter((x) => x.type === 'income')
    .reduce((s, x) => s + Number(x.monto), 0)
  const gastos = movimientos
    .filter((x) => x.type === 'expense')
    .reduce((s, x) => s + Number(x.monto), 0)

  return (
    <div>
      <header className="flex items-end justify-between gap-6">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight">Extracto</h1>
          <p className="mt-1 text-[14px] text-muted-foreground">
            {nombreDelMes(mes)} · {perfil?.display_name}
          </p>
        </div>

        <div className="solo-pantalla flex items-center gap-3">
          <SelectorMesExtracto mes={mes} />
        </div>
      </header>

      {movimientos.length === 0 ? (
        <p className="mt-10 text-[14px] text-muted-foreground">
          No hubo movimientos en {nombreDelMes(mes).toLowerCase()}.
        </p>
      ) : (
        <>
          <section className="mt-6 grid grid-cols-3 gap-4">
            <Cifra etiqueta="Entró" valor={ingresos} tono="positivo" />
            <Cifra etiqueta="Salió" valor={gastos} tono="negativo" />
            <Cifra etiqueta="Diferencia" valor={ingresos - gastos}
                   tono={ingresos - gastos < 0 ? 'negativo' : 'positivo'} />
          </section>

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_2fr]">
            {(categorias ?? []).length > 0 && (
              <section>
                <h2 className="text-[11px] font-semibold uppercase
                               tracking-[0.09em] text-muted-foreground">
                  En qué se fue
                </h2>
                <dl className="mt-2 divide-y divide-border/70 rounded-2xl
                               bg-card px-5 shadow-card ring-1 ring-border/70
                               print:shadow-none print:ring-0">
                  {(categorias ?? []).map((c) => (
                    <div key={c.categoria as string}
                         className="flex items-baseline justify-between gap-3 py-3">
                      <dt className="min-w-0 truncate text-[14px]">
                        {c.categoria as string}
                      </dt>
                      <dd className="shrink-0 text-[14px] font-medium tabular-nums">
                        {formatearCOP(Number(c.monto))}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}

            <section>
              <h2 className="text-[11px] font-semibold uppercase
                             tracking-[0.09em] text-muted-foreground">
                Movimientos ({movimientos.length})
              </h2>
              {/* Tabla de verdad: en una hoja A4 y en un monitor hay
                  ancho para columnas, y un extracto se lee así. */}
              <div className="mt-2 overflow-hidden rounded-2xl bg-card
                              shadow-card ring-1 ring-border/70
                              print:shadow-none print:ring-0">
                <table className="w-full text-[13px]">
                  <thead className="text-left text-muted-foreground">
                    <tr className="border-b border-border/70">
                      <th className="px-4 py-2.5 font-normal">Fecha</th>
                      <th className="px-4 py-2.5 font-normal">Descripción</th>
                      <th className="px-4 py-2.5 font-normal">Movimiento</th>
                      <th className="px-4 py-2.5 text-right font-normal">Monto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/70">
                    {movimientos.map((x) => {
                      const signo =
                        x.type === 'expense' ? -1 : x.type === 'income' ? 1 : 0
                      return (
                        <tr key={x.id as string}>
                          <td className="whitespace-nowrap px-4 py-2.5
                                         text-muted-foreground tabular-nums">
                            {formatearFecha(x.occurred_on as string)
                              .replace(/ de \d{4}$/, '')}
                            <span className="ml-1.5 text-[11px]">
                              {formatearHora(x.occurred_at as string)}
                            </span>
                          </td>
                          <td className="px-4 py-2.5">{x.description as string}</td>
                          <td className="px-4 py-2.5 text-muted-foreground">
                            {x.cuenta_origen as string} → {x.cuenta_destino as string}
                          </td>
                          <td className={`whitespace-nowrap px-4 py-2.5 text-right
                                          font-medium tabular-nums ${
                            signo < 0 ? 'text-negativo'
                              : signo > 0 ? 'text-positivo' : ''
                          }`}>
                            {signo === 0 ? '' : signo > 0 ? '+' : '−'}
                            {formatearCOP(Number(x.monto))}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </>
      )}

      <section className="solo-pantalla mt-8 max-w-md rounded-2xl bg-card p-5
                          shadow-card ring-1 ring-border/70">
        <p className="text-[15px] font-medium">Guardar o descargar</p>

        <BotonImprimir />

        <a
          href="/api/exportar"
          className="mt-2 flex min-h-11 w-full items-center justify-center gap-2
                     rounded-xl border text-[14px] font-medium transition
                     hover:bg-muted/60"
        >
          <Download className="size-4" />
          Descargar todo el historial
        </a>
        <p className="mt-2 text-[12px] leading-snug text-muted-foreground">
          El extracto es un mes; la descarga es <strong>todo</strong>, desde el
          principio, en un archivo que abre Excel. Es lo que te salva si algún
          día esta app deja de estar.
        </p>
      </section>
    </div>
  )
}

function Cifra({
  etiqueta, valor, tono,
}: {
  etiqueta: string
  valor: number
  tono: 'positivo' | 'negativo'
}) {
  return (
    <div className="rounded-2xl bg-card px-5 py-4 shadow-card
                    ring-1 ring-border/70 print:shadow-none print:ring-0">
      <p className="text-[12px] text-muted-foreground">{etiqueta}</p>
      <p className={`mt-1 text-[22px] font-semibold tabular-nums ${
        valor === 0 ? '' : tono === 'positivo' ? 'text-positivo' : 'text-negativo'
      }`}>
        {formatearCOP(valor)}
      </p>
    </div>
  )
}
