import Link from 'next/link'
import { Plus, AlertCircle, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { formatearCOP, formatearFecha } from '@/lib/format'
import { BarraProgreso } from '@/components/barra-progreso'
import { CifraAnimada } from '@/components/cifra-animada'
import {
  TarjetaDestacada, Reparto, DosRepartos,
} from '@/components/tarjeta-destacada'
import {
  agruparPorPersona, separarSaldados, type PrestamoFila, type PersonaPrestamos,
} from '@/lib/prestamos'

/**
 * Préstamos, por persona.
 *
 * La lista contestaba "¿qué préstamos he hecho?" cuando la pregunta es
 * "¿quién me debe?". Prestarle cuatro veces a la misma persona ponía
 * cuatro tarjetas, y las ya pagadas se quedaban ahí para siempre
 * empujando hacia abajo las que importan.
 *
 * Ahora arriba va una persona por tarjeta, con lo que debe en total, y
 * lo saldado se va a un desplegable al final. El ledger no cambia: cada
 * préstamo sigue siendo suyo, con su fecha y sus cuotas, y se llega a
 * él abriendo la persona.
 */
export default async function PrestamosPage() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('prestamos_resumen')
    .select('*')
    .neq('status', 'cancelled')
    .order('loan_date', { ascending: false })

  // Si algo falla en la consulta, mejor verlo que quedarse en blanco.
  if (error) {
    return (
      <main className="px-4 pt-4 pb-[calc(8rem+env(safe-area-inset-bottom))]">
        <h1 className="px-1 text-[22px] font-semibold tracking-tight">
          Préstamos
        </h1>
        <p className="mt-4 rounded-2xl bg-card p-4 text-[13px] text-destructive
                      shadow-card ring-1 ring-destructive/30">
          No se pudieron cargar: {error.message}
        </p>
      </main>
    )
  }

  const prestamos = (data ?? []) as unknown as PrestamoFila[]
  const personas = agruparPorPersona(prestamos)
  const { deben, saldados } = separarSaldados(personas)

  const porCobrar = deben.reduce((s, p) => s + p.pendiente, 0)
  const yaCobrado = personas.reduce((s, p) => s + p.pagado, 0)

  return (
    <main className="px-4 pt-4 pb-[calc(8rem+env(safe-area-inset-bottom))]">
      <div className="aparece flex items-center justify-between gap-3 px-1">
        <h1 className="text-[22px] font-semibold tracking-tight">Préstamos</h1>
        <Link href="/prestamos/nuevo" aria-label="Nuevo préstamo"
              className="flex size-10 items-center justify-center rounded-full
                         bg-card shadow-card ring-1 ring-border/70 transition
                         active:scale-95">
          <Plus className="size-[18px]" />
        </Link>
      </div>

      {prestamos.length > 0 && (
        <div className="mt-3">
          <TarjetaDestacada
            etiqueta="Por cobrar"
            valor={<CifraAnimada valor={porCobrar} />}
            retraso={50}
          >
            <DosRepartos>
              <Reparto
                etiqueta="Ya te devolvieron"
                valor={formatearCOP(yaCobrado)}
              />
              <Reparto
                etiqueta={deben.length === 1 ? 'Persona te debe' : 'Personas te deben'}
                valor={String(deben.length)}
              />
            </DosRepartos>
          </TarjetaDestacada>
        </div>
      )}

      {prestamos.length === 0 ? (
        <div className="aparece mt-8 rounded-2xl border border-dashed
                        border-border px-5 py-7 text-center"
             style={{ '--retraso': '100ms' } as React.CSSProperties}>
          <p className="text-[15px] font-medium">No has registrado préstamos</p>
          <p className="mx-auto mt-1.5 max-w-[30ch] text-[13px] leading-snug
                        text-muted-foreground">
            Prestar dinero no reduce tu patrimonio: lo mueve a «por cobrar».
          </p>
          <Link href="/prestamos/nuevo"
                className="mt-4 inline-flex min-h-11 items-center rounded-xl
                           bg-primary px-5 text-[14px] font-medium
                           text-primary-foreground shadow-card">
            Registrar uno
          </Link>
        </div>
      ) : (
        <>
          {deben.length > 0 && (
            <div className="mt-3 space-y-2">
              {deben.map((persona, i) => (
                <TarjetaPersona key={persona.clave} persona={persona} indice={i} />
              ))}
            </div>
          )}

          {/* Todo el mundo al día: se dice, no se deja un hueco. */}
          {deben.length === 0 && (
            <p className="mt-6 text-center text-[14px] text-muted-foreground">
              Nadie te debe nada ahora mismo.
            </p>
          )}

          {/* LO SALDADO NO SE BORRA, SE GUARDA. Es historial: sirve para
              saber si alguien devuelve o no devuelve. Pero no puede
              estar ocupando la pantalla que contesta quién me debe. */}
          {saldados.length > 0 && (
            <details className="mt-6 rounded-2xl bg-card px-4 shadow-card
                                ring-1 ring-border/70">
              <summary className="flex min-h-14 cursor-pointer list-none
                                  items-center justify-between gap-3
                                  text-[14px]">
                <span>
                  Ya te pagaron
                  <span className="ml-1.5 text-muted-foreground">
                    ({saldados.length})
                  </span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </summary>

              <div className="divide-y divide-border/70 border-t
                              border-border/70">
                {saldados.map((persona) => (
                  <div key={persona.clave} className="py-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="min-w-0 flex-1 truncate text-[14px]">
                        {persona.nombre}
                      </p>
                      <span className="shrink-0 text-[13px] text-positivo">
                        Pagado
                      </span>
                    </div>
                    <div className="mt-1 space-y-0.5">
                      {persona.prestamos.map((p) => (
                        <Link key={p.id} href={`/prestamos/${p.id}`}
                              className="flex items-baseline justify-between
                                         gap-3 text-[11px] text-muted-foreground
                                         tabular-nums">
                          <span className="truncate">
                            {formatearFecha(p.loan_date)}
                          </span>
                          <span className="shrink-0">
                            {formatearCOP(Number(p.principal))}
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </details>
          )}
        </>
      )}
    </main>
  )
}

/**
 * Una persona y lo que debe.
 *
 * Con un solo préstamo la tarjeta ES el préstamo y se toca entera. Con
 * varios se despliega: meter cuatro préstamos detrás de un solo enlace
 * obligaría a adivinar a cuál lleva.
 */
function TarjetaPersona({
  persona, indice,
}: {
  persona: PersonaPrestamos
  indice: number
}) {
  const progreso = persona.prestado > 0
    ? Math.round((persona.pagado * 100) / persona.prestado)
    : 0
  const vivos = persona.prestamos.filter((p) => p.status === 'active')
  const unico = vivos.length === 1 && persona.prestamos.length === 1

  const cabecera = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[15px] font-medium leading-tight">
            {persona.nombre}
          </p>
          <p className="mt-0.5 truncate text-[12px] leading-tight
                        text-muted-foreground tabular-nums">
            {formatearCOP(persona.pagado)} de {formatearCOP(persona.prestado)}
            {persona.prestamos.length > 1 && (
              <> · {persona.prestamos.length} préstamos</>
            )}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <span className="text-[15px] font-semibold tabular-nums">
            {formatearCOP(persona.pendiente)}
          </span>
        </div>
      </div>

      <div className="mt-2.5">
        <BarraProgreso progreso={progreso} retraso={260 + indice * 55} />
      </div>

      {(persona.vencidas > 0 || persona.proxima_fecha) && (
        <div className="mt-2 flex items-center justify-between gap-2
                        text-[12px] text-muted-foreground">
          <span className="tabular-nums">
            {vivos.length === 1 ? 'Pendiente' : `${vivos.length} pendientes`}
          </span>
          {persona.vencidas > 0 ? (
            <span className="flex items-center gap-1 text-destructive">
              <AlertCircle className="size-3.5" />
              {persona.vencidas} vencida{persona.vencidas > 1 ? 's' : ''}
            </span>
          ) : persona.proxima_fecha ? (
            <span className="tabular-nums">
              {formatearFecha(persona.proxima_fecha)}
            </span>
          ) : null}
        </div>
      )}
    </>
  )

  if (unico) {
    return (
      <Link href={`/prestamos/${persona.prestamos[0].id}`}
            className="aparece block rounded-2xl bg-card px-4 py-3 shadow-card
                       ring-1 ring-border/70 transition active:scale-[0.99]"
            style={{ '--retraso': `${140 + indice * 55}ms` } as React.CSSProperties}>
        {cabecera}
      </Link>
    )
  }

  return (
    <details className="aparece rounded-2xl bg-card px-4 shadow-card
                        ring-1 ring-border/70"
             style={{ '--retraso': `${140 + indice * 55}ms` } as React.CSSProperties}>
      <summary className="cursor-pointer list-none py-3">{cabecera}</summary>

      <div className="divide-y divide-border/70 border-t border-border/70">
        {persona.prestamos.map((p) => (
          <Link key={p.id} href={`/prestamos/${p.id}`}
                className="flex min-h-14 items-center justify-between gap-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-[13px] tabular-nums">
                {formatearFecha(p.loan_date)}
              </p>
              <p className="mt-0.5 truncate text-[11px] text-muted-foreground
                            tabular-nums">
                {formatearCOP(Number(p.pagado))} de{' '}
                {formatearCOP(Number(p.principal))}
              </p>
            </div>
            <span className={`shrink-0 text-[13px] font-medium tabular-nums ${
              p.status === 'paid' ? 'text-positivo' : ''
            }`}>
              {p.status === 'paid'
                ? 'Pagado'
                : formatearCOP(Number(p.pendiente))}
            </span>
          </Link>
        ))}
      </div>
    </details>
  )
}
