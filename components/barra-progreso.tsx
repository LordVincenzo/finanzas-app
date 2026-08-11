/**
 * Barra de progreso.
 *
 * Crece desde cero al aparecer. La animación es CSS puro —el ancho
 * final viaja en la variable --ancho— así que esto sigue siendo un
 * Server Component y no añade JavaScript al navegador.
 *
 * El color es el acento, no el verde de --positivo: el verde en esta
 * app significa "entra dinero", y una meta cumplida no es un ingreso.
 */
export function BarraProgreso({
  progreso, retraso = 0,
}: {
  progreso: number
  /** Milisegundos de espera, para escalonar varias barras. */
  retraso?: number
}) {
  const ancho = Math.min(100, Math.max(0, progreso))
  const completa = ancho >= 100

  return (
    <div
      className="h-1.5 overflow-hidden rounded-full bg-muted"
      role="progressbar"
      aria-valuenow={Math.round(ancho)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={`crece h-full rounded-full
                    ${completa ? 'bg-primary' : 'bg-primary/70'}`}
        style={{
          '--ancho': `${ancho}%`,
          '--retraso': `${retraso}ms`,
        } as React.CSSProperties}
      />
    </div>
  )
}