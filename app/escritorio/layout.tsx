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
      {/* EL ANCHO Y EL MARGEN SE DECIDEN AQUÍ, una vez.
          Antes los ponía cada pantalla y habían derivado a cuatro
          valores distintos —1400, 1152, 1024 y 576—, así que al navegar
          el título saltaba de sitio en cada una. Eso no se ve como un
          fallo concreto: se ve como que la app está a medio hacer.
          Una pantalla que necesite otra cosa lo dice en su contenido,
          no cambiando el marco. */}
      <main className="min-w-0 flex-1">
        <div className="mx-auto w-full max-w-[1400px] px-8 py-10">
          {children}
        </div>
      </main>
    </div>
  )
}
