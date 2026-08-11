import { ChevronDown } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { formatearCOP, formatearFecha } from '@/lib/format'
import { InvitarPareja } from '@/components/invitar-pareja'
import { ToggleVisibilidad } from '@/components/toggle-visibilidad'
import { aceptar, rechazar, cancelar, salir, eliminarGastoCompartido } from './actions'
import { FormularioGastoCompartido } from '@/components/formulario-gasto-compartido'
import { FormularioLiquidar } from '@/components/formulario-liquidar'
import { Seccion, Lista, Fila } from '@/components/seccion'
import { CifraAnimada } from '@/components/cifra-animada'
import { TarjetaDestacada } from '@/components/tarjeta-destacada'

export default async function ParejaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const yo = user!.id

  // ¿Tengo pareja activa?
  const { data: miMembresia } = await supabase
    .from('couple_members')
    .select('couple_id')
    .eq('profile_id', yo)
    .eq('status', 'active')
    .maybeSingle()

  const coupleId = miMembresia?.couple_id ?? null

  // Invitaciones que he recibido
  const { data: recibidas } = await supabase.rpc('invitaciones_recibidas')

  // El otro miembro (si lo hay)
  let pareja: { id: string; nombre: string } | null = null
  if (coupleId) {
    const { data: otros } = await supabase
      .from('couple_members')
      .select('profile_id')
      .eq('couple_id', coupleId)
      .eq('status', 'active')
      .neq('profile_id', yo)

    const otroId = otros?.[0]?.profile_id
    if (otroId) {
      const { data: perfil } = await supabase
        .from('profiles').select('display_name').eq('id', otroId).maybeSingle()
      pareja = { id: otroId, nombre: perfil?.display_name ?? 'Tu pareja' }
    }
  }

  // Invitaciones que YO envié y siguen pendientes
  const { data: enviadas } = coupleId
    ? await supabase
        .from('couple_invitations')
        .select('id, invitee_email')
        .eq('inviter_id', yo)
        .eq('status', 'pending')
    : { data: null }

  // Mis cuentas, para elegir qué comparto
  const { data: misCuentas } = await supabase
    .from('accounts')
    .select('id, name, visibility')
    .eq('owner_id', yo)
    .in('class', ['asset', 'liability'])
    .eq('is_active', true)
    .order('name')

  /* Lo que mi pareja comparte conmigo.
     Antes esta consulta pedía TODAS las cuentas ajenas y confiaba en que
     el RLS recortara el resultado. Dos filtros faltaban:
       - class: sin él, una categoría de gasto suya podría acabar en esta
         lista. Las categorías dicen en qué gasta, y el modelo de
         privacidad promete mostrar el saldo, no los movimientos.
       - visibility: la sección se llama "qué comparte contigo", así que
         debe pedir exactamente eso. */
  const { data: cuentasSuyas } = pareja
    ? await supabase
        .from('accounts')
        .select('id, name')
        .neq('owner_id', yo)
        .in('class', ['asset', 'liability'])
        .in('visibility', ['shared_view', 'joint'])
        .eq('is_active', true)
        .order('name')
    : { data: null }

  // El saldo se pide con la función, que valida el permiso aparte.
  const suyas = await Promise.all(
    (cuentasSuyas ?? []).map(async (c) => {
      const { data: saldo } = await supabase.rpc('saldo_cuenta_visible', {
        p_cuenta: c.id,
      })
      return { account_id: c.id, name: c.name, balance: Number(saldo ?? 0) }
    })
  )

  // Balance con la pareja y datos para los formularios
  const { data: balanceRow } = pareja
    ? await supabase.from('account_balances')
        .select('balance')
        .eq('owner_id', yo)
        .eq('type', 'partner_receivable')
        .maybeSingle()
    : { data: null }

  const balance = Number(balanceRow?.balance ?? 0)

  const { data: misCuentasPago } = await supabase
    .from('accounts').select('id, name')
    .eq('owner_id', yo).eq('class', 'asset').eq('is_active', true)
    .eq('is_partner_balance', false).eq('is_opening', false)
    .neq('type', 'receivable').order('name')

  const { data: misCategorias } = await supabase
    .from('accounts').select('id, name')
    .eq('owner_id', yo).eq('class', 'expense').order('name')

  const { data: compartidos } = pareja
    ? await supabase.from('gastos_compartidos_detalle')
        .select('*').order('occurred_on', { ascending: false }).limit(20)
    : { data: null }

  const hoy = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Bogota',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())

  return (
    <main className="px-4 pt-4 pb-[calc(8rem+env(safe-area-inset-bottom))]">
      <h1 className="aparece px-1 text-[22px] font-semibold tracking-tight">
        Pareja
      </h1>

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