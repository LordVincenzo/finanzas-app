/**
 * Los préstamos, agrupados por persona.
 *
 * EL PROBLEMA. Cada préstamo crea su propia cuenta "Por cobrar: X", y
 * si le prestas tres veces a la misma persona salen "Por cobrar:
 * Jinete", "(2)" y "(3)". La pantalla los listaba uno debajo de otro,
 * mezclados con los ya saldados, así que prestarle seguido a las mismas
 * personas —que es lo normal— convertía la lista en un archivo
 * histórico en vez de en la respuesta a "¿quién me debe?".
 *
 * NO SE TOCA EL LEDGER. Un préstamo es un préstamo: tiene su fecha, su
 * monto, sus cuotas y su cuenta. Fusionarlos en la base sería perder
 * esa información y reescribir movimientos ya registrados. Lo que se
 * agrupa es lo que se ENSEÑA.
 *
 * UN SOLO SITIO. Lo usan la pantalla del celular y la del escritorio.
 * Si el criterio de "misma persona" o de "ya saldado" viviera en las
 * dos, un día dirían cosas distintas — y de ahí salieron cuatro bugs de
 * este proyecto.
 */

export type PrestamoFila = {
  id: string
  person_name: string
  principal: number
  loan_date: string
  status: string
  pagado: number
  pendiente: number
  cuotas_total: number
  cuotas_pagadas: number
  cuotas_vencidas: number
  proxima_fecha: string | null
}

export type PersonaPrestamos = {
  /** Nombre normalizado. Sirve de key y de criterio de agrupación. */
  clave: string
  /** El nombre tal como se escribió la última vez. */
  nombre: string
  /** Sus préstamos, del más reciente al más viejo. */
  prestamos: PrestamoFila[]
  prestado: number
  pagado: number
  pendiente: number
  vencidas: number
  proxima_fecha: string | null
  /** Ya no debe nada. */
  saldado: boolean
}

/**
 * "Jinete", "jinete" y " Jinete " son la misma persona.
 *
 * No se intenta nada más listo que eso: "Tia moni" y "Tía Moni" se
 * quedan separadas. Adivinar que dos nombres parecidos son el mismo
 * humano y juntarles el dinero es peor que dejarlos aparte — uno se
 * arregla escribiendo igual, el otro enseña una deuda que no existe.
 */
function normalizar(nombre: string): string {
  return nombre.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function agruparPorPersona(filas: PrestamoFila[]): PersonaPrestamos[] {
  const mapa = new Map<string, PersonaPrestamos>()

  for (const p of filas) {
    const clave = normalizar(p.person_name)
    let persona = mapa.get(clave)

    if (!persona) {
      persona = {
        clave,
        nombre: p.person_name.trim(),
        prestamos: [],
        prestado: 0,
        pagado: 0,
        pendiente: 0,
        vencidas: 0,
        proxima_fecha: null,
        saldado: true,
      }
      mapa.set(clave, persona)
    }

    persona.prestamos.push(p)
    persona.prestado += Number(p.principal)
    persona.pagado += Number(p.pagado)
    persona.pendiente += Number(p.pendiente)
    persona.vencidas += Number(p.cuotas_vencidas ?? 0)

    /* La próxima fecha de la persona es la más cercana de todas sus
       deudas vivas. La de un préstamo ya pagado no vence nunca más. */
    if (p.status === 'active' && p.proxima_fecha) {
      if (!persona.proxima_fecha || p.proxima_fecha < persona.proxima_fecha) {
        persona.proxima_fecha = p.proxima_fecha
      }
    }
  }

  for (const persona of mapa.values()) {
    /* Saldado es "no debe ni un peso", no "todos sus préstamos están
       marcados como pagados": un abono parcial en un préstamo nuevo
       tiene que sacarla de los saldados aunque el viejo esté cerrado. */
    persona.saldado = persona.pendiente <= 0
    persona.prestamos.sort((a, b) => b.loan_date.localeCompare(a.loan_date))
    /* El nombre que se enseña es el del préstamo más reciente: si lo
       escribiste mejor la última vez, esa es la que vale. */
    persona.nombre = persona.prestamos[0].person_name.trim()
  }

  return [...mapa.values()].sort((a, b) => {
    /* Primero quien más debe. Entre saldados, el más reciente. */
    if (a.pendiente !== b.pendiente) return b.pendiente - a.pendiente
    return b.prestamos[0].loan_date.localeCompare(a.prestamos[0].loan_date)
  })
}

/** Las que todavía deben, y las que ya no. */
export function separarSaldados(personas: PersonaPrestamos[]) {
  return {
    deben: personas.filter((p) => !p.saldado),
    saldados: personas.filter((p) => p.saldado),
  }
}
