import Link from 'next/link'
import { ChevronLeft, Download } from 'lucide-react'
import { formatearCOP, formatearFecha, nombreDelMes } from '@/lib/format'
import { datosDelExtracto } from '@/lib/datos-extracto'
import { SelectorMesExtracto } from '@/components/selector-mes-extracto'
import { BotonImprimir } from '@/components/boton-imprimir'
import { DetalleEnElPdf } from '@/components/detalle-en-el-pdf'

/**
 * El extracto de un mes.
 *
 * PARA QUÉ. Para leer un mes cerrado de un vistazo, y para guardarlo o
 * mandarlo. La app enseña el mes en curso por todas partes; esto es lo
 * que queda cuando el mes ya pasó.
 *
 * PRIMERO LAS CONCLUSIONES. Cuánto entró, cuánto salió, cómo quedó cada
 * cuenta y en qué se fue. El detalle —setenta y pico de movimientos en
 * un mes normal— va al final, empieza en hoja aparte y se puede dejar
 * fuera del PDF. Antes la hoja era solo esa lista, y un muro de filas
 * no es un extracto: es el ledger impreso.
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
  const {
    mes, nombre, movimientos, dias, porCuenta, categorias, ingresos, gastos,
  } = await datosDelExtracto(mesPedido)

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
            {nombreDelMes(mes)} · {nombre}
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

          {/* Cómo quedó cada cuenta — lo que convierte una lista de
              movimientos en un extracto de verdad. En 390px no cabe una
              tabla de cinco columnas, así que cada cuenta es un bloque:
              arriba el nombre y lo que quedó, abajo de dónde viene. */}
          {porCuenta.length > 0 && (
            <section className="mt-6">
              <Titulo>Cómo quedó cada cuenta</Titulo>
              <div className="mt-2 divide-y divide-border/70 rounded-xl bg-card
                              px-4 shadow-card ring-1 ring-border/70
                              print:shadow-none print:ring-0">
                {porCuenta.map((c) => (
                  <div key={c.cuenta} className="py-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="min-w-0 flex-1 truncate text-[14px]">
                        {c.cuenta}
                      </p>
                      <span className="shrink-0 text-[14px] font-medium
                                       tabular-nums">
                        {formatearCOP(c.saldo_final)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted-foreground
                                  tabular-nums">
                      Empezó con {formatearCOP(c.saldo_inicial)}
                      {c.entro > 0 && <> · entró {formatearCOP(c.entro)}</>}
                      {c.salio > 0 && <> · salió {formatearCOP(c.salio)}</>}
                    </p>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
                Aquí sí cuentan los traslados entre tus cuentas, por eso estos
                números no suman igual que Entró y Salió.
              </p>
            </section>
          )}

          {/* En qué se fue */}
          {categorias.length > 0 && (
            <section className="mt-6">
              <Titulo>En qué se fue</Titulo>
              <dl className="mt-2 divide-y divide-border/70 rounded-xl
                             bg-card px-4 shadow-card ring-1 ring-border/70
                             print:shadow-none print:ring-0">
                {categorias.map((c) => (
                  <div key={c.categoria}
                       className="flex items-baseline justify-between gap-3 py-2.5">
                    <dt className="min-w-0 truncate text-[14px]">
                      {c.categoria}
                    </dt>
                    <dd className="shrink-0 text-[14px] font-medium tabular-nums">
                      {formatearCOP(c.monto)}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {/* Todo, en orden, con la fecha una sola vez por día */}
          <div className="mt-6">
            <DetalleEnElPdf titulo={`Movimientos (${movimientos.length})`}>
              <div className="mt-2 overflow-hidden rounded-xl bg-card
                              shadow-card ring-1 ring-border/70
                              print:shadow-none print:ring-0">
                {dias.map((d) => (
                  <div key={d.dia}>
                    <p className="bg-muted/40 px-4 py-1.5 text-[11px]
                                  font-semibold print:bg-transparent
                                  print:py-0.5">
                      {formatearFecha(d.dia).replace(/ de \d{4}$/, '')}
                    </p>
                    <div className="divide-y divide-border/70 px-4">
                      {d.movimientos.map((x) => {
                        const signo =
                          x.type === 'expense' ? -1 : x.type === 'income' ? 1 : 0
                        return (
                          <div key={x.id} className="py-2.5 print:py-1">
                            <div className="flex items-baseline justify-between gap-3">
                              <p className="min-w-0 flex-1 truncate text-[14px]
                                            print:text-[11px]">
                                {x.description}
                              </p>
                              <span className={`shrink-0 text-[14px] font-medium
                                                tabular-nums print:text-[11px] ${
                                signo < 0 ? 'text-negativo'
                                  : signo > 0 ? 'text-positivo' : ''
                              }`}>
                                {signo === 0 ? '' : signo > 0 ? '+' : '−'}
                                {formatearCOP(x.monto)}
                              </span>
                            </div>
                            <p className="truncate text-[11px]
                                          text-muted-foreground print:text-[9px]">
                              {x.cuenta_origen} → {x.cuenta_destino}
                            </p>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </DetalleEnElPdf>
          </div>
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

function Titulo({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] font-semibold uppercase tracking-[0.09em]
                   text-muted-foreground">
      {children}
    </h2>
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
