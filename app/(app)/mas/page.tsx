import Link from 'next/link'
import { ChevronRight, Wallet, HeartHandshake, HandCoins, User } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { cerrarSesion } from '@/app/auth/actions'
import { Seccion, Lista } from '@/components/seccion'
import { SelectorTema } from '@/components/selector-tema'

const ENLACES = [
  { href: '/cuentas',   icono: Wallet,         etiqueta: 'Cuentas',
    detalle: 'Dónde tienes tu dinero' },
  { href: '/prestamos', icono: HandCoins,      etiqueta: 'Préstamos',
    detalle: 'Dinero que te deben' },
  { href: '/pareja',    icono: HeartHandshake, etiqueta: 'Pareja',
    detalle: 'Balance y gastos compartidos' },
]

export default async function MasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: perfil } = await supabase
    .from('profiles').select('display_name').eq('id', user!.id).single()

  return (
    <main className="px-4 pb-28 pt-4">
      <h1 className="px-1 text-[22px] font-semibold tracking-tight">Más</h1>

      <Seccion>
        <Lista>
          {ENLACES.map(({ href, icono: Icono, etiqueta, detalle }) => (
            <Link key={href} href={href}
                  className="flex min-h-13 items-center gap-3 px-4 py-2.5
                             transition active:bg-muted/60">
              <span className="flex size-9 shrink-0 items-center justify-center
                               rounded-xl bg-muted">
                <Icono className="size-[17px] text-muted-foreground" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] leading-tight">{etiqueta}</p>
                <p className="mt-0.5 text-[12px] leading-tight
                              text-muted-foreground">
                  {detalle}
                </p>
              </div>
              <ChevronRight className="size-4 shrink-0
                                       text-muted-foreground/60" />
            </Link>
          ))}
        </Lista>
      </Seccion>

      <Seccion titulo="Apariencia">
        <Lista>
          <SelectorTema />
        </Lista>
      </Seccion>

      <Seccion titulo="Cuenta">
        <Lista>
          <div className="flex min-h-13 items-center gap-3 px-4 py-2.5">
            <span className="flex size-9 shrink-0 items-center justify-center
                             rounded-xl bg-muted">
              <User className="size-[17px] text-muted-foreground" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] leading-tight">
                {perfil?.display_name}
              </p>
              <p className="mt-0.5 truncate text-[12px] leading-tight
                            text-muted-foreground">
                {user?.email}
              </p>
            </div>
          </div>
          <form action={cerrarSesion}>
            <button className="min-h-12 w-full px-4 text-left text-[15px]
                               font-medium text-destructive transition
                               active:bg-muted/60">
              Cerrar sesión
            </button>
          </form>
        </Lista>
      </Seccion>
    </main>
  )
}