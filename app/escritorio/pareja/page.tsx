import { createClient } from '@/lib/supabase/server'
import { formatearCOP, formatearFecha } from '@/lib/format'
import { cargarPareja } from '@/lib/datos-pareja'
import { InvitarPareja } from '@/components/invitar-pareja'
import { ToggleVisibilidad } from '@/components/toggle-visibilidad'
import { FormularioGastoCompartido } from '@/components/formulario-gasto-compartido'
import { FormularioLiquidar } from '@/components/formulario-liquidar'
import { CifraAnimada } from '@/components/cifra-animada'
import {
  aceptar, rechazar, cancelar, salir, eliminarGastoCompartido,
  eliminarLiquidacion,
} from '@/app/(app)/pareja/actions'
import { AvisoPendienteUbicar } from '@/components/aviso-pendiente-ubicar'

/**
 * Pareja en escritorio.
 *
 * La versión de celular pliega casi todo en <details>: liquidar, el
 * gasto compartido, qué compartes y qué comparte contigo. Eso no es una
 * decisión de diseño que haya que copiar, es lo único que cabe en 390px
 * de ancho. Aquí los formularios están abiertos y las listas en
 * columnas, porque el espacio existe y esconder cosas detrás de un clic
 * sin necesidad solo añade trabajo.
 *
 * Los datos salen de cargarPareja(), el mismo módulo que usa el celular:
 * son unas quince consultas con filtros de privacidad finos y no puede
 * haber dos copias que se desincronicen.
 */
