/**
 * Prueba los lectores de notificaciones contra los textos REALES.
 *
 *     node scripts/probar-lectores.mts
 *
 * Los textos de abajo son los que manda cada banco de verdad, copiados
 * del celular. Si un banco cambia su formato, aquí es donde se ve: el
 * día que una prueba falle, el lector hay que arreglarlo antes de que
 * empiece a leer mal en silencio.
 *
 * Node 24 ejecuta TypeScript directamente, así que esto no necesita
 * compilar nada ni instalar un runner.
 */

import { leerNotificacion, type Lectura } from '../lib/lectores.ts'

type Caso = {
  fuente: string
  texto: string
  espera: Partial<Lectura>
}

const CASOS: Caso[] = [
  // ---- NEQUI --------------------------------------------------------
  {
    fuente: 'nequi',
    texto: 'Te transfirieron $50.000 desde otro banco a tu Nequi. Tu nuevo saldo es $120.000.',
    espera: { monto: 50000, direccion: 'entrada' },
  },
  {
    fuente: 'nequi',
    texto: 'Te enviaron $30.000. Revisa tu Nequi. Tu saldo es $150.000.',
    espera: { monto: 30000, direccion: 'entrada' },
  },
  {
    fuente: 'nequi',
    texto: 'Enviaste $25.000 a la cuenta 3101234567. Tu disponible es $125.000.',
    espera: { monto: 25000, direccion: 'salida', comercio: '3101234567' },
  },

  // ---- NU -----------------------------------------------------------
  {
    fuente: 'nu',
    texto: 'Te transfirieron $100.000 a tu Cuenta Nu. Tu saldo total se está actualizando.',
    espera: { monto: 100000, direccion: 'entrada' },
  },
  {
    fuente: 'nu',
    texto: 'Enviaste $45.000 a Juan Pérez desde tu Cuenta Nu.',
    espera: { monto: 45000, direccion: 'salida', comercio: 'Juan Pérez' },
  },

  // ---- DAVIPLATA ----------------------------------------------------
  {
    fuente: 'daviplata',
    texto: 'DaviPlata le informa: Le pasaron $80.000 a su DaviPlata. Su nuevo saldo es $82.500. Transaccion 123456.',
    espera: { monto: 80000, direccion: 'entrada' },
  },
  {
    fuente: 'daviplata',
    texto: 'DaviPlata le informa: Se pasaron $15.000 a la cuenta 3209876543. Costo $0. Transaccion 789012.',
    espera: { monto: 15000, direccion: 'salida', comercio: '3209876543' },
  },

  // ---- DAVIVIENDA ---------------------------------------------------
  {
    fuente: 'davivienda',
    texto: 'Davivienda Alertas: Abono en su cta Ahorros terminado en 1234 por $600.000 el 19/09/2026 10:15AM.',
    espera: { monto: 600000, direccion: 'entrada', cuentaTerminada: '1234' },
  },
  {
    fuente: 'davivienda',
    texto: 'Davivienda Alertas: Transaccion en cta terminada en 1234 por $150.000 el 19/09/2026 10:20AM. Ref: BANCO BOGOTA.',
    espera: { monto: 150000, direccion: 'salida', comercio: 'BANCO BOGOTA',
              cuentaTerminada: '1234' },
  },

  // ---- LO QUE NO SE DEBE INTERPRETAR --------------------------------
  // Mejor no adivinar que adivinar mal: estos tienen que dar null y
  // dejar que la persona los rellene.
  {
    fuente: 'nequi',
    texto: 'Tienes una notificación nueva. Ábrela en la app.',
    espera: { monto: null, direccion: null },
  },
  {
    fuente: 'bancolombia',   // sin lector todavía
    texto: 'Compra por $99.000 en EXITO',
    espera: { monto: null, direccion: null },
  },

  // ---- LOS DOS LADOS DE UNA TRANSFERENCIA REAL ----------------------
  //
  // Capturados de una transferencia de $100 entre dos cuentas propias,
  // el 19 de septiembre de 2026. Van con TÍTULO Y CUERPO separados por
  // un salto de línea, que es como los manda la app de Android.
  //
  // Están aquí por dos motivos que costaron un rato:
  //
  //   1. El monto de Nu vive SOLO en el título. Cuando la app mandaba
  //      nada más el cuerpo, esto entraba sin monto.
  //   2. "$100,00" lleva coma decimal. Si parsearCOP la tomara por
  //      separador de miles, esto serían $10.000: cien veces más.
  //
  // Los dos montos iguales en direcciones opuestas son, además, lo que
  // la bandeja usa para preguntar si es la misma transferencia.
  {
    fuente: 'nequi',
    texto: 'Te enviaron plata por Bre-B\n'
      + 'Te enviaron $100. Entra a tu app y revisa tu saldo.',
    espera: { monto: 100, direccion: 'entrada' },
  },
  {
    fuente: 'nu',
    texto: 'Enviaste $100,00\n'
      + 'Le enviaste a Bri***** Cas***** en su cuenta de Nequi.',
    espera: { monto: 100, direccion: 'salida', comercio: 'Bri***** Cas*****' },
  },
]

let fallos = 0

for (const caso of CASOS) {
  const real = leerNotificacion(caso.fuente, caso.texto)
  const malas: string[] = []

  for (const [campo, esperado] of Object.entries(caso.espera)) {
    const obtenido = real[campo as keyof Lectura]
    if (obtenido !== esperado) {
      malas.push(`${campo}: esperaba ${JSON.stringify(esperado)}, dio ${JSON.stringify(obtenido)}`)
    }
  }

  const corto = caso.texto.length > 58
    ? caso.texto.slice(0, 55) + '…'
    : caso.texto

  if (malas.length === 0) {
    const detalle = [
      real.monto !== null ? `$${real.monto.toLocaleString('es-CO')}` : 'sin monto',
      real.direccion ?? 'sin direccion',
      real.comercio ? `"${real.comercio}"` : null,
      real.cuentaTerminada ? `cta ${real.cuentaTerminada}` : null,
    ].filter(Boolean).join(' · ')
    console.log(`  OK    ${caso.fuente.padEnd(11)} ${corto}`)
    console.log(`        -> ${detalle}`)
  } else {
    fallos++
    console.log(`  FALLA ${caso.fuente.padEnd(11)} ${corto}`)
    for (const m of malas) console.log(`        -> ${m}`)
  }
}

console.log('')
if (fallos === 0) {
  console.log(`=== LOS ${CASOS.length} CASOS PASARON ===`)
} else {
  console.log(`=== ${fallos} DE ${CASOS.length} FALLARON ===`)
  process.exitCode = 1
}
