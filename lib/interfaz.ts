/**
 * Las dos interfaces de la app.
 *
 * app/(app) es la de celular y app/escritorio la de pantalla ancha. No
 * son un diseño responsive del mismo árbol de páginas, así que un
 * formulario compartido por las dos tiene que saber a cuál vuelve
 * cuando termina.
 *
 * El origen viaja dentro del formulario, en un campo oculto. Nunca se
 * pasa tal cual a redirect(): se traduce contra RUTAS, y un valor que
 * no reconozcamos cae en la interfaz de celular. Sin esa tabla, un
 * campo oculto manipulado podría mandar a la persona a una URL ajena
 * justo después de guardar algo.
 */

export type Origen = 'celular' | 'escritorio'

export type Seccion =
  | 'inicio'
  | 'movimientos'
  | 'cuentas'
  | 'ahorros'
  | 'prestamos'
  | 'pareja'
  | 'perfil'

const RUTAS: Record<Origen, Record<Seccion, string>> = {
  celular: {
    inicio:      '/inicio',
    movimientos: '/movimientos',
    cuentas:     '/cuentas',
    ahorros:     '/ahorros',
    prestamos:   '/prestamos',
    pareja:      '/pareja',
    // En el celular los ajustes viven dentro de /mas, que además lleva
    // los atajos de navegación; en escritorio esa navegación la hace el
    // sidebar, así que la pantalla es solo el perfil.
    perfil:      '/mas',
  },
  escritorio: {
    inicio:      '/escritorio',
    movimientos: '/escritorio/movimientos',
    cuentas:     '/escritorio/cuentas',
    ahorros:     '/escritorio/ahorros',
    prestamos:   '/escritorio/prestamos',
    pareja:      '/escritorio/pareja',
    perfil:      '/escritorio/perfil',
  },
}

/** Lee el campo oculto del formulario. Cualquier cosa rara -> celular. */
export function leerOrigen(valor: FormDataEntryValue | null | undefined): Origen {
  return valor === 'escritorio' ? 'escritorio' : 'celular'
}

export function rutaDe(origen: Origen, seccion: Seccion): string {
  return RUTAS[origen][seccion]
}
