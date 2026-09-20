/**
 * Utilidades de dinero.
 *
 * REGLA: internamente el dinero SIEMPRE es un entero de pesos.
 * 20000 significa $20.000. Nunca usamos decimales en cálculos.
 */

/** 20000 -> "$20.000" */
export function formatearCOP(pesos: number): string {
  const signo = pesos < 0 ? '-' : ''
  const absoluto = Math.abs(Math.round(pesos))
  return `${signo}$${new Intl.NumberFormat('es-CO').format(absoluto)}`
}

/** 20000 -> "$20.000"  ·  1250000 -> "$1,25 M" */
export function formatearCOPCompacto(pesos: number): string {
  const absoluto = Math.abs(pesos)
  if (absoluto < 1_000_000) return formatearCOP(pesos)
  const signo = pesos < 0 ? '-' : ''
  const millones = (absoluto / 1_000_000).toFixed(2).replace('.', ',')
  return `${signo}$${millones} M`
}

/**
 * Convierte lo que escribe la persona en un entero de pesos.
 * Acepta "20.000", "20000", "$20.000", "20k", "1,5m".
 */
export function parsearCOP(entrada: string): number | null {
  const texto = entrada.trim().toLowerCase().replace(/[$\s]/g, '')
  if (!texto) return null

  const atajo = texto.match(/^([\d.,]+)(k|m)$/)
  if (atajo) {
    const base = Number(atajo[1].replace(/\./g, '').replace(',', '.'))
    if (Number.isNaN(base)) return null
    return Math.round(base * (atajo[2] === 'k' ? 1_000 : 1_000_000))
  }

  const limpio = texto.replace(/\./g, '').replace(',', '.')
  const valor = Number(limpio)
  if (Number.isNaN(valor)) return null
  return Math.round(valor)
}

/** "9 de agosto de 2026" */
export function formatearFecha(fecha: string | Date): string {
  const d = typeof fecha === 'string' ? new Date(fecha + 'T12:00:00') : fecha
  return new Intl.DateTimeFormat('es-CO', {
    day: 'numeric', month: 'long', year: 'numeric',
    timeZone: 'America/Bogota',
  }).format(d)
}

/** "2026-09-19" — el día de hoy en Bogotá.
 *
 *  Con Intl y no con toISOString(): este último da UTC, y a las 8 de
 *  la noche en Bogotá UTC ya es el día siguiente. Una meta que vence
 *  hoy se daría por vencida cinco horas antes de tiempo. */
export function hoyEnBogota(): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Bogota',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
}

/** "2026-03" — el mes actual en Bogotá, para agrupar por mes. */
export function mesActualBogota(): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Bogota', year: 'numeric', month: '2-digit',
  }).format(new Date()).slice(0, 7)
}

/** "2026-03-26" — el día de hoy en Bogotá, mismo formato que `occurred_on`. */
export function hoyBogota(): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
}

/** "2026-03", 2 -> "2026-01". Para listar los últimos N meses. */
export function restarMeses(mes: string, n: number): string {
  const [anio, m] = mes.split('-').map(Number)
  const fecha = new Date(Date.UTC(anio, m - 1 - n, 1))
  return `${fecha.getUTCFullYear()}-${String(fecha.getUTCMonth() + 1).padStart(2, '0')}`
}

/** "2026-03" -> "mar" */
export function etiquetaMesCorta(mes: string): string {
  const [anio, m] = mes.split('-').map(Number)
  // Día 15: cualquier día del mes sirve, pero uno a mitad de mes evita
  // que un huso horario raro lo empuje al mes anterior o siguiente.
  const nombre = new Intl.DateTimeFormat('es-CO', {
    month: 'short', timeZone: 'America/Bogota',
  }).format(new Date(Date.UTC(anio, m - 1, 15)))
  return nombre.replace('.', '')
}

/** "12:32 p. m." — con espacios normales, iguales en servidor y cliente. */
export function formatearHora(instante: string | Date): string {
  const d = typeof instante === 'string' ? new Date(instante) : instante
  return new Intl.DateTimeFormat('es-CO', {
    hour: 'numeric', minute: '2-digit', hour12: true,
    timeZone: 'America/Bogota',
  })
    .format(d)
    // Normalizamos los espacios especiales (U+202F, U+00A0) a espacios
    // normales. Node y el navegador usan versiones distintas de ICU y
    // producen caracteres invisiblemente diferentes, lo que rompe la
    // hidratación de React.
    .replace(/[\u202F\u00A0]/g, ' ')
}
/**
 * Suma o resta meses a "2026-08" devolviendo "2026-09".
 *
 * Con Date.UTC y no con setMonth sobre una fecha local: el 31 de marzo
 * menos un mes da 3 de marzo en muchas implementaciones, porque febrero
 * no tiene 31. Empezando siempre por el día 1 eso no puede pasar.
 */
export function moverMes(mes: string, delta: number): string {
  const [anio, m] = mes.split('-').map(Number)
  const d = new Date(Date.UTC(anio, m - 1 + delta, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

/** "2026-08" -> "agosto 2026" */
export function nombreDelMes(mes: string): string {
  const [anio, m] = mes.split('-').map(Number)
  const texto = new Intl.DateTimeFormat('es-CO', {
    month: 'long', timeZone: 'UTC',
  }).format(new Date(Date.UTC(anio, m - 1, 1)))
  /* La mayúscula la pone esta función y NO la clase CSS `capitalize`.
     Esa pone mayúscula en cada palabra, y el formato largo del mes en
     español lleva un "de" en medio: en el escritorio salía "Septiembre
     De 2026". Aquí solo se toca la primera letra. */
  return `${texto.charAt(0).toUpperCase()}${texto.slice(1)} ${anio}`
}

/** "2026-08" -> "agosto". Sin el año, para comparar con el mes vecino:
 *  "$180.000 menos que en agosto" no necesita decir de qué año. */
export function soloNombreMes(mes: string): string {
  const [anio, m] = mes.split('-').map(Number)
  return new Intl.DateTimeFormat('es-CO', {
    month: 'long', timeZone: 'UTC',
  }).format(new Date(Date.UTC(anio, m - 1, 1)))
}

/**
 * La nota de "y además hay tanto en metas", bajo el saldo de una cuenta.
 *
 * POR QUÉ ES UNA FUNCIÓN Y NO TEXTO SUELTO. Esta frase estaba escrita
 * en cuatro sitios con cuatro redacciones, y tres de ellas decían
 * "$600.000 en metas" a secas debajo de un saldo. Eso se lee como que
 * los 600.000 están DENTRO de la cifra de arriba, y están fuera: donde
 * se muestra el saldo de una cuenta suelta se muestra el disponible,
 * que ya los restó.
 *
 * El resultado era que alguien miraba su cuenta y creía tener 600.000
 * menos de lo que puede gastar. El signo + es lo que arregla la frase:
 * dice que eso se SUMA a lo de arriba, no que se descuente.
 */
export function notaEnMetas(asignado: number): string | undefined {
  if (asignado <= 0) return undefined
  return `+ ${formatearCOP(asignado)} guardados en metas`
}
