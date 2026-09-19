import { ChevronDown } from 'lucide-react'
import { formatearCOP, formatearFecha } from '@/lib/format'
import { cargarPareja } from '@/lib/datos-pareja'
import { InvitarPareja } from '@/components/invitar-pareja'
import { ToggleVisibilidad } from '@/components/toggle-visibilidad'
import {
  aceptar, rechazar, cancelar, salir, eliminarGastoCompartido,
  eliminarLiquidacion,
} from './actions'
import { AvisoPendienteUbicar } from '@/components/aviso-pendiente-ubicar'
import { FormularioGastoCompartido } from '@/components/formulario-gasto-compartido'
import { FormularioLiquidar } from '@/components/formulario-liquidar'
import { Seccion, Lista, Fila } from '@/components/seccion'
import { CifraAnimada } from '@/components/cifra-animada'
import { TarjetaDestacada } from '@/components/tarjeta-destacada'

export default async function ParejaPage() {
  /* Las quince consultas de esta pantalla viven en lib/datos-pareja.ts.
     La vista de escritorio muestra exactamente los mismos datos con otra
     forma, y unos filtros de privacidad tan finos (qué clase de cuenta,
     qué visibilidad, excluir la de balance) no pueden existir en dos
     copias: olvidar uno en una de ellas sería una fuga silenciosa. */
  const {
    yo, pareja, recibidas, enviadas, misCuentas, suyas, balance,
    misCuentasPago, misCategorias, compartidos, liquidaciones,
    pendienteUbicar, hoy,
  } = await cargarPareja()


  return (
    <main className="px-4 pt-4 pb-[calc(8rem+env(safe-area-inset-bottom))]">
      <h1 className="aparece px-1 text-[22px] font-semibold tracking-tight">
        Pareja
      </h1>

      {/* Arriba de todo porque es lo único de esta pantalla que pide que
          hagas algo. FUERA del bloque `pareja &&` a propósito: si os
          desvinculáis después de una liquidación, ese dinero sigue
          estando sin ubicar y seguiría siendo tuyo — esconder el aviso
          sería esconder la única pista de dónde está. */}
      {pendienteUbicar !== 0 && (
        <div className="aparece mt-3"
             style={{ '--retraso': '40ms' } as React.CSSProperties}>
          <AvisoPendienteUbicar monto={pendienteUbicar} origen="celular" />
        </div>
      )}

      {/* --- Invitaciones recibidas --- */}
      {(recibidas ?? []).length > 0 && (
        <div className="mt-3 space-y-2">
          {(recibidas ?? []).map((inv: { id: string; inviter_name: string }, i: number) => (
            <div key={inv.id}
                 className="aparece rounded-2xl bg-card px-4 py-3.5 shadow-card
                            ring-1 ring-primary/25"
                 style={{ '--retraso': `${50 + i * 60}ms` } as React.CSSProperties}>
              <p className="text-[14px] leading-snug">
                <span className="font-medium">{inv.inviter_name}</span> quiere
                vincularse contigo.
              </p>
              <div className="mt-3 flex gap-2">
                <form action={aceptar} className="flex-1">
                  <input type="hidden" name="id" value={inv.id} />
                  <button className="min-h-10 w-full rounded-xl bg-primary
                                     text-[13px] font-medium
                                     text-primary-foreground">
                    Aceptar
                  </button>
                </form>
                <form action={rechazar} className="flex-1">
                  <input type="hidden" name="id" value={inv.id} />
                  <button className="min-h-10 w-full rounded-xl border
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
        <>
          <div className="aparece mt-3 rounded-2xl bg-card p-4 shadow-elevada
                          ring-1 ring-border/70"
               style={{ '--retraso': '50ms' } as React.CSSProperties}>
            <p className="text-[15px] font-medium">Vincula tu cuenta</p>
            <p className="mt-1.5 text-[12px] leading-snug text-muted-foreground">
              Vincularse no comparte nada automáticamente. Tú eliges cuenta
              por cuenta qué puede ver la otra persona.
            </p>
            <InvitarPareja />
          </div>

          {(enviadas ?? []).length > 0 && (
            <Seccion titulo="Invitaciones enviadas">
              <div className="aparece"
                   style={{ '--retraso': '130ms' } as React.CSSProperties}>
                <Lista>
                  {(enviadas ?? []).map((inv) => (
                    <Fila
                      key={inv.id}
                      titulo={inv.invitee_email}
                      detalle="Pendiente"
                      valor={
                        <form action={cancelar}>
                          <input type="hidden" name="id" value={inv.id} />
                          <button className="text-[12px] font-medium
                                             text-destructive">
                            Cancelar
                          </button>
                        </form>
                      }
                    />
                  ))}
                </Lista>
              </div>
            </Seccion>
          )}
        </>
      )}

      {/* --- Con pareja --- */}
      {pareja && (
        <>
          {/* El balance es lo único que se consulta a diario:
              va grande y arriba, como el patrimonio en Inicio. */}
          <div className="mt-3">
            <TarjetaDestacada
              etiqueta={`Balance con ${pareja.nombre}`}
              valor={
                balance === 0
                  ? 'Están a mano'
                  : <CifraAnimada valor={Math.abs(balance)} />
              }
              pie={balance === 0
                ? undefined
                : balance > 0
                  ? `${pareja.nombre} te debe`
                  : `Le debes a ${pareja.nombre}`}
              retraso={50}
            >
              {balance !== 0 && (misCuentasPago ?? []).length > 0 && (
                <details className="group">
                  <summary className="flex min-h-12 cursor-pointer list-none
                                      items-center justify-between px-4
                                      text-[14px] font-medium">
                    Liquidar
                    <ChevronDown className="size-4 transition-transform
                                            group-open:rotate-180" />
                  </summary>
                  <div className="border-t border-destacado bg-card px-4 pb-4
                                  text-foreground">
                    <FormularioLiquidar
                      cuentas={misCuentasPago ?? []}
                      balance={balance}
                      nombrePareja={pareja.nombre}
                      hoy={hoy}
                    />
                  </div>
                </details>
              )}
            </TarjetaDestacada>
          </div>

          {/* --- Nuevo gasto compartido ---
              Es la acción principal de esta pantalla, así que no puede
              parecer un desplegable de ajustes más. */}
          {(misCuentasPago ?? []).length > 0 && (
            <details className="aparece group mt-4 overflow-hidden rounded-2xl
                                bg-card shadow-card ring-1 ring-border/70"
                     style={{ '--retraso': '130ms' } as React.CSSProperties}>
              <summary className="flex min-h-13 cursor-pointer list-none
                                  items-center justify-between px-4 py-3
                                  text-[15px] font-medium">
                <span>
                  Registrar gasto compartido
                  <span className="mt-0.5 block text-[12px] font-normal
                                   text-muted-foreground">
                    Se reparte entre los dos automáticamente
                  </span>
                </span>
                <ChevronDown className="size-4 shrink-0 text-muted-foreground
                                        transition-transform
                                        group-open:rotate-180" />
              </summary>
              <div className="border-t border-border/70 px-4 pb-4">
                <FormularioGastoCompartido
                  cuentas={misCuentasPago ?? []}
                  categorias={misCategorias ?? []}
                  nombrePareja={pareja.nombre}
                  hoy={hoy}
                />
              </div>
            </details>
          )}

          {/* --- Historial compartido --- */}
          {(compartidos ?? []).length > 0 && (
            <Seccion titulo="Gastos compartidos">
              <div className="aparece"
                   style={{ '--retraso': '200ms' } as React.CSSProperties}>
                <Lista>
                  {(compartidos ?? []).map((g) => (
                    <Fila
                      key={g.id}
                      titulo={g.description}
                      detalle={`Pagó ${g.payer_id === yo ? 'tú' : g.payer_name} · ${formatearFecha(g.occurred_on)}`}
                      valor={formatearCOP(Number(g.total_amount))}
                      extra={
                        g.payer_id === yo ? (
                          <form action={eliminarGastoCompartido}>
                            <input type="hidden" name="id" value={g.id} />
                            <button className="shrink-0 pl-2 text-[12px]
                                               font-medium text-destructive">
                              Quitar
                            </button>
                          </form>
                        ) : undefined
                      }
                    />
                  ))}
                </Lista>
              </div>
            </Seccion>
          )}

          {/* Las liquidaciones no se listaban en ninguna parte, así que
              una mal registrada no había forma de deshacerla: el error de
              eliminar_movimiento mandaba a "Pareja" y aquí no estaban. */}
          {liquidaciones.length > 0 && (
            <Seccion titulo="Liquidaciones">
              <div className="aparece"
                   style={{ '--retraso': '240ms' } as React.CSSProperties}>
                <Lista>
                  {liquidaciones.map((l) => (
                    <Fila
                      key={l.id}
                      titulo={l.from_profile === yo
                        ? `Le pagaste a ${pareja.nombre}`
                        : `${pareja.nombre} te pagó`}
                      detalle={`${formatearFecha(l.occurred_on)}${l.note ? ` · ${l.note}` : ''}`}
                      valor={formatearCOP(Number(l.amount))}
                      extra={
                        <form action={eliminarLiquidacion}>
                          <input type="hidden" name="id" value={l.id} />
                          <button className="shrink-0 pl-2 text-[12px]
                                             font-medium text-destructive">
                            Quitar
                          </button>
                        </form>
                      }
                    />
                  ))}
                </Lista>
              </div>
            </Seccion>
          )}

          {/* Lo que se configura una vez, plegado */}
          <Seccion titulo="Privacidad">
            <div className="aparece space-y-2"
                 style={{ '--retraso': '270ms' } as React.CSSProperties}>
              <details className="group overflow-hidden rounded-2xl bg-card
                                  shadow-card ring-1 ring-border/70">
                <summary className="flex min-h-12 cursor-pointer list-none
                                    items-center justify-between px-4
                                    text-[14px] font-medium">
                  Qué compartes
                  <ChevronDown className="size-4 text-muted-foreground
                                          transition-transform
                                          group-open:rotate-180" />
                </summary>
                <div className="divide-y divide-border/70 border-t
                                border-border/70">
                  {(misCuentas ?? []).map((c) => (
                    <div key={c.id} className="flex min-h-12 items-center
                                               justify-between gap-3 px-4 py-2">
                      <span className="truncate text-[14px]">{c.name}</span>
                      <ToggleVisibilidad id={c.id} visibilidad={c.visibility} />
                    </div>
                  ))}
                  <p className="px-4 py-2.5 text-[11px] leading-snug
                                text-muted-foreground">
                    Compartida = puede ver el saldo, no los movimientos ni
                    editarla.
                  </p>
                </div>
              </details>

              <details className="group overflow-hidden rounded-2xl bg-card
                                  shadow-card ring-1 ring-border/70">
                <summary className="flex min-h-12 cursor-pointer list-none
                                    items-center justify-between px-4
                                    text-[14px] font-medium">
                  Qué comparte contigo
                  <ChevronDown className="size-4 text-muted-foreground
                                          transition-transform
                                          group-open:rotate-180" />
                </summary>
                {suyas.length === 0 ? (
                  <p className="border-t border-border/70 px-4 py-3
                                text-[12px] text-muted-foreground">
                    Todavía no comparte ninguna cuenta.
                  </p>
                ) : (
                  <div className="divide-y divide-border/70 border-t
                                  border-border/70">
                    {suyas.map((c) => (
                      <div key={c.account_id}
                           className="flex min-h-12 items-center justify-between
                                      gap-3 px-4 py-2">
                        <span className="truncate text-[14px]">{c.name}</span>
                        <span className="shrink-0 text-[14px] font-medium
                                         tabular-nums">
                          {formatearCOP(Number(c.balance))}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </details>
            </div>
          </Seccion>

          <form action={salir} className="mt-8 px-1">
            <button className="text-[13px] font-medium text-destructive">
              Desvincular
            </button>
          </form>
        </>
      )}
    </main>
  )
}
