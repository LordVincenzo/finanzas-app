'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { Search, X } from 'lucide-react'

/**
 * Buscar en el historial.
 *
 * POR QUÉ HACÍA FALTA. Con la bandeja llenando sola, en tres meses hay
 * cientos de movimientos y los únicos filtros eran mes y tipo. «¿Cuánto
 * llevo gastado en el Éxito este año?» no tenía respuesta, y esa es de
 * las pocas preguntas que uno le hace de verdad a una app de finanzas.
 *
 * BUSCAR IGNORA EL MES a propósito. Filtrar por mes Y por texto deja
 * fuera justo lo que se busca: si no recuerdas cuándo fue, tampoco vas
 * a acertar el mes. Cuando hay búsqueda, el selector de mes desaparece
 * de la pantalla para que no parezca que sigue aplicándose.
 *
 * Con router.push y no con un <form> normal: un GET nativo recarga la
 * página entera, y aquí se va a escribir, borrar y volver a escribir.
 */
export function BuscadorMovimientos({
  valor, tipo,
}: {
  valor: string
  /** Se conserva al buscar: "gastos que digan Éxito" es una pregunta
   *  razonable. El mes no, porque buscar es buscar en todo. */
  tipo: string
}) {
  const router = useRouter()
  const [texto, setTexto] = useState(valor)
  const campo = useRef<HTMLInputElement>(null)

  function ir(q: string) {
    const params = new URLSearchParams()
    if (q.trim()) params.set('q', q.trim())
    if (tipo) params.set('tipo', tipo)
    const cola = params.toString()
    router.push(cola ? `/movimientos?${cola}` : '/movimientos')
  }

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); ir(texto) }}
      role="search"
      className="relative"
    >
      <Search aria-hidden
        className="pointer-events-none absolute left-3.5 top-1/2 size-4
                   -translate-y-1/2 text-muted-foreground" />

      <input
        ref={campo}
        type="search"
        name="q"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Buscar en todo el historial"
        aria-label="Buscar movimientos"
        enterKeyHint="search"
        maxLength={60}
        className="min-h-11 w-full rounded-xl border bg-transparent pl-10 pr-10
                   text-[14px] placeholder:text-muted-foreground/60
                   focus:outline-none focus:ring-2 focus:ring-ring
                   [&::-webkit-search-cancel-button]:hidden"
      />

      {texto && (
        <button
          type="button"
          aria-label="Borrar la búsqueda"
          onClick={() => { setTexto(''); ir(''); campo.current?.focus() }}
          className="absolute right-0 top-1/2 flex size-11 -translate-y-1/2
                     items-center justify-center rounded-lg
                     text-muted-foreground transition active:scale-90"
        >
          <X className="size-4" />
        </button>
      )}
    </form>
  )
}
