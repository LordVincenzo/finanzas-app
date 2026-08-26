'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, BarChart3, ArrowLeftRight, Wallet, PiggyBank, HandCoins, ChevronLeft,
} from 'lucide-react'

const ENLACES = [
  { href: '/escritorio', etiqueta: 'Panorama', icono: LayoutDashboard },
  { href: '/escritorio/estadisticas', etiqueta: 'Estadísticas', icono: BarChart3 },
  { href: '/escritorio/movimientos', etiqueta: 'Movimientos', icono: ArrowLeftRight },
  { href: '/escritorio/cuentas', etiqueta: 'Cuentas', icono: Wallet },
  { href: '/escritorio/ahorros', etiqueta: 'Ahorros', icono: PiggyBank },
  { href: '/escritorio/prestamos', etiqueta: 'Préstamos', icono: HandCoins },
]

export function SidebarEscritorio() {
  const ruta = usePathname()

  return (
    <nav className="sticky top-0 flex h-screen w-60 shrink-0 flex-col
                    border-r border-border/70 bg-card px-3 py-6">
      <div className="px-3">
        <p className="text-[15px] font-semibold tracking-tight">Finanzas</p>
        <p className="mt-0.5 text-[12px] text-muted-foreground">Vista de escritorio</p>
      </div>

      <div className="mt-6 space-y-1">
        {ENLACES.map(({ href, etiqueta, icono: Icono }) => {
          // "/escritorio" a secas necesita coincidencia exacta: si no,
          // startsWith lo marcaría activo en todas las demás páginas.
          const activo = href === '/escritorio' ? ruta === href : ruta.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5
                         text-[14px] transition ${
                activo
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <Icono className="size-4 shrink-0" />
              {etiqueta}
            </Link>
          )
        })}
      </div>

      <Link
        href="/inicio"
        className="mt-auto flex items-center gap-2 px-3 text-[13px]
                   text-muted-foreground transition hover:text-foreground"
      >
        <ChevronLeft className="size-4" /> Volver a la app
      </Link>
    </nav>
  )
}
