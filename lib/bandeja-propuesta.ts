import type { MensajeBandeja, Opcion } from '@/lib/datos-bandeja'

/**
 * Qué propone la bandeja para un mensaje, antes de que nadie toque nada.
 *
 * UN SOLO SITIO. Lo usan tres cosas que tienen que estar de acuerdo:
 *
 *   - La fila, para decidir si enseña el resumen de un toque o abre el
 *     formulario.
 *   - El botón de «confirmar todas», para saber cuáles puede.
 *   - La acción del servidor de ese botón, que vuelve a calcularlo y no
 *     se fía de lo que llegue del cliente.
 *
 * Si esto viviera dentro del componente, la tercera no podría usarlo —
 * es un Server Component— y acabaría siendo una copia. Cuatro bugs de
 * este proyecto salieron de justo eso.
 */

export type Propuesta = {
  tipo: 'expense' | 'income' | 'transfer'
  /** Los dos avisos son el mismo movimiento: se confirman juntos. */
  esPareja: boolean
  monto: number
  /** La cuenta del banco que avisó. */
  cuenta: string
  /** La categoría, o la otra cuenta si es un traslado. */
  contraparte: string
  descripcion: string
}

/** Lo que se propone aunque falten piezas. `completa` dice si se puede
 *  confirmar sin preguntar nada. */
export type Borrador = {
  tipo: 'expense' | 'income' | 'transfer'
  esPareja: boolean
  contraparte: string
  descripcion: string
  completa: boolean
}

function nombreDe(id: string | null, lista: Opcion[]): string | null {
  if (!id) return null
  return lista.find((c) => c.id === id)?.name ?? null
}

/**
 * El borrador con el que se dibuja la fila.
 *
 * `esPareja` arranca en true cuando hay pareja: dos avisos del mismo
 * importe en sentidos contrarios y en apps distintas son, casi siempre,
 * un traslado entre cuentas propias. Pero es una PROPUESTA — la fila
 * pregunta, porque confirmarlo solo sería la suposición silenciosa que
 * esta bandeja existe para evitar.
 */
export function borradorDe(
  m: MensajeBandeja,
  cuentas: Opcion[],
  categoriasGasto: Opcion[],
  categoriasIngreso: Opcion[],
  /** Para recalcular cuando la persona cambia el tipo o deshace la
   *  pareja en la pantalla. Sin esto, el valor de arranque. */
  forzar?: { tipo?: string; esPareja?: boolean },
): Borrador {
  const esPareja = forzar?.esPareja
    ?? Boolean(m.pareja_id && m.pareja_texto)

  const tipoBase = forzar?.tipo
    ?? (m.direccion === 'entrada' ? 'income' : 'expense')

  // Tratarlos como uno solo obliga al tipo: es un traslado entre dos
  // cuentas tuyas, no un gasto ni un ingreso.
  const tipo = (esPareja ? 'transfer' : tipoBase) as Borrador['tipo']

  const contraparte = tipo === 'transfer'
    ? (m.pareja_cuenta_id ?? '')
    : (m.categoria_id ?? '')

  const listaContra = tipo === 'transfer'
    ? cuentas
    : tipo === 'income' ? categoriasIngreso : categoriasGasto

  const nombreCuenta = nombreDe(m.cuenta_id, cuentas)
  const nombreContra = nombreDe(contraparte || null, listaContra)

  /* La descripción venía del comercio, y en un traslado no hay
     comercio: el campo salía vacío y era obligatorio, así que el
     movimiento más frecuente obligaba a teclear algo aunque todo lo
     demás estuviera resuelto. */
  const descripcion =
    m.comercio?.trim()
    || (tipo === 'transfer' && nombreCuenta && nombreContra
          ? `De ${nombreCuenta} a ${nombreContra}`
          : '')
    || (nombreContra ?? '')

  return {
    tipo,
    esPareja,
    contraparte,
    descripcion,
    completa: Boolean(
      m.monto && m.cuenta_id && contraparte && descripcion
      // Un traslado de una cuenta a sí misma no existe, y el servidor
      // lo rechaza. Mejor abrir el formulario que ofrecer un botón que
      // va a fallar.
      && !(tipo === 'transfer' && m.cuenta_id === contraparte)
    ),
  }
}

/**
 * La propuesta cerrada, o null si falta algo.
 *
 * Es lo que usa el botón de confirmar varias: solo entran los mensajes
 * de los que no hay nada que preguntar.
 */
export function propuestaDe(
  m: MensajeBandeja,
  cuentas: Opcion[],
  categoriasGasto: Opcion[],
  categoriasIngreso: Opcion[],
): Propuesta | null {
  const b = borradorDe(m, cuentas, categoriasGasto, categoriasIngreso)
  if (!b.completa) return null

  return {
    tipo: b.tipo,
    esPareja: b.esPareja,
    monto: m.monto!,
    cuenta: m.cuenta_id!,
    contraparte: b.contraparte,
    descripcion: b.descripcion,
  }
}
