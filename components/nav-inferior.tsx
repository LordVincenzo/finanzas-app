'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, ArrowLeftRight, Plus, PiggyBank, Menu } from 'lucide-react'
import { cn } from '@/lib/utils'

const enlaces = [
  { href: '/inicio',      icono: Home,           etiqueta: 'Inicio' },
  { href: '/movimientos', icono: ArrowLeftRight, etiqueta: 'Movimientos' },
  { href: '/ahorros',     icono: PiggyBank,      etiqueta: 'Ahorros' },
  { href: '/mas',         icono: Menu,           etiqueta: 'Más' },
]

export function NavInferior() {
  const ruta = usePathname()

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 border-t bg-background pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-md items-center justify-around px-2">
        {enlaces.slice(0, 2).map((e) => (
          <ItemNav key={e.href} {...e} activo={ruta.startsWith(e.href)} />
        ))}

        <Link
          href="/movimientos/nuevo"
          aria-label="Registrar movimiento"
          className="-mt-5 flex size-14 shrink-0 items-center justify-center rounded-full bg-foreground text-background shadow-lg transition active:scale-95"
        >
          <Plus className="size-6" />
        </Link>

        {enlaces.slice(2).map((e) => (
          <ItemNav key={e.href} {...e} activo={ruta.startsWith(e.href)} />
        ))}
      </div>
    </nav>
  )
}

function ItemNav({
  href, icono: Icono, etiqueta, activo,
}: {
  href: string
  icono: React.ComponentType<{ className?: string }>
  etiqueta: string
  activo: boolean
}) {
  return (
    <Link
      href={href}
      className={cn(
        'flex w-16 flex-col items-center gap-1 py-2.5 text-[11px] transition',
        activo ? 'text-foreground' : 'text-muted-foreground'
      )}
    >
      <Icono className="size-5" />
      <span>{etiqueta}</span>
    </Link>
  )
}