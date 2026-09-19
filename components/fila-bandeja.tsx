'use client'

import { useActionState, useState } from 'react'
import { ChevronDown, ArrowLeftRight } from 'lucide-react'
import {
  confirmarMensaje, ignorarMensaje, type EstadoBandeja,
} from '@/app/(app)/bandeja/actions'
import { formatearCOP, formatearFecha, formatearHora } from '@/lib/format'
import type { MensajeBandeja, Opcion } from '@/lib/datos-bandeja'

const estadoInicial: EstadoBandeja = {}

const CAMPO = `min-h-11 w-full rounded-xl border bg-transparent px-3
               text-[14px] placeholder:text-muted-foreground/50
               focus:outline-none focus:ring-2 focus:ring-ring`

const SELECT = `min-h-11 w-full appearance-none rounded-xl border
                bg-transparent pl-3 pr-9 text-[14px]
                focus:outline-none focus:ring-2 focus:ring-ring`

const TIPOS = [
  { valor: 'expense',  etiqueta: 'Gasto' },
  { valor: 'income',   etiqueta: 'Ingreso' },
  { valor: 'transfer', etiqueta: 'Transferir' },
] as const

/**
 * Un mensaje de la bandeja, con lo justo para convertirlo en movimiento.
 *
 * EL TEXTO CRUDO SIEMPRE ESTÁ A LA VISTA, arriba y sin tocar. Es lo
 * único que no miente: si el lector interpretó mal el monto o no hay
 * lector todavía para esa entidad, ahí está lo que dijo el banco para
 * corregirlo. Y el día que un banco cambie su formato, es lo que
 * permite darse cuenta.
 *
 * Lo interpretado llega como valor por defecto, no como dato cerrado:
 * todo se puede cambiar antes de confirmar. Mientras no existan lectores
 * los campos vienen vacíos y se rellenan a mano, que ya es más rápido
 * que abrir el formulario y escribirlo todo.
 */
