import Link from 'next/link'
import { Plus, AlertCircle, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { formatearCOP, formatearFecha } from '@/lib/format'
import { BarraProgreso } from '@/components/barra-progreso'
import {
  agruparPorPersona, separarSaldados, type PrestamoFila,
} from '@/lib/prestamos'

/**
 * Préstamos, por persona — en escritorio.
 *
 * Misma idea que en el celular (ver lib/prestamos.ts): una fila por
 * persona con lo que debe en total, y sus préstamos debajo. Lo saldado
 * baja a su propia tabla, que aquí sí cabe abierta sin estorbar.
 */
export default async function PrestamosEscritorioPage() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('prestamos_resumen')
    .select('*')
    .neq('status', 'cancelled')
    .order('loan_date', { ascending: false })

  if (error) {
    return (
      <div>
        <h1 className="text-[26px] font-semibold tracking-tight">Préstamos</h1>
        <p className="mt-4 rounded-2xl bg-card p-4 text-[13px] text-destructive
                      shadow-card ring-1 ring-destructive/30">
          No se pudieron cargar: {error.message}
        </p>
      </div>
    )
  }

  const prestamos = (data ?? []) as unknown as PrestamoFila[]
  const personas = agruparPorPersona(prestamos)
  const { deben, saldados } = separarSaldados(personas)

  const porCobrar = deben.reduce((s, p) => s + p.pendiente, 0)
  const yaCobrado = personas.reduce((s, p) => s + p.pagado, 0)

  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight">Préstamos</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Prestar dinero no reduce tu patrimonio: lo mueve a &quot;por cobrar&quot;.
          </p>
        </div>
        <Link href="/escritorio/prestamos/nuevo"
              className="flex h-9 items-center gap-1.5 rounded-full bg-primary
                         px-4 text-[13px] font-medium text-primary-foreground
                         shadow-card transition hover:opacity-90">
          <Plus className="size-4" /> Nuevo préstamo
        </Link>
      </div>

      {prestamos.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-border px-6 py-12 text-center">
          <p className="text-[15px] font-medium">No has registrado préstamos</p>
          <p className="mx-auto mt-1.5 max-w-[40ch] text-[13px] text-muted-foreground">
            Prestar dinero no reduce tu patrimonio: lo mueve a &quot;por cobrar&quot;.
          </p>
          <Link href="/escritorio/prestamos/nuevo"
                className="mt-4 inline-flex h-11 items-center rounded-xl bg-primary
                           px-5 text-[14px] font-medium text-primary-foreground shadow-card">
            Registrar uno
          </Link>
        </div>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-3 gap-4">
            <TarjetaResumen etiqueta="Por cobrar" valor={formatearCOP(porCobrar)} />
            <TarjetaResumen etiqueta="Ya te devolvieron" valor={formatearCOP(yaCobrado)} />
            <TarjetaResumen
              etiqueta={deben.length === 1 ? 'Persona te debe' : 'Personas te deben'}
              valor={String(deben.length)}
            />
          </div>

          {deben.length === 0 ? (
            <p className="mt-8 text-[14px] text-muted-foreground">
              Nadie te debe nada ahora mismo.
            </p>
          ) : (
            <div className="mt-6 overflow-hidden rounded-2xl bg-card shadow-card ring-1 ring-border/70">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b border-border/70 text-[12px] text-muted-foreground">
                    <th className="px-5 py-3 font-medium">Persona</th>
                    <th className="px-5 py-3 font-medium">Progreso</th>
                    <th className="px-5 py-3 font-medium">Estado</th>
                    <th className="px-5 py-3 text-right font-medium">Pendiente</th>
                    <th className="w-10" />
                  </tr>
                </thead>

                {/* Un tbody por persona: la fila de la persona y, debajo,
                    sus préstamos. Un tbody es lo que permite agrupar
                    filas sin inventarse tablas anidadas. */}
                {deben.map((persona) => {
                  const progreso = persona.prestado > 0
                    ? Math.round((persona.pagado * 100) / persona.prestado)
                    : 0
                  const varios = persona.prestamos.length > 1

                  return (
                    <tbody key={persona.clave} className="divide-y divide-border/70
                                                          border-b border-border/70">
                      <tr className="transition hover:bg-muted/40">
                        <td className="px-5 py-3">
                          <p className="font-medium">{persona.nombre}</p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground tabular-nums">
                            {formatearCOP(persona.pagado)} de{' '}
                            {formatearCOP(persona.prestado)}
                            {varios && <> · {persona.prestamos.length} préstamos</>}
                          </p>
                        </td>
                        <td className="px-5 py-3">
                          <div className="w-32">
                            <BarraProgreso progreso={progreso} />
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-5 py-3 text-muted-foreground">
                          {persona.vencidas > 0 ? (
                            <span className="flex items-center gap-1 text-destructive">
                              <AlertCircle className="size-3.5" />
                              {persona.vencidas} vencida{persona.vencidas > 1 ? 's' : ''}
                            </span>
                          ) : persona.proxima_fecha ? (
                            <span className="tabular-nums">
                              {formatearFecha(persona.proxima_fecha)}
                            </span>
                          ) : (
                            'Sin fecha'
                          )}
                        </td>
                        <td className="px-5 py-3 text-right font-medium tabular-nums">
                          {formatearCOP(persona.pendiente)}
                        </td>
                        <td className="px-5 py-3">
                          {!varios && (
                            <Link href={`/escritorio/prestamos/${persona.prestamos[0].id}`}
                                  aria-label={`Ver ${persona.nombre}`}>
                              <ChevronRight className="size-4 text-muted-foreground/60" />
                            </Link>
                          )}
                        </td>
                      </tr>

                      {/* Con un solo préstamo la fila de arriba ya lo dice
                          todo; repetirlo debajo sería la misma línea dos
                          veces. */}
                      {varios && persona.prestamos.map((p) => (
                        <tr key={p.id} className="text-[12px] transition hover:bg-muted/40">
                          <td className="py-2 pl-10 pr-5 text-muted-foreground tabular-nums">
                            {formatearFecha(p.loan_date)}
                          </td>
                          <td className="px-5 py-2 text-muted-foreground tabular-nums">
                            {formatearCOP(Number(p.pagado))} de{' '}
                            {formatearCOP(Number(p.principal))}
                          </td>
                          <td className="px-5 py-2 text-muted-foreground">
                            {Number(p.cuotas_total) > 1
                              ? `${p.cuotas_pagadas ?? 0} de ${p.cuotas_total} cuotas`
                              : 'Pago único'}
                          </td>
                          <td className={`px-5 py-2 text-right tabular-nums ${
                            p.status === 'paid' ? 'text-positivo' : ''
                          }`}>
                            {p.status === 'paid'
                              ? 'Pagado'
                              : formatearCOP(Number(p.pendiente))}
                          </td>
                          <td className="px-5 py-2">
                            <Link href={`/escritorio/prestamos/${p.id}`}
                                  aria-label={`Ver préstamo del ${formatearFecha(p.loan_date)}`}>
                              <ChevronRight className="size-4 text-muted-foreground/60" />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  )
                })}
              </table>
            </div>
          )}

          {/* Historial: sirve para saber quién devuelve y quién no, pero
              no puede ocupar la pantalla que contesta quién me debe. */}
          {saldados.length > 0 && (
            <section className="mt-8">
              <h2 className="text-[11px] font-semibold uppercase
                             tracking-[0.09em] text-muted-foreground">
                Ya te pagaron ({saldados.length})
              </h2>
              <div className="mt-2 overflow-hidden rounded-2xl bg-card
                              shadow-card ring-1 ring-border/70">
                <table className="w-full text-left text-[13px]">
                  <tbody className="divide-y divide-border/70">
                    {saldados.map((persona) => (
                      <tr key={persona.clave} className="transition hover:bg-muted/40">
                        <td className="px-5 py-3">{persona.nombre}</td>
                        <td className="px-5 py-3 text-muted-foreground tabular-nums">
                          {persona.prestamos.length === 1
                            ? formatearFecha(persona.prestamos[0].loan_date)
                            : `${persona.prestamos.length} préstamos`}
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums">
                          {formatearCOP(persona.prestado)}
                        </td>
                        <td className="w-10 px-5 py-3">
                          <Link href={`/escritorio/prestamos/${persona.prestamos[0].id}`}
                                aria-label={`Ver ${persona.nombre}`}>
                            <ChevronRight className="size-4 text-muted-foreground/60" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}

function TarjetaResumen({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="rounded-2xl bg-card p-4 shadow-card ring-1 ring-border/70">
      <p className="text-[12px] text-muted-foreground">{etiqueta}</p>
      <p className="mt-0.5 text-[20px] font-semibold tabular-nums">{valor}</p>
    </div>
  )
}
