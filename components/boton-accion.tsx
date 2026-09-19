'use client'

import { useActionState } from 'react'

export type EstadoAccion = { error?: string; ok?: string }

type Accion = (
  previo: EstadoAccion,
  formData: FormData,
) => Promise<EstadoAccion>

/**
 * Un botón que dispara una acción de servidor y MUESTRA si falla.
 *
 * Antes cada uno de estos botones era un `<form action={accion}>` suelto
 * dentro de un componente de servidor, y eso obliga a elegir entre dos
 * cosas malas:
 *
 *   - que la acción lance la excepción, y entonces se ve la pantalla de
 *     error en vez del motivo ("solo puedes borrar tus propios
 *     movimientos" es información útil, no un fallo del programa);
 *   - o que se la trague, y entonces la pantalla se recarga igual y
 *     parece que funcionó. En una operación de dinero eso es peor: crees
 *     que borraste un gasto compartido y sigue ahí.
 *
 * Un componente cliente puede usar useActionState y pintar el error al
 * lado del botón, que es donde la persona está mirando. Uno solo para
 * todos: así la respuesta a "¿qué se ve cuando esto falla?" vive en un
 * sitio, como la de "¿cómo se ve un movimiento?" vive en lib/movimientos.
 */
export function BotonAccion({
  accion, campos, children, textoEnviando = 'Un momento…',
  className = '', claseFormulario = '', claseError = '',
}: {
  accion: Accion
  /** Los campos ocultos que la acción necesita: id, origen, etc. */
  campos: Record<string, string>
  children: React.ReactNode
  textoEnviando?: string
  /** Clases del botón. */
  className?: string
  /** Clases de la caja. El botón y el mensaje van apilados dentro. */
  claseFormulario?: string
  /** Para alinear el mensaje según el hueco donde viva el botón. */
  claseError?: string
}) {
  const [estado, ejecutar, enviando] = useActionState(accion, {})

  /* El <form> es una caja normal, no `display: contents`. Con `contents`
     el botón y el mensaje se convertían en hijos del grid o flex de
     arriba, y el mensaje de uno empujaba el botón del otro a otra fila.
     Una caja se coloca igual en cualquier padre. */
  return (
    <form action={ejecutar} className={`min-w-0 ${claseFormulario}`}>
      {Object.entries(campos).map(([nombre, valor]) => (
        <input key={nombre} type="hidden" name={nombre} value={valor} />
      ))}

      <button type="submit" disabled={enviando} className={className}>
        {enviando ? textoEnviando : children}
      </button>

      {estado.error && (
        <span
          role="alert"
          className={`mt-1 block text-[11px] leading-snug text-destructive
                      ${claseError}`}
        >
          {estado.error}
        </span>
      )}
    </form>
  )
}
