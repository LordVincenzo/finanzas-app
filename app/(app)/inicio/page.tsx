import Link from 'next/link'
import { Users, Wallet, HandCoins, Heart, Inbox, ChevronRight } from 'lucide-react'
import { createClient, requerirUsuario } from '@/lib/supabase/server'
import {
  formatearCOP, mesActualBogota, moverMes, soloNombreMes,
} from '@/lib/format'
import { Seccion, Lista, Monto } from '@/components/seccion'
import { BarraProgreso } from '@/components/barra-progreso'
import { RepartoGastos } from '@/components/reparto-gastos'
import { PrimerosPasos } from '@/components/primeros-pasos'
import { AvatarPerfil } from '@/components/avatar-perfil'
import { CarruselPatrimonio, type CuentaWallet } from '@/components/carrusel-patrimonio'
import { TarjetaDestacadaVacia } from '@/components/tarjeta-destacada'
import { contarPendientes } from '@/lib/datos-bandeja'
import { Comparacion } from '@/components/comparacion'

export default async function InicioPage() {
  const supabase = await createClient()
  const user = await requerirUsuario(supabase)

  const mes = mesActualBogota()
  const mesPasado = moverMes(mes, -1)

  const [
    { data: perfil },
    { data: detalle },
    { data: cuentas },
    { data: cuentasActivos },
    { data: mensual },
    { data: porCategoria },
    { data: metas },
    { count: numCuentas },
    { count: numMovimientos },
    { count: numMetas },
    { data: ctaPendiente },
  ] = await Promise.all([
    supabase.from('profiles')
      .select('display_name, avatar_url').eq('id', user.id).single(),
    // Las partes del patrimonio que se pintan en la tarjeta. Entre las
    // cuatro suman el total de arriba: eso es lo que hace que la cifra
    // grande se pueda comprobar de un vistazo en vez de tener que
    // creerla.
    supabase.from('patrimonio_detalle')
      .select('por_cobrar, deudas, otros, patrimonio')
      .eq('owner_id', user.id).maybeSingle(),
    // La misma vista que usa /ahorros. Ella ya sabe cuánto de cada cuenta
    // está comprometido en metas; duplicar ese cálculo aquí sería pedir
    // que los dos números se separen con el tiempo. account_id además
    // permite avisar, tarjeta por tarjeta, cuánto de ese saldo no es
    // libre — sin eso, la billetera hace ver disponible dinero que ya
    // tiene dueño en una meta.
    supabase.from('cuentas_disponible')
      .select('account_id, saldo, asignado, disponible').eq('owner_id', user.id),
    // Saldo real por cuenta, tal cual lo muestra /cuentas: sin restar lo
    // comprometido en metas. Por cobrar y balance con pareja quedan
    // fuera porque ya salen en el desglose de la primera tarjeta.
    //
    // owner_id explícito: sin él entraban también las cuentas que tu
    // pareja marcó como shared_view, mezcladas en tu billetera sin
    // ninguna señal de que son suyas. Lo que ella comparte se ve en
    // /pareja, que es donde dice de quién es.
    supabase.from('account_balances')
      .select('account_id, name, type, balance')
      .eq('owner_id', user.id)
      .eq('class', 'asset').eq('is_active', true)
      .not('type', 'in', '("receivable","partner_receivable")')
      .order('name'),
    /* Los dos meses de una sola vez, y desde las VISTAS.

       owner_id explícito en las dos. Antes salía el número correcto por
       accidente: la vista hace INNER JOIN con accounts y las cuentas de
       tu pareja son privadas, así que sus filas se caían por RLS. El día
       que ella compartiera sus cuentas, sus gastos habrían empezado a
       sumarse a los tuyos sin ningún error visible.

       Antes esta pantalla sumaba movimientos_detalle por su cuenta
       mientras /escritorio/estadisticas usaba movimientos_mensuales:
       dos formas de contar lo mismo, esperando a separarse. Ahora las
       dos leen la misma vista, y de paso sale gratis el mes anterior,
       que es lo que convierte "$473.500" en "$180.000 menos que en
       agosto". */
    supabase.from('movimientos_mensuales')
      .select('mes, type, monto')
      .eq('owner_id', user.id)
      .in('mes', [mes, mesPasado]),
    supabase.from('categorias_mensuales')
      .select('mes, categoria, monto')
      .eq('owner_id', user.id)
      .in('mes', [mes, mesPasado]),
    /* SIN owner_id a propósito: una meta conjunta pertenece a la pareja y
       las dos personas tienen que verla. El RLS ya recorta a las tuyas
       más las shared_view/joint de ella. No lo "arregles" añadiendo el
       filtro: escondería las metas compartidas. */
    supabase.from('metas_resumen')
      .select('id, name, target_amount, acumulado, progreso, visibility')
      .eq('is_archived', false)
      .order('progreso', { ascending: false })
      .limit(2),

    /* Los tres contadores de la guía de primeros pasos.
       head: true pide solo el número de filas, sin traerlas: no hace
       falta el contenido para saber si hay al menos una. */
    supabase.from('accounts')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', user.id).eq('class', 'asset')
      .eq('is_active', true).eq('is_opening', false)
      .eq('is_partner_balance', false)
      // Las tres cuentas de sistema quedan fuera: si no, una liquidación
      // marcaría por sí sola el paso de "crea tu primera cuenta".
      .eq('is_pending_location', false)
      .not('type', 'in', '("receivable","partner_receivable")'),
    supabase.from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', user.id).neq('type', 'opening'),
    supabase.from('savings_goals')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', user.id).eq('is_archived', false),

    /* Cuál es tu cuenta "Pendiente de ubicar" (migración 0021). Es
       contabilidad, no una billetera donde tengas el dinero, así que no
       pinta en el carrusel: aparece en /cuentas cuando tiene saldo, y el
       aviso de Pareja explica qué hacer con él.
       Sale de `accounts` y no de `account_balances` porque esa vista es
       de 0001 y no expone la columna. */
    supabase.from('accounts')
      .select('id')
      .eq('owner_id', user.id).eq('is_pending_location', true)
      .maybeSingle(),
  ])

  // Cuántas notificaciones esperan confirmación. Consulta aparte porque
  // cargarBandeja() trae mucho más de lo que Inicio necesita.
  const pendientes = await contarPendientes()

  const total = Number(detalle?.patrimonio ?? 0)
  const porCobrar = Number(detalle?.por_cobrar ?? 0)
  /* Las dos partes que faltaban en el desglose: sin ellas, la tarjeta
     enseñaba un patrimonio que no cuadraba con sus propios repartos. */
  const deudas = Number(detalle?.deudas ?? 0)
  const otros = Number(detalle?.otros ?? 0)

  // Tres cifras distintas, no una:
  //   saldo      lo que hay en las cuentas
  //   asignado   lo que ya tiene dueño (metas)
  //   libre      lo que puedes gastar hoy sin romper una meta
  const filas = cuentas ?? []
  const enCuentas = filas.reduce((s, c) => s + Number(c.saldo), 0)
  const comprometido = filas.reduce((s, c) => s + Number(c.asignado), 0)
  const libre = filas.reduce((s, c) => s + Number(c.disponible), 0)

  const asignadoPorCuenta = new Map((cuentas ?? []).map((c) => [c.account_id, Number(c.asignado)]))

  const cuentasWallet: CuentaWallet[] = (cuentasActivos ?? [])
    .filter((c) => c.account_id !== ctaPendiente?.id)
    .map((c) => ({
      account_id: c.account_id as string,
      name: c.name as string,
      type: c.type as string,
      balance: Number(c.balance),
      asignado: asignadoPorCuenta.get(c.account_id as string) ?? 0,
    }))

  /* Los totales de cada mes.
     Las vistas devuelven una fila por (mes, tipo), así que un mes sin
     gastos no trae fila — de ahí el ?? 0. Pero un mes SIN NINGUNA fila
     es distinto de un mes en cero: el primero no tiene con qué
     comparar y el segundo sí. Esa diferencia es `huboMesPasado`. */
  const totalDe = (delMes: string, tipo: string) =>
    (mensual ?? [])
      .filter((x) => x.mes === delMes && x.type === tipo)
      .reduce((s, x) => s + Number(x.monto), 0)

  const gastos = totalDe(mes, 'expense')
  const ingresos = totalDe(mes, 'income')
  const balance = ingresos - gastos

  const huboMesPasado = (mensual ?? []).some((x) => x.mes === mesPasado)
  const gastosAntes = huboMesPasado ? totalDe(mesPasado, 'expense') : null
  const ingresosAntes = huboMesPasado ? totalDe(mesPasado, 'income') : null
  const nombreMesPasado = soloNombreMes(mesPasado)

  /* Sin ingresos registrados no hay balance que calcular.
     Antes se mostraba "Gastaste de más" con ingresos en cero: suena a
     que te pasaste de un presupuesto, cuando lo que pasa es que el
     sueldo todavía no ha entrado. */
  const hayIngresos = ingresos > 0

  const usado = hayIngresos
    ? Math.min(100, Math.round((gastos * 100) / ingresos))
    : 0

  /* Las categorías del mes, con lo que fue cada una el mes pasado.
     `antes` puede ser 0 —gastaste en algo nuevo— y eso es distinto de
     null, que es "no hay mes pasado con el que comparar". */
  const gastoCategoria = (delMes: string) =>
    new Map((porCategoria ?? [])
      .filter((x) => x.mes === delMes)
      .map((x) => [x.categoria as string, Number(x.monto)]))

  const esteMes = gastoCategoria(mes)
  const mesAnterior = gastoCategoria(mesPasado)

  const categorias = [...esteMes.entries()]
    .map(([nombre, valor]) => ({
      nombre,
      valor,
      antes: huboMesPasado ? (mesAnterior.get(nombre) ?? 0) : null,
    }))
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 4)

  const nombreMes = new Intl.DateTimeFormat('es-CO', {
    month: 'long', timeZone: 'America/Bogota',
  }).format(new Date())

  // Cuenta recién creada: sin cuentas y sin patrimonio.
  const vacia = (numCuentas ?? 0) === 0 && total === 0

  return (
    // El botón + de la barra sobresale por encima de ella, así que el
    // hueco tiene que contarlo. Y env(safe-area-inset-bottom) añade la
    // franja del gesto de inicio en los iPhone sin botón.
    <main className="px-4 pt-4 pb-[calc(8rem+env(safe-area-inset-bottom))]">
      <div className="aparece flex items-center justify-between gap-3 px-1">
        <div className="min-w-0">
          <p className="text-[13px] text-muted-foreground">Hola,</p>
          <h1 className="truncate text-[24px] font-bold leading-tight
                        tracking-tight">
            {perfil?.display_name}
          </h1>
        </div>
        <AvatarPerfil nombre={perfil?.display_name} url={perfil?.avatar_url} />
      </div>

      {/* La billetera necesita más aire arriba que la tarjeta vacía:
          las tarjetas de atrás se asoman hacia arriba y si no, tapan
          el saludo. */}
      <div className={vacia ? 'mt-2.5' : 'mt-10'}>
        {vacia ? (
          /* Con todo a cero, la tarjeta normal mostraba "$0" arriba y
             "Disponible para gastar $0" debajo: el mismo cero dos veces.
             Aquí lo útil no es la cifra sino qué significa la palabra. */
          <TarjetaDestacadaVacia
            etiqueta="Patrimonio"
            explicacion="El patrimonio es todo lo que tienes menos lo que debes. Cuando registres tus cuentas con el saldo que tienen hoy, aparecerá aquí."
            retraso={50}
          />
        ) : (
          <CarruselPatrimonio
            patrimonio={total}
            libre={libre}
            porCobrar={porCobrar}
            deudas={deudas}
            otros={otros}
            comprometido={comprometido}
            enCuentas={enCuentas}
            cuentas={cuentasWallet}
          />
        )}
      </div>

      {/* Lo único de Inicio que pide una acción. Solo aparece si hay algo
          esperando, y desaparece solo al confirmarlo todo — como
          PrimerosPasos, sin estado que mantener. */}
      {pendientes > 0 && (
        <Link
          href="/bandeja"
          className="aparece mt-4 flex min-h-14 items-center gap-3 rounded-2xl
                     bg-card px-4 shadow-card ring-1 ring-primary/25
                     transition active:scale-[0.99]"
          style={{ '--retraso': '120ms' } as React.CSSProperties}
        >
          <span className="flex size-9 shrink-0 items-center justify-center
                           rounded-xl bg-muted">
            <Inbox className="size-[17px] text-muted-foreground" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] leading-tight">
              {pendientes === 1
                ? '1 movimiento por confirmar'
                : `${pendientes} movimientos por confirmar`}
            </p>
            <p className="mt-0.5 text-[12px] leading-tight text-muted-foreground">
              Llegaron de tus bancos
            </p>
          </div>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground/60" />
        </Link>
      )}

      {/* Se completa sola y desaparece cuando los tres pasos están
          hechos. No guarda estado: cada paso se deduce de los datos. */}
      <div className="aparece mt-4"
           style={{ '--retraso': '150ms' } as React.CSSProperties}>
        <PrimerosPasos
          tieneCuenta={(numCuentas ?? 0) > 0}
          tieneMovimiento={(numMovimientos ?? 0) > 0}
          tieneMeta={(numMetas ?? 0) > 0}
        />
      </div>

      {(gastos > 0 || ingresos > 0 || total !== 0) && (
        <Seccion titulo={nombreMes}>
          <div className="grid grid-cols-2 gap-3">
            <TarjetaDato etiqueta="Ingresos" valor={ingresos} tono="positivo"
                         antes={ingresosAntes} mesAnterior={nombreMesPasado}
                         retraso={180} />
            <TarjetaDato etiqueta="Gastos" valor={gastos} tono="negativo"
                         antes={gastosAntes} mesAnterior={nombreMesPasado}
                         retraso={210} />
          </div>

          {/* Sin ingresos, las dos cifras de arriba ya lo cuentan todo:
              una tercera línea repetiría el gasto o inventaría un
              juicio que los datos no sostienen. */}
          {hayIngresos && (
            <div className="aparece mt-3 rounded-2xl bg-card p-4 shadow-card
                            ring-1 ring-border/70"
                 style={{ '--retraso': '240ms' } as React.CSSProperties}>
              <BarraProgreso progreso={usado} retraso={300} />
              <div className="mt-2.5 flex items-baseline justify-between gap-3">
                {/* "Te queda" era mentira, y de la peor clase: la que
                    suena a presupuesto. Esto es ingresos menos gastos
                    DEL MES, no lo que puedes gastar — si te pagan el 30,
                    el día 29 decía que no te quedaba casi nada aunque
                    tuvieras cinco millones en el banco. Lo que puedes
                    gastar es el "Disponible" de la tarjeta de arriba, y
                    sale de las cuentas, no del calendario. */}
                <div className="min-w-0">
                  <p className="text-[13px] text-muted-foreground">
                    {balance < 0 ? 'Gastaste más de lo que entró' : 'Ahorraste'}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-snug
                                text-muted-foreground">
                    De los {formatearCOP(ingresos)} que entraron
                  </p>
                </div>
                <Monto
                  valor={balance}
                  tono={balance < 0 ? 'negativo' : 'positivo'}
                  formato={formatearCOP}
                  className="shrink-0 text-[16px] font-semibold"
                />
              </div>
            </div>
          )}
        </Seccion>
      )}

      {categorias.length > 0 && gastos > 0 && (
        <Seccion
          titulo="En qué gastaste"
          accion={
            /* -my-3 py-3 sube el área táctil de 18 a 42px sin mover el
               texto ni cambiar la altura de la cabecera. Un enlace de
               18px se falla con el pulgar una de cada tres veces. */
            <Link href="/movimientos"
                  className="-my-3 -mr-1 py-3 pr-1 text-[12px] font-medium
                             text-primary">
              Ver todo
            </Link>
          }
        >
          <div className="aparece"
               style={{ '--retraso': '250ms' } as React.CSSProperties}>
            <RepartoGastos
              categorias={categorias}
              total={gastos}
              mesAnterior={huboMesPasado ? nombreMesPasado : undefined}
              retraso={320}
            />
          </div>
        </Seccion>
      )}

      {(metas ?? []).length > 0 && (
        <Seccion
          titulo="Tus metas"
          accion={
            <Link href="/ahorros"
                  className="-my-3 -mr-1 py-3 pr-1 text-[12px] font-medium
                             text-primary">
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
                    style={{ '--retraso': `${330 + i * 60}ms` } as React.CSSProperties}>
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
                    retraso={450 + i * 60}
                  />
                </div>
              </Link>
            ))}
          </div>
        </Seccion>
      )}

      <Seccion titulo="Ir a">
        <div className="aparece"
             style={{ '--retraso': '440ms' } as React.CSSProperties}>
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
function TarjetaDato({
  etiqueta, valor, tono, retraso, antes, mesAnterior,
}: {
  etiqueta: string
  valor: number
  tono: 'positivo' | 'negativo'
  retraso: number
  /** Lo mismo el mes pasado, o null si no hay mes pasado que comparar. */
  antes?: number | null
  mesAnterior?: string
}) {
  return (
    <div className="aparece rounded-2xl bg-card p-4 shadow-card ring-1
                    ring-border/70"
         style={{ '--retraso': `${retraso}ms` } as React.CSSProperties}>
      <p className="text-[12px] text-muted-foreground">{etiqueta}</p>
      {/* Monto deja el cero en neutro: no tiene signo que colorear. */}
      <Monto
        valor={valor} tono={tono} formato={formatearCOP}
        className="mt-0.5 block text-[16px] font-medium leading-tight"
      />
      {antes !== undefined && mesAnterior && (
        <Comparacion
          actual={valor}
          anterior={antes}
          mesAnterior={mesAnterior}
          // En gastos, bajar es bueno. En ingresos, al revés.
          bajarEsBueno={tono === 'negativo'}
          className="mt-1"
        />
      )}
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