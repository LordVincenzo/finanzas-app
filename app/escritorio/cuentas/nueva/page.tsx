import { FormularioCuenta } from '@/components/formulario-cuenta'
import { PaginaFormulario } from '@/components/pagina-escritorio'

/**
 * Antes el enlace "Nueva cuenta" de /escritorio/cuentas apuntaba a
 * /cuentas/nueva, que vive en app/(app): en una pantalla de 1400px te
 * aparecía de golpe la columna estrecha del celular con la barra
 * flotante de abajo. Esta pantalla es la misma operación en la
 * interfaz que le corresponde.
 */
export default function NuevaCuentaEscritorioPage() {
  return (
    <PaginaFormulario
      volverA="/escritorio/cuentas"
      volverTexto="Cuentas"
      titulo="Nueva cuenta"
      ayuda="Registra dónde tienes tu dinero hoy y con cuánto."
    >
      <FormularioCuenta origen="escritorio" />
    </PaginaFormulario>
  )
}
