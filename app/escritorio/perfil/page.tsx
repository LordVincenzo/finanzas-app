import { createClient, requerirUsuario } from '@/lib/supabase/server'
import { cerrarSesion } from '@/app/auth/actions'
import { FormularioPerfil } from '@/components/formulario-perfil'
import { SelectorTema } from '@/components/selector-tema'

/**
 * En el celular esto vive en /mas (con los atajos de navegación) y en
 * /mas/perfil. En escritorio la navegación ya la lleva el sidebar, así
 * que los atajos no hacen falta: queda solo lo que de verdad es ajustes
 * —nombre, foto, apariencia y cerrar sesión— en una pantalla.
 */
export default async function PerfilEscritorioPage() {
  const supabase = await createClient()
  const user = await requerirUsuario(supabase)
  const { data: perfil } = await supabase
    .from('profiles')
    .select('display_name, avatar_url')
    .eq('id', user.id).single()

  return (
    <div>
      <div className="max-w-xl">
        <h1 className="text-[26px] font-semibold tracking-tight">Perfil</h1>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Tu nombre y tu foto los ve tu pareja. El correo no se puede cambiar
          desde aquí.
        </p>

        <section className="mt-6 rounded-2xl bg-card p-5 shadow-card
                            ring-1 ring-border/70">
          <FormularioPerfil
            nombreActual={perfil?.display_name ?? ''}
            fotoActual={perfil?.avatar_url ?? null}
            origen="escritorio"
          />
        </section>

        <section className="mt-6 overflow-hidden rounded-2xl bg-card
                            shadow-card ring-1 ring-border/70">
          <p className="px-5 pt-4 text-[11px] font-semibold uppercase
                        tracking-[0.09em] text-muted-foreground">
            Ajustes
          </p>
          <div className="mt-1 px-1.5 pb-1.5">
            <SelectorTema />
          </div>
          <div className="border-t border-border/70 px-5 py-3">
            <p className="text-[12px] text-muted-foreground">
              {user?.email}
            </p>
          </div>
        </section>

        <form action={cerrarSesion} className="mt-6">
          <button className="text-[13px] font-medium text-destructive
                             transition hover:opacity-80">
            Cerrar sesión
          </button>
        </form>
      </div>
    </div>
  )
}
