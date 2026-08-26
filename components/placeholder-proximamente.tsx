export function PlaceholderProximamente({
  icono: Icono, texto,
}: {
  icono: React.ComponentType<{ className?: string }>
  texto: string
}) {
  return (
    <div className="mt-8 flex flex-col items-center rounded-2xl border
                    border-dashed border-border px-6 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-muted">
        <Icono className="size-5 text-muted-foreground" />
      </span>
      <p className="mt-4 text-[15px] font-medium">Todavía no está lista</p>
      <p className="mx-auto mt-1.5 max-w-[42ch] text-[13px] text-muted-foreground">
        {texto}
      </p>
    </div>
  )
}
