import Link from 'next/link'
import { formatearCOP } from '@/lib/format'
import { rutaDe, type Origen } from '@/lib/interfaz'

/**
 * El cabo suelto que deja una liquidación registrada por la otra persona.
 *
 * Cuando tu pareja registra que te pagó, sabe de qué cuenta suya salió el
 * dinero pero no a cuál de las tuyas entró. La migración 0021 pone esa
 * contrapartida en tu cuenta "Pendiente de ubicar" (clase asset), así que
 * tu patrimonio queda correcto desde el primer segundo — antes bajaba por
 * el importe recibido, porque la contrapartida iba a una cuenta de clase
 * income que no cuenta como patrimonio.
 *
 * Lo que falta es decir DÓNDE está ese dinero, y eso solo lo sabes tú.
 * Este aviso existe porque el arreglo del patrimonio, por sí solo, deja
 * un saldo en una cuenta que nadie mira: la única señal era una fila más
 * en /cuentas.
 *
 * Positivo = entró dinero y no has dicho a qué cuenta.
 * Negativo = salió dinero y no has dicho de qué cuenta.
 */
export function AvisoPendienteUbicar({
  monto, origen = 'celular',
}: {
  monto: number
  origen?: Origen
}) {
  if (monto === 0) return null

  const entro = monto > 0
  // Las dos interfaces llaman igual a la pantalla de registrar
  // (/movimientos/nuevo y /escritorio/movimientos/nuevo).
  const href = `${rutaDe(origen, 'movimientos')}/nuevo?tipo=transfer`

  return (
    <div className="rounded-2xl bg-card p-4 shadow-card ring-1 ring-primary/25">
      <p className="text-[14px] font-medium">
        {entro ? 'Tienes' : 'Falta descontar'} {formatearCOP(Math.abs(monto))}{' '}
        sin ubicar
      </p>
      <p className="mt-1.5 text-[13px] leading-snug text-muted-foreground">
        {entro
          ? 'Tu pareja registró un pago y el dinero ya cuenta en tu patrimonio, pero todavía no está en ninguna cuenta concreta. Muévelo con una transferencia desde «Pendiente de ubicar» a la cuenta donde entró de verdad.'
          : 'Tu pareja registró que le pagaste. El dinero ya salió de tu patrimonio, pero todavía no de una cuenta concreta. Haz una transferencia desde la cuenta de la que salió hacia «Pendiente de ubicar» para cuadrarla.'}
      </p>
      <Link
        href={href}
        className="mt-3 inline-flex min-h-10 items-center rounded-xl bg-primary
                   px-4 text-[13px] font-medium text-primary-foreground
                   shadow-card"
      >
        Hacer la transferencia
      </Link>
    </div>
  )
}
