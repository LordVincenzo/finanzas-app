/**
 * Foto de perfil si hay una guardada; si no, las iniciales del nombre
 * sobre el color de marca. `className` decide el tamaño y el tipo de
 * letra, para poder usarlo tanto chico (cabecera) como grande
 * (editar perfil) sin duplicar el componente.
 */
export function AvatarPerfil({
  nombre, url, className = 'size-11 text-[15px]',
}: {
  nombre?: string | null
  url?: string | null
  className?: string
}) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        className={`${className} shrink-0 rounded-full object-cover
                    ring-1 ring-border/70`}
      />
    )
  }

  const iniciales = (nombre ?? '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((palabra) => palabra[0]?.toUpperCase())
    .join('') || '?'

  return (
    <span className={`flex ${className} shrink-0 items-center
                      justify-center rounded-full bg-primary font-semibold
                      text-primary-foreground`}>
      {iniciales}
    </span>
  )
}
