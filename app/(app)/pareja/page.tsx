import { createClient } from '@/lib/supabase/server'
import { formatearCOP } from '@/lib/format'
import { InvitarPareja } from '@/components/invitar-pareja'
import { ToggleVisibilidad } from '@/components/toggle-visibilidad'
import { aceptar, rechazar, cancelar, salir } from './actions'

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

  return (
    <main className="px-5 pt-8">
      <h1 className="text-2xl font-semibold">Pareja</h1>

      {/* --- Invitaciones recibidas --- */}
      {(recibidas ?? []).length > 0 && (
        <section className="mt-6 space-y-3">
          {(recibidas ?? []).map((inv: { id: string; inviter_name: string }) => (
            <div key={inv.id} className="rounded-2xl border p-4">
              <p className="text-sm">
                <span className="font-medium">{inv.inviter_name}</span> quiere
                vincularse contigo.
              </p>
              <div className="mt-3 flex gap-2">
                <form action={aceptar}>
                  <input type="hidden" name="id" value={inv.id} />
                  <button className="rounded-lg bg-foreground px-3 py-1.5
                                     text-xs font-medium text-background">
                    Aceptar
                  </button>
                </form>
                <form action={rechazar}>
                  <input type="hidden" name="id" value={inv.id} />
                  <button className="rounded-lg border px-3 py-1.5 text-xs">
                    Rechazar
                  </button>
                </form>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* --- Sin pareja --- */}
      {!pareja && (
        <section className="mt-6">
          <div className="rounded-2xl border p-5">
            <p className="text-sm font-medium">Vincula tu cuenta</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Vincularse no comparte nada automáticamente. Tú eliges cuenta
              por cuenta qué puede ver la otra persona.
            </p>
            <InvitarPareja />
          </div>

          {(enviadas ?? []).length > 0 && (
            <div className="mt-4 divide-y rounded-2xl border">
              {(enviadas ?? []).map((inv) => (
                <div key={inv.id} className="flex items-center justify-between
                                             gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm">{inv.invitee_email}</p>
                    <p className="text-xs text-muted-foreground">Pendiente</p>
                  </div>
                  <form action={cancelar}>
                    <input type="hidden" name="id" value={inv.id} />
                    <button className="shrink-0 text-xs text-destructive underline">
                      Cancelar
                    </button>
                  </form>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* --- Con pareja --- */}
      {pareja && (
        <>
          <section className="mt-6 rounded-2xl border p-5">
            <p className="text-sm text-muted-foreground">Vinculado con</p>
            <p className="mt-0.5 text-lg font-medium">{pareja.nombre}</p>
          </section>

          <section className="mt-6">
            <h2 className="mb-2 text-xs font-medium uppercase tracking-wide
                           text-muted-foreground">
              Qué compartes
            </h2>
            <div className="divide-y rounded-2xl border">
              {(misCuentas ?? []).map((c) => (
                <div key={c.id} className="flex items-center justify-between
                                           gap-3 px-4 py-3">
                  <span className="truncate text-sm">{c.name}</span>
                  <ToggleVisibilidad id={c.id} visibilidad={c.visibility} />
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Compartida = puede verla, no editarla.
            </p>
          </section>

          <section className="mt-6">
            <h2 className="mb-2 text-xs font-medium uppercase tracking-wide
                           text-muted-foreground">
              Qué comparte contigo
            </h2>
            {(suyas ?? []).length === 0 ? (
              <div className="rounded-2xl border border-dashed p-6 text-center">
                <p className="text-xs text-muted-foreground">
                  Todavía no comparte ninguna cuenta.
                </p>
              </div>
            ) : (
              <div className="divide-y rounded-2xl border">
                {(suyas ?? []).map((c) => (
                  <div key={c.account_id} className="flex items-center
                                                     justify-between gap-3 px-4 py-3">
                    <span className="truncate text-sm">{c.name}</span>
                    <span className="shrink-0 text-sm tabular-nums">
                      {formatearCOP(Number(c.balance))}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <form action={salir} className="mt-8">
            <button className="text-sm text-destructive underline">
              Desvincular
            </button>
          </form>
        </>
      )}
    </main>
  )
}