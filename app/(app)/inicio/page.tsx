import Link from 'next/link'
import { Users, Wallet, HandCoins, Heart, ArrowRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { formatearCOP } from '@/lib/format'
import { Seccion, Lista, Fila } from '@/components/seccion'
import { BarraProgreso } from '@/components/barra-progreso'

function mesActual(): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Bogota', year: 'numeric', month: '2-digit',
  }).format(new Date()).slice(0, 7)
}

export default async function InicioPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const mes = mesActual()
  const desde = `${mes}-01`
  const [anio, m] = mes.split('-').map(Number)
  const hasta = new Date(Date.UTC(anio, m, 0)).toISOString().slice(0, 10)

  const [{ data: perfil }, { data: detalle }, { data: delMes }, { data: metas }] =
    await Promise.all([
      supabase.from('profiles')
        .select('display_name').eq('id', user!.id).single(),
      supabase.from('patrimonio_detalle')
        .select('liquido, ahorros, inversiones, por_cobrar, deudas, patrimonio')
        .eq('owner_id', user!.id).maybeSingle(),
      supabase.from('movimientos_detalle')
        .select('type, monto, cuenta_destino')
        .gte('occurred_on', desde).lte('occurred_on', hasta)
        .in('type', ['expense', 'income']),
      // Las metas más cercanas a cumplirse: son las que motivan.
      supabase.from('metas_resumen')
        .select('id, name, target_amount, acumulado, progreso, visibility')
        .eq('is_archived', false)
        .order('progreso', { ascending: false })
        .limit(2),
    ])

  const total = Number(detalle?.patrimonio ?? 0)
  const disponible =
    Number(detalle?.liquido ?? 0) +
    Number(detalle?.ahorros ?? 0) +
    Number(detalle?.inversiones ?? 0)
  const porCobrar = Number(detalle?.por_cobrar ?? 0)

  const movs = delMes ?? []
  const gastos = movs.filter((x) => x.type === 'expense')
    .reduce((s, x) => s + Number(x.monto), 0)
  const ingresos = movs.filter((x) => x.type === 'income')
    .reduce((s, x) => s + Number(x.monto), 0)
  const balance = ingresos - gastos

  const acumulado = new Map<string, number>()
  for (const mov of movs) {
    if (mov.type !== 'expense') continue
    acumulado.set(mov.cuenta_destino,
      (acumulado.get(mov.cuenta_destino) ?? 0) + Number(mov.monto))
  }
  const categorias = [...acumulado.entries()]
    .map(([nombre, valor]) => ({ nombre, valor }))
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 4)

  const nombreMes = new Intl.DateTimeFormat('es-CO', {
    month: 'long', timeZone: 'America/Bogota',
  }).format(new Date())

  // Cuenta recién creada: mejor una invitación a empezar que tres ceros.
  const sinMovimientos = movs.length === 0
  const cuentaNueva = sinMovimientos && total === 0

  return (
    <main className="px-4 pb-28 pt-6">
      <header>
        <p className="text-[14px] text-muted-foreground">
          Hola, {perfil?.display_name}
        </p>
        <p className="mt-5 text-[12px] uppercase tracking-wider
                      text-muted-foreground">
          Patrimonio
        </p>
        <p className="mt-1 text-[40px] font-semibold leading-none
                      tracking-tight tabular-nums">
          {formatearCOP(total)}
        </p>

        {/* El patrimonio no es lo que puedes gastar: hay que separarlo.
            Si no has prestado nada, "Por cobrar" no aporta: ocupa sitio
            para decir cero. */}
        {porCobrar > 0 ? (
          <div className="mt-5 grid grid-cols-2 divide-x rounded-xl border">
            <Reparto etiqueta="Disponible" valor={disponible} />
            <Reparto etiqueta="Por cobrar" valor={porCobrar} />
          </div>
        ) : (
          <div className="mt-5 rounded-xl border">
            <Reparto etiqueta="Disponible para gastar" valor={disponible} />
          </div>
        )}
      </header>

      {cuentaNueva ? (
        <Seccion titulo="Empezar">
          <div className="rounded-xl border border-dashed px-5 py-8 text-center">
            <p className="text-[15px] font-medium">Aún no hay movimientos</p>
            <p className="mx-auto mt-1.5 max-w-[26ch] text-[13px] leading-snug
                          text-muted-foreground">
              Crea tus cuentas con el saldo que tienen hoy y registra tu
              primer gasto.
            </p>
            <Link
              href="/cuentas/nueva"
              className="mt-5 inline-flex min-h-11 items-center rounded-lg
                         bg-foreground px-5 text-[14px] font-medium
                         text-background"
            >
              Crear una cuenta
            </Link>
          </div>
        </Seccion>
      ) : (
        <Seccion titulo={nombreMes}>
          <div className="rounded-xl border">
            <div className="grid grid-cols-2 divide-x">
              <Dato etiqueta="Ingresos" valor={ingresos} tono="positivo" />
              <Dato etiqueta="Gastos" valor={gastos} tono="negativo" />
            </div>
            <div className="flex items-center justify-between border-t px-4 py-3">
              <p className="text-[13px] text-muted-foreground">
                {balance < 0 ? 'Gastaste de más' : 'Te queda'}
              </p>
              <p className={`text-[17px] font-semibold tabular-nums
                             ${balance < 0 ? 'text-negativo' : ''}`}>
                {formatearCOP(balance)}
              </p>
            </div>
          </div>
        </Seccion>
      )}

      {/* Metas: lo que estás construyendo, no solo lo que gastaste */}
      {(metas ?? []).length > 0 && (
        <Seccion
          titulo="Tus metas"
          accion={
            <Link href="/ahorros"
                  className="text-[12px] text-muted-foreground underline">
              Ver todas
            </Link>
          }
        >
          <div className="space-y-2">
            {(metas ?? []).map((meta) => (
              <Link key={meta.id} href={`/ahorros/${meta.id}`}
                    className="block rounded-xl border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-medium leading-tight">
                      {meta.name}
                    </p>
                    <p className="mt-1 truncate text-[12px] leading-tight
                                  text-muted-foreground tabular-nums">
                      {formatearCOP(Number(meta.acumulado))} de{' '}
                      {formatearCOP(Number(meta.target_amount))}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {meta.visibility === 'joint' && (
                      <Users className="size-3.5 text-muted-foreground" />
                    )}
                    <span className="text-[15px] font-semibold tabular-nums">
                      {meta.progreso}%
                    </span>
                  </div>
                </div>
                <div className="mt-3">
                  <BarraProgreso progreso={Number(meta.progreso)} />
                </div>
              </Link>
            ))}
          </div>
        </Seccion>
      )}

      {categorias.length > 0 && gastos > 0 && (
        <Seccion
          titulo="En qué gastaste"
          accion={
            <Link href="/movimientos"
                  className="text-[12px] text-muted-foreground underline">
              Ver todo
            </Link>
          }
        >
          <Lista>
            {categorias.map((c) => (
              <Fila
                key={c.nombre}
                titulo={c.nombre}
                detalle={`${Math.round((c.valor / gastos) * 100)}% del mes`}
                valor={formatearCOP(c.valor)}
              />
            ))}
          </Lista>
        </Seccion>
      )}

      <Seccion titulo="Ir a">
        <Lista>
          <Atajo href="/cuentas" etiqueta="Cuentas"
                 detalle="Dónde tienes tu dinero" icono={Wallet} />
          <Atajo href="/prestamos" etiqueta="Préstamos"
                 detalle="Dinero que te deben" icono={HandCoins} />
          <Atajo href="/pareja" etiqueta="Pareja"
                 detalle="Balance y gastos compartidos" icono={Heart} />
        </Lista>
      </Seccion>
    </main>
  )
}

