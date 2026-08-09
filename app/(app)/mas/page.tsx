import Link from 'next/link'
import { cerrarSesion } from '@/app/auth/actions'

export default function MasPage() {
  return (
    <main className="px-5 pt-8">
      <h1 className="text-2xl font-semibold">Más</h1>

      <nav className="mt-6 divide-y rounded-2xl border">
        <Link href="/cuentas" className="block px-4 py-3.5 text-sm">Cuentas</Link>
        <Link href="/pareja" className="block px-4 py-3.5 text-sm">Pareja</Link>
        <Link href="/prestamos" className="block px-4 py-3.5 text-sm">Préstamos</Link>
      </nav>

      <p className="mt-4 text-xs text-muted-foreground">
        Préstamos, Pareja y Perfil llegarán en próximas fases.
      </p>

      <form action={cerrarSesion} className="mt-8">
        <button className="text-sm text-destructive underline">Cerrar sesión</button>
      </form>
    </main>
  )
}