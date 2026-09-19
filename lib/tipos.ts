/** Tipos de cuenta que el usuario puede crear desde la app. */
export const TIPOS_CUENTA = [
  { valor: 'digital_wallet', etiqueta: 'Billetera digital', ayuda: 'Nu, Nequi, Davivienda' },
  { valor: 'checking',       etiqueta: 'Cuenta corriente',  ayuda: 'Cuenta de banco del día a día' },
  { valor: 'savings',        etiqueta: 'Cuenta de ahorros', ayuda: 'Ahorro programado o CDT' },
  { valor: 'cash',           etiqueta: 'Efectivo',          ayuda: 'Dinero en billetes' },
  { valor: 'investment',     etiqueta: 'Inversión',         ayuda: 'Acciones, fondos, cripto' },
  { valor: 'other',          etiqueta: 'Otra',              ayuda: '' },
] as const

export type TipoCuenta = (typeof TIPOS_CUENTA)[number]['valor']

export const VISIBILIDADES = [
  { valor: 'private',     etiqueta: 'Privada',    ayuda: 'Solo tú puedes verla' },
  { valor: 'shared_view', etiqueta: 'Compartida', ayuda: 'Tu pareja puede verla, no editarla' },
] as const

export type Visibilidad = (typeof VISIBILIDADES)[number]['valor']

/** Agrupación para mostrar el listado ordenado. */
export const ETIQUETAS_TIPO: Record<string, string> = {
  digital_wallet: 'Billeteras digitales',
  checking: 'Cuentas corrientes',
  savings: 'Ahorros',
  cash: 'Efectivo',
  investment: 'Inversiones',
  receivable: 'Por cobrar',
  partner_receivable: 'Balance con tu pareja',
  credit_card: 'Tarjetas de crédito',
  debt: 'Deudas',
  other: 'Otras',
}

/**
 * Orden en que se muestran los grupos de cuentas.
 * Antes salía del orden alfabético, así que crear una cuenta nueva
 * podía reordenar la pantalla entera. La usan tanto /cuentas (celular)
 * como /escritorio/cuentas.
 */
export const ORDEN_TIPOS_CUENTA = [
  'digital_wallet', 'checking', 'savings', 'cash', 'investment', 'other',
  'credit_card', 'debt', 'receivable', 'partner_receivable',
]

/**
 * Cuándo una cuenta no dice nada y se oculta del listado. Regla única
 * para no repetir el mismo filtro en cada pantalla que lista cuentas.
 *
 * - Una cuenta por cobrar en $0 ya se cobró: no aporta nada.
 * - "Pendiente de ubicar" (`is_pending_location`, migración 0021) en $0
 *   significa que no hay ningún cabo suelto. Es una cuenta de sistema
 *   que solo existe para que una liquidación no tuerza el patrimonio de
 *   quien no la registró; en cuanto está cuadrada, estorba. A diferencia
 *   de las por cobrar, aquí el criterio no puede ser el tipo (es
 *   'other', como cualquier cuenta "Otra" que crees tú), así que la
 *   pantalla tiene que decir cuál es.
 */
export function cuentaVisible(
  tipo: string,
  balance: number,
  esPendienteUbicar = false,
): boolean {
  if (esPendienteUbicar) return balance !== 0
  return !((tipo === 'receivable' || tipo === 'partner_receivable') && balance === 0)
}