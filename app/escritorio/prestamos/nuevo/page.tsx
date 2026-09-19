import { createClient, requerirUsuario } from '@/lib/supabase/server'
import { hoyBogota } from '@/lib/format'
import { FormularioPrestamo } from '@/components/formulario-prestamo'
import { PaginaFormulario } from '@/components/pagina-escritorio'

export default async function NuevoPrestamoEscritorioPage() {
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
    <PaginaFormulario
      volverA="/escritorio/prestamos"
      volverTexto="Préstamos"
      titulo="Nuevo préstamo"
      ayuda="El dinero sale de tu cuenta y pasa a «por cobrar». Tu patrimonio no cambia."
    >
      <FormularioPrestamo
        cuentas={disponibles ?? []}
        hoy={hoyBogota()}
        origen="escritorio"
      />
    </PaginaFormulario>
  )
}
