'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { Sun, Moon, Smartphone } from 'lucide-react'

const OPCIONES = [
  { valor: 'system', etiqueta: 'Auto',   Icono: Smartphone },
  { valor: 'light',  etiqueta: 'Claro',  Icono: Sun },
  { valor: 'dark',   etiqueta: 'Oscuro', Icono: Moon },
]

export function SelectorTema() {
  const { theme, setTheme } = useTheme()
  const [listo, setListo] = useState(false)

  // El tema real solo se conoce en el navegador.
  useEffect(() => setListo(true), [])

  return (
    <div className="flex items-center gap-3 px-3.5 py-2.5">
      <p className="flex-1 text-[13px]">Apariencia</p>
      <div className="flex gap-1 rounded-full bg-muted p-0.5">
        {OPCIONES.map(({ valor, etiqueta, Icono }) => (
          <button
            key={valor}
            type="button"
            onClick={() => setTheme(valor)}
            aria-label={etiqueta}
            className={`flex items-center gap-1 rounded-full px-2.5 py-1
                        text-[11px] transition ${
                          listo && theme === valor
                            ? 'bg-background shadow-sm'
                            : 'text-muted-foreground'
                        }`}
          >
            <Icono className="size-3" />
            {etiqueta}
          </button>
        ))}
      </div>
    </div>
  )
}