import { Download } from 'lucide-react'
import {
  formatearCOP, formatearFecha, formatearHora, nombreDelMes,
} from '@/lib/format'
import { datosDelExtracto } from '@/lib/datos-extracto'
import { SelectorMesExtracto } from '@/components/selector-mes-extracto'
import { BotonImprimir } from '@/components/boton-imprimir'
import { DetalleEnElPdf } from '@/components/detalle-en-el-pdf'

/**
 * El extracto de un mes, en escritorio.
 *
 * EL ORDEN ES EL MENSAJE. Primero el resumen —cuánto entró, cuánto
 * salió, cómo quedó cada cuenta, en qué se fue— y solo después el
 * detalle, que empieza en hoja aparte y se puede dejar fuera del PDF.
 * Antes la hoja era la lista de movimientos y nada más: cuatro páginas
 * de filas sin una sola conclusión.
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
  const {
    mes, nombre, movimientos, dias, porCuenta, categorias, ingresos, gastos,
  } = await datosDelExtracto(mesPedido)

  return (
    <div>
      <header className="flex items-end justify-between gap-6">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight">Extracto</h1>
          <p className="mt-1 text-[14px] text-muted-foreground">
            {nombreDelMes(mes)} · {nombre}
          </p>
        </div>

        <div className="solo-pantalla flex items-center gap-3">
          <SelectorMesExtracto mes={mes} origen="escritorio" />
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

          {porCuenta.length > 0 && (
            <section className="mt-6">
              <Titulo>Cómo quedó cada cuenta</Titulo>
              <div className="mt-2 overflow-hidden rounded-2xl bg-card
                              shadow-card ring-1 ring-border/70
                              print:shadow-none print:ring-0">
                <table className="w-full text-[13px]">
                  <thead className="text-muted-foreground">
                    <tr className="border-b border-border/70">
                      <th className="px-4 py-2.5 text-left font-normal">Cuenta</th>
                      <th className="px-4 py-2.5 text-right font-normal">Empezó con</th>
                      <th className="px-4 py-2.5 text-right font-normal">Entró</th>
                      <th className="px-4 py-2.5 text-right font-normal">Salió</th>
                      <th className="px-4 py-2.5 text-right font-normal">Terminó con</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/70">
                    {porCuenta.map((c) => (
                      <tr key={c.cuenta}>
                        <td className="px-4 py-2.5">{c.cuenta}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums
                                       text-muted-foreground">
                          {formatearCOP(c.saldo_inicial)}
                        </td>
                        <td className={`px-4 py-2.5 text-right tabular-nums ${
                          c.entro === 0 ? 'text-muted-foreground' : 'text-positivo'
                        }`}>
                          {c.entro === 0 ? '—' : formatearCOP(c.entro)}
                        </td>
                        <td className={`px-4 py-2.5 text-right tabular-nums ${
                          c.salio === 0 ? 'text-muted-foreground' : 'text-negativo'
                        }`}>
                          {c.salio === 0 ? '—' : formatearCOP(c.salio)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-medium
                                       tabular-nums">
                          {formatearCOP(c.saldo_final)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-[12px] text-muted-foreground">
                Aquí sí cuentan los traslados entre tus cuentas, por eso estos
                números no suman igual que Entró y Salió.
              </p>
            </section>
          )}

          {categorias.length > 0 && (
            <section className="mt-6">
              <Titulo>En qué se fue</Titulo>
              <dl className="mt-2 grid grid-cols-2 gap-x-6 divide-y
                             divide-border/70 rounded-2xl bg-card px-5
                             shadow-card ring-1 ring-border/70
                             print:shadow-none print:ring-0">
                {categorias.map((c) => (
                  <div key={c.categoria}
                       className="flex items-baseline justify-between gap-3 py-3">
                    <dt className="min-w-0 truncate text-[14px]">{c.categoria}</dt>
                    <dd className="shrink-0 text-[14px] font-medium tabular-nums">
                      {formatearCOP(c.monto)}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          <div className="mt-6">
            <DetalleEnElPdf titulo={`Movimientos (${movimientos.length})`}>
              {/* Tabla de verdad: en una hoja A4 y en un monitor hay ancho
                  para columnas, y un extracto se lee así. La fecha va una
                  vez por día, en su propia fila. */}
              <div className="mt-2 overflow-hidden rounded-2xl bg-card
                              shadow-card ring-1 ring-border/70
                              print:shadow-none print:ring-0">
                <table className="w-full text-[13px] print:text-[10px]">
                  <thead className="text-left text-muted-foreground">
                    <tr className="border-b border-border/70">
                      <th className="px-4 py-2.5 font-normal print:py-1">Hora</th>
                      <th className="px-4 py-2.5 font-normal print:py-1">Descripción</th>
                      <th className="px-4 py-2.5 font-normal print:py-1">Movimiento</th>
                      <th className="px-4 py-2.5 text-right font-normal print:py-1">Monto</th>
                    </tr>
                  </thead>
                  {dias.map((d) => (
                    <tbody key={d.dia} className="divide-y divide-border/70">
                      <tr className="bg-muted/40 print:bg-transparent">
                        <td colSpan={4}
                            className="px-4 py-1.5 text-[11px] font-semibold
                                       print:py-0.5 print:text-[10px]">
                          {formatearFecha(d.dia).replace(/ de \d{4}$/, '')}
                        </td>
                      </tr>
                      {d.movimientos.map((x) => {
                        const signo =
                          x.type === 'expense' ? -1 : x.type === 'income' ? 1 : 0
                        return (
                          <tr key={x.id}>
                            <td className="whitespace-nowrap px-4 py-2.5
                                           text-[11px] text-muted-foreground
                                           tabular-nums print:py-1">
                              {formatearHora(x.occurred_at)}
                            </td>
                            <td className="px-4 py-2.5 print:py-1">
                              {x.description}
                            </td>
                            <td className="px-4 py-2.5 text-muted-foreground
                                           print:py-1">
                              {x.cuenta_origen} → {x.cuenta_destino}
                            </td>
                            <td className={`whitespace-nowrap px-4 py-2.5
                                            text-right font-medium tabular-nums
                                            print:py-1 ${
                              signo < 0 ? 'text-negativo'
                                : signo > 0 ? 'text-positivo' : ''
                            }`}>
                              {signo === 0 ? '' : signo > 0 ? '+' : '−'}
                              {formatearCOP(x.monto)}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  ))}
                </table>
              </div>
            </DetalleEnElPdf>
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
