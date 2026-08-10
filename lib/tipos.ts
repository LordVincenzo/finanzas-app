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