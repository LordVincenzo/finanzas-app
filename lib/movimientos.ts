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

/**
 * Qué cuenta es el ORIGEN y cuál el DESTINO, según el tipo.
 *
 * En un ingreso el dinero viene de la categoría y entra a la cuenta; en
 * un gasto o una transferencia sale de la cuenta. Esa decisión la toma
 * siempre el servidor: el formulario manda "cuenta" y "contraparte", y
 * nunca cuál de las dos va en cada lado — si lo mandara, bastaría con
 * invertirlas para registrar un gasto como si fuera un ingreso.
 *
 * Vive aquí, junto a presentarMovimiento(), porque las dos responden la
 * misma pregunta desde lados opuestos: una dice cómo se LEE un
 * movimiento según su tipo y esta cómo se ESCRIBE. La usan el formulario
 * de movimiento y la bandeja de entrada.
 */
export function ladosDelMovimiento(
  tipo: string,
  cuenta: string,
  contraparte: string,
): { origen: string; destino: string } {
  return tipo === 'income'
    ? { origen: contraparte, destino: cuenta }
    : { origen: cuenta, destino: contraparte }
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
