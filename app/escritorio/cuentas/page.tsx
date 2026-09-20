import Link from 'next/link'
import { Plus } from 'lucide-react'
import { createClient, requerirUsuario } from '@/lib/supabase/server'
import { formatearCOP, notaEnMetas } from '@/lib/format'
import {
  ETIQUETAS_TIPO, ORDEN_TIPOS_CUENTA, cuentaVisible, esDeuda,
} from '@/lib/tipos'
import { SaldoEditable } from '@/components/saldo-editable'
import { FechasTarjeta } from '@/components/fechas-tarjeta'

type CuentaFila = {
  account_id: string
  name: string
  type: string
  class: string
  balance: number
}

// Cuentas gobernadas por otro flujo (Préstamos, Pareja): se ven en su
// propio bloque, de "Por cobrar", y su saldo no se edita aquí para no
// pasar por encima de ese seguimiento.
const TIPOS_POR_COBRAR = ['receivable', 'partner_receivable']

export default async function CuentasEscritorioPage() {
  const supabase = await createClient()
  const user = await requerirUsuario(supabase)

  const [
    { data },
    { data: resumen },
    { data: patri },
    { data: ctaPendiente },
    { data: fechasDeuda },
  ] = await Promise.all([
    /* owner_id explícito. Aquí el error era peor que en el celular: las
       cuentas shared_view de tu pareja salían en el bloque "Tus cuentas"
       con el saldo editable, y al hacer clic el RPC contestaba "Solo
       puedes ajustar tus propias cuentas" — un control que se ofrecía
       sin poder funcionar. */
    supabase.from('account_balances')
      .select('account_id, name, type, class, balance')
      .eq('owner_id', user.id)
      .in('class', ['asset', 'liability'])
      .eq('is_active', true)
      .order('name'),
    // Misma vista que usan Inicio, Cuentas y Ahorros del celular: es la
    // fuente única del "disponible" (ver CLAUDE.md). account_id permite
    // además avisar, cuenta por cuenta, cuánto de su saldo ya está
    // reservado en una meta.
    supabase.from('cuentas_disponible')
      .select('account_id, saldo, asignado, disponible').eq('owner_id', user.id),
    supabase.from('patrimonio_detalle')
      .select('por_cobrar, deudas').eq('owner_id', user.id).maybeSingle(),
    /* Cuál es tu cuenta "Pendiente de ubicar", para esconderla cuando
       está en $0 (ver cuentaVisible en lib/tipos.ts). Dentro del mismo
       Promise.all: no añade espera. */
    supabase.from('accounts')
      .select('id')
      .eq('owner_id', user.id).eq('is_pending_location', true)
      .maybeSingle(),
    /* Corte y pago de las deudas. account_balances no los expone:
       es una vista de 0001. */
    supabase.from('accounts')
      .select('id, dia_corte, dia_pago')
      .eq('owner_id', user.id).eq('class', 'liability').eq('is_active', true),
  ])

  const cuentas = (data ?? []) as CuentaFila[]

  const fechas = new Map(
    (fechasDeuda ?? []).map((f) => [
      f.id as string,
      { corte: f.dia_corte as number | null, pago: f.dia_pago as number | null },
    ])
  )
  const visibles = cuentas.filter((c) =>
    cuentaVisible(c.type, Number(c.balance), c.account_id === ctaPendiente?.id))

  const filas = resumen ?? []
  const disponible = filas.reduce((s, c) => s + Number(c.disponible), 0)
  const asignado = filas.reduce((s, c) => s + Number(c.asignado), 0)
  /* El saldo BRUTO, solo para poder decir de cuanto sale el
     disponible. Sin esa frase, "Disponible" y "Comprometido en
     metas" uno al lado del otro se leen como si el segundo
     estuviera dentro del primero. */
  const enCuentas = filas.reduce((s, c) => s + Number(c.saldo), 0)
  const porCobrar = Number(patri?.por_cobrar ?? 0)
  const deudas = Number(patri?.deudas ?? 0)
  const asignadoPorCuenta = new Map(filas.map((c) => [c.account_id, Number(c.asignado)]))

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

  // Dos bloques, no una sola tabla larga: mezclar dinero que tienes con
  // dinero que te deben hacía parecer que había muchas más cuentas de
  // las que en verdad hay.
  const cuentasDinero = ordenados.filter(([tipo]) => !TIPOS_POR_COBRAR.includes(tipo))
  const cuentasPorCobrar = ordenados.filter(([tipo]) => TIPOS_POR_COBRAR.includes(tipo))

  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight">Cuentas</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Clic sobre un saldo para ajustarlo.
          </p>
        </div>
        <Link href="/escritorio/cuentas/nueva"
              className="flex h-9 items-center gap-1.5 rounded-full bg-primary
                         px-4 text-[13px] font-medium text-primary-foreground
                         shadow-card transition hover:opacity-90">
          <Plus className="size-4" /> Nueva cuenta
        </Link>
      </div>

      {cuentas.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-border px-6 py-12 text-center">
          <p className="text-[15px] font-medium">Aún no tienes cuentas</p>
          <p className="mx-auto mt-1.5 max-w-[40ch] text-[13px] text-muted-foreground">
            Registra dónde tienes tu dinero hoy: Nu, Nequi, efectivo, lo que uses.
          </p>
          <Link href="/escritorio/cuentas/nueva"
                className="mt-4 inline-flex h-11 items-center rounded-xl bg-primary
                           px-5 text-[14px] font-medium text-primary-foreground shadow-card">
            Crear la primera
          </Link>
        </div>
      ) : (
        <>
          {/* La cuarta tarjeta solo si debes algo. Con tarjetas de
              crédito el patrimonio baja, y hasta ahora nada decía por
              qué: patrimonio_detalle.deudas existía desde 0012 sin que
              ninguna pantalla lo pintara. */}
          <div className={`mt-6 grid gap-4 ${deudas !== 0 ? 'grid-cols-4' : 'grid-cols-3'}`}>
            {/* La nota es la que evita que "Disponible" y
                "Comprometido en metas" se lean como si el segundo
                estuviera dentro del primero. Estan al lado y no dentro:
                disponible ya resto lo de metas. */}
            <TarjetaResumen etiqueta="Disponible"
                            valor={formatearCOP(disponible)}
                            nota={asignado > 0
                              ? `De ${formatearCOP(enCuentas)} en cuentas`
                              : undefined} />
            <TarjetaResumen etiqueta="Comprometido en metas" valor={formatearCOP(asignado)} />
            <TarjetaResumen etiqueta="Por cobrar" valor={formatearCOP(porCobrar)} />
            {deudas !== 0 && (
              <TarjetaResumen etiqueta="Debes" valor={formatearCOP(Math.abs(deudas))} />
            )}
          </div>

          {cuentasDinero.length > 0 && (
            <section className="mt-8">
              <h2 className="px-1 text-[13px] font-semibold">Tus cuentas</h2>
              <BloqueCuentas grupos={cuentasDinero}
                            asignadoPorCuenta={asignadoPorCuenta}
                            editable fechas={fechas} />
            </section>
          )}

          {cuentasPorCobrar.length > 0 && (
            <section className="mt-8">
              <h2 className="px-1 text-[13px] font-semibold">Por cobrar</h2>
              <p className="px-1 text-[12px] text-muted-foreground">
                Dinero que te deben, no dinero que tienes hoy.
              </p>
              <div className="mt-3">
                <BloqueCuentas grupos={cuentasPorCobrar} asignadoPorCuenta={asignadoPorCuenta} editable={false} />
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}

/**
 * Las cuentas, en tarjetas.
 *
 * POR QUÉ NO FILAS. En el celular una fila es lo correcto: 390px de
 * ancho, el nombre a la izquierda y la cifra a la derecha, y el ojo
 * recorre 8cm. Aquí el área útil son 1130px, y esa misma fila deja
 * un metro de vacío entre el nombre y su saldo: hay que cruzar la
 * pantalla con la vista para emparejar dos datos que van juntos.
 *
 * En tarjetas, cada cuenta es una unidad y caben tres por fila. La
 * misma información ocupa un tercio del alto y no obliga a barrer.
 *
 * Es el mismo dato con otra forma, que es de lo que van las dos
 * interfaces de este proyecto.
 */
function BloqueCuentas({
  grupos, asignadoPorCuenta, editable, fechas,
}: {
  grupos: [string, CuentaFila[]][]
  asignadoPorCuenta: Map<string, number>
  editable: boolean
  /** Corte y pago de las deudas, para poder ponerlos desde aquí. */
  fechas?: Map<string, { corte: number | null; pago: number | null }>
}) {
  return (
    <div className="mt-3 space-y-6">
      {grupos.map(([tipo, lista]) => (
        <div key={tipo}>
          <p className="text-[11px] font-semibold uppercase
                        tracking-[0.09em] text-muted-foreground">
            {ETIQUETAS_TIPO[tipo] ?? 'Otras'}
          </p>
          <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2
                          xl:grid-cols-3">
            {lista.map((c) => {
              const enMetas = asignadoPorCuenta.get(c.account_id) ?? 0
              const f = fechas?.get(c.account_id)
              return (
                <div key={c.account_id}
                     className="rounded-2xl bg-card shadow-card
                                ring-1 ring-border/70">
                  <div className="px-5 py-4">
                    {/* El nombre y su cifra, uno encima del otro: no hay
                        nada que recorrer entre los dos. */}
                    <Link href={`/escritorio/movimientos?cuenta=${c.account_id}`}
                          className="block truncate text-[14px]
                                     text-muted-foreground transition
                                     hover:text-foreground">
                      {nombreCorto(c.name, c.type)}
                    </Link>

                    <div className="mt-1 text-[22px] font-semibold">
                      {editable ? (
                        <SaldoEditable
                          cuentaId={c.account_id}
                          disponible={Number(c.balance) - enMetas}
                          asignado={enMetas}
                          deuda={esDeuda(c.type)}
                        />
                      ) : (
                        <span className="tabular-nums">
                          {formatearCOP(Number(c.balance))}
                        </span>
                      )}
                    </div>

                    {/* Sin esto, "$1.612.200" en Nu parece todo
                        disponible aunque una meta ya se haya quedado
                        con una parte. */}
                    {enMetas > 0 && (
                      <p className="mt-1 truncate text-[12px]
                                    text-muted-foreground tabular-nums">
                        {notaEnMetas(enMetas)}
                      </p>
                    )}
                  </div>

                  {/* Solo las deudas tienen fecha de pago. */}
                  {f && (
                    <div className="border-t border-border/70">
                      <FechasTarjeta
                        cuentaId={c.account_id}
                        nombre={c.name}
                        corte={f.corte}
                        pago={f.pago}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

function TarjetaResumen({
  etiqueta, valor, nota,
}: {
  etiqueta: string
  valor: string
  nota?: string
}) {
  return (
    <div className="rounded-2xl bg-card p-4 shadow-card ring-1 ring-border/70">
      <p className="text-[12px] text-muted-foreground">{etiqueta}</p>
      <p className="mt-0.5 text-[20px] font-semibold tabular-nums">{valor}</p>
      {nota && (
        <p className="mt-1 text-[11px] text-muted-foreground tabular-nums">
          {nota}
        </p>
      )}
    </div>
  )
}

/**
 * "Por cobrar: Abuela" bajo un grupo ya titulado "Por cobrar" repite la
 * palabra. El nombre completo se conserva en la base de datos.
 */
function nombreCorto(nombre: string, tipo: string): string {
  if (tipo !== 'receivable') return nombre
  return nombre.replace(/^por cobrar:\s*/i, '') || nombre
}
