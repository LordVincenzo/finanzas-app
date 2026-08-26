import { HandCoins } from 'lucide-react'
import { PlaceholderProximamente } from '@/components/placeholder-proximamente'

export default function PrestamosEscritorioPage() {
  return (
    <div className="mx-auto max-w-[1400px] px-8 py-10">
      <h1 className="text-[26px] font-semibold tracking-tight">Préstamos</h1>
      <PlaceholderProximamente
        icono={HandCoins}
        texto="La vista ancha de préstamos, con abonos e historial, todavía no está construida. Por ahora, entra a Préstamos desde la app del celular."
      />
    </div>
  )
}
