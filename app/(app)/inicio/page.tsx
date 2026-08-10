import Link from 'next/link'
import { Users, Wallet, HandCoins, Heart, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { formatearCOP } from '@/lib/format'
import { Seccion, Lista, Fila, Monto } from '@/components/seccion'
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

  const [
    { data: perfil },
    { data: detalle },
    { data: cuentas },
    { data: delMes },
    { data: metas },
  ] = await Promise.all([
    supabase.from('profiles')
      .select('display_name').eq('id', user!.id).single(),
    supabase.from('patrimonio_detalle')
      .select('liquido, ahorros, inversiones, por_cobrar, deudas, patrimonio')
      .eq('owner_id', user!.id).maybeSingle(),
    // La misma vista que usa /ahorros. Ella ya sabe cuánto de cada cuenta
    // está comprometido en metas; duplicar ese cálculo aquí sería pedir
    // que los dos números se separen con el tiempo.
    supabase.from('cuentas_disponible')
      .select('saldo, asignado, disponible').eq('owner_id', user!.id),
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
  const porCobrar = Number(detalle?.por_cobrar ?? 0)

  // Tres cifras distintas, no una:
  //   saldo      lo que hay en las cuentas
  //   asignado   lo que ya tiene dueño (metas)
  //   libre      lo que puedes gastar hoy sin romper una meta
  const filas = cuentas ?? []
  const enCuentas = filas.reduce((s, c) => s + Number(c.saldo), 0)
  const comprometido = filas.reduce((s, c) => s + Number(c.asignado), 0)
  const libre = filas.reduce((s, c) => s + Number(c.disponible), 0)

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

  const cuentaNueva = movs.length === 0 && total === 0

  return (
    <main className="px-4 pb-28 pt-4">
      <p className="px-1 text-[19px] text-muted-foreground">
        Bienvenido, {perfil?.display_name}
      </p>

      {/* Tarjeta principal: patrimonio arriba, su reparto debajo.
          El aire va ENTRE las tarjetas, no dentro: el espacio exterior
          agrupa y separa, el interior solo infla. */}
      <section className="mt-2.5 overflow-hidden rounded-2xl bg-card
                          shadow-elevada ring-1 ring-border/70">
        <div className="px-4 pb-3.5 pt-3.5">
          <p className="text-[11px] font-semibold uppercase
                        tracking-[0.09em] text-muted-foreground">
            Patrimonio
          </p>
          <p className="mt-1 text-[34px] font-semibold leading-none
                        tracking-tight tabular-nums">
            {formatearCOP(total)}
          </p>
        </div>

        {porCobrar > 0 ? (
          <div className="grid grid-cols-2 divide-x divide-border/70
                          border-t border-border/70">
            <Reparto
              etiqueta="Disponible"
              valor={libre}
              nota={comprometido > 0
                ? `+ ${formatearCOP(comprometido)} en metas`
                : undefined}
            />
            <Reparto etiqueta="Por cobrar" valor={porCobrar} />
          </div>
        ) : (
          <div className="border-t border-border/70">
            <Reparto
              etiqueta="Disponible para gastar"
              valor={libre}
              nota={comprometido > 0
                ? `De ${formatearCOP(enCuentas)} en cuentas, ${formatearCOP(comprometido)} reservados en metas`
                : undefined}
            />
          </div>
        )}
      </section>

      {cuentaNueva ? (
        <Seccion titulo="Empezar">
          <div className="rounded-2xl border border-dashed border-border
                          px-5 py-7 text-center">
            <p className="text-[15px] font-medium">Aún no hay movimientos</p>
            <p className="mx-auto mt-1.5 max-w-[26ch] text-[13px] leading-snug
                          text-muted-foreground">
              Crea tus cuentas con el saldo que tienen hoy y registra tu
              primer gasto.
            </p>
            <Link
              href="/cuentas/nueva"
              className="mt-4 inline-flex min-h-11 items-center rounded-xl
                         bg-primary px-5 text-[14px] font-medium
                         text-primary-foreground shadow-card"
            >
              Crear una cuenta
            </Link>
          </div>
        </Seccion>
      ) : (
        <Seccion titulo={nombreMes}>
          <div className="overflow-hidden rounded-2xl bg-card shadow-card
                          ring-1 ring-border/70">
            <div className="grid grid-cols-2 divide-x divide-border/70">
              <Dato etiqueta="Ingresos" valor={ingresos} tono="positivo" />
              <Dato etiqueta="Gastos" valor={gastos} tono="negativo" />
            </div>
            <div className="flex items-center justify-between
                            border-t border-border/70 px-4 py-2.5">
              <p className="text-[13px] text-muted-foreground">
                {balance < 0 ? 'Gastaste de más' : 'Te queda'}
              </p>
              <Monto
                valor={balance}
                tono={balance < 0 ? 'negativo' : 'neutro'}
                formato={formatearCOP}
                className="text-[16px] font-semibold"
              />
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
                  className="text-[12px] font-medium text-primary">
              Ver todas
            </Link>
          }
        >
          <div className="space-y-2">
            {(metas ?? []).map((meta) => (
              <Link key={meta.id} href={`/ahorros/${meta.id}`}
                    className="block rounded-2xl bg-card px-4 py-3 shadow-card
                               ring-1 ring-border/70 transition
                               active:scale-[0.99]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-medium leading-tight">
                      {meta.name}
                    </p>
                    <p className="mt-0.5 truncate text-[12px] leading-tight
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
                <div className="mt-2.5">
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
                  className="text-[12px] font-medium text-primary">
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

/** Bloque del reparto: etiqueta, cifra y, si hace falta, el matiz. */
function Reparto({
  etiqueta, valor, nota,
}: {
  etiqueta: string
  valor: number
  nota?: string
}) {
  return (
    <div className="px-4 py-3">
      <p className="text-[12px] text-muted-foreground">{etiqueta}</p>
      <p className="mt-0.5 text-[18px] font-medium tabular-nums">
        {formatearCOP(valor)}
      </p>
      {nota && (
        <p className="mt-1 text-[11px] leading-snug text-muted-foreground
                      tabular-nums">
          {nota}
        </p>
      )}
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
      {/* Monto deja el cero en neutro: no tiene signo que colorear. */}
      <Monto
        valor={valor} tono={tono} formato={formatearCOP}
        className="mt-0.5 block text-[16px] font-medium leading-tight"
      />
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
    <Link href={href}
          className="flex min-h-13 items-center gap-3 px-4 py-2.5
                     transition active:bg-muted/60">
      <span className="flex size-9 shrink-0 items-center justify-center
                       rounded-xl bg-muted">
        <Icono className="size-[17px] text-muted-foreground" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] leading-tight">{etiqueta}</p>
        <p className="mt-0.5 truncate text-[12px] leading-tight
                      text-muted-foreground">
          {detalle}
        </p>
      </div>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground/60" />
    </Link>
  )
}