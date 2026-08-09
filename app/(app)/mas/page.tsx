import Link from 'next/link'
import { ChevronRight, Wallet, HeartHandshake, HandCoins, User } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { cerrarSesion } from '@/app/auth/actions'
import { Seccion, Lista } from '@/components/seccion'

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
    <main className="px-4 pt-6">
      <h1 className="text-xl font-semibold">Más</h1>

      <Seccion>
        <Lista>
          {ENLACES.map(({ href, icono: Icono, etiqueta, detalle }) => (
            <Link key={href} href={href}
                  className="flex items-center gap-3 px-3.5 py-2.5">
              <Icono className="size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] leading-tight">{etiqueta}</p>
                <p className="text-[11px] leading-tight text-muted-foreground">
                  {detalle}
                </p>
              </div>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </Link>
          ))}
        </Lista>
      </Seccion>

      <Seccion titulo="Cuenta">
        <Lista>
          <div className="flex items-center gap-3 px-3.5 py-2.5">
            <User className="size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] leading-tight">{perfil?.display_name}</p>
              <p className="truncate text-[11px] leading-tight text-muted-foreground">
                {user?.email}
              </p>
            </div>
          </div>
          <form action={cerrarSesion}>
            <button className="w-full px-3.5 py-2.5 text-left text-[13px]
                               text-destructive">
              Cerrar sesión
            </button>
          </form>
        </Lista>
      </Seccion>
    </main>
  )
}