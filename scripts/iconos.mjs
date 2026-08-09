/**
 * Genera los iconos de la PWA.
 * Ejecutar:  node scripts/iconos.mjs
 *
 * El símbolo: dos círculos que se solapan. Uno lleno y uno vacío,
 * cada uno con su espacio, compartiendo una zona en común.
 */
import { writeFile, mkdir } from 'node:fs/promises'
import sharp from 'sharp'

function icono({ radio = 105, grosor = 16, desplazamiento = 46 } = {}) {
  const cx = 256, cy = 256
  const d = desplazamiento
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <clipPath id="izq">
      <circle cx="${cx - d}" cy="${cy + d * 0.9}" r="${radio}"/>
    </clipPath>
  </defs>
  <rect width="512" height="512" fill="#0a0a0a"/>
  <circle cx="${cx - d}" cy="${cy + d * 0.9}" r="${radio}"
          fill="none" stroke="#fafafa" stroke-width="${grosor}"/>
  <circle cx="${cx + d}" cy="${cy - d * 0.9}" r="${radio}"
          fill="none" stroke="#fafafa" stroke-width="${grosor}"/>
  <circle cx="${cx + d}" cy="${cy - d * 0.9}" r="${radio}"
          fill="#fafafa" clip-path="url(#izq)"/>
</svg>`.trim()
}

await mkdir('public/icons', { recursive: true })

const normal = icono()
for (const size of [192, 512]) {
  await sharp(Buffer.from(normal)).resize(size, size).png()
    .toFile(`public/icons/icon-${size}.png`)
  console.log(`icon-${size}.png`)
}

// Android recorta el icono en círculo, cuadrado o gota según el
// fabricante. El símbolo va más pequeño para que nunca se corte.
const maskable = icono({ radio: 76, grosor: 12, desplazamiento: 33 })
await sharp(Buffer.from(maskable)).resize(512, 512).png()
  .toFile('public/icons/icon-maskable.png')
console.log('icon-maskable.png')

await writeFile('public/icons/icon.svg', normal)
console.log('icon.svg')