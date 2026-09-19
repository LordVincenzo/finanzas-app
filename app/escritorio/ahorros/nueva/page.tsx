import { createClient, requerirUsuario } from '@/lib/supabase/server'
import { FormularioMeta } from '@/components/formulario-meta'
import { PaginaFormulario } from '@/components/pagina-escritorio'

export default async function NuevaMetaEscritorioPage() {
  const supabase = await createClient()
  const user = await requerirUsuario(supabase)

  // Sin pareja vinculada, el formulario no ofrece las visibilidades
  // compartida y conjunta: prometerían algo que el RPC rechazaría.
  const { data: membresia } = await supabase
    .from('couple_members')
    .select('couple_id')
    .eq('profile_id', user.id)
    .eq('status', 'active')
    .maybeSingle()

  return (
    <PaginaFormulario
      volverA="/escritorio/ahorros"
      volverTexto="Ahorros"
      titulo="Nueva meta"
      ayuda="Una meta reserva dinero que ya tienes; no lo mueve de tus cuentas."
    >
      <FormularioMeta tienePareja={Boolean(membresia)} origen="escritorio" />
    </PaginaFormulario>
  )
}
