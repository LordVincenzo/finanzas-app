/* Import relativo y no '@/lib/format', que es lo que usa el resto del
   proyecto. El alias lo entienden TypeScript y el bundler, pero no
   `node` a secas — y este módulo interesa que se pueda ejecutar sin
   nada: `node scripts/probar-lectores.mts` prueba los lectores contra
   los textos reales de cada banco sin instalar ningún runner. Es el
   archivo con más probabilidades de romperse (los bancos cambian sus
   frases), así que poder probarlo en un segundo vale la excepción. */
import { parsearCOP } from './format.ts'

/**
 * Leer el texto de una notificación bancaria.
 *
 * Una función por entidad, despachadas por `fuente`. Añadir un banco es
 * añadir un lector aquí: nada más del sistema sabe que Nequi existe.
 *
 *
 * EL PELIGRO DE LOS DOS MONTOS
 *
 * Casi todas estas notificaciones traen DOS cifras: la del movimiento y
 * el saldo que queda después.
 *
 *     "Te transfirieron $50.000 desde otro banco. Tu nuevo saldo es $120.000."
 *                       ^^^^^^^ esta                            ^^^^^^^^ esta NO
 *
 * Un lector que cogiera "el primer $" acertaría hoy y fallaría el día
 * que un banco reordene la frase — y fallaría en silencio, registrando
 * el saldo como si fuera el gasto. Por eso cada monto se ancla a SU
 * verbo: "Te transfirieron $X", "Enviaste $X", "por $X". Si la frase
 * cambia, el lector devuelve null y el mensaje se rellena a mano, que es
 * el fallo correcto.
 *
 * Lo mismo con "Costo $0" de DaviPlata y con "Transaccion 123456", que
 * es un número de referencia y no una cifra de dinero.
 *
 *
 * NADA DE ESTO SE CREE A PIES JUNTILLAS. Lo que salga de aquí es una
 * PROPUESTA que la persona ve y puede cambiar antes de confirmar. El
 * texto original se guarda entero y para siempre: es lo único que
 * permite darse cuenta el día que un formato cambie.
 */

export type Direccion = 'salida' | 'entrada'

export type Lectura = {
  monto: number | null
  comercio: string | null
  direccion: Direccion | null
  /** Últimos dígitos de la cuenta, cuando el mensaje los trae. */
  cuentaTerminada: string | null
}

const NADA: Lectura = {
  monto: null, comercio: null, direccion: null, cuentaTerminada: null,
}

/** El grupo 1 de la primera expresión que case, como entero de pesos. */
function montoDe(texto: string, ...patrones: RegExp[]): number | null {
  for (const patron of patrones) {
    const m = texto.match(patron)
    if (m?.[1]) {
      const valor = parsearCOP(m[1])
      // Un movimiento de $0 no es un movimiento: suele ser el "Costo $0"
      // de DaviPlata colándose por una frase mal anclada.
      if (valor !== null && valor > 0) return valor
    }
  }
  return null
}

function primerGrupo(texto: string, patron: RegExp): string | null {
  const m = texto.match(patron)
  return m?.[1]?.trim() || null
}

/** "...terminado en 1234", "...terminada en 1234" */
const CUENTA_TERMINADA = /termina(?:do|da) en\s+(\d{3,6})/i

/** "a la cuenta 3101234567" */
const CUENTA_DESTINO = /a la cuenta\s+(\d{6,})/i


// =====================================================================
// NEQUI
//
//   "Te transfirieron $50.000 desde otro banco a tu Nequi.
//    Tu nuevo saldo es $120.000."
//   "Te enviaron $30.000. Revisa tu Nequi. Tu saldo es $150.000."
//   "Enviaste $25.000 a la cuenta 3101234567. Tu disponible es $125.000."
// =====================================================================

function leerNequi(texto: string): Lectura {
  const entrada = montoDe(texto, /Te (?:transfirieron|enviaron)\s+\$\s?([\d.,]+)/i)
  if (entrada !== null) {
    return { monto: entrada, comercio: null, direccion: 'entrada',
             cuentaTerminada: null }
  }

  const salida = montoDe(texto, /Enviaste\s+\$\s?([\d.,]+)/i)
  if (salida !== null) {
    return {
      monto: salida,
      comercio: primerGrupo(texto, CUENTA_DESTINO),
      direccion: 'salida',
      cuentaTerminada: null,
    }
  }

  return NADA
}


// =====================================================================
// NU COLOMBIA
//
//   "Te transfirieron $100.000 a tu Cuenta Nu. Tu saldo total se está
//    actualizando."
//   "Enviaste $45.000 a Juan Pérez desde tu Cuenta Nu."
//
// La de envío trae el NOMBRE de quien recibe, que es lo más útil que da
// ninguna de estas notificaciones: sirve de descripción y, con el
// tiempo, para aprender la categoría.
// =====================================================================

