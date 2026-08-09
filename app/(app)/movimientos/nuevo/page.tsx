import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { FormularioMovimiento } from '@/components/formulario-movimiento'

/** "2026-08-09T12:32" en hora de Bogotá, para el valor por defecto. */
function ahoraEnBogota(): string {
  const partes = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Bogota',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date())
  return partes.replace(' ', 'T')
}

export default async function NuevoMovimientoPage() {
  const supabase = await createClient()

  const { data } = await supabase
    .from('accounts')
    .select('id, name, class')
    .eq('is_active', true)
    .eq('is_opening', false)
    .order('name')

  const todas = data ?? []
  const cuentas = todas.filter((a) => a.class === 'asset' || a.class === 'liability')
  const categoriasGasto = todas.filter((a) => a.class === 'expense')
  const categoriasIngreso = todas.filter((a) => a.class === 'income')

  if (cuentas.length === 0) {
    return (
      <main className="px-5 pt-8">
        <h1 className="text-2xl font-semibold">Registrar movimiento</h1>
        <div className="mt-8 rounded-2xl border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Primero necesitas al menos una cuenta.
          </p>
          <Link
            href="/cuentas/nueva"
            className="mt-4 inline-block rounded-lg bg-foreground px-4 py-2
                       text-sm font-medium text-background"
          >
            Crear una cuenta
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="px-5 pt-6">
      <Link
        href="/movimientos"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground"
      >
        <ChevronLeft className="size-4" /> Movimientos
      </Link>

      <h1 className="mt-4 text-2xl font-semibold">Registrar movimiento</h1>

      <FormularioMovimiento
        cuentas={cuentas}
        categoriasGasto={categoriasGasto}
        categoriasIngreso={categoriasIngreso}
        ahora={ahoraEnBogota()}
      />
    </main>
  )
}