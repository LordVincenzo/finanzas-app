import { hoyEnBogota } from '@/lib/format'

/**
 * De una meta a un plan.
 *
 * POR QUÉ EXISTE. "Viaje a Japón · $0 de $12.000.000 · 0%" no le dice
 * nada a nadie. Es una lista de deseos con una barra al lado: no hay
 * nada que hacer con esa información, y por eso las metas se abandonan.
 *
 * Lo único accionable es cuánto hay que apartar cada mes para llegar a
 * tiempo. Con eso la meta deja de ser un deseo y pasa a ser una cuota
 * que se puede cumplir o no — y si no se puede, se ve a tiempo y se
 * mueve la fecha en vez de descubrirlo en diciembre.
 *
 * La fecha ya se guardaba (`target_date`, migración 0008) y solo se
 * enseñaba como "Para el 15 de diciembre". Nadie hacía la división.
 *
 * Vive en lib/ y no dentro de una pantalla porque lo necesitan cuatro:
 * la lista y el detalle de Ahorros, sus gemelas de escritorio, e Inicio.
 */

export type Ritmo =
  | { clase: 'sin_fecha' }
  | { clase: 'lograda' }
  /** La fecha ya pasó y todavía falta dinero. */
  | { clase: 'vencida'; faltante: number; diasDeRetraso: number }
  | { clase: 'en_curso'; faltante: number; meses: number; porMes: number }

/** Meses completos entre hoy y la fecha objetivo, mínimo 1.
 *
 *  Mínimo 1 porque dividir entre cero no es una cifra, y porque una
 *  meta que vence este mes sí tiene una respuesta útil: todo lo que
 *  falta, ahora. */
function mesesHasta(objetivo: string, desde: string): number {
  const [a1, m1, d1] = desde.split('-').map(Number)
  const [a2, m2, d2] = objetivo.split('-').map(Number)
  let meses = (a2 - a1) * 12 + (m2 - m1)
  // Si el día del mes todavía no llegó, ese mes no está completo.
  if (d2 < d1) meses -= 1
  return Math.max(1, meses)
}

function diasEntre(desde: string, hasta: string): number {
  const a = Date.UTC(...(desde.split('-').map(Number) as [number, number, number]))
  const b = Date.UTC(...(hasta.split('-').map(Number) as [number, number, number]))
  return Math.round((a - b) / 86_400_000)
}

export function ritmoDeMeta(
  meta: { target_amount: number; acumulado: number; target_date: string | null },
  /** Inyectable para poder probarlo sin depender de qué día es hoy. */
  hoy: string = hoyEnBogota(),
): Ritmo {
  const faltante = Math.max(0, Number(meta.target_amount) - Number(meta.acumulado))

  if (faltante === 0) return { clase: 'lograda' }
  if (!meta.target_date) return { clase: 'sin_fecha' }

  if (meta.target_date < hoy) {
    return {
      clase: 'vencida',
      faltante,
      diasDeRetraso: diasEntre(hoy, meta.target_date),
    }
  }

  const meses = mesesHasta(meta.target_date, hoy)
  return {
    clase: 'en_curso',
    faltante,
    meses,
    // Hacia arriba: apartar $499.999 al mes cuando hacen falta
    // $500.000 no llega, y en dinero quedarse corto no vale.
    porMes: Math.ceil(faltante / meses),
  }
}
