import { Wallet } from 'lucide-react'
import { PlaceholderProximamente } from '@/components/placeholder-proximamente'

export default function CuentasEscritorioPage() {
  return (
    <div className="mx-auto max-w-[1400px] px-8 py-10">
      <h1 className="text-[26px] font-semibold tracking-tight">Cuentas</h1>
      <PlaceholderProximamente
        icono={Wallet}
        texto="La tabla de cuentas con ajuste de saldo en línea todavía no está construida. Por ahora, entra a Cuentas desde la app del celular."
      />
    </div>
  )
}
