import type { MetadataRoute } from 'next'

/**
 * Manifest de la PWA. Next.js lo sirve automáticamente
 * en /manifest.webmanifest — no hace falta enlazarlo.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Finanzas',
    short_name: 'Finanzas',
    description: 'Finanzas personales y en pareja',
    start_url: '/inicio',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0a0a0a',
    theme_color: '#0a0a0a',
    lang: 'es-CO',
    categories: ['finance', 'productivity'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      {
        src: '/icons/icon-maskable.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}