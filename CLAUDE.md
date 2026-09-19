# Finanzas — app de finanzas personales y en pareja

Next.js 16 (App Router) · TypeScript · Tailwind v4 · shadcn/ui · Supabase · PWA.
Colombia: pesos enteros (COP), zona `America/Bogota`.

## Comandos

```bash
npm run dev          # desarrollo en localhost:3000
npm run build        # comprobar que compila antes de subir
npm run lint         # tiene que salir en cero antes de subir
node scripts/iconos.mjs          # regenerar iconos de la PWA
node scripts/probar-lectores.mts # probar los lectores de notificaciones
```

**No corras `npm run build` con `npm run dev` abierto.** Los dos escriben
en `.next` y el build lee `.next/dev/types/validator.ts` a medio generar:
el error apunta a un archivo generado y no dice nada útil.

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

**Una deuda es un saldo NEGATIVO.** Las tarjetas de crédito y las deudas son
cuentas de clase `liability`, y `patrimonio_detalle` suma `asset` y
`liability` juntos: así la deuda resta sola, sin ninguna regla aparte. Pero a
nadie se le pide escribir un número negativo — la persona escribe «debo
500.000» y **el servidor pone el signo**, consultando la clase en la base.
Nunca a partir de un campo del formulario: el signo decide si algo suma o
resta al patrimonio. Quien pregunte «¿esto es una deuda?» se lo pregunta a
`esDeuda()` en `lib/tipos.ts`, que es el único sitio con esa lista.

**Dos campos de tiempo.** `occurred_at` (instante UTC) y `occurred_on` (día
contable en Bogotá, por trigger). Sin el segundo, un gasto del 31 de agosto a
las 8 PM caería en septiembre.

**Toda escritura pasa por RPC de Postgres.** Ninguna pantalla inserta directo
en `transactions` ni `transaction_entries`: `crear_movimiento`, `ajustar_saldo`,
`crear_cuenta`, `crear_prestamo`, `registrar_pago_prestamo`, `aportar_meta`,
`crear_gasto_compartido`, `liquidar_con_pareja`, `eliminar_movimiento`,
`eliminar_meta`, `eliminar_liquidacion`.

**Una liquidación no puede torcer el patrimonio del otro.** `liquidar_con_pareja`
escribe en los dos ledgers, y quien registra sabe de qué cuenta suya salió el
dinero pero no a cuál de las del otro entró. La contrapartida del espejo va a
la cuenta de sistema **`Pendiente de ubicar`** (`is_pending_location`, clase
`asset`), nunca a la de apertura: esa es de clase `income` y no cuenta como
patrimonio, así que el dinero recibido se evaporaba del patrimonio de quien no
registró la liquidación (migración 0021). El cabo suelto queda visible con
saldo y se cierra con una transferencia normal, sin funciones nuevas.

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
  del "disponible"**: la usan Inicio, Cuentas y Ahorros. Donde se muestra el
  saldo de una cuenta suelta (billetera de Inicio, `/cuentas`,
  `/escritorio/cuentas`) se muestra el disponible de esa fila, no el saldo
  bruto — mostrar el bruto hace parecer disponible dinero que ya está
  comprometido en una meta.
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
esa lógica vivía duplicada dentro del componente de la fila. El orden de los
grupos de cuentas y cuándo ocultar una "por cobrar" en $0 viven en
`lib/tipos.ts` (`ORDEN_TIPOS_CUENTA`, `cuentaVisible`) por la misma razón:
los usan tanto `/cuentas` como `/escritorio/cuentas`.

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
app/escritorio/     vista de escritorio — Panorama (resumen de todo),
                    Estadísticas, Movimientos, Cuentas, Ahorros,
                    Préstamos, Pareja y Perfil, más las pantallas de
                    creación (cuentas/nueva, ahorros/nueva,
                    prestamos/nuevo, movimientos/nuevo). Ninguna enlaza
                    a rutas de (app): hacerlo te expulsa al layout de
                    celular en una pantalla de 1400px. Los formularios
                    van sin acordeones — los <details> del celular
                    existen por falta de ancho, no por diseño. Ahorros y
                    Préstamos tienen su propio detalle en [id] (no
                    reusan el del celular: ese redirige a (app)). Sidebar
                    propio, sin barra de scroll visible (`.sin-scrollbar`
                    en globals.css). NO vive dentro de (app): layout y
                    comprobación de sesión completamente aparte, así que
                    (app)/layout.tsx no la protege
app/auth/           server actions de autenticación
lib/supabase/       clientes de navegador y servidor
lib/format.ts       formato y parseo de COP, fechas y horas
lib/movimientos.ts  cómo se ve un movimiento según su tipo — un solo sitio,
                    lo usan la fila del celular y la tabla de escritorio
lib/tipos.ts        tipos de cuenta, orden de sus grupos y cuándo ocultar
                    una por cobrar en $0 — un solo sitio para /cuentas y
                    /escritorio/cuentas
lib/interfaz.ts     las dos interfaces: tipo `Origen`, `leerOrigen()` y la
                    tabla blanca de rutas `rutaDe()`. Lo usan los
                    formularios compartidos para saber a dónde volver
