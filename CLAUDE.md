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

Si una función SQL necesita saber qué cuentas son "dinero gastable", que
consulte `cuentas_disponible` en vez de copiar la lista de tipos.

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
app/(app)/          rutas protegidas; la sesión se comprueba en su layout
app/auth/           server actions de autenticación
lib/supabase/       clientes de navegador y servidor
lib/format.ts       formato y parseo de COP, fechas y horas
supabase/migrations/  esquema versionado + scripts verificacion_*.sql
proxy.ts            refresco de sesión en cada petición
```

## Cómo trabajar conmigo

- Soy principiante: pasos concretos, comandos exactos, sin ambigüedad.
- **Archivos completos siempre**, nunca fragmentos ni "el resto igual".
- Ante un error: diagnosticar primero, no probar soluciones al azar.
- Sé crítico si propongo algo que rompa la correctitud financiera.
- Prioridades: 1) correctitud, 2) seguridad, 3) facilidad de uso,
  4) simplicidad técnica, 5) móvil, 6) diseño.