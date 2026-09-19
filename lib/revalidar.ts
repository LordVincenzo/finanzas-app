import { revalidatePath } from 'next/cache'

/**
 * Un solo sitio que sabe qué pantallas dependen del ledger.
 *
 * Antes esta lista estaba copiada en cuatro archivos de acciones
 * (movimientos, cuentas, ahorros, prestamos) y en los de escritorio,
 * cada copia con rutas ligeramente distintas. Añadir una pantalla
 * obligaba a acordarse de todas, y olvidarse de una no da ningún error:
 * simplemente se queda con cifras viejas.
 *
 * Como los saldos se derivan del ledger, cualquier escritura puede
 * mover los números de cualquiera de estas pantallas. Revalidarlas
 * todas es más barato que razonar cuál se salva.
 */
const PANTALLAS = [
  // Celular
  '/inicio',
  '/movimientos',
  '/cuentas',
  '/ahorros',
  '/prestamos',
  '/pareja',
  // Escritorio
  '/escritorio',
  '/escritorio/movimientos',
  '/escritorio/cuentas',
  '/escritorio/ahorros',
  '/escritorio/prestamos',
  '/escritorio/estadisticas',
  '/escritorio/pareja',
  '/bandeja',
  '/escritorio/bandeja',
]

/* /escritorio/perfil no está en la lista a propósito: muestra tu nombre,
   tu foto y el tema, nada que dependa del ledger. Las acciones de perfil
   revalidan su propia ruta. */

export function revalidarLedger() {
  for (const pantalla of PANTALLAS) revalidatePath(pantalla)
}

/** El detalle de una meta, en las dos interfaces. */
export function revalidarMeta(id: string) {
  revalidarLedger()
  if (!id) return
  revalidatePath(`/ahorros/${id}`)
  revalidatePath(`/escritorio/ahorros/${id}`)
}

/** El detalle de un préstamo, en las dos interfaces. */
export function revalidarPrestamo(id?: string) {
  revalidarLedger()
  if (!id) return
  revalidatePath(`/prestamos/${id}`)
  revalidatePath(`/escritorio/prestamos/${id}`)
}