lib/revalidar.ts    `revalidarLedger()` — la lista de pantallas cuyos
                    números salen del ledger, en un solo sitio. Antes
                    estaba copiada en cuatro archivos de acciones
lib/datos-pareja.ts las ~15 consultas de la pantalla de Pareja, que las
                    dos interfaces comparten. Filtros de privacidad
                    finos: no puede haber dos copias
lib/lectores.ts     leer el texto de una notificación bancaria, un lector
                    por entidad. Añadir un banco es añadir un lector: no
                    hay nada más del sistema que sepa que Nequi existe.
                    Se prueba contra los textos REALES con
                    `node scripts/probar-lectores.mts`
lib/datos-bandeja.ts las consultas de la bandeja, para las dos interfaces
lib/navegador.ts    leer el navegador sin romper la hidratación:
                    `useHidratado`, `useReducido`, `usePreferenciaLocal`.
                    Con `useSyncExternalStore`, NO con setState dentro de
                    un useEffect — ese patrón provoca un render en
                    cascada y lo marca react-hooks/set-state-in-effect
lib/puente.ts       hablar con la app de Android cuando la web corre
                    dentro del APK. `useDentroDeLaApp()` dice si hay
                    puente; el estado del oyente es un almacén externo,
                    por lo mismo que navegador.ts
android/            la app de Android: un WebView con esta misma web
                    dentro y, en el mismo proceso, el servicio que lee
                    las notificaciones del banco. Se compila aparte,
                    con Gradle; ver android/README.md
supabase/migrations/  esquema versionado + scripts verificacion_*.sql
proxy.ts            refresco de sesión en cada petición
```

**Una sola app en el teléfono.** El APK lleva la web dentro, así que la
misma página corre en un navegador y dentro de la app. Lo que cambia es
que dentro hay puente: `window.Oyente`, que Android solo inyecta si la
página viene de nuestro origen.

Eso es lo que quita el token a mano. Dentro del APK la sesión ya está
iniciada, así que la página llama a `crear_token_ingesta()` ella misma y
se lo pasa al oyente; copiarlo de una pantalla a otra solo hacía falta
cuando eran dos programas que no se conocían.

Un componente que dependa del puente **tiene que funcionar sin él**: la
misma pantalla se abre desde el escritorio. `components/conectar.tsx` es
el patrón — elige entre la tarjeta de permisos (dentro) y la del token
para copiar (fuera), y nunca enseña las dos.

**Dos interfaces, no una que se adapta.** `app/(app)/` es la app de celular;
`app/escritorio/` es una vista de escritorio aparte, con su propio layout y
navegación (sidebar en vez de barra flotante) — como una vista de cliente y
una de admin, no un diseño responsive del mismo árbol de páginas. Comparten
`app/layout.tsx` (fuentes, tema, `globals.css`) y las utilidades de `lib/` y
`components/`, pero nada de la navegación ni del ancho de página.

Los formularios y las acciones de servidor que no navegan (`aportar`,
`registrarAbono`, `eliminarAporte`, `eliminarAbono`...) se comparten tal
cual entre las dos interfaces: son UI y llamadas a RPC, no navegación.

Las que sí redirigen al terminar (`crearCuenta`, `crearMeta`,
`crearPrestamo`, `registrarMovimiento`, `eliminarMeta`,
`eliminarPrestamo`) **no se duplican**: el formulario manda un campo
oculto `origen` con `celular` o `escritorio`, y la acción lo traduce con
`rutaDe()` de `lib/interfaz.ts`. Nunca se pasa ese valor directo a
`redirect()` — la tabla blanca es lo que evita que un campo oculto
manipulado mande a la persona a una URL ajena.

Antes cada una tenía su gemela en `app/escritorio/<sección>/actions.ts`.
Con `eliminarMeta`, de tres líneas, daba igual; con `crearPrestamo`
—esquema zod, `parsearCOP` y validación de cuotas— significaba una quinta
copia del mismo cálculo, que es de donde salieron cuatro bugs de este
proyecto. Solo sigue teniendo archivo propio `app/escritorio/cuentas/
actions.ts`, porque `ajustarSaldoEscritorio` no existe en el celular.

Los componentes compartidos por las dos interfaces reciben `origen` como
prop opcional (`'celular'` por defecto) y con él deciden dos cosas: a
dónde volver y con qué densidad dibujarse (44px de área táctil en el
celular, 40 con ratón). `components/eliminar-meta.tsx` es el ejemplo:
antes era dos archivos casi idénticos.

## Cómo trabajar conmigo

- Soy principiante: pasos concretos, comandos exactos, sin ambigüedad.
- **Archivos completos siempre**, nunca fragmentos ni "el resto igual".
- Ante un error: diagnosticar primero, no probar soluciones al azar.
- Sé crítico si propongo algo que rompa la correctitud financiera.
- Prioridades: 1) correctitud, 2) seguridad, 3) facilidad de uso,
  4) simplicidad técnica, 5) móvil, 6) diseño.