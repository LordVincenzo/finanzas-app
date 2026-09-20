import { Inbox } from 'lucide-react'
import { cargarBandeja } from '@/lib/datos-bandeja'
import { FilaBandeja } from '@/components/fila-bandeja'
import { ConectarDispositivo } from '@/components/conectar-dispositivo'

/**
 * La bandeja en escritorio. Mismos datos que la del celular —salen del
 * mismo cargarBandeja()— en dos columnas: los mensajes a la izquierda,
 * donde está el trabajo, y los dispositivos a la derecha, que se
 * configuran una vez y ya.
 */
export default async function BandejaEscritorioPage() {
  const { mensajes, dispositivos, cuentas, categoriasGasto, categoriasIngreso } =
    await cargarBandeja()

  const urlBase = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, '')
    ?? 'http://localhost:3000'

  return (
    <div>
      <h1 className="text-[26px] font-semibold tracking-tight">Por confirmar</h1>
      <p className="mt-1 text-[13px] text-muted-foreground">
        Lo que leyeron tus bancos. Nada entra a tus cuentas hasta que lo
        confirmes.
      </p>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          {mensajes.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border
                            px-6 py-12 text-center">
              <span className="mx-auto flex size-11 items-center justify-center
                               rounded-full bg-muted">
                <Inbox className="size-5 text-muted-foreground" />
              </span>
              <p className="mt-3 text-[15px] font-medium">
                No hay nada pendiente
              </p>
              <p className="mx-auto mt-1.5 max-w-[44ch] text-[13px]
                            text-muted-foreground">
                {dispositivos.length === 0
                  ? 'Conecta un celular en el panel de la derecha y las notificaciones de tus bancos empezarán a llegar aquí.'
                  : 'Cuando tu banco te notifique un movimiento, aparecerá aquí para que lo confirmes.'}
              </p>
            </div>
          ) : (
            mensajes.map((m) => (
              <FilaBandeja
                key={m.id}
                mensaje={m}
                cuentas={cuentas}
                categoriasGasto={categoriasGasto}
                categoriasIngreso={categoriasIngreso}
              />
            ))
          )}
        </div>

        <div className="lg:col-span-1">
          <ConectarDispositivo dispositivos={dispositivos} urlBase={urlBase} />
        </div>
      </div>
    </div>
  )
}
