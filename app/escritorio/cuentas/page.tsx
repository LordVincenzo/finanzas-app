import Link from 'next/link'
import { Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { formatearCOP } from '@/lib/format'
import { ETIQUETAS_TIPO, ORDEN_TIPOS_CUENTA, cuentaVisible } from '@/lib/tipos'
import { SaldoEditable } from '@/components/saldo-editable'

type CuentaFila = {
  account_id: string
  name: string
  type: string
  class: string
  balance: number
}

// Cuentas gobernadas por otro flujo (Préstamos, Pareja): se ven en su
// propio bloque, de "Por cobrar", y su saldo no se edita aquí para no
// pasar por encima de ese seguimiento.
const TIPOS_POR_COBRAR = ['receivable', 'partner_receivable']

export default async function CuentasEscritorioPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data }, { data: resumen }, { data: patri }] = await Promise.all([
    supabase.from('account_balances')
      .select('account_id, name, type, class, balance')
      .in('class', ['asset', 'liability'])
      .eq('is_active', true)
      .order('name'),
    // Misma vista que usan Inicio, Cuentas y Ahorros del celular: es la
    // fuente única del "disponible" (ver CLAUDE.md). account_id permite
    // además avisar, cuenta por cuenta, cuánto de su saldo ya está
    // reservado en una meta.
    supabase.from('cuentas_disponible')
      .select('account_id, saldo, asignado, disponible').eq('owner_id', user!.id),
    supabase.from('patrimonio_detalle')
      .select('por_cobrar').eq('owner_id', user!.id).maybeSingle(),
  ])

  const cuentas = (data ?? []) as CuentaFila[]
  const visibles = cuentas.filter((c) => cuentaVisible(c.type, Number(c.balance)))

  const filas = resumen ?? []
  const disponible = filas.reduce((s, c) => s + Number(c.disponible), 0)
  const asignado = filas.reduce((s, c) => s + Number(c.asignado), 0)
  const porCobrar = Number(patri?.por_cobrar ?? 0)
  const asignadoPorCuenta = new Map(filas.map((c) => [c.account_id, Number(c.asignado)]))

  const grupos = new Map<string, CuentaFila[]>()
  for (const c of visibles) {
    const lista = grupos.get(c.type) ?? []
    lista.push(c)
    grupos.set(c.type, lista)
  }
  const ordenados = [...grupos.entries()].sort((a, b) => {
    const ia = ORDEN_TIPOS_CUENTA.indexOf(a[0])
    const ib = ORDEN_TIPOS_CUENTA.indexOf(b[0])
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
  })

  // Dos bloques, no una sola tabla larga: mezclar dinero que tienes con
  // dinero que te deben hacía parecer que había muchas más cuentas de
  // las que en verdad hay.
  const cuentasDinero = ordenados.filter(([tipo]) => !TIPOS_POR_COBRAR.includes(tipo))
  const cuentasPorCobrar = ordenados.filter(([tipo]) => TIPOS_POR_COBRAR.includes(tipo))

  return (
    <div className="mx-auto max-w-[1400px] px-8 py-10">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight">Cuentas</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Clic sobre un saldo para ajustarlo.
          </p>
        </div>
        <Link href="/cuentas/nueva"
              className="flex h-9 items-center gap-1.5 rounded-full bg-primary
                         px-4 text-[13px] font-medium text-primary-foreground
                         shadow-card transition hover:opacity-90">
          <Plus className="size-4" /> Nueva cuenta
        </Link>
      </div>

      {cuentas.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-border px-6 py-12 text-center">
          <p className="text-[15px] font-medium">Aún no tienes cuentas</p>
          <p className="mx-auto mt-1.5 max-w-[40ch] text-[13px] text-muted-foreground">
            Registra dónde tienes tu dinero hoy: Nu, Nequi, efectivo, lo que uses.
          </p>
          <Link href="/cuentas/nueva"
                className="mt-4 inline-flex h-11 items-center rounded-xl bg-primary
                           px-5 text-[14px] font-medium text-primary-foreground shadow-card">
            Crear la primera
          </Link>
        </div>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-3 gap-4">
            <TarjetaResumen etiqueta="Disponible" valor={formatearCOP(disponible)} />
            <TarjetaResumen etiqueta="Comprometido en metas" valor={formatearCOP(asignado)} />
            <TarjetaResumen etiqueta="Por cobrar" valor={formatearCOP(porCobrar)} />
          </div>

          {cuentasDinero.length > 0 && (
            <section className="mt-8">
              <h2 className="px-1 text-[13px] font-semibold">Tus cuentas</h2>
              <BloqueCuentas grupos={cuentasDinero} asignadoPorCuenta={asignadoPorCuenta} editable />
            </section>
          )}

          {cuentasPorCobrar.length > 0 && (
            <section className="mt-8">
              <h2 className="px-1 text-[13px] font-semibold">Por cobrar</h2>
              <p className="px-1 text-[12px] text-muted-foreground">
                Dinero que te deben, no dinero que tienes hoy.
              </p>
              <div className="mt-3">
                <BloqueCuentas grupos={cuentasPorCobrar} asignadoPorCuenta={asignadoPorCuenta} editable={false} />
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}

function BloqueCuentas({
  grupos, asignadoPorCuenta, editable,
}: {
  grupos: [string, CuentaFila[]][]
  asignadoPorCuenta: Map<string, number>
  editable: boolean
}) {
  return (
    <div className="mt-3 overflow-hidden rounded-2xl bg-card shadow-card ring-1 ring-border/70">
      {grupos.map(([tipo, lista], i) => (
        <div key={tipo} className={i > 0 ? 'border-t border-border/70' : ''}>
          <p className="px-5 pt-4 text-[11px] font-semibold uppercase
                        tracking-[0.09em] text-muted-foreground">
            {ETIQUETAS_TIPO[tipo] ?? 'Otras'}
          </p>
          <div className="divide-y divide-border/70">
            {lista.map((c) => {
              const enMetas = asignadoPorCuenta.get(c.account_id) ?? 0
              return (
                <div key={c.account_id}
                     className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-[14px]">
                      {nombreCorto(c.name, c.type)}
                    </p>
                    {/* Sin esto, "$1.612.200" en Nu parece todo
                        disponible aunque una meta ya se haya quedado
                        con una parte. */}
                    {enMetas > 0 && (
                      <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
                        {formatearCOP(enMetas)} en metas
                      </p>
                    )}
                  </div>
                  {editable ? (
                    <span className="text-[14px] font-medium">
                      <SaldoEditable
                        cuentaId={c.account_id}
                        disponible={Number(c.balance) - enMetas}
                        asignado={enMetas}
                      />
                    </span>
                  ) : (
                    <span className="px-2 py-1 text-[14px] font-medium tabular-nums">
                      {formatearCOP(Number(c.balance))}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
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

/**
 * "Por cobrar: Abuela" bajo un grupo ya titulado "Por cobrar" repite la
 * palabra. El nombre completo se conserva en la base de datos.
 */
function nombreCorto(nombre: string, tipo: string): string {
  if (tipo !== 'receivable') return nombre
  return nombre.replace(/^por cobrar:\s*/i, '') || nombre
}
