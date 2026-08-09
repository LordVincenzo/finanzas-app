export function BarraProgreso({ progreso }: { progreso: number }) {
  const ancho = Math.min(100, Math.max(0, progreso))
  const completa = ancho >= 100

  return (
    <div className="h-2 overflow-hidden rounded-full bg-muted">
      <div
        className={`h-full rounded-full transition-all ${
          completa ? 'bg-emerald-600' : 'bg-foreground'
        }`}
        style={{ width: `${ancho}%` }}
      />
    </div>
  )
}