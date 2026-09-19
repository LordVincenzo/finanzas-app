import Link from 'next/link'
import { createClient, requerirUsuario } from '@/lib/supabase/server'
import {
  FormularioMovimiento, type TipoMovimiento,
} from '@/components/formulario-movimiento'
import { PaginaFormulario } from '@/components/pagina-escritorio'

const TIPOS_VALIDOS: TipoMovimiento[] = ['expense', 'income', 'transfer', 'adjustment']

/** "2026-08-09T12:32" en hora de Bogotá, para el valor por defecto. */
function ahoraEnBogota(): string {
  const partes = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Bogota',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date())
  return partes.replace(' ', 'T')
}

/**
 * Desde el escritorio no se podía registrar un movimiento: había
 * filtros e historial, pero ninguna forma de añadir un gasto. Era el
 * hueco más raro de las dos interfaces, porque con teclado es más
 * rápido que en el celular.
 */
export default async function NuevoMovimientoEscritorioPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string }>
}) {
  const { tipo } = await searchParams
  const tipoInicial = TIPOS_VALIDOS.find((t) => t === tipo)

  const supabase = await createClient()
  const user = await requerirUsuario(supabase)

  // Solo tus cuentas y tus categorías — ver el comentario del celular.
  const { data } = await supabase
    .from('accounts')
    .select('id, name, class, type')
    .eq('owner_id', user.id)
    .eq('is_active', true)
    .eq('is_opening', false)
    .order('name')

  const todas = data ?? []

  // Las cuentas por cobrar y el balance de pareja NO son de gasto libre:
  // se mueven desde Préstamos y desde Pareja, con su propio seguimiento.
  const EXCLUIDAS = ['receivable', 'partner_receivable']

  const cuentas = todas.filter(
    (a) => (a.class === 'asset' || a.class === 'liability')
        && !EXCLUIDAS.includes(a.type)
  )
  const categoriasGasto = todas.filter((a) => a.class === 'expense')
  const categoriasIngreso = todas.filter((a) => a.class === 'income')

  if (cuentas.length === 0) {
    return (
      <PaginaFormulario
        volverA="/escritorio/movimientos"
        volverTexto="Movimientos"
        titulo="Registrar movimiento"
      >
        <div className="mt-6 rounded-2xl border border-dashed border-border
                        px-6 py-12 text-center">
          <p className="text-[15px] font-medium">
            Primero necesitas al menos una cuenta
          </p>
          <p className="mx-auto mt-1.5 max-w-[40ch] text-[13px]
                        text-muted-foreground">
            Un movimiento siempre sale de algún sitio y entra en otro.
          </p>
          <Link
            href="/escritorio/cuentas/nueva"
            className="mt-4 inline-flex h-11 items-center rounded-xl bg-primary
                       px-5 text-[14px] font-medium text-primary-foreground
                       shadow-card"
          >
            Crear una cuenta
          </Link>
        </div>
      </PaginaFormulario>
    )
  }

  return (
    <PaginaFormulario
      volverA="/escritorio/movimientos"
      volverTexto="Movimientos"
      titulo="Registrar movimiento"
    >
      <FormularioMovimiento
        cuentas={cuentas}
        categoriasGasto={categoriasGasto}
        categoriasIngreso={categoriasIngreso}
        ahora={ahoraEnBogota()}
        tipoInicial={tipoInicial}
        origen="escritorio"
      />
    </PaginaFormulario>
  )
}
