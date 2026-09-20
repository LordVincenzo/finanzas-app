import Link from 'next/link'
import { ChevronLeft, Download } from 'lucide-react'
import { createClient, requerirUsuario } from '@/lib/supabase/server'
import {
  formatearCOP, formatearFecha, mesActualBogota, moverMes, nombreDelMes,
} from '@/lib/format'
import { SelectorMesExtracto } from '@/components/selector-mes-extracto'
import { BotonImprimir } from '@/components/boton-imprimir'

/**
 * El extracto de un mes.
 *
 * PARA QUÉ. Para leer un mes cerrado de un vistazo, y para guardarlo o
 * mandarlo. La app enseña el mes en curso por todas partes; esto es lo
 * que queda cuando el mes ya pasó.
 *
 * NO ES EL RESPALDO. Un extracto es un mes; el respaldo es todo, y vive
 * en /api/exportar. Confundirlos es quedarse sin agosto el día que haga
 * falta.
 *
 * SE IMPRIME CON EL NAVEGADOR. No hay librería de PDF: Ctrl+P y
 * "Guardar como PDF" produce el mismo archivo, sin 300 KB de
 * dependencia que auditar en una app que maneja dinero. Lo que hace
 * falta es que la página esté preparada para el papel, y de eso se
 * encargan las clases `solo-pantalla` y la regla @media print de
 * globals.css.
 */
export default async function ExtractoPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>
}) {
  const { mes: mesPedido } = await searchParams
  const supabase = await createClient()
  const user = await requerirUsuario(supabase)

  /* El mes anterior por defecto, no el actual: un extracto es de algo
     que ya terminó. El de este mes todavía está cambiando. */
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

  const vacio = movimientos.length === 0

  return (
    <main className="px-4 pt-4 pb-[calc(8rem+env(safe-area-inset-bottom))]
                     print:px-0 print:pb-0">
      {/* Nada de esto va al papel: en una hoja impresa, un botón es un
          rectángulo gris que no hace nada. */}
      <div className="solo-pantalla">
        <Link href="/mas"
              className="-my-2.5 -ml-1 inline-flex items-center gap-1 px-2 py-2.5
                         text-[13px] text-muted-foreground">
          <ChevronLeft className="size-4" /> Más
        </Link>
      </div>

      <header className="mt-1 flex items-baseline justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight">
            Extracto
          </h1>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {nombreDelMes(mes)} · {perfil?.display_name}
          </p>
        </div>
      </header>

      <div className="solo-pantalla mt-3">
        <SelectorMesExtracto mes={mes} />
      </div>

      {vacio ? (
        <p className="mt-8 text-center text-[14px] text-muted-foreground">
          No hubo movimientos en {nombreDelMes(mes).toLowerCase()}.
        </p>
      ) : (
        <>
          {/* Resumen */}
          <section className="mt-5 grid grid-cols-3 gap-2">
            <Cifra etiqueta="Entró" valor={ingresos} tono="positivo" />
            <Cifra etiqueta="Salió" valor={gastos} tono="negativo" />
            <Cifra etiqueta="Diferencia" valor={ingresos - gastos}
                   tono={ingresos - gastos < 0 ? 'negativo' : 'positivo'} />
          </section>

          {/* En qué se fue */}
          {(categorias ?? []).length > 0 && (
            <section className="mt-6">
              <h2 className="text-[11px] font-semibold uppercase
                             tracking-[0.09em] text-muted-foreground">
                En qué se fue
              </h2>
              <dl className="mt-2 divide-y divide-border/70 rounded-xl
                             bg-card px-4 shadow-card ring-1 ring-border/70
                             print:shadow-none print:ring-0">
                {(categorias ?? []).map((c) => (
                  <div key={c.categoria as string}
                       className="flex items-baseline justify-between gap-3 py-2.5">
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

          {/* Todo, en orden */}
          <section className="mt-6">
            <h2 className="text-[11px] font-semibold uppercase
                           tracking-[0.09em] text-muted-foreground">
              Movimientos ({movimientos.length})
            </h2>
            <div className="mt-2 divide-y divide-border/70 rounded-xl bg-card
                            px-4 shadow-card ring-1 ring-border/70
                            print:shadow-none print:ring-0">
              {movimientos.map((x) => {
                const signo = x.type === 'expense' ? -1 : x.type === 'income' ? 1 : 0
                return (
                  <div key={x.id as string} className="py-2.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="min-w-0 flex-1 truncate text-[14px]">
                        {x.description as string}
                      </p>
                      <span className={`shrink-0 text-[14px] font-medium
                                        tabular-nums ${
                        signo < 0 ? 'text-negativo'
                          : signo > 0 ? 'text-positivo' : ''
                      }`}>
                        {signo === 0 ? '' : signo > 0 ? '+' : '−'}
                        {formatearCOP(Number(x.monto))}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                      {formatearFecha(x.occurred_on as string)
                        .replace(/ de \d{4}$/, '')}
                      {' · '}
                      {x.cuenta_origen as string} → {x.cuenta_destino as string}
                    </p>
                  </div>
                )
              })}
            </div>
          </section>
        </>
      )}

      {/* Las dos salidas, juntas y con la diferencia dicha */}
      <section className="solo-pantalla mt-8 rounded-2xl bg-card p-5
                          shadow-card ring-1 ring-border/70">
        <p className="text-[15px] font-medium">Guardar o descargar</p>

        <BotonImprimir />

        <a
          href="/api/exportar"
          className="mt-2 flex min-h-11 w-full items-center justify-center gap-2
                     rounded-xl border text-[14px] font-medium transition
                     active:scale-[0.99]"
        >
          <Download className="size-4" />
          Descargar todo el historial
        </a>
        <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
          El extracto es un mes; la descarga es <strong>todo</strong>, desde el
          principio, en un archivo que abre Excel. Es lo que te salva si algún
          día esta app deja de estar.
        </p>
      </section>
    </main>
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
    <div className="rounded-xl bg-card px-3 py-2.5 shadow-card
                    ring-1 ring-border/70 print:shadow-none print:ring-0">
      <p className="text-[11px] text-muted-foreground">{etiqueta}</p>
      <p className={`mt-0.5 text-[15px] font-semibold tabular-nums ${
        valor === 0 ? '' : tono === 'positivo' ? 'text-positivo' : 'text-negativo'
      }`}>
        {formatearCOP(valor)}
      </p>
    </div>
  )
}
