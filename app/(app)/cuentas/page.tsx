import Link from 'next/link'
import { Plus } from 'lucide-react'
import { createClient, requerirUsuario } from '@/lib/supabase/server'
import { formatearCOP } from '@/lib/format'
import { ETIQUETAS_TIPO, ORDEN_TIPOS_CUENTA, cuentaVisible } from '@/lib/tipos'
import { Seccion, Lista, Fila, Monto } from '@/components/seccion'
import { CifraAnimada } from '@/components/cifra-animada'
import {
  TarjetaDestacada, Reparto, DosRepartos, TresRepartos,
} from '@/components/tarjeta-destacada'

type CuentaFila = {
  account_id: string
  name: string
  type: string
  class: string
  balance: number
}

export default async function CuentasPage() {
  const supabase = await createClient()
  const user = await requerirUsuario(supabase)

  const [
    { data },
    { data: resumen },
    { data: patri },
    { data: ctaPendiente },
  ] = await Promise.all([
    /* owner_id explícito. Sin él, esta lista traía también las cuentas
       shared_view de tu pareja, sin distinguirlas de las tuyas — y la
       tarjeta "Disponible" de arriba sí filtra por dueño (sale de
       cuentas_disponible). Las filas y el total no cuadraban. Lo que
       ella comparte se ve en /pareja, con su nombre al lado. */
    supabase.from('account_balances')
      .select('account_id, name, type, class, balance')
      .eq('owner_id', user.id)
      .in('class', ['asset', 'liability'])
      .eq('is_active', true)
      .order('name'),
    // Antes esta pantalla sumaba el disponible por su cuenta y daba un
    // número distinto al de Inicio y Ahorros. La vista es la fuente
    // única: ya sabe qué cuentas cuentan y cuánto está comprometido.
    // account_id además sirve para avisar, cuenta por cuenta, cuánto de
    // su saldo ya tiene dueño en una meta — sin eso, ver "$1.612.200"
    // en Nu hace pensar que todo ese dinero está libre.
    supabase.from('cuentas_disponible')
      .select('account_id, saldo, asignado, disponible').eq('owner_id', user.id),
    supabase.from('patrimonio_detalle')
      .select('por_cobrar, patrimonio, deudas')
      .eq('owner_id', user.id).maybeSingle(),
    /* Cuál es tu cuenta "Pendiente de ubicar", para esconderla cuando
       está en $0 (ver cuentaVisible en lib/tipos.ts). Va dentro del
       mismo Promise.all, así que no añade ni un milisegundo de espera.
       No sale de account_balances porque esa vista es de 0001 y no
       expone is_pending_location. */
    supabase.from('accounts')
      .select('id')
      .eq('owner_id', user.id).eq('is_pending_location', true)
      .maybeSingle(),
  ])

  const cuentas = (data ?? []) as CuentaFila[]

  const filas = resumen ?? []
  const enCuentas = filas.reduce((s, c) => s + Number(c.saldo), 0)
  const comprometido = filas.reduce((s, c) => s + Number(c.asignado), 0)
  const libre = filas.reduce((s, c) => s + Number(c.disponible), 0)

  const porCobrar = Number(patri?.por_cobrar ?? 0)
  const deudas = Number(patri?.deudas ?? 0)
  const patrimonio = Number(patri?.patrimonio ?? 0)

  const asignadoPorCuenta = new Map(filas.map((c) => [c.account_id, Number(c.asignado)]))

  const visibles = cuentas.filter((c) =>
    cuentaVisible(c.type, Number(c.balance), c.account_id === ctaPendiente?.id))

  const grupos = new Map<string, CuentaFila[]>()
  for (const c of visibles) {
    const lista = grupos.get(c.type) ?? []
    lista.push(c)
    grupos.set(c.type, lista)
  }

  const ordenados = [...grupos.entries()].sort((a, b) => {
    const ia = ORDEN_TIPOS_CUENTA.indexOf(a[0])
    const ib = ORDEN_TIPOS_CUENTA.indexOf(b[0])
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
  })

  return (
    <main className="px-4 pt-4 pb-[calc(8rem+env(safe-area-inset-bottom))]">
      <div className="aparece flex items-center justify-between gap-3 px-1">
        <h1 className="text-[22px] font-semibold tracking-tight">Cuentas</h1>
        <Link href="/cuentas/nueva" aria-label="Nueva cuenta"
              className="flex size-10 items-center justify-center rounded-full
                         bg-card shadow-card ring-1 ring-border/70 transition
                         active:scale-95">
          <Plus className="size-[18px]" />
        </Link>
      </div>

      {cuentas.length > 0 && (
        <div className="mt-3">
          <TarjetaDestacada
            etiqueta="Disponible"
            valor={<CifraAnimada valor={libre} />}
            pie={comprometido > 0
              ? `De ${formatearCOP(enCuentas)} en cuentas, ${formatearCOP(comprometido)} reservados en metas`
              : undefined}
            retraso={50}
          >
            {/* La columna de "Debes" solo sale si debes algo: una
                columna en $0 ocupa sitio sin decir nada. Antes no existía
                y una tarjeta de crédito bajaba el patrimonio en silencio. */}
            {deudas !== 0 ? (
              <TresRepartos>
                <Reparto etiqueta="Por cobrar" valor={formatearCOP(porCobrar)} />
                <Reparto etiqueta="Debes" valor={formatearCOP(Math.abs(deudas))} />
                <Reparto etiqueta="Patrimonio" valor={formatearCOP(patrimonio)} />
              </TresRepartos>
            ) : (
              <DosRepartos>
                <Reparto etiqueta="Por cobrar" valor={formatearCOP(porCobrar)} />
                <Reparto etiqueta="Patrimonio" valor={formatearCOP(patrimonio)} />
              </DosRepartos>
            )}
          </TarjetaDestacada>
        </div>
      )}

      {cuentas.length === 0 ? (
        <div className="aparece mt-8 rounded-2xl border border-dashed
                        border-border px-5 py-7 text-center"
             style={{ '--retraso': '100ms' } as React.CSSProperties}>
          <p className="text-[15px] font-medium">Aún no tienes cuentas</p>
          <p className="mx-auto mt-1.5 max-w-[28ch] text-[13px] leading-snug
                        text-muted-foreground">
            Registra dónde tienes tu dinero hoy: Nu, Nequi, efectivo, lo
            que uses.
          </p>
          <Link href="/cuentas/nueva"
                className="mt-4 inline-flex min-h-11 items-center rounded-xl
                           bg-primary px-5 text-[14px] font-medium
                           text-primary-foreground shadow-card">
            Crear la primera
          </Link>
        </div>
      ) : (
        ordenados.map(([tipo, lista], g) => (
          <Seccion key={tipo} titulo={ETIQUETAS_TIPO[tipo] ?? 'Otras'}>
            <div className="aparece"
                 style={{ '--retraso': `${140 + g * 70}ms` } as React.CSSProperties}>
              <Lista>
                {lista.map((c) => {
                  const asignado = asignadoPorCuenta.get(c.account_id) ?? 0
                  // Se muestra el disponible (saldo menos lo comprometido en
                  // metas), no el saldo real: mostrar el saldo real hacía
                  // pensar que ese dinero también estaba libre para gastar.
                  const disponibleCuenta = Number(c.balance) - asignado
                  return (
                    <Fila
                      key={c.account_id}
                      titulo={nombreCorto(c.name, tipo)}
                      detalle={asignado > 0
                        ? `${formatearCOP(asignado)} en metas`
                        : undefined}
                      valor={
                        <Monto
                          valor={disponibleCuenta}
                          tono={disponibleCuenta < 0 ? 'negativo' : 'neutro'}
                          formato={formatearCOP}
                        />
                      }
                    />
                  )
                })}
              </Lista>
            </div>
          </Seccion>
        ))
      )}
    </main>
  )
}

/**
 * "Por cobrar: Abuela" bajo un grupo titulado "Por cobrar" repite la
 * palabra en cada línea. El nombre completo se conserva en la base de
 * datos, donde sí hace falta el contexto.
 */
function nombreCorto(nombre: string, tipo: string): string {
  if (tipo !== 'receivable') return nombre
  return nombre.replace(/^por cobrar:\s*/i, '') || nombre
}