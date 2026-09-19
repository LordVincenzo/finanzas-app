import { Inbox } from 'lucide-react'
import { cargarBandeja } from '@/lib/datos-bandeja'
import { FilaBandeja } from '@/components/fila-bandeja'
import { Conectar } from '@/components/conectar'

/**
 * La bandeja de entrada, en el celular.
 *
 * Es una SALA DE ESPERA, no el ledger: aquí caen las notificaciones que
 * el celular leyó de tus bancos, y nada toca tu patrimonio hasta que
 * confirmes. Al confirmar se pasa por crear_movimiento(), el mismo RPC
 * que usa el formulario de siempre.
 */
export default async function BandejaPage() {
  const { mensajes, dispositivos, cuentas, categoriasGasto, categoriasIngreso } =
    await cargarBandeja()

  const urlBase = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, '')
    ?? 'http://localhost:3000'

  return (
    <main className="px-4 pt-4 pb-[calc(8rem+env(safe-area-inset-bottom))]">
      <h1 className="aparece px-1 text-[22px] font-semibold tracking-tight">
        Por confirmar
      </h1>
      <p className="aparece mt-1 px-1 text-[13px] leading-snug text-muted-foreground"
         style={{ '--retraso': '40ms' } as React.CSSProperties}>
        Lo que leyeron tus bancos. Nada entra a tus cuentas hasta que lo
        confirmes.
      </p>

      {mensajes.length === 0 ? (
        <div className="aparece mt-6 rounded-2xl border border-dashed
                        border-border px-5 py-8 text-center"
             style={{ '--retraso': '80ms' } as React.CSSProperties}>
          <span className="mx-auto flex size-11 items-center justify-center
                           rounded-full bg-muted">
            <Inbox className="size-5 text-muted-foreground" />
          </span>
          <p className="mt-3 text-[15px] font-medium">No hay nada pendiente</p>
          <p className="mx-auto mt-1.5 max-w-[32ch] text-[13px] leading-snug
                        text-muted-foreground">
            {dispositivos.length === 0
              ? 'Conecta tu celular abajo y las notificaciones de tus bancos empezarán a llegar aquí.'
              : 'Cuando tu banco te notifique un movimiento, aparecerá aquí para que lo confirmes.'}
          </p>
        </div>
      ) : (
        <div className="aparece mt-4 space-y-3"
             style={{ '--retraso': '80ms' } as React.CSSProperties}>
          {mensajes.map((m) => (
            <FilaBandeja
              key={m.id}
              mensaje={m}
              cuentas={cuentas}
              categoriasGasto={categoriasGasto}
              categoriasIngreso={categoriasIngreso}
            />
          ))}
        </div>
      )}

      <div className="aparece mt-6"
           style={{ '--retraso': '140ms' } as React.CSSProperties}>
        <Conectar dispositivos={dispositivos} urlBase={urlBase} />
      </div>
    </main>
  )
}
