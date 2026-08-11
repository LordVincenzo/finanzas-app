/**
 * Genera los iconos de la PWA.
 * Ejecutar:  node scripts/iconos.mjs
 *
 * Si existe scripts/logo-fuente.png, se usa esa imagen.
 * Si no, se dibuja el símbolo por defecto: dos círculos que se solapan.
 * Uno lleno y uno vacío, cada uno con su espacio, compartiendo una zona
 * en común.
 *
 * La imagen fuente debe ser PNG cuadrado, idealmente 1024x1024.
 */
import { writeFile, mkdir, access } from 'node:fs/promises'
import sharp from 'sharp'

// ---------------------------------------------------------------------
// Ajustes
// ---------------------------------------------------------------------

const FUENTE = 'scripts/logo-fuente.png'

/** Relleno detrás del logo. iOS pinta de negro las zonas transparentes,
 *  así que un icono con fondo transparente sale con un marco negro. */
const FONDO = '#0a0a0a'

// ---------------------------------------------------------------------

function simbolo({ radio = 105, grosor = 16, desplazamiento = 46 } = {}) {
  const cx = 256, cy = 256
  const d = desplazamiento
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <clipPath id="izq">
      <circle cx="${cx - d}" cy="${cy + d * 0.9}" r="${radio}"/>
    </clipPath>
  </defs>
  <rect width="512" height="512" fill="${FONDO}"/>
  <circle cx="${cx - d}" cy="${cy + d * 0.9}" r="${radio}"
          fill="none" stroke="#fafafa" stroke-width="${grosor}"/>
  <circle cx="${cx + d}" cy="${cy - d * 0.9}" r="${radio}"
          fill="none" stroke="#fafafa" stroke-width="${grosor}"/>
  <circle cx="${cx + d}" cy="${cy - d * 0.9}" r="${radio}"
          fill="#fafafa" clip-path="url(#izq)"/>
</svg>`.trim()
}

async function existe(ruta) {
  try {
    await access(ruta)
    return true
  } catch {
    return false
  }
}

/**
 * Devuelve un buffer PNG cuadrado de `lado` px con el contenido ocupando
 * `proporcion` del ancho, centrado sobre el color de fondo.
 *
 * La proporción importa: Android recorta el icono en círculo, cuadrado
 * o gota según el fabricante. Si el logo llega al borde, se le comen las
 * esquinas.
 */
async function componer(origen, lado, proporcion) {
  const interior = Math.round(lado * proporcion)
  const margen = Math.round((lado - interior) / 2)

  const contenido = await sharp(origen)
    .resize(interior, interior, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer()

  return sharp({
    create: {
      width: lado, height: lado, channels: 4,
      background: FONDO,
    },
  })
    .composite([{ input: contenido, top: margen, left: margen }])
    .png()
    .toBuffer()
}

// ---------------------------------------------------------------------

const usaLogo = await existe(FUENTE)
console.log(usaLogo
  ? `Usando ${FUENTE}`
  : `No hay ${FUENTE}: se dibuja el símbolo por defecto`)

await mkdir('public/icons', { recursive: true })

// --- Icono normal: el logo casi a sangre -----------------------------
for (const size of [192, 512]) {
  const buffer = usaLogo
    ? await componer(FUENTE, size, 0.92)
    : await sharp(Buffer.from(simbolo())).resize(size, size).png().toBuffer()

  await writeFile(`public/icons/icon-${size}.png`, buffer)
  console.log(`icon-${size}.png`)
}

// --- Maskable: el símbolo va más pequeño para que nunca se corte -----
const maskable = usaLogo
  ? await componer(FUENTE, 512, 0.66)
  : await sharp(Buffer.from(simbolo({ radio: 76, grosor: 12, desplazamiento: 33 })))
      .resize(512, 512).png().toBuffer()

await writeFile('public/icons/icon-maskable.png', maskable)
console.log('icon-maskable.png')

// --- iOS: Next.js sirve app/apple-icon.png automáticamente -----------
// Sin esto, al añadir la app a la pantalla de inicio en un iPhone
// aparece una miniatura de la web en vez del icono.
const apple = usaLogo
  ? await componer(FUENTE, 180, 0.86)
  : await sharp(Buffer.from(simbolo())).resize(180, 180).png().toBuffer()

await writeFile('app/apple-icon.png', apple)
console.log('app/apple-icon.png')

// --- SVG: solo cuando el símbolo es vectorial ------------------------
if (!usaLogo) {
  await writeFile('public/icons/icon.svg', simbolo())
  console.log('icon.svg')
}
