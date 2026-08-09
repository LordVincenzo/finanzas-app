import Link from 'next/link'
import { Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { formatearCOP } from '@/lib/format'
import { ETIQUETAS_TIPO } from '@/lib/tipos'
import { Seccion, Lista, Fila } from '@/components/seccion'

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
    <main className="px-4 pt-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Cuentas</h1>
          <p className="mt-0.5 text-[13px] text-muted-foreground tabular-nums">
            {formatearCOP(total)}
          </p>
        </div>
        <Link href="/cuentas/nueva" aria-label="Nueva cuenta"
              className="flex size-8 items-center justify-center rounded-full border">
          <Plus className="size-4" />
        </Link>
      </div>

      {cuentas.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed p-6 text-center">
          <p className="text-[13px] text-muted-foreground">
            Aún no tienes cuentas registradas.
          </p>
          <Link href="/cuentas/nueva"
                className="mt-3 inline-block rounded-lg bg-foreground px-3 py-1.5
                           text-[13px] font-medium text-background">
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