/** Bloque del reparto del patrimonio: etiqueta arriba, cifra debajo. */
function Reparto({ etiqueta, valor }: { etiqueta: string; valor: number }) {
  return (
    <div className="px-4 py-3">
      <p className="text-[12px] text-muted-foreground">{etiqueta}</p>
      <p className="mt-1 text-[18px] font-medium tabular-nums">
        {formatearCOP(valor)}
      </p>
    </div>
  )
}

/** Cifra del mes. El color marca la dirección del dinero, nada más. */
function Dato({
  etiqueta, valor, tono,
}: {
  etiqueta: string
  valor: number
  tono: 'positivo' | 'negativo'
}) {
  return (
    <div className="px-4 py-3">
      <p className="text-[12px] text-muted-foreground">{etiqueta}</p>
      <p className={`mt-1 text-[16px] font-medium leading-tight tabular-nums
                     ${tono === 'positivo' ? 'text-positivo' : 'text-negativo'}`}>
        {formatearCOP(valor)}
      </p>
    </div>
  )
}

function Atajo({
  href, etiqueta, detalle, icono: Icono,
}: {
  href: string
  etiqueta: string
  detalle: string
  icono: React.ComponentType<{ className?: string }>
}) {
  return (
    <Link href={href} className="flex min-h-14 items-center gap-3 px-4 py-3">
      <Icono className="size-[18px] shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] leading-tight">{etiqueta}</p>
        <p className="mt-0.5 truncate text-[12px] leading-tight
                      text-muted-foreground">
          {detalle}
        </p>
      </div>
      <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  )
}