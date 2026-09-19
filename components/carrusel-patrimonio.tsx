'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import {
  Wallet, Landmark, PiggyBank, Banknote, TrendingUp, CircleDollarSign,
  Eye, EyeOff, ArrowLeftRight,
} from 'lucide-react'
import { formatearCOP } from '@/lib/format'
import { useReducido, usePreferenciaLocal } from '@/lib/navegador'
import { Monto } from '@/components/seccion'
import { CifraAnimada } from '@/components/cifra-animada'
import {
  TarjetaDestacada, Reparto, DosRepartos,
} from '@/components/tarjeta-destacada'

type Icono = React.ComponentType<{ className?: string }>

/** Solo cubre tipos de clase asset: las cuentas que entran a este
 *  carrusel ya vienen filtradas a esa clase. */
const ICONOS_TIPO: Record<string, Icono> = {
  digital_wallet: Wallet,
  checking: Landmark,
  savings: PiggyBank,
  cash: Banknote,
  investment: TrendingUp,
  other: CircleDollarSign,
}

const ETIQUETAS_TIPO: Record<string, string> = {
  digital_wallet: 'Billetera digital',
  checking: 'Cuenta corriente',
  savings: 'Ahorros',
  cash: 'Efectivo',
  investment: 'Inversión',
  other: 'Otra',
}

export type CuentaWallet = {
  account_id: string
  name: string
  type: string
  balance: number
  /** Cuánto de `balance` ya tiene dueño en una meta de ahorro. */
  asignado: number
}

const UMBRAL_ARRASTRE = 50
const MASCARA = '••••••'
const CLAVE_OCULTO = 'finanzas:billetera-oculta'

/** Cómo se ve cada tarjeta según qué tan lejos está del frente de la
 *  pila (k = 0 es la que se ve completa; k = 1, 2... las que se asoman
 *  detrás). Más allá de la segunda, se ocultan del todo. */
function estiloDeRango(k: number) {
  if (k === 0) return { y: 0, rot: 0, opacidad: 1, z: 30 }
  if (k === 1) return { y: -14, rot: 4, opacidad: 1, z: 20 }
  if (k === 2) return { y: -26, rot: 7, opacidad: 0.9, z: 10 }
  return { y: -26, rot: 7, opacidad: 0, z: 0 }
}

/**
 * Pila de cartas de verdad, no un carrusel de scroll: cada tarjeta vive
 * en la misma caja (position absolute, todas del mismo tamaño) y lo
 * que cambia es su lugar en la pila. Al deslizar hacia abajo, la que
 * se asomaba detrás baja y se pone encima, tapando a la anterior — como
 * repartir una carta. Hacia arriba hace lo contrario.
 *
 * Sin overflow-auto en ningún lado: como nada se recorta, no puede
 * volver a aparecer el bug de la esquina cortada de las versiones con
 * scroll nativo.
 *
 * La tarjeta de Patrimonio se arma aquí adentro (no llega ya construida
 * desde Inicio) porque el ojo de ocultar montos vive del lado del
 * cliente: necesita poder volver a pintar esos números con la pila
 * tapada, y un Server Component no puede reaccionar a ese estado.
 */
