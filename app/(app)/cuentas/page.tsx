import Link from 'next/link'
import { Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { formatearCOP } from '@/lib/format'
import { ETIQUETAS_TIPO } from '@/lib/tipos'

type Fila = {
  account_id: string
  name: string
  type: string
  balance: number
}

export default async function CuentasPage() {
  const supabase = await createClient()

  // Leemos de la VISTA: los saldos se calculan, no se almacenan.
  const { data } = await supabase
    .from('account_balances')
    .select('account_id, name, type, balance')
    .in('class', ['asset', 'liability'])
    .eq('is_active', true)
    .order('name')

  const cuentas = (data ?? []) as Fila[]
  const total = cuentas.reduce((suma, c) => suma + Number(c.balance), 0)

  // Agrupamos por tipo para que el listado no sea una lista plana.
  const grupos = new Map<string, Fila[]>()
  for (const c of cuentas) {
    const lista = grupos.get(c.type) ?? []
    lista.push(c)
    grupos.set(c.type, lista)
  }

  return (
    <main className="px-5 pt-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Cuentas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Total: <span className="tabular-nums">{formatearCOP(total)}</span>
          </p>
        </div>
        <Link
          href="/cuentas/nueva"
          aria-label="Nueva cuenta"
          className="flex size-10 items-center justify-center rounded-full border"
        >
          <Plus className="size-5" />
        </Link>
      </div>

      {cuentas.length === 0 ? (
        <div className="mt-12 rounded-2xl border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Aún no tienes cuentas registradas.
          </p>
          <Link
            href="/cuentas/nueva"
            className="mt-4 inline-block rounded-lg bg-foreground px-4 py-2
                       text-sm font-medium text-background"
          >
            Crear la primera
          </Link>
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {[...grupos.entries()].map(([tipo, lista]) => (
            <section key={tipo}>
              <h2 className="mb-2 text-xs font-medium uppercase tracking-wide
                             text-muted-foreground">
                {ETIQUETAS_TIPO[tipo] ?? 'Otras'}
              </h2>
              <div className="divide-y rounded-2xl border">
                {lista.map((c) => (
                  <div key={c.account_id} className="flex items-center
                                                     justify-between gap-3 px-4 py-3.5">
                    <span className="truncate text-sm">{c.name}</span>
                    <span className="text-sm font-medium tabular-nums">
                      {formatearCOP(Number(c.balance))}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  )
}