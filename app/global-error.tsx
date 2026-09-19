'use client'

/**
 * La red de debajo de todas las redes: solo se usa si falla el layout
 * raíz, que es lo que monta las fuentes, el tema y globals.css.
 *
 * Por eso aquí NO se usan clases de Tailwind ni los tokens del sistema
 * visual: si lo que se rompió es justo lo que carga esa hoja de estilos,
 * `bg-card` y `text-muted-foreground` no existirían y la pantalla saldría
 * en blanco sobre blanco. Estilos en línea, feos pero incondicionales.
 *
 * También tiene que traer su propio <html> y <body>, porque reemplaza al
 * layout raíz en vez de vivir dentro de él.
 */
export default function GlobalError({
  error, reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          background: '#f7f7f8',
          color: '#18181b',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        <div style={{ maxWidth: '380px', textAlign: 'center' }}>
          <h1 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>
            La aplicación no pudo cargar
          </h1>
          <p style={{ fontSize: '14px', lineHeight: 1.5, color: '#52525b' }}>
            Tus datos están a salvo. Esto falló al arrancar la interfaz, no
            al guardar nada.
          </p>
          {error.digest && (
            <p style={{ fontSize: '12px', color: '#71717a' }}>
              Referencia: {error.digest}
            </p>
          )}
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: '16px',
              minHeight: '48px',
              width: '100%',
              borderRadius: '12px',
              border: 'none',
              background: '#5b3df5',
              color: '#fff',
              fontSize: '15px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Intentar de nuevo
          </button>
        </div>
      </body>
    </html>
  )
}
