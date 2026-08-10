/**
 * Barra de progreso de una meta.
 *
 * Usa el acento (--primary), no el verde de --positivo: el verde en
 * esta app significa "entra dinero", y una meta cumplida no es un
 * ingreso. Antes usaba bg-emerald-600, un color de Tailwind fuera del
 * sistema que no cambiaba con el tema.
 */
export function BarraProgreso({ progreso }: { progreso: number }) {
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
        className={`h-full rounded-full transition-all duration-500
                    ${completa ? 'bg-primary' : 'bg-foreground/80'}`}
        style={{ width: `${ancho}%` }}
      />
    </div>
  )
}