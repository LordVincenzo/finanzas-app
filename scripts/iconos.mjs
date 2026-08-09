/**
 * Genera los iconos de la PWA a partir de un SVG.
 * Ejecutar una sola vez:  node scripts/iconos.mjs
 */
import { writeFile, mkdir } from 'node:fs/promises'
import sharp from 'sharp'

// Símbolo de peso en blanco sobre negro, con el mismo peso
// tipográfico que usa la app para las cifras.
const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
  <rect width="512" height="512" fill="#0a0a0a"/>
  <text x="256" y="256" fill="#fafafa"
        font-family="Geist, Inter, -apple-system, sans-serif"
        font-size="300" font-weight="600"
        text-anchor="middle" dominant-baseline="central">$</text>
</svg>`

await mkdir('public/icons', { recursive: true })

for (const size of [192, 512]) {
  await sharp(Buffer.from(svg)).resize(size, size).png()
    .toFile(`public/icons/icon-${size}.png`)
  console.log(`icon-${size}.png`)
}

// Versión "maskable": Android recorta el icono en distintas formas,
// así que el símbolo va más pequeño para que no se corte.
const maskable = svg.replace('font-size="300"', 'font-size="200"')
await sharp(Buffer.from(maskable)).resize(512, 512).png()
  .toFile('public/icons/icon-maskable.png')
console.log('icon-maskable.png')

await writeFile('public/icons/icon.svg', svg.trim())
console.log('icon.svg')