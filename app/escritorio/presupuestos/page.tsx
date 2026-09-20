import { Target } from 'lucide-react'
import { createClient, requerirUsuario } from '@/lib/supabase/server'
import { formatearCOP, mesActualBogota, soloNombreMes } from '@/lib/format'
import { FilaPresupuesto } from '@/components/fila-presupuesto'
import { NuevoPresupuesto } from '@/components/nuevo-presupuesto'

/**
 * Los topes de gasto, en escritorio.
 *
 * Misma pantalla que la del celular con otra distribución: aquí caben
 * tres columnas de tarjetas y el resumen arriba en una fila, en vez de
 * una tarjeta destacada y una lista.
 *
 * Los componentes de fila y de alta se comparten tal cual: son UI y
 * llamadas a RPC, no navegación. Ninguno redirige, así que no hace
 * falta una versión de escritorio de las acciones.
 */
export default async function PresupuestosEscritorioPage() {
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
    <div>
      <h1 className="text-[26px] font-semibold tracking-tight">
        Topes de gasto
      </h1>
      <p className="mt-1 text-[14px] text-muted-foreground">
        Cuánto quieres gastar al mes en cada cosa. Se ponen una vez y
        valen para todos los meses.
      </p>

      {presupuestos.length > 0 && (
        <div className="mt-6 grid grid-cols-3 gap-4">
          <TarjetaResumen
            etiqueta={`Te queda en ${soloNombreMes(mes)}`}
            valor={formatearCOP(queda)}
            tono={queda < 0 ? 'negativo' : 'neutro'}
          />
          <TarjetaResumen etiqueta="Llevas" valor={formatearCOP(gastado)} />
          <TarjetaResumen etiqueta="De un tope de" valor={formatearCOP(tope)} />
        </div>
      )}

      {presupuestos.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-border
                        px-6 py-10 text-center">
          <span className="mx-auto flex size-11 items-center justify-center
                           rounded-full bg-muted">
            <Target className="size-5 text-muted-foreground" />
          </span>
          <p className="mt-3 text-[15px] font-medium">Sin topes todavía</p>
          <p className="mx-auto mt-1.5 max-w-[40ch] text-[13px] leading-snug
                        text-muted-foreground">
            Empieza por una sola categoría, la que más se te va de las
            manos. Con cinco topes a la vez no se cumple ninguno.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2">
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

      <div className="mt-4 max-w-md">
        <NuevoPresupuesto categorias={sinTope} />
      </div>
    </div>
  )
}

function TarjetaResumen({
  etiqueta, valor, tono = 'neutro',
}: {
  etiqueta: string
  valor: string
  tono?: 'neutro' | 'negativo'
}) {
  return (
    <div className="rounded-2xl bg-card px-5 py-4 shadow-card
                    ring-1 ring-border/70">
      <p className="text-[12px] text-muted-foreground">{etiqueta}</p>
      <p className={`mt-1 text-[22px] font-semibold tabular-nums ${
        tono === 'negativo' ? 'text-negativo' : ''
      }`}>
        {valor}
      </p>
    </div>
  )
}