function leerNu(texto: string): Lectura {
  const entrada = montoDe(texto, /Te transfirieron\s+\$\s?([\d.,]+)/i)
  if (entrada !== null) {
    return { monto: entrada, comercio: null, direccion: 'entrada',
             cuentaTerminada: null }
  }

  const salida = montoDe(texto, /Enviaste\s+\$\s?([\d.,]+)/i)
  if (salida !== null) {
    return {
      monto: salida,
      comercio: destinatarioNu(texto),
      direccion: 'salida',
      cuentaTerminada: null,
    }
  }

  return NADA
}

/**
 * A quién le enviaste, en Nu.
 *
 * Dos formatos, y el orden importa porque el segundo es el que manda de
 * verdad — el primero estaba escrito de memoria y nunca llegó a
 * coincidir con nada:
 *
 *   "Enviaste $50.000 a Juan Pérez desde tu Cuenta Nu"
 *   "Le enviaste a Bri***** Cas***** en su cuenta de Nequi."
 *
 * Nu enmascara el nombre. Se deja tal cual: sirve para reconocer el
 * movimiento y no hay nada que reconstruir.
 */
function destinatarioNu(texto: string): string | null {
  return primerGrupo(texto, /Le enviaste a\s+(.+?)\s+en su cuenta/i)
    ?? primerGrupo(texto, /Enviaste\s+\$\s?[\d.,]+\s+a\s+(.+?)\s+desde/i)
}


// =====================================================================
// DAVIPLATA
//
//   "DaviPlata le informa: Le pasaron $80.000 a su DaviPlata.
//    Su nuevo saldo es $82.500. Transaccion 123456."
//   "DaviPlata le informa: Se pasaron $15.000 a la cuenta 3209876543.
//    Costo $0. Transaccion 789012."
//
// Ojo con "Costo $0" y con "Transaccion 123456": el primero es dinero
// que no es el movimiento, el segundo ni siquiera es dinero.
// =====================================================================

function leerDaviplata(texto: string): Lectura {
  const entrada = montoDe(texto, /Le pasaron\s+\$\s?([\d.,]+)/i)
  if (entrada !== null) {
    return { monto: entrada, comercio: null, direccion: 'entrada',
             cuentaTerminada: null }
  }

  const salida = montoDe(texto, /Se pasaron\s+\$\s?([\d.,]+)/i)
  if (salida !== null) {
    return {
      monto: salida,
      comercio: primerGrupo(texto, CUENTA_DESTINO),
      direccion: 'salida',
      cuentaTerminada: null,
    }
  }

  return NADA
}


// =====================================================================
// DAVIVIENDA
//
//   "Davivienda Alertas: Abono en su cta Ahorros terminado en 1234
//    por $600.000 el 19/09/2026 10:15AM."
//   "Davivienda Alertas: Transaccion en cta terminada en 1234
//    por $150.000 el 19/09/2026 10:20AM. Ref: BANCO BOGOTA."
//
// La única que dice a QUÉ cuenta: "terminado en 1234". Se guarda para
// poder proponer la cuenta correcta cuando haya varias de Davivienda.
//
// "Transaccion" a secas se toma como salida porque su pareja es
// "Abono". Es la inferencia menos firme de todos los lectores, y por eso
// mismo conviene mirarla las primeras veces.
// =====================================================================

function leerDavivienda(texto: string): Lectura {
  const cuenta = primerGrupo(texto, CUENTA_TERMINADA)

  const entrada = montoDe(texto, /Abono\b[^$]*?por\s+\$\s?([\d.,]+)/i)
  if (entrada !== null) {
    return { monto: entrada, comercio: null, direccion: 'entrada',
             cuentaTerminada: cuenta }
  }

  const salida = montoDe(texto, /Transacci[oó]n\b[^$]*?por\s+\$\s?([\d.,]+)/i)
  if (salida !== null) {
    return {
      monto: salida,
      // "Ref: BANCO BOGOTA" al final del mensaje
      comercio: primerGrupo(texto, /Ref:\s*([^.]+)/i),
      direccion: 'salida',
      cuentaTerminada: cuenta,
    }
  }

  return NADA
}


// =====================================================================
// DESPACHO
// =====================================================================

const LECTORES: Record<string, (texto: string) => Lectura> = {
  nequi: leerNequi,
  nu: leerNu,
  daviplata: leerDaviplata,
  davivienda: leerDavivienda,
}

/** Las entidades que la app sabe leer hoy. */
export const FUENTES_CONOCIDAS = Object.keys(LECTORES)

/**
 * Interpreta el texto según de qué app venga.
 *
 * Una entidad desconocida, o un texto que no casa con ningún patrón,
 * devuelve todo en null. Eso NO es un error: el mensaje entra igual a la
 * bandeja con su texto a la vista, y se rellena a mano. Es mejor no
 * adivinar que adivinar mal en algo que mueve dinero.
 */
export function leerNotificacion(fuente: string, texto: string): Lectura {
  const lector = LECTORES[fuente.trim().toLowerCase()]
  if (!lector) return NADA
  try {
    return lector(texto)
  } catch {
    // Un texto raro no puede tumbar la ingesta: el mensaje entra sin
    // interpretar y la persona lo completa.
    return NADA
  }
}
