import Link from 'next/link'
import { ChevronLeft, Target } from 'lucide-react'
import { createClient, requerirUsuario } from '@/lib/supabase/server'
import { formatearCOP, mesActualBogota, soloNombreMes } from '@/lib/format'
import { FilaPresupuesto } from '@/components/fila-presupuesto'
import { NuevoPresupuesto } from '@/components/nuevo-presupuesto'
import { TarjetaDestacada, Reparto, Repartos } from '@/components/tarjeta-destacada'
import { CifraAnimada } from '@/components/cifra-animada'

/**
 * Los topes de gasto del mes.
 *
 * QUÉ AÑADE sobre lo que ya había. Inicio dice cuánto gastaste y si es
 * más o menos que el mes pasado. Eso responde "¿voy como siempre?".
 * Esto responde "¿voy como quería?", que no es lo mismo: llevar tres
 * meses gastando de más de forma estable sale igual de tranquilo en la
 * comparación con el mes pasado.
 *
 * Los topes se ponen una vez y valen para todos los meses. Un
 * presupuesto que hay que volver a escribir cada mes es un presupuesto
 * que se abandona en febrero.
 */
export default async function PresupuestosPage() {
  const supabase = await createClient()
  const user = await requerirUsuario(supabase)

  const mes = mesActualBogota()

  const [{ data: filas }, { data: todasCategorias }] = await Promise.all([
    supabase.from('presupuestos_del_mes')
      .select('categoria_id, categoria, tope, gastado, restante, porcentaje')
      .eq('owner_id', user.id).eq('mes', mes)
      .order('categoria'),
    supabase.from('accounts')
      .select('id, name')
      .eq('owner_id', user.id).eq('class', 'expense').eq('is_active', true)
      .order('name'),
  ])

  const presupuestos = filas ?? []
  const conTope = new Set(presupuestos.map((p) => p.categoria_id))
  const sinTope = (todasCategorias ?? [])
    .filter((c) => !conTope.has(c.id))
    .map((c) => ({ id: c.id as string, name: c.name as string }))

  const tope = presupuestos.reduce((s, p) => s + Number(p.tope), 0)
  const gastado = presupuestos.reduce((s, p) => s + Number(p.gastado), 0)
  const queda = tope - gastado

  return (
    <main className="px-4 pt-4 pb-[calc(8rem+env(safe-area-inset-bottom))]">
      <div className="aparece">
        <Link href="/mas"
              className="-my-2.5 inline-flex items-center gap-1 px-1 py-2.5
                         text-[13px] text-muted-foreground">
          <ChevronLeft className="size-4" /> Más
        </Link>
        <h1 className="mt-1 px-1 text-[22px] font-semibold tracking-tight">
          Topes de gasto
        </h1>
        <p className="mt-1 px-1 text-[13px] leading-snug text-muted-foreground">
          Cuánto quieres gastar al mes en cada cosa. Se ponen una vez y
          valen para todos los meses.
        </p>
      </div>

      {presupuestos.length > 0 && (
        <div className="mt-3">
          <TarjetaDestacada
            etiqueta={`Te queda en ${soloNombreMes(mes)}`}
            valor={<CifraAnimada valor={queda} />}
            retraso={50}
          >
            <Repartos>
              {[
                <Reparto key="gastado" etiqueta="Llevas"
                         valor={formatearCOP(gastado)} />,
                <Reparto key="tope" etiqueta="De un tope de"
                         valor={formatearCOP(tope)} />,
              ]}
            </Repartos>
          </TarjetaDestacada>
        </div>
      )}

      {presupuestos.length === 0 ? (
        <div className="aparece mt-6 rounded-2xl border border-dashed
                        border-border px-5 py-8 text-center"
             style={{ '--retraso': '80ms' } as React.CSSProperties}>
          <span className="mx-auto flex size-11 items-center justify-center
                           rounded-full bg-muted">
            <Target className="size-5 text-muted-foreground" />
          </span>
          <p className="mt-3 text-[15px] font-medium">Sin topes todavía</p>
          <p className="mx-auto mt-1.5 max-w-[32ch] text-[13px] leading-snug
                        text-muted-foreground">
            Empieza por una sola categoría, la que más se te va de las
            manos. Con cinco topes a la vez no se cumple ninguno.
          </p>
        </div>
      ) : (
        <div className="aparece mt-3 space-y-2"
             style={{ '--retraso': '100ms' } as React.CSSProperties}>
          {presupuestos.map((p) => (
            <FilaPresupuesto
              key={p.categoria_id}
              categoriaId={p.categoria_id as string}
              categoria={p.categoria as string}
              tope={Number(p.tope)}
              gastado={Number(p.gastado)}
            />
          ))}
        </div>
      )}

      <div className="aparece mt-3"
           style={{ '--retraso': '160ms' } as React.CSSProperties}>
        <NuevoPresupuesto categorias={sinTope} />
      </div>
    </main>
  )
}
