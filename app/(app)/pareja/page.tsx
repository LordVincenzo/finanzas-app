import { createClient } from '@/lib/supabase/server'
import { formatearCOP, formatearFecha } from '@/lib/format'
import { InvitarPareja } from '@/components/invitar-pareja'
import { ToggleVisibilidad } from '@/components/toggle-visibilidad'
import { aceptar, rechazar, cancelar, salir, eliminarGastoCompartido } from './actions'
import { FormularioGastoCompartido } from '@/components/formulario-gasto-compartido'
import { FormularioLiquidar } from '@/components/formulario-liquidar'
import { Seccion, Lista, Fila } from '@/components/seccion'

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

  // Lo que mi pareja comparte conmigo
  
  const { data: cuentasSuyas } = pareja
    ? await supabase
        .from('accounts')
        .select('id, name')
        .neq('owner_id', yo)
        .eq('is_active', true)
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
    <main className="px-4 pt-6">
      <h1 className="text-xl font-semibold">Pareja</h1>

      {/* --- Invitaciones recibidas --- */}
      {(recibidas ?? []).length > 0 && (
        <div className="mt-5 space-y-2">
          {(recibidas ?? []).map((inv: { id: string; inviter_name: string }) => (
            <div key={inv.id} className="rounded-xl border p-3.5">
              <p className="text-[13px]">
                <span className="font-medium">{inv.inviter_name}</span> quiere
                vincularse contigo.
              </p>
              <div className="mt-2.5 flex gap-2">
                <form action={aceptar}>
                  <input type="hidden" name="id" value={inv.id} />
                  <button className="rounded-lg bg-foreground px-3 py-1.5
                                     text-[11px] font-medium text-background">
                    Aceptar
                  </button>
                </form>
                <form action={rechazar}>
                  <input type="hidden" name="id" value={inv.id} />
                  <button className="rounded-lg border px-3 py-1.5 text-[11px]">
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
          <div className="mt-5 rounded-xl border p-4">
            <p className="text-[13px] font-medium">Vincula tu cuenta</p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              Vincularse no comparte nada automáticamente. Tú eliges cuenta
              por cuenta qué puede ver la otra persona.
            </p>
            <InvitarPareja />
          </div>

          {(enviadas ?? []).length > 0 && (
            <Seccion titulo="Invitaciones enviadas">
              <Lista>
                {(enviadas ?? []).map((inv) => (
                  <Fila
                    key={inv.id}
                    titulo={inv.invitee_email}
                    detalle="Pendiente"
                    valor={
                      <form action={cancelar}>
                        <input type="hidden" name="id" value={inv.id} />
                        <button className="text-[11px] text-destructive underline">
                          Cancelar
                        </button>
                      </form>
                    }
                  />
                ))}
              </Lista>
            </Seccion>
          )}
        </>
      )}

      {/* --- Con pareja --- */}
      {pareja && (
        <>
          {/* El balance es lo único que se consulta a diario:
              va suelto y grande, como el patrimonio en Inicio. */}
          <div className="mt-5">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Balance con {pareja.nombre}
            </p>
            {balance === 0 ? (
              <p className="mt-1 text-[22px] font-semibold leading-none">
                Están a mano
              </p>
            ) : (
              <>
                <p className={`mt-1 text-[30px] font-semibold leading-none
                               tracking-tight tabular-nums ${
                                 balance > 0 ? 'text-positivo' : 'text-negativo'
                               }`}>
                  {formatearCOP(Math.abs(balance))}
                </p>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  {balance > 0
                    ? `${pareja.nombre} te debe`
                    : `Le debes a ${pareja.nombre}`}
                </p>
              </>
            )}

            {balance !== 0 && (misCuentasPago ?? []).length > 0 && (
              <details className="mt-3 rounded-xl border">
                <summary className="cursor-pointer px-4 py-2.5 text-[13px] font-medium">
                  Liquidar
                </summary>
                <div className="border-t px-4 pb-4">
                  <FormularioLiquidar
                    cuentas={misCuentasPago ?? []}
                    balance={balance}
                    nombrePareja={pareja.nombre}
                    hoy={hoy}
                  />
                </div>
              </details>
            )}
          </div>

          {/* --- Nuevo gasto compartido --- */}
          {(misCuentasPago ?? []).length > 0 && (
            <details className="mt-5 rounded-xl border">
              <summary className="cursor-pointer px-4 py-2.5 text-[13px] font-medium">
                Registrar gasto compartido
              </summary>
              <div className="border-t px-4 pb-4">
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
                          <button className="shrink-0 text-[11px] text-destructive
                                             underline">
                            Quitar
                          </button>
                        </form>
                      ) : undefined
                    }
                  />
                ))}
              </Lista>
            </Seccion>
          )}

          {/* Lo que se configura una vez, plegado */}
          <details className="mt-5 rounded-xl border">
            <summary className="cursor-pointer px-4 py-2.5 text-[13px] font-medium">
              Qué compartes
            </summary>
            <div className="divide-y border-t">
              {(misCuentas ?? []).map((c) => (
                <div key={c.id} className="flex items-center justify-between
                                           gap-3 px-3.5 py-2.5">
                  <span className="truncate text-[13px]">{c.name}</span>
                  <ToggleVisibilidad id={c.id} visibilidad={c.visibility} />
                </div>
              ))}
              <p className="px-3.5 py-2.5 text-[11px] text-muted-foreground">
                Compartida = puede verla, no editarla.
              </p>
            </div>
          </details>

          <details className="mt-2.5 rounded-xl border">
            <summary className="cursor-pointer px-4 py-2.5 text-[13px] font-medium">
              Qué comparte contigo
            </summary>
            {suyas.length === 0 ? (
              <p className="border-t px-3.5 py-3 text-[11px] text-muted-foreground">
                Todavía no comparte ninguna cuenta.
              </p>
            ) : (
              <div className="divide-y border-t">
                {suyas.map((c) => (
                  <div key={c.account_id} className="flex items-center
                                                     justify-between gap-3
                                                     px-3.5 py-2.5">
                    <span className="truncate text-[13px]">{c.name}</span>
                    <span className="shrink-0 text-[13px] tabular-nums">
                      {formatearCOP(Number(c.balance))}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </details>

          <form action={salir} className="mt-8">
            <button className="text-[11px] text-destructive underline">
              Desvincular
            </button>
          </form>
        </>
      )}
    </main>
  )
}
