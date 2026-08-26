export type Movimiento = {
  id: string
  type: string
  description: string
  occurred_at: string
  occurred_on: string
  cuenta_origen: string
  cuenta_destino: string
  clase_origen: string
  clase_destino: string
  /** Lo que de verdad gastaste o ingresaste. */
  monto: number
  /** Todo el dinero que se movió. Difiere solo en gastos compartidos. */
  monto_total: number
}

export const NOMBRE_TIPO: Record<string, string> = {
  expense: 'Gasto',
  income: 'Ingreso',
  transfer: 'Transferencia',
  adjustment: 'Ajuste de saldo',
  opening: 'Saldo inicial',
  loan_out: 'Préstamo',
  loan_repay: 'Cobro de préstamo',
  settlement: 'Liquidación',
}

/**
 * Cómo se ve el movimiento según su tipo.
 *
 * Los gastos van en color neutro a propósito: en una lista donde casi todo
 * son gastos, pintarlos todos de rojo deja de ser información. El signo "−"
 * ya dice que el dinero salió.
 *
 * La usan tanto la fila del celular (fila-movimiento.tsx) como la tabla de
 * escritorio: es la misma pregunta ("¿cómo se lee este movimiento?"), así
 * que solo puede tener una respuesta.
 */
export function presentarMovimiento(m: Movimiento) {
  switch (m.type) {
    case 'expense':
      return { signo: '-', color: '',
               contexto: `${m.cuenta_origen} · ${m.cuenta_destino}` }
    case 'income':
      return { signo: '+', color: 'text-positivo',
               contexto: `${m.cuenta_destino} · ${m.cuenta_origen}` }
    case 'transfer':
      return { signo: '', color: 'text-muted-foreground',
               contexto: `${m.cuenta_origen} → ${m.cuenta_destino}` }
    case 'adjustment':
      return { signo: m.clase_destino === 'income' ? '-' : '+',
               color: 'text-muted-foreground',
               contexto: m.clase_destino === 'income'
                 ? m.cuenta_origen : m.cuenta_destino }
    default: // opening, loan_out, loan_repay, settlement
      return { signo: '', color: 'text-muted-foreground',
               contexto: `${m.cuenta_origen} → ${m.cuenta_destino}` }
  }
}
