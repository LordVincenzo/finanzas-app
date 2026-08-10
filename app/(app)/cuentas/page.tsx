import Link from 'next/link'
import { Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { formatearCOP } from '@/lib/format'
import { ETIQUETAS_TIPO } from '@/lib/tipos'
import { Seccion, Lista, Fila, Monto } from '@/components/seccion'

type CuentaFila = {
  account_id: string
  name: string
  type: string
  class: string
  balance: number
}

/**
 * Orden en que se muestran los grupos.
 * Antes salía del orden alfabético de las cuentas, así que crear una
 * cuenta nueva podía reordenar la pantalla entera.
 */
const ORDEN_TIPOS = [
  'digital_wallet', 'checking', 'savings', 'cash', 'investment', 'other',
  'credit_card', 'debt', 'receivable', 'partner_receivable',
]

export default async function CuentasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data }, { data: resumen }, { data: patri }] = await Promise.all([
    supabase.from('account_balances')
      .select('account_id, name, type, class, balance')
      .in('class', ['asset', 'liability'])
      .eq('is_active', true)
      .order('name'),
    // Antes esta pantalla sumaba el disponible por su cuenta y daba un
    // número distinto al de Inicio y Ahorros. La vista es la fuente
    // única: ya sabe qué cuentas cuentan y cuánto está comprometido.
    supabase.from('cuentas_disponible')
      .select('saldo, asignado, disponible').eq('owner_id', user!.id),
    supabase.from('patrimonio_detalle')
      .select('por_cobrar, patrimonio')
      .eq('owner_id', user!.id).maybeSingle(),
  ])

  const cuentas = (data ?? []) as CuentaFila[]

  const filas = resumen ?? []
  const enCuentas = filas.reduce((s, c) => s + Number(c.saldo), 0)
  const comprometido = filas.reduce((s, c) => s + Number(c.asignado), 0)
  const libre = filas.reduce((s, c) => s + Number(c.disponible), 0)

  const porCobrar = Number(patri?.por_cobrar ?? 0)
  const patrimonio = Number(patri?.patrimonio ?? 0)

  // Una cuenta por cobrar en cero ya no dice nada: la ocultamos.
  const visibles = cuentas.filter(
    (c) => !(
      (c.type === 'receivable' || c.type === 'partner_receivable') &&
      Number(c.balance) === 0
    )
  )

  const grupos = new Map<string, CuentaFila[]>()
  for (const c of visibles) {
    const lista = grupos.get(c.type) ?? []
    lista.push(c)
    grupos.set(c.type, lista)
  }

  const ordenados = [...grupos.entries()].sort((a, b) => {
    const ia = ORDEN_TIPOS.indexOf(a[0])
    const ib = ORDEN_TIPOS.indexOf(b[0])
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
  })

  return (
    <main className="px-4 pb-28 pt-4">
      <div className="flex items-center justify-between gap-3 px-1">
        <h1 className="text-[22px] font-semibold tracking-tight">Cuentas</h1>
        <Link href="/cuentas/nueva" aria-label="Nueva cuenta"
              className="flex size-10 items-center justify-center rounded-full
                         bg-card shadow-card ring-1 ring-border/70 transition
                         active:scale-95">
          <Plus className="size-[18px]" />
        </Link>
      </div>

      {cuentas.length > 0 && (
        <section className="mt-3 overflow-hidden rounded-2xl bg-card
                            shadow-elevada ring-1 ring-border/70">
          <div className="grid grid-cols-2 divide-x divide-border/70">
            <Resumen
              etiqueta="Disponible"
              valor={libre}
              nota={comprometido > 0
                ? `+ ${formatearCOP(comprometido)} en metas`
                : undefined}
            />
            <Resumen etiqueta="Por cobrar" valor={porCobrar} />
          </div>
          <div className="flex items-center justify-between
                          border-t border-border/70 px-4 py-2.5">
            <span className="text-[12px] text-muted-foreground">Patrimonio</span>
            <span className="text-[14px] font-medium tabular-nums">
              {formatearCOP(patrimonio)}
            </span>
          </div>
        </section>
      )}

      {cuentas.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-border
                        px-5 py-7 text-center">
          <p className="text-[15px] font-medium">Aún no tienes cuentas</p>
          <p className="mx-auto mt-1.5 max-w-[28ch] text-[13px] leading-snug
                        text-muted-foreground">
            Registra dónde tienes tu dinero hoy: Nu, Nequi, efectivo, lo
            que uses.
          </p>
          <Link href="/cuentas/nueva"
                className="mt-4 inline-flex min-h-11 items-center rounded-xl
                           bg-primary px-5 text-[14px] font-medium
                           text-primary-foreground shadow-card">
            Crear la primera
          </Link>
        </div>
      ) : (
        ordenados.map(([tipo, lista]) => (
          <Seccion key={tipo} titulo={ETIQUETAS_TIPO[tipo] ?? 'Otras'}>
            <Lista>
              {lista.map((c) => (
                <Fila
                  key={c.account_id}
                  titulo={nombreCorto(c.name, tipo)}
                  valor={
                    <Monto
                      valor={Number(c.balance)}
                      tono={Number(c.balance) < 0 ? 'negativo' : 'neutro'}
                      formato={formatearCOP}
                    />
                  }
                />
              ))}
            </Lista>
          </Seccion>
        ))
      )}

      {comprometido > 0 && (
        <p className="mt-5 px-1 text-[12px] leading-snug text-muted-foreground">
          De {formatearCOP(enCuentas)} en tus cuentas,{' '}
          {formatearCOP(comprometido)} están reservados para metas de ahorro.
        </p>
      )}
    </main>
  )
}

/**
 * "Por cobrar: Abuela" bajo un grupo titulado "Por cobrar" repite la
 * palabra en cada línea. El nombre completo se conserva en la base de
 * datos, donde sí hace falta el contexto.
 */
function nombreCorto(nombre: string, tipo: string): string {
  if (tipo !== 'receivable') return nombre
  return nombre.replace(/^por cobrar:\s*/i, '') || nombre
}

function Resumen({
  etiqueta, valor, nota,
}: {
  etiqueta: string
  valor: number
  nota?: string
}) {
  return (
    <div className="px-4 py-3">
      <p className="text-[12px] text-muted-foreground">{etiqueta}</p>
      <p className="mt-0.5 text-[18px] font-medium tabular-nums">
        {formatearCOP(valor)}
      </p>
      {nota && (
        <p className="mt-1 text-[11px] leading-snug text-muted-foreground
                      tabular-nums">
          {nota}
        </p>
      )}
    </div>
  )
}