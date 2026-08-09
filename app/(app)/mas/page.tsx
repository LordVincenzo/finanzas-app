import { cerrarSesion } from '@/app/auth/actions'

export default function MasPage() {
  return (
    <main className="px-5 pt-8">
      <h1 className="text-2xl font-semibold">Más</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Cuentas, Préstamos, Pareja y Perfil llegarán en próximas fases.
      </p>

      <form action={cerrarSesion} className="mt-8">
        <button className="text-sm text-red-600 underline">Cerrar sesión</button>
      </form>
    </main>
  )
}