export default async function ParejaEscritorioPage() {
  const datos = await cargarPareja()
  const {
    yo, pareja, recibidas, enviadas, misCuentas, suyas, balance,
    misCuentasPago, misCategorias, compartidos, liquidaciones,
    pendienteUbicar, hoy,
  } = datos

  // El nombre propio, para etiquetar quién pagó en la tabla.
  const supabase = await createClient()
  const { data: miPerfil } = await supabase
    .from('profiles').select('display_name').eq('id', yo).maybeSingle()

  return (
    <div className="mx-auto max-w-[1400px] px-8 py-10">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight">Pareja</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {pareja
              ? `Vinculado con ${pareja.nombre}. Vincularse no comparte nada: tú eliges cuenta por cuenta.`
              : 'Gastos compartidos y balance con otra persona.'}
          </p>
        </div>
        {pareja && (
          <form action={salir}>
            <button className="text-[13px] font-medium text-destructive
                               transition hover:opacity-80">
              Desvincular
            </button>
          </form>
        )}
      </div>

      {/* FUERA del bloque `pareja &&` a propósito: si os desvinculáis
          después de una liquidación, ese dinero sigue estando sin ubicar
          y seguiría siendo tuyo. */}
      {pendienteUbicar !== 0 && (
        <div className="mt-6 max-w-xl">
          <AvisoPendienteUbicar monto={pendienteUbicar} origen="escritorio" />
        </div>
      )}

      {/* --- Invitaciones recibidas --- */}
      {recibidas.length > 0 && (
        <div className="mt-6 space-y-3">
          {recibidas.map((inv) => (
            <div key={inv.id}
                 className="flex items-center justify-between gap-4 rounded-2xl
                            bg-card px-5 py-4 shadow-card ring-1 ring-primary/25">
              <p className="text-[14px]">
                <span className="font-medium">{inv.inviter_name}</span> quiere
                vincularse contigo.
              </p>
              <div className="flex shrink-0 gap-2">
                <form action={aceptar}>
                  <input type="hidden" name="id" value={inv.id} />
                  <button className="h-9 rounded-xl bg-primary px-4 text-[13px]
                                     font-medium text-primary-foreground">
                    Aceptar
                  </button>
                </form>
                <form action={rechazar}>
                  <input type="hidden" name="id" value={inv.id} />
                  <button className="h-9 rounded-xl border border-border px-4
                                     text-[13px]">
                    Rechazar
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* --- Sin pareja --- */}
      {!pareja && (
        <div className="mt-6 max-w-xl">
          <div className="rounded-2xl bg-card p-5 shadow-card ring-1 ring-border/70">
            <p className="text-[15px] font-medium">Vincula tu cuenta</p>
            <p className="mt-1.5 text-[13px] leading-snug text-muted-foreground">
              Vincularse no comparte nada automáticamente. Tú eliges cuenta
              por cuenta qué puede ver la otra persona.
            </p>
            <InvitarPareja />
          </div>

          {enviadas.length > 0 && (
            <section className="mt-6">
              <h2 className="px-1 text-[11px] font-semibold uppercase
                             tracking-[0.09em] text-muted-foreground">
                Invitaciones enviadas
              </h2>
              <div className="mt-2 overflow-hidden rounded-2xl bg-card
                              shadow-card ring-1 ring-border/70">
                {enviadas.map((inv) => (
                  <div key={inv.id}
                       className="flex items-center justify-between gap-3
                                  border-b border-border/70 px-5 py-3
                                  last:border-b-0">
                    <div className="min-w-0">
                      <p className="truncate text-[14px]">{inv.invitee_email}</p>
                      <p className="text-[12px] text-muted-foreground">Pendiente</p>
                    </div>
                    <form action={cancelar}>
                      <input type="hidden" name="id" value={inv.id} />
                      <button className="shrink-0 text-[12px] font-medium
                                         text-destructive">
                        Cancelar
                      </button>
                    </form>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* --- Con pareja --- */}
      {pareja && (
        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          {/* Columna izquierda: balance y privacidad */}
          <div className="space-y-6">
            <section className="rounded-2xl bg-card p-5 shadow-card
                                ring-1 ring-border/70">
              <p className="text-[12px] text-muted-foreground">
                Balance con {pareja.nombre}
              </p>
              <p className="mt-1 text-[28px] font-semibold tracking-tight">
                {balance === 0
                  ? 'Están a mano'
                  : <CifraAnimada valor={Math.abs(balance)} />}
              </p>
              {balance !== 0 && (
                <p className="mt-0.5 text-[13px] text-muted-foreground">
                  {balance > 0
                    ? `${pareja.nombre} te debe`
                    : `Le debes a ${pareja.nombre}`}
                </p>
              )}

              {balance !== 0 && misCuentasPago.length > 0 && (
                <div className="mt-4 border-t border-border/70 pt-2">
                  <p className="text-[13px] font-medium">Liquidar</p>
                  <FormularioLiquidar
                    cuentas={misCuentasPago}
                    balance={balance}
                    nombrePareja={pareja.nombre}
                    hoy={hoy}
                  />
                </div>
              )}
            </section>

            <section className="overflow-hidden rounded-2xl bg-card shadow-card
                                ring-1 ring-border/70">
              <p className="px-5 pt-4 text-[11px] font-semibold uppercase
                            tracking-[0.09em] text-muted-foreground">
                Qué compartes
              </p>
              <div className="mt-2 divide-y divide-border/70">
                {misCuentas.map((c) => (
                  <div key={c.id}
                       className="flex items-center justify-between gap-3 px-5 py-2.5">
                    <span className="truncate text-[14px]">{c.name}</span>
                    <ToggleVisibilidad id={c.id} visibilidad={c.visibility} />
                  </div>
                ))}
              </div>
              <p className="border-t border-border/70 px-5 py-3 text-[11px]
                            leading-snug text-muted-foreground">
                Compartida = puede ver el saldo, no los movimientos ni editarla.
              </p>
            </section>

            <section className="overflow-hidden rounded-2xl bg-card shadow-card
                                ring-1 ring-border/70">
              <p className="px-5 pt-4 text-[11px] font-semibold uppercase
                            tracking-[0.09em] text-muted-foreground">
                Qué comparte contigo
              </p>
              {suyas.length === 0 ? (
                <p className="px-5 py-3 text-[13px] text-muted-foreground">
                  Todavía no comparte ninguna cuenta.
                </p>
              ) : (
                <div className="mt-2 divide-y divide-border/70">
                  {suyas.map((c) => (
                    <div key={c.account_id}
                         className="flex items-center justify-between gap-3 px-5 py-2.5">
                      <span className="truncate text-[14px]">{c.name}</span>
                      <span className="shrink-0 text-[14px] font-medium tabular-nums">
                        {formatearCOP(c.balance)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Columna derecha: registrar e historial */}
          <div className="space-y-6 lg:col-span-2">
            {misCuentasPago.length > 0 ? (
              <section className="rounded-2xl bg-card p-5 shadow-card
                                  ring-1 ring-border/70">
                <p className="text-[15px] font-medium">Registrar gasto compartido</p>
                <p className="mt-0.5 text-[12px] text-muted-foreground">
                  Se escribe en los dos ledgers a la vez: tu parte como gasto
                  tuyo, la suya como algo que te debe.
                </p>
                <div className="max-w-xl">
                  <FormularioGastoCompartido
                    cuentas={misCuentasPago}
                    categorias={misCategorias}
                    nombrePareja={pareja.nombre}
                    hoy={hoy}
                  />
                </div>
              </section>
            ) : (
              <section className="rounded-2xl border border-dashed border-border
                                  px-6 py-10 text-center">
                <p className="text-[15px] font-medium">
                  Necesitas una cuenta para registrar gastos compartidos
                </p>
                <p className="mx-auto mt-1.5 max-w-[44ch] text-[13px]
                              text-muted-foreground">
                  El gasto tiene que salir de algún sitio tuyo.
                </p>
              </section>
            )}

            <section className="overflow-hidden rounded-2xl bg-card shadow-card
                                ring-1 ring-border/70">
              <p className="px-5 pt-4 text-[11px] font-semibold uppercase
                            tracking-[0.09em] text-muted-foreground">
                Gastos compartidos
              </p>

              {compartidos.length === 0 ? (
                <p className="px-5 py-4 text-[13px] text-muted-foreground">
                  Todavía no hay ninguno.
                </p>
              ) : (
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full text-left text-[13px]">
                    <thead>
                      <tr className="border-y border-border/70 text-[12px]
                                     text-muted-foreground">
                        <th className="whitespace-nowrap px-5 py-2.5 font-medium">
                          Fecha
                        </th>
                        <th className="px-5 py-2.5 font-medium">Descripción</th>
                        <th className="px-5 py-2.5 font-medium">Pagó</th>
                        <th className="px-5 py-2.5 text-right font-medium">Total</th>
                        <th className="px-5 py-2.5" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/70">
                      {compartidos.map((g) => (
                        <tr key={g.id} className="transition hover:bg-muted/40">
                          <td className="whitespace-nowrap px-5 py-3
                                         text-muted-foreground">
                            {formatearFecha(g.occurred_on).replace(/ de \d{4}$/, '')}
                          </td>
                          <td className="px-5 py-3">{g.description}</td>
                          <td className="px-5 py-3 text-muted-foreground">
                            {g.payer_id === yo
                              ? (miPerfil?.display_name ?? 'Tú')
                              : g.payer_name}
                          </td>
                          <td className="px-5 py-3 text-right font-medium tabular-nums">
                            {formatearCOP(Number(g.total_amount))}
                          </td>
                          <td className="px-5 py-3 text-right">
                            {g.payer_id === yo && (
                              <form action={eliminarGastoCompartido}>
                                <input type="hidden" name="id" value={g.id} />
                                <button className="text-[12px] font-medium
                                                   text-destructive">
                                  Quitar
                                </button>
                              </form>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Las liquidaciones no se listaban en ninguna parte, así que
                una mal registrada no había forma de deshacerla: el error
                de eliminar_movimiento mandaba a "Pareja" y aquí no
                estaban. */}
            {liquidaciones.length > 0 && (
              <section className="overflow-hidden rounded-2xl bg-card
                                  shadow-card ring-1 ring-border/70">
                <p className="px-5 pt-4 text-[11px] font-semibold uppercase
                              tracking-[0.09em] text-muted-foreground">
                  Liquidaciones
                </p>
                <div className="mt-2 divide-y divide-border/70">
                  {liquidaciones.map((l) => {
                    const yoPague = l.from_profile === yo
                    return (
                      <div key={l.id}
                           className="flex items-center justify-between gap-4
                                      px-5 py-3">
                        <div className="min-w-0">
                          <p className="truncate text-[14px]">
                            {yoPague
                              ? `Le pagaste a ${pareja.nombre}`
                              : `${pareja.nombre} te pagó`}
                          </p>
                          <p className="mt-0.5 text-[12px] text-muted-foreground">
                            {formatearFecha(l.occurred_on)
                              .replace(/ de \d{4}$/, '')}
                            {l.note ? ` · ${l.note}` : ''}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-4">
                          <span className="text-[14px] font-medium tabular-nums">
                            {formatearCOP(Number(l.amount))}
                          </span>
                          <form action={eliminarLiquidacion}>
                            <input type="hidden" name="id" value={l.id} />
                            <button className="text-[12px] font-medium
                                               text-destructive">
                              Quitar
                            </button>
                          </form>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
