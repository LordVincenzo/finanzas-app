import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SidebarEscritorio } from '@/components/sidebar-escritorio'

/**
 * Layout propio, separado del de (app): esto no es la app de celular
 * con otra ropa, es una segunda interfaz para pantalla ancha, con su
 * propia navegación (el sidebar) en vez de la barra flotante de abajo.
 *
 * La sesión se comprueba aquí de nuevo porque (app)/layout.tsx no
 * envuelve esta ruta.
 */
export default async function LayoutEscritorio({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div className="sin-scrollbar flex h-screen overflow-y-auto
                    bg-background text-foreground">
      <SidebarEscritorio />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  )
}