export function CarruselPatrimonio({
  patrimonio, libre, porCobrar, comprometido, enCuentas, cuentas,
}: {
  patrimonio: number
  libre: number
  porCobrar: number
  comprometido: number
  enCuentas: number
  cuentas: CuentaWallet[]
}) {
  const total = 1 + cuentas.length
  const [activo, setActivo] = useState(0)
  const arrastreInicioY = useRef<number | null>(null)

  /* Los dos salen del navegador, y antes se leían con un setState dentro
     de un useEffect: un render en cascada en cada montaje y un error de
     react-hooks/set-state-in-effect. useSyncExternalStore es la
     herramienta de React para esto — ver lib/navegador.ts. */
  const reducido = useReducido()
  const [oculto, setOculto] = usePreferenciaLocal(CLAVE_OCULTO)

  function alternarOculto() {
    setOculto(!oculto)
  }

  function siguiente() {
    setActivo((a) => (a + 1) % total)
  }

  function anterior() {
    setActivo((a) => (a - 1 + total) % total)
  }

  function alBajarPuntero(e: React.PointerEvent) {
    arrastreInicioY.current = e.clientY
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function alSoltarPuntero(e: React.PointerEvent) {
    if (arrastreInicioY.current === null) return
    const delta = e.clientY - arrastreInicioY.current
    arrastreInicioY.current = null
    if (delta > UMBRAL_ARRASTRE) siguiente()
    else if (delta < -UMBRAL_ARRASTRE) anterior()
  }

  function alPresionarTecla(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      siguiente()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      anterior()
    }
  }

  const transicion = reducido ? 'none' : 'transform 320ms ease, opacity 320ms ease'

  const resumen = (
    <div className="relative h-full w-full">
      <TarjetaDestacada
        etiqueta="Patrimonio"
        valor={oculto ? MASCARA : <CifraAnimada valor={patrimonio} />}
      >
        {porCobrar > 0 ? (
          <DosRepartos>
            <Reparto
              etiqueta="Disponible"
              valor={oculto ? MASCARA : formatearCOP(libre)}
              nota={!oculto && comprometido > 0
                ? `+ ${formatearCOP(comprometido)} en metas`
                : undefined}
            />
            <Reparto
              etiqueta="Por cobrar"
              valor={oculto ? MASCARA : formatearCOP(porCobrar)}
            />
          </DosRepartos>
        ) : (
          <Reparto
            etiqueta="Disponible para gastar"
            valor={oculto ? MASCARA : formatearCOP(libre)}
            nota={!oculto && comprometido > 0
              ? `De ${formatearCOP(enCuentas)} en cuentas, ${formatearCOP(comprometido)} reservados en metas`
              : undefined}
          />
        )}
      </TarjetaDestacada>

      {/* ARRIBA, no abajo. Estaban en `bottom-3 right-3`, encima de la
          esquina inferior derecha de la tarjeta — que es justo donde cae
          el valor del segundo reparto cuando hay algo por cobrar. Con un
          préstamo activo, "Por cobrar $1.200.000" quedaba 68px debajo de
          los botones y se leía "$1.200.00". Solo pasaba con dos columnas,
          por eso no se veía sin datos.

          Arriba hay hueco en las dos variantes: la etiqueta
          "PATRIMONIO" es texto pequeño y no llega al borde derecho.

          stopPropagation: esta fila vive dentro del área que detecta el
          arrastre para cambiar de tarjeta; sin esto, tocar un botón
          podría interpretarse como el inicio de un swipe. */}
      <div
        onPointerDown={(e) => e.stopPropagation()}
        className="absolute right-3 top-3 flex items-center gap-2"
      >
        <Link
          href="/movimientos/nuevo?tipo=transfer"
          aria-label="Transferir entre cuentas"
          className="flex size-8 items-center justify-center rounded-full
                     bg-white/15 text-destacado backdrop-blur-sm
                     transition active:scale-90"
        >
          <ArrowLeftRight className="size-4" />
        </Link>
        <button
          type="button"
          onClick={alternarOculto}
          aria-label={oculto ? 'Mostrar montos' : 'Ocultar montos'}
          className="flex size-8 items-center justify-center rounded-full
                     bg-white/15 text-destacado backdrop-blur-sm
                     transition active:scale-90"
        >
          {oculto ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
    </div>
  )

  return (
    <div
      tabIndex={0}
      role="region"
      aria-label="Patrimonio y cuentas. Desliza hacia abajo para ver la siguiente, hacia arriba para volver, o usa las flechas del teclado"
      onKeyDown={alPresionarTecla}
      onPointerDown={alBajarPuntero}
      onPointerUp={alSoltarPuntero}
      onPointerCancel={() => { arrastreInicioY.current = null }}
      className="relative h-[165px] touch-none [perspective:1200px]
                 focus:outline-none focus-visible:ring-2
                 focus-visible:ring-ring"
    >
      {[resumen, ...cuentas.map((c) => (
        <TarjetaCuentaWallet key={c.account_id} cuenta={c} oculto={oculto} />
      ))]
        .map((contenido, i) => {
          const k = (i - activo + total) % total
          const { y, rot, opacidad, z } = estiloDeRango(k)
          return (
            <div
              key={i === 0 ? 'patrimonio' : cuentas[i - 1].account_id}
              aria-hidden={k !== 0}
              className="absolute inset-0 [backface-visibility:hidden]"
              style={{
                transform: `translateY(${y}px) rotateX(${rot}deg)`,
                opacity: opacidad,
                zIndex: z,
                transition: transicion,
              }}
            >
              <div className="h-full w-full">{contenido}</div>
            </div>
          )
        })}
    </div>
  )
}

function TarjetaCuentaWallet({
  cuenta, oculto,
}: {
  cuenta: CuentaWallet
  oculto: boolean
}) {
  const Icono = ICONOS_TIPO[cuenta.type] ?? CircleDollarSign
  // Disponible, no saldo real: mostrar el saldo real hacía pensar que
  // el dinero comprometido en una meta también estaba libre.
  const disponible = cuenta.balance - cuenta.asignado

  return (
    <div className="flex h-full flex-col justify-between gap-3
                    overflow-hidden rounded-2xl bg-secundaria p-4
                    text-secundaria shadow-elevada">
      <div className="flex items-center gap-2">
        <span className="flex size-8 shrink-0 items-center justify-center
                         rounded-xl bg-white/10">
          <Icono className="size-4 text-secundaria-suave" />
        </span>
        <p className="text-[11px] font-semibold uppercase tracking-[0.09em]
                      text-secundaria-suave">
          {ETIQUETAS_TIPO[cuenta.type] ?? 'Cuenta'}
        </p>
      </div>
      <div>
        <p className="truncate text-[15px] font-medium leading-tight">
          {cuenta.name}
        </p>
        {oculto ? (
          <span className="mt-1 block text-[28px] font-semibold leading-tight">
            {MASCARA}
          </span>
        ) : (
          <>
            <Monto
              valor={disponible}
              tono={disponible < 0 ? 'negativo' : 'neutro'}
              formato={formatearCOP}
              className="mt-1 block text-[28px] font-semibold leading-tight"
            />
            {/* Sin esto, el saldo completo de la cuenta parece libre
                aunque una meta ya se haya quedado con parte de él. */}
            {cuenta.asignado > 0 && (
              <p className="mt-0.5 text-[12px] text-secundaria-suave">
                {formatearCOP(cuenta.asignado)} en metas
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
