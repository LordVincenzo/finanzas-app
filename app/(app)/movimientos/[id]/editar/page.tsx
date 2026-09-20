import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { createClient, requerirUsuario } from '@/lib/supabase/server'
import {
  FormularioMovimiento, type MovimientoEditable,
} from '@/components/formulario-movimiento'

/**
 * Corregir un movimiento.
 *
 * Reusa el formulario de registrar en vez de tener uno propio: las
 * reglas de qué cuenta va en qué lado, cómo se lee "20k" y qué campos
 * son obligatorios son las mismas, y dos formularios para lo mismo
 * acaban validando distinto.
 *
 * QUÉ CUENTA VA EN "cuenta" Y QUÉ EN "contraparte". El formulario
 * piensa en esos dos términos y no en origen/destino, porque en un
 * ingreso el dinero ENTRA a tu cuenta: la cuenta es el destino, no el
 * origen. Es la misma regla que ladosDelMovimiento() aplica al guardar,
 * leída al revés.
 */
export default async function EditarMovimientoPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const user = await requerirUsuario(supabase)

  const { data: mov } = await supabase
    .from('movimientos_detalle')
    .select('id, type, description, notes, occurred_at, monto, cuenta_origen_id, cuenta_destino_id')
    .eq('id', id)
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!mov) notFound()

  /* Los que no se editan se dicen aquí, con su motivo, en vez de dejar
     que falle el RPC después de rellenar el formulario entero. */
  if (mov.type === 'opening' || mov.type === 'adjustment') {
    return (
      <main className="px-4 pt-4 pb-[calc(8rem+env(safe-area-inset-bottom))]">
        <Link href="/movimientos"
              className="-my-2.5 -ml-1 inline-flex items-center gap-1 px-2 py-2.5
                         text-[13px] text-muted-foreground">
          <ChevronLeft className="size-4" /> Movimientos
        </Link>
        <h1 className="mt-1 text-[22px] font-semibold tracking-tight">
          Esto no se edita
        </h1>
        <p className="mt-2 max-w-[38ch] text-[14px] leading-snug
                      text-muted-foreground">
          {mov.type === 'opening'
            ? 'Es el saldo con el que empezó la cuenta. Para corregirlo, registra un ajuste de saldo: así queda constancia de que hubo una corrección en vez de cambiar la historia.'
            : 'Un ajuste ya es una corrección. Si el saldo sigue sin cuadrar, registra otro ajuste con el número bueno.'}
        </p>
      </main>
    )
  }

  const { data: todas } = await supabase
    .from('accounts')
    .select('id, name, class, type')
    .eq('owner_id', user.id)
    .eq('is_active', true)
    .eq('is_opening', false)
    .order('name')

  const lista = todas ?? []
  const cuentas = lista
    .filter((a) => a.class === 'asset' || a.class === 'liability')
    .map((a) => ({ id: a.id, name: a.name, type: a.type }))
  const categoriasGasto = lista
    .filter((a) => a.class === 'expense')
    .map((a) => ({ id: a.id, name: a.name }))
  const categoriasIngreso = lista
    .filter((a) => a.class === 'income')
    .map((a) => ({ id: a.id, name: a.name }))

  const esIngreso = mov.type === 'income'

  const edicion: MovimientoEditable = {
    id: mov.id as string,
    tipo: mov.type as MovimientoEditable['tipo'],
    monto: Number(mov.monto),
    // En un ingreso el dinero entra a tu cuenta, así que la "cuenta" es
    // el destino. En gasto y traslado, el origen.
    cuenta: (esIngreso ? mov.cuenta_destino_id : mov.cuenta_origen_id) as string,
    contraparte: (esIngreso ? mov.cuenta_origen_id : mov.cuenta_destino_id) as string,
    descripcion: (mov.description as string) ?? '',
    fecha: instanteABogota(mov.occurred_at as string),
    notas: (mov.notes as string) ?? '',
  }

  return (
    <main className="px-4 pt-4 pb-[calc(8rem+env(safe-area-inset-bottom))]">
      <Link href="/movimientos"
            className="-my-2.5 -ml-1 inline-flex items-center gap-1 px-2 py-2.5
                       text-[13px] text-muted-foreground">
        <ChevronLeft className="size-4" /> Movimientos
      </Link>

      <h1 className="mt-1 text-[22px] font-semibold tracking-tight">
        Corregir movimiento
      </h1>
      <p className="mt-1 text-[13px] leading-snug text-muted-foreground">
        Se guarda sobre el mismo movimiento: no se crea uno nuevo ni se
        duplica nada.
      </p>

      <FormularioMovimiento
        cuentas={cuentas}
        categoriasGasto={categoriasGasto}
        categoriasIngreso={categoriasIngreso}
        ahora={edicion.fecha}
        edicion={edicion}
      />
    </main>
  )
}

/**
 * Un instante UTC -> "2026-09-20T16:09" en hora de Bogotá, que es lo
 * que entiende un <input type="datetime-local">.
 *
 * Con Intl y no cortando el ISO: el ISO está en UTC, y a las 8 de la
 * noche en Bogotá ya es el día siguiente allí. El formulario mostraría
 * otro día del que tiene el movimiento.
 */
function instanteABogota(iso: string): string {
  const partes = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Bogota',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(iso))
  return partes.replace(' ', 'T')
}
