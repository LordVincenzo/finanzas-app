import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { createClient, requerirUsuario } from '@/lib/supabase/server'
import { FormularioPrestamo } from '@/components/formulario-prestamo'

function hoyEnBogota(): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Bogota',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
}

export default async function NuevoPrestamoPage() {
  const supabase = await createClient()
  const user = await requerirUsuario(supabase)

  const { data: disponibles } = await supabase
    .from('accounts')
    .select('id, name, type')
    .eq('owner_id', user.id)
    .eq('class', 'asset')
    .eq('is_active', true)
    // "Pendiente de ubicar": primero se ubica, luego se presta.
    .eq('is_pending_location', false)
    .neq('type', 'receivable')
    .order('name')

  return (
    <main className="px-5 pt-6">
      <Link href="/prestamos"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground">
        <ChevronLeft className="size-4" /> Préstamos
      </Link>

      <h1 className="mt-4 text-2xl font-semibold">Nuevo préstamo</h1>

      <FormularioPrestamo cuentas={disponibles ?? []} hoy={hoyEnBogota()} />
    </main>
  )
}