export function FilaBandeja({
  mensaje, cuentas, categoriasGasto, categoriasIngreso,
}: {
  mensaje: MensajeBandeja
  cuentas: Opcion[]
  categoriasGasto: Opcion[]
  categoriasIngreso: Opcion[]
}) {
  const [confirmar, accionConfirmar, confirmando] =
    useActionState(confirmarMensaje, estadoInicial)
  const [ignorar, accionIgnorar, ignorando] =
    useActionState(ignorarMensaje, estadoInicial)

  /* ¿Llegó con pareja? Entonces los dos avisos son, probablemente, una
     sola transferencia tuya entre cuentas propias. Se propone tratarlos
     así, pero se PREGUNTA: decidirlo solo sería la suposición
     silenciosa que esta bandeja existe para evitar. */
  const tienePareja = Boolean(mensaje.pareja_id && mensaje.pareja_texto)
  const [comoPareja, setComoPareja] = useState(tienePareja)

  /* Si el lector dijo que entró dinero, se propone "Ingreso"; si dijo
     que salió o no dijo nada, "Gasto", que es lo más frecuente. */
  const [tipoElegido, setTipo] = useState<string>(
    mensaje.direccion === 'entrada' ? 'income' : 'expense'
  )

  // Tratarlos como uno solo obliga al tipo: es un traslado entre dos
  // cuentas tuyas, no un gasto ni un ingreso.
  const tipo = comoPareja ? 'transfer' : tipoElegido
  const esTransferencia = tipo === 'transfer'
  const categorias = tipo === 'income' ? categoriasIngreso : categoriasGasto
  const contrapartes = esTransferencia ? cuentas : categorias

  /* Qué se propone del otro lado.
   *
   * Tratados como una sola transferencia, el otro lado es la cuenta del
   * OTRO aviso, y eso ya lo sabemos: Nu dijo que salió, Nequi dijo que
   * entró. Los dos selectores llegan resueltos y confirmar es un toque.
   *
   * Si no, es una categoría, y solo viene puesta si ya se aprendió de
   * ese comercio — o sea, de la segunda vez en adelante. */
  const propuestaContraparte = esTransferencia
    ? (mensaje.pareja_cuenta_id ?? '')
    : (mensaje.categoria_id ?? '')

  const error = confirmar.error ?? ignorar.error

  return (
    <div className="rounded-2xl bg-card p-4 shadow-card ring-1 ring-border/70">
      {/* Lo que dijo el banco, tal cual */}
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[11px] font-semibold uppercase
                         tracking-[0.09em] text-muted-foreground">
          {mensaje.fuente}
        </span>
        <span className="shrink-0 text-[12px] text-muted-foreground tabular-nums">
          {formatearFecha(mensaje.recibido_en.slice(0, 10))
            .replace(/ de \d{4}$/, '')}
          {' · '}
          {formatearHora(mensaje.recibido_en)}
        </span>
      </div>

      <p className="mt-1.5 text-[14px] leading-snug">{mensaje.texto}</p>

      {/* La pareja: el otro aviso del mismo movimiento. */}
      {tienePareja && (
        <div className="mt-3 rounded-xl bg-muted p-3">
          <div className="flex items-start gap-2">
            <ArrowLeftRight className="mt-0.5 size-4 shrink-0
                                       text-muted-foreground" />
            <div className="min-w-0">
              <p className="text-[13px] font-medium">
                Parece una transferencia tuya
              </p>
              <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">
                <span className="uppercase">{mensaje.pareja_fuente}</span>
                {' avisó a la vez: '}
                {mensaje.pareja_texto}
              </p>
            </div>
          </div>

          <div className="mt-2.5 flex gap-2">
            <button
              type="button"
              onClick={() => setComoPareja(true)}
              aria-pressed={comoPareja}
              className={`min-h-9 flex-1 rounded-lg text-[12px] font-medium
                          transition ${comoPareja
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-background text-muted-foreground'}`}
            >
              Es una sola
            </button>
            <button
              type="button"
              onClick={() => setComoPareja(false)}
              aria-pressed={!comoPareja}
              className={`min-h-9 flex-1 rounded-lg text-[12px] font-medium
                          transition ${!comoPareja
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-background text-muted-foreground'}`}
            >
              Son dos cosas
            </button>
          </div>

          <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
            {comoPareja
              ? 'Se registrará un solo traslado entre tus cuentas, y los dos avisos quedarán resueltos.'
              : 'Se registrará solo este aviso. El otro seguirá esperando en la bandeja.'}
          </p>
        </div>
      )}

      <form action={accionConfirmar} className="mt-4 space-y-2.5">
        <input type="hidden" name="id" value={mensaje.id} />
        <input type="hidden" name="tipo" value={tipo} />
        {comoPareja && <input type="hidden" name="pareja" value="1" />}

        <div className="flex gap-2">
          <div className="relative w-36 shrink-0">
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              disabled={comoPareja}
              aria-label="Tipo de movimiento"
              className={`${SELECT} disabled:opacity-60`}
            >
              {TIPOS.map((t) => (
                <option key={t.valor} value={t.valor}>{t.etiqueta}</option>
              ))}
            </select>
            <ChevronDown aria-hidden
              className="pointer-events-none absolute right-3 top-1/2 size-4
                         -translate-y-1/2 text-muted-foreground" />
          </div>

          <div className="flex flex-1 items-center rounded-xl border
                          focus-within:ring-2 focus-within:ring-ring">
            <span className="pl-3 text-[15px] font-semibold
                             text-muted-foreground">
              $
            </span>
            <input
              name="monto" inputMode="numeric" required
              defaultValue={mensaje.monto ? String(mensaje.monto) : ''}
              placeholder="45.000"
              aria-label="Monto"
              className="min-h-11 w-full rounded-xl bg-transparent pl-1.5 pr-3
                         text-[15px] font-semibold tabular-nums
                         placeholder:text-muted-foreground/50
                         focus:outline-none"
            />
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <div className="relative">
            <select name="cuenta" required
                    defaultValue={mensaje.cuenta_id ?? ''}
                    aria-label={tipo === 'income' ? 'Entra a' : 'Sale de'}
                    className={SELECT}>
              <option value="" disabled>
                {tipo === 'income' ? 'Entra a…' : 'Sale de…'}
              </option>
              {cuentas.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <ChevronDown aria-hidden
              className="pointer-events-none absolute right-3 top-1/2 size-4
                         -translate-y-1/2 text-muted-foreground" />
          </div>

          <div className="relative">
            {/* La clave fuerza a redibujar el selector cuando cambia el
                tipo. Sin ella, React conserva el valor elegido y una
                categoría de gasto se quedaría seleccionada al pasar a
                transferencia, donde ya no está en la lista: el selector
                se vería vacío pero con valor puesto. */}
            <select name="contraparte" required
                    key={tipo}
                    defaultValue={propuestaContraparte}
                    aria-label={esTransferencia ? 'Entra a' : 'Categoría'}
                    className={SELECT}>
              <option value="" disabled>
                {esTransferencia ? 'Entra a…' : 'Categoría…'}
              </option>
              {contrapartes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <ChevronDown aria-hidden
              className="pointer-events-none absolute right-3 top-1/2 size-4
                         -translate-y-1/2 text-muted-foreground" />
          </div>
        </div>

        <input
          name="descripcion" required maxLength={200}
          defaultValue={mensaje.comercio ?? ''}
          placeholder="En qué fue"
          aria-label="Descripción"
          className={CAMPO}
        />

        {error && (
          <p className="text-[12px] text-destructive" role="alert">{error}</p>
        )}

        <div className="flex items-center gap-2 pt-1">
          <button
            type="submit"
            disabled={confirmando || ignorando}
            className="min-h-11 flex-1 rounded-xl bg-primary text-[14px]
                       font-medium text-primary-foreground shadow-card
                       transition active:scale-[0.99] disabled:opacity-50"
          >
            {confirmando
              ? 'Registrando…'
              : comoPareja ? 'Confirmar el traslado' : 'Confirmar'}
          </button>
        </div>
      </form>

      {/* Fuera del formulario de arriba: son dos acciones distintas y
          un <form> dentro de otro no es válido. */}
      <form action={accionIgnorar} className="mt-2">
        <input type="hidden" name="id" value={mensaje.id} />
        <button
          type="submit"
          disabled={confirmando || ignorando}
          className="min-h-9 w-full rounded-xl text-[13px]
                     text-muted-foreground transition
                     hover:text-foreground disabled:opacity-50"
        >
          {ignorando ? 'Quitando…' : 'No es un movimiento mío'}
        </button>
      </form>

      {mensaje.monto !== null && (
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          Leído del mensaje: {formatearCOP(mensaje.monto)}
          {mensaje.comercio ? ` · ${mensaje.comercio}` : ''}
        </p>
      )}
    </div>
  )
}
