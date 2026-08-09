import Link from 'next/link'
import { Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { formatearCOP } from '@/lib/format'
import { ETIQUETAS_TIPO } from '@/lib/tipos'
import { Seccion, Lista, Fila } from '@/components/seccion'

type CuentaFila = {
  account_id: string
  name: string
  type: string
  class: string
  balance: number
}

/** Cuentas cuyo dinero puedes mover hoy. Las "por cobrar" no entran. */
const LIQUIDAS = ['checking', 'savings', 'cash', 'digital_wallet', 'investment', 'other']

export default async function CuentasPage() {
  const supabase = await createClient()

  const { data } = await supabase
    .from('account_balances')
    .select('account_id, name, type, class, balance')
    .in('class', ['asset', 'liability'])
    .eq('is_active', true)
    .order('name')

  const cuentas = (data ?? []) as CuentaFila[]

  const disponible = cuentas
    .filter((c) => LIQUIDAS.includes(c.type))
    .reduce((s, c) => s + Number(c.balance), 0)

  const porCobrar = cuentas
    .filter((c) => c.type === 'receivable' || c.type === 'partner_receivable')
    .reduce((s, c) => s + Number(c.balance), 0)

  const patrimonio = cuentas.reduce((s, c) => s + Number(c.balance), 0)

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

  return (
    <main className="px-4 pt-6">
      <div className="flex items-start justify-between gap-3">
        <h1 className="text-xl font-semibold">Cuentas</h1>
        <Link href="/cuentas/nueva" aria-label="Nueva cuenta"
              className="flex size-8 items-center justify-center rounded-full border">
          <Plus className="size-4" />
        </Link>
      </div>

      {cuentas.length > 0 && (
        <>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-xl border p-3">
              <p className="text-[12px] text-muted-foreground">Disponible</p>
              <p className="mt-0.5 text-[17px] font-medium tabular-nums">
                {formatearCOP(disponible)}
              </p>
            </div>
            <div className="rounded-xl border p-3">
              <p className="text-[12px] text-muted-foreground">Por cobrar</p>
              <p className="mt-0.5 text-[17px] font-medium tabular-nums">
                {formatearCOP(porCobrar)}
              </p>
            </div>
          </div>

          <p className="mt-2 px-1 text-[12px] text-muted-foreground tabular-nums">
            Patrimonio: {formatearCOP(patrimonio)}
          </p>
        </>
      )}

      {cuentas.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed p-6 text-center">
          <p className="text-[14px] text-muted-foreground">
            Aún no tienes cuentas registradas.
          </p>
          <Link href="/cuentas/nueva"
                className="mt-3 inline-block rounded-lg bg-foreground px-3 py-1.5
                           text-[14px] font-medium text-background">
            Crear la primera
          </Link>
        </div>
      ) : (
        [...grupos.entries()].map(([tipo, lista]) => (
          <Seccion key={tipo} titulo={ETIQUETAS_TIPO[tipo] ?? 'Otras'}>
            <Lista>
              {lista.map((c) => (
                <Fila
                  key={c.account_id}
                  titulo={c.name}
                  valor={formatearCOP(Number(c.balance))}
                />
              ))}
            </Lista>
          </Seccion>
        ))
      )}
    </main>
  )
}