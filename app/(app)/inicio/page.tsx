import Link from 'next/link'
import { Users, Wallet, HandCoins, Heart, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { formatearCOP } from '@/lib/format'
import { Seccion, Lista, Monto } from '@/components/seccion'
import { BarraProgreso } from '@/components/barra-progreso'
import { CifraAnimada } from '@/components/cifra-animada'
import { RepartoGastos } from '@/components/reparto-gastos'
import {
  TarjetaDestacada, Reparto, DosRepartos,
} from '@/components/tarjeta-destacada'

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

  /* Sin ingresos registrados no hay balance que calcular.
     Antes se mostraba "Gastaste de más" con ingresos en cero: suena a
     que te pasaste de un presupuesto, cuando lo que pasa es que el
     sueldo todavía no ha entrado. */
  const hayIngresos = ingresos > 0

  const usado = hayIngresos
    ? Math.min(100, Math.round((gastos * 100) / ingresos))
    : 0

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
    // El botón + de la barra sobresale por encima de ella, así que el
    // hueco tiene que contarlo. Y env(safe-area-inset-bottom) añade la
    // franja del gesto de inicio en los iPhone sin botón.
    <main className="px-4 pt-4 pb-[calc(8rem+env(safe-area-inset-bottom))]">
      <p className="aparece px-1 text-[13px] text-muted-foreground">
        Hola, {perfil?.display_name}
      </p>

      <div className="mt-2.5">
        <TarjetaDestacada
          etiqueta="Patrimonio"
          valor={<CifraAnimada valor={total} />}
          retraso={50}
        >
          {porCobrar > 0 ? (
            <DosRepartos>
              <Reparto
                etiqueta="Disponible"
                valor={formatearCOP(libre)}
                nota={comprometido > 0
                  ? `+ ${formatearCOP(comprometido)} en metas`
                  : undefined}
              />
              <Reparto
                etiqueta="Por cobrar"
                valor={formatearCOP(porCobrar)}
              />
            </DosRepartos>
          ) : (
            <Reparto
              etiqueta="Disponible para gastar"
              valor={formatearCOP(libre)}
              nota={comprometido > 0
                ? `De ${formatearCOP(enCuentas)} en cuentas, ${formatearCOP(comprometido)} reservados en metas`
                : undefined}
            />
          )}
        </TarjetaDestacada>
      </div>

      {cuentaNueva ? (
        <Seccion titulo="Empezar">
          <div className="aparece rounded-2xl border border-dashed
                          border-border px-5 py-7 text-center"
                style={{ '--retraso': '130ms' } as React.CSSProperties}>
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
          <div className="aparece overflow-hidden rounded-2xl bg-card
                          shadow-card ring-1 ring-border/70"
               style={{ '--retraso': '130ms' } as React.CSSProperties}>
            <div className="grid grid-cols-2 divide-x divide-border/70">
              <Dato etiqueta="Ingresos" valor={ingresos} tono="positivo" />
              <Dato etiqueta="Gastos" valor={gastos} tono="negativo" />
            </div>

            {/* Sin ingresos, las dos cifras de arriba ya lo cuentan todo:
                una tercera línea repetiría el gasto o inventaría un
                juicio que los datos no sostienen. */}
            {hayIngresos && (
              <>
                <div className="px-4 pb-1">
                  <BarraProgreso progreso={usado} retraso={260} />
                </div>
                <div className="flex items-center justify-between px-4 py-2.5">
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
              </>
            )}
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
          <div className="aparece"
               style={{ '--retraso': '210ms' } as React.CSSProperties}>
            <RepartoGastos
              categorias={categorias}
              total={gastos}
              retraso={280}
            />
          </div>
        </Seccion>
      )}

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
            {(metas ?? []).map((meta, i) => (
              <Link key={meta.id} href={`/ahorros/${meta.id}`}
                    className="aparece block rounded-2xl bg-card px-4 py-3
                               shadow-card ring-1 ring-border/70 transition
                               active:scale-[0.99]"
                    style={{ '--retraso': `${290 + i * 60}ms` } as React.CSSProperties}>
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
                  <BarraProgreso
                    progreso={Number(meta.progreso)}
                    retraso={420 + i * 60}
                  />
                </div>
              </Link>
            ))}
          </div>
        </Seccion>
      )}

      <Seccion titulo="Ir a">
        <div className="aparece"
             style={{ '--retraso': '410ms' } as React.CSSProperties}>
          <Lista>
            <Atajo href="/cuentas" etiqueta="Cuentas"
                   detalle="Dónde tienes tu dinero" icono={Wallet} />
            <Atajo href="/prestamos" etiqueta="Préstamos"
                   detalle="Dinero que te deben" icono={HandCoins} />
            <Atajo href="/pareja" etiqueta="Pareja"
                   detalle="Balance y gastos compartidos" icono={Heart} />
          </Lista>
        </div>
      </Seccion>
    </main>
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