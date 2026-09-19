import Link from 'next/link'
import {
  ChevronRight, Wallet, HeartHandshake, HandCoins, BarChart3, Inbox,
} from 'lucide-react'
import { createClient, requerirUsuario } from '@/lib/supabase/server'
import { cerrarSesion } from '@/app/auth/actions'
import { contarPendientes } from '@/lib/datos-bandeja'
import { Seccion, Lista } from '@/components/seccion'
import { SelectorTema } from '@/components/selector-tema'
import { AvatarPerfil } from '@/components/avatar-perfil'

export default async function MasPage() {
  const supabase = await createClient()
  const user = await requerirUsuario(supabase)
  const { data: perfil } = await supabase
    .from('profiles')
    .select('display_name, avatar_url')
    .eq('id', user.id).single()

  const pendientes = await contarPendientes()

  /* "Por confirmar" va aquí y no solo en Inicio.
     En Inicio aparece únicamente cuando hay algo esperando, que está
     bien para no ensuciar la pantalla con un aviso vacío — pero
     entonces no había NINGUNA forma de llegar a la bandeja con la
     bandeja vacía, y ahí es justo donde se activa la lectura de
     notificaciones. Para que llegaran mensajes había que entrar, y para
     entrar hacía falta que ya hubieran llegado.
     Dentro del APK no hay barra de direcciones para saltárselo. */
  const ENLACES = [
    { href: '/bandeja',   icono: Inbox,          etiqueta: 'Por confirmar',
      detalle: pendientes > 0
        ? `${pendientes} esperando`
        : 'Lo que leen tus bancos, y activar la lectura' },
    { href: '/cuentas',   icono: Wallet,         etiqueta: 'Cuentas',
      detalle: 'Dónde tienes tu dinero' },
    { href: '/prestamos', icono: HandCoins,      etiqueta: 'Préstamos',
      detalle: 'Dinero que te deben' },
    { href: '/pareja',    icono: HeartHandshake, etiqueta: 'Pareja',
      detalle: 'Balance y gastos compartidos' },
  ]

  return (
    <main className="px-4 pt-4 pb-[calc(8rem+env(safe-area-inset-bottom))]">
      <h1 className="aparece px-1 text-[22px] font-semibold tracking-tight">
        Más
      </h1>

      <Seccion>
        <div className="aparece"
             style={{ '--retraso': '50ms' } as React.CSSProperties}>
          <Lista>
            {ENLACES.map(({ href, icono: Icono, etiqueta, detalle }) => (
              <Link key={href} href={href}
                    className="flex min-h-13 items-center gap-3 px-4 py-2.5
                               transition active:bg-muted/60">
                <span className="flex size-9 shrink-0 items-center
                                 justify-center rounded-xl bg-muted">
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
        </div>
      </Seccion>

      <Seccion titulo="Escritorio">
        <div className="aparece"
             style={{ '--retraso': '90ms' } as React.CSSProperties}>
          <Lista>
            <Link href="/escritorio/estadisticas"
                  className="flex min-h-13 items-center gap-3 px-4 py-2.5
                             transition active:bg-muted/60">
              <span className="flex size-9 shrink-0 items-center
                               justify-center rounded-xl bg-muted">
                <BarChart3 className="size-[17px] text-muted-foreground" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] leading-tight">Vista de escritorio</p>
                <p className="mt-0.5 text-[12px] leading-tight
                              text-muted-foreground">
                  Estadísticas y movimientos — se ve mejor desde un computador
                </p>
              </div>
              <ChevronRight className="size-4 shrink-0
                                       text-muted-foreground/60" />
            </Link>
          </Lista>
        </div>
      </Seccion>

      <Seccion titulo="Apariencia">
        <div className="aparece"
             style={{ '--retraso': '120ms' } as React.CSSProperties}>
          <Lista>
            <SelectorTema />
          </Lista>
        </div>
      </Seccion>

      <Seccion titulo="Cuenta">
        <div className="aparece"
             style={{ '--retraso': '190ms' } as React.CSSProperties}>
          <Lista>
            <Link
              href="/mas/perfil"
              className="flex min-h-13 items-center gap-3 px-4 py-2.5
                         transition active:bg-muted/60"
            >
              <AvatarPerfil
                nombre={perfil?.display_name} url={perfil?.avatar_url}
                className="size-9 text-[13px]"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] leading-tight">
                  {perfil?.display_name}
                </p>
                <p className="mt-0.5 truncate text-[12px] leading-tight
                              text-muted-foreground">
                  {user?.email}
                </p>
              </div>
              <ChevronRight className="size-4 shrink-0
                                       text-muted-foreground/60" />
            </Link>
            <form action={cerrarSesion}>
              <button className="min-h-12 w-full px-4 text-left text-[15px]
                                 font-medium text-destructive transition
                                 active:bg-muted/60">
                Cerrar sesión
              </button>
            </form>
          </Lista>
        </div>
      </Seccion>
    </main>
  )
}