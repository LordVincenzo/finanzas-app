# Finanzas — app de finanzas personales y en pareja

Next.js 16 (App Router) · TypeScript · Tailwind v4 · shadcn/ui · Supabase · PWA.
Colombia: pesos enteros (COP), zona `America/Bogota`.

## Comandos

```bash
npm run dev          # desarrollo en localhost:3000
npm run build        # comprobar que compila antes de subir
node scripts/iconos.mjs   # regenerar iconos de la PWA
```

Las migraciones SQL se ejecutan a mano en Supabase → SQL Editor, en orden
numérico. No hay CLI de Supabase en este proyecto.

## Reglas que no se rompen

**Partida doble.** Todo movimiento son dos tablas: `transactions` (cabecera) y
`transaction_entries` (líneas). Las líneas de una transacción suman
exactamente 0, y el trigger `check_transaction_balanced` lo obliga.

**Los saldos no se guardan, se derivan** sumando entries. No existe ninguna
columna `saldo`, y no se debe crear.

**Las categorías son cuentas** de clase `expense` o `income`. Gasto, ingreso y
transferencia son la misma operación con distintas cuentas. Solo `asset` y
`liability` cuentan como patrimonio.

**El dinero es BIGINT en pesos enteros.** `20000` = $20.000. Nunca float: en
JavaScript `0.1 + 0.2` da `0.30000000000000004`.

**Dos campos de tiempo.** `occurred_at` (instante UTC) y `occurred_on` (día
contable en Bogotá, por trigger). Sin el segundo, un gasto del 31 de agosto a
las 8 PM caería en septiembre.

**Toda escritura pasa por RPC de Postgres.** Ninguna pantalla inserta directo
en `transactions` ni `transaction_entries`: `crear_movimiento`, `ajustar_saldo`,
`crear_cuenta`, `crear_prestamo`, `registrar_pago_prestamo`, `aportar_meta`,
`crear_gasto_compartido`, `liquidar_con_pareja`, `eliminar_movimiento`,
`eliminar_meta`.

**RLS en todas las tablas.** Visibilidad por recurso: `private`, `shared_view`,
`joint`. Se aplica en la base, no en la interfaz.

**Fotos de perfil van a Supabase Storage**, bucket `avatars` (público de
lectura; cada quien sube/reemplaza/borra solo su propia carpeta, RLS sobre
`storage.objects`). No hay CLI de Storage tampoco: el bucket y sus políticas
se crean con SQL, como cualquier otra migración.

**Nada de funcionalidad decorativa.** Un botón o icono que no hace nada real
—una campana de notificaciones sin sistema de notificaciones detrás, un logo
de Visa/Mastercard inventado porque una referencia visual lo traía— es peor
que no ponerlo. Si hace falta, se construye de verdad; si no, se omite.

**`getUser()`, nunca `getSession()`** para decidir permisos. `getSession()` lee
la cookie sin verificarla.

**`proxy.ts`, no `middleware.ts`.** Next.js 16 renombró el archivo; la
documentación de Supabase todavía usa el nombre viejo.

## Un cálculo, un sitio

Cuatro bugs de este proyecto salieron de duplicar la misma cuenta en dos
lugares. Antes de calcular algo, comprobar si ya existe una vista que lo haga:

- `cuentas_disponible` — saldo, asignado y disponible por cuenta. **Fuente única
  del "disponible"**: la usan Inicio, Cuentas y Ahorros.
- `patrimonio_detalle` — líquido, ahorros, inversiones, por cobrar, deudas.
- `movimientos_detalle` — `monto` (lo que gastaste) vs `monto_total` (lo que se
  movió). Difieren en gastos compartidos.
- `metas_resumen`, `metas_aportes_por_persona`, `prestamos_resumen`.
- `movimientos_mensuales`, `categorias_mensuales`, `patrimonio_mensual` —
  tendencias de los últimos 12 meses para `/escritorio/estadisticas`. Las dos
  primeras reusan `movimientos_detalle` (agregan `monto` por mes), no repiten
  su selección de líneas. `patrimonio_mensual` es la única vista con
  historial real: reconstruye el patrimonio de cada fin de mes sumando todo
  lo ocurrido hasta esa fecha, porque no existe ningún otro sitio que guarde
  saldos pasados.

Si una función SQL necesita saber qué cuentas son "dinero gastable", que
consulte `cuentas_disponible` en vez de copiar la lista de tipos.

Lo mismo aplica fuera de SQL: cómo se ve un movimiento según su tipo (color,
signo, qué cuenta mostrar) vive solo en `lib/movimientos.ts`. La fila del
celular y la tabla de `/escritorio/movimientos` lo importan de ahí — antes
esa lógica vivía duplicada dentro del componente de la fila.

## Sistema visual

Tokens en `app/globals.css`. Primitivas en `components/seccion.tsx`
(`Seccion`, `Lista`, `Fila`, `Tarjeta`, `Monto`).

- **El color es un dato, no decoración.** Verde `--positivo` solo si entra
  dinero, rojo `--negativo` solo si sale. Todo lo demás neutro. **El cero nunca
  se colorea.** Nunca usar `text-green-500` ni colores de Tailwind a pelo.
- **Una `TarjetaDestacada` por pantalla**, la cifra que resume esa vista.
- **Campos de formulario:** `min-h-12`, `rounded-xl`, borde completo. Selects
  nativos con `appearance-none` y chevron propio — no instalar Select de shadcn:
  los nativos envían su valor solos y abren el selector del sistema en móvil.
- **Dinero siempre con `tabular-nums`** y alineado a la derecha.
- **Área táctil mínima 44px.** Las filas usan `min-h-14`.
- **Padding inferior:** `pb-[calc(8rem+env(safe-area-inset-bottom))]`, porque el
  botón `+` sobresale de la barra.
- Animación de entrada con la clase `aparece` y `--retraso` en milisegundos.

## Estructura

```
app/(app)/          app de celular (PWA); sesión y NavInferior en su layout
app/escritorio/     vista de escritorio — sidebar propio, tabla de
                    movimientos con filtros combinados, más pantallas por
                    construir (Cuentas, Préstamos). NO vive dentro de
                    (app): layout y comprobación de sesión completamente
                    aparte, así que (app)/layout.tsx no la protege
app/auth/           server actions de autenticación
lib/supabase/       clientes de navegador y servidor
lib/format.ts       formato y parseo de COP, fechas y horas
lib/movimientos.ts  cómo se ve un movimiento según su tipo — un solo sitio,
                    lo usan la fila del celular y la tabla de escritorio
supabase/migrations/  esquema versionado + scripts verificacion_*.sql
proxy.ts            refresco de sesión en cada petición
```

**Dos interfaces, no una que se adapta.** `app/(app)/` es la app de celular;
`app/escritorio/` es una vista de escritorio aparte, con su propio layout y
navegación (sidebar en vez de barra flotante) — como una vista de cliente y
una de admin, no un diseño responsive del mismo árbol de páginas. Comparten
`app/layout.tsx` (fuentes, tema, `globals.css`) y las utilidades de `lib/` y
`components/`, pero nada de la navegación ni del ancho de página.

## Cómo trabajar conmigo

- Soy principiante: pasos concretos, comandos exactos, sin ambigüedad.
- **Archivos completos siempre**, nunca fragmentos ni "el resto igual".
- Ante un error: diagnosticar primero, no probar soluciones al azar.
- Sé crítico si propongo algo que rompa la correctitud financiera.
- Prioridades: 1) correctitud, 2) seguridad, 3) facilidad de uso,
  4) simplicidad técnica, 5) móvil, 6) diseño.