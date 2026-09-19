import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { FormularioCuenta } from '@/components/formulario-cuenta'

export default function NuevaCuentaPage() {
  return (
    <main className="px-5 pt-6 pb-[calc(8rem+env(safe-area-inset-bottom))]">
      <Link
        href="/cuentas"
        className="inline-flex min-h-9 items-center gap-1 text-[13px]
                   text-muted-foreground"
      >
        <ChevronLeft className="size-4" /> Cuentas
      </Link>

      <h1 className="mt-4 text-[22px] font-semibold tracking-tight">
        Nueva cuenta
      </h1>

      <FormularioCuenta origen="celular" />
    </main>
  )
}
