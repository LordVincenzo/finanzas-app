# Finanzas — la app de Android

La app de finanzas y el lector de notificaciones bancarias, en un solo
APK y un solo icono. Dentro hay un WebView con la web desplegada y, en
el mismo proceso, el servicio que lee las notificaciones de Nequi, Nu,
DaviPlata y Davivienda y las manda a la bandeja.

## Por qué existe

Antes eran dos cosas instaladas: la web añadida a la pantalla de inicio
y un oyente aparte. Conectarlas era copiar un token de 64 caracteres de
una pantalla a otra y escribir a mano la dirección del servidor. Una vez
por teléfono, y otra vez cada vez que algo se rompiera.

Ahora la web va dentro, y dentro **ya sabe quién eres**: pide el token
ella misma y se lo pasa al oyente por el puente (`Puente.kt` /
`lib/puente.ts`). Lo único que se pide es el permiso de Android, que
ninguna app puede concederse a sí misma.

Antes de eso estaba MacroDroid, que además de las cuatro macros por
teléfono pedía acceso a **todas** las notificaciones del dispositivo.
Esta app tiene el mismo permiso —Android no deja pedir menos— pero
**solo manda lo de cuatro paquetes concretos**, y esa lista está en
`Bancos.kt`, a la vista.

## Dependencias

Tres, todas de Google, y cada una por un motivo:

- `appcompat` y `material` — la pantalla de diagnóstico.
- `webkit` — por seguridad, no por comodidad. La forma clásica de
  comunicar web y app (`addJavascriptInterface`) inyecta el objeto en
  **todos** los marcos de la página, iframes de otros dominios
  incluidos; aquí se acuña un token que escribe en tu bandeja. De esta
  librería sale `addWebMessageListener`, que ata el puente a un origen:
  si la página no es la nuestra, `window.Oyente` no existe, y lo
  comprueba el WebView antes de inyectar en vez de nuestro código en
  cada método nuevo.

Ni librería de red ni de JSON: `HttpURLConnection` y `org.json` vienen
en Android. En una app que ve tus notificaciones, cada librería es algo
más que auditar.

## Compilar (recomendado)

Android Studio pide unos 8 GB de RAM y este proyecto se desarrolla en un
PC que tiene 8 GB en total. Pero **Android Studio pesa por el editor, no
por el compilador**: con las herramientas de línea de comandos basta, y
la compilación entera cabe en 2 GB.

Se instala una sola vez, fuera del repositorio (en `~/Android/`):

- **JDK 17 o posterior.**
- **SDK de Android**, con `sdkmanager` de las `cmdline-tools`:
  `platform-tools`, `platforms;android-35` y `build-tools;35.0.0`.
  Las licencias se aceptan a mano con `sdkmanager --licenses`: es un
  acuerdo con Google y lo firma una persona, no un script.
- **Gradle 8.11.1.** No hay wrapper en el repositorio a propósito: un
  `.jar` binario dentro del código es justo lo que no se puede revisar
  leyendo el código.

Con `ANDROID_HOME` apuntando al SDK, desde la carpeta `android/`:

```bash
gradle assembleDebug
```

El APK sale en `app/build/outputs/apk/debug/app-debug.apk`.

La primera vez tarda unos 8 minutos, porque baja el plugin de Android y
el compilador de Kotlin (~2 GB en `~/.gradle`). A partir de ahí, la
misma compilación son segundos.

El mismo APK sirve para los dos teléfonos: se pasa por cable o por
WhatsApp y se instala permitiendo «orígenes desconocidos».

## Compilar en GitHub (si tu cuenta lo permite)

`.github/workflows/apk.yml` hace exactamente lo mismo en los servidores
de GitHub: pestaña **Actions** → **APK de Android** → **Run workflow**,
y el APK queda en *Artifacts*.

Dos condiciones que no son obvias y que cuestan un rato descubrir:

- **El workflow tiene que estar en la rama por defecto** para que
  aparezca el botón «Run workflow». Si vive solo en una rama de trabajo,
  el botón no sale por ningún lado y no hay mensaje que lo explique.
- **La cuenta no puede estar bloqueada por facturación.** Si lo está, el
  job muere en 2 segundos sin llegar a pedir máquina, y el motivo solo
  se lee en *Annotations*: «the job was not started because your account
  is locked due to a billing issue». Hacer público el repositorio **no**
  lo levanta —los minutos son gratis en repos públicos, pero el bloqueo
  es de la cuenta, no del repositorio— y tampoco sirve reintentar.

Por eso la ruta recomendada es la de arriba: compilar en local no
depende de nadie.

## Compilar con Android Studio

Si la máquina da para el IDE: *Open* → la carpeta `android/` (no la
raíz), acepta la descarga del SDK, y ▶ **Run** con el teléfono conectado
por USB y la depuración activada (Ajustes → Acerca del teléfono → toca 7
veces «Número de compilación» → Opciones de desarrollador → Depuración
USB).

## Instalar y usar (una vez por teléfono)

1. Pasa el `.apk` al teléfono e instálalo (pedirá permitir «orígenes
   desconocidos», y Play Protect avisará de que no reconoce al
   desarrollador: es normal, no está firmada por Play Store).
2. Abre **Finanzas** e inicia sesión.
3. Ve a **Por confirmar**. Sale una tarjeta: **«Activar lectura de
   notificaciones»** → tócala → Android te lleva a una lista → activa
   **Finanzas**.
4. Vuelve. Ya está.

No hay token que copiar ni servidor que escribir: la página lo resuelve
sola por el puente, y la dirección viene compilada dentro (ver
`SERVIDOR` en `app/build.gradle.kts`).

Si algo no va, la pantalla de **Diagnóstico** (botón *Ajustes* de la
pantalla de error) enseña cuántas se han enviado, qué dijo el último
intento y cuántas esperan en la cola.

## Añadir un banco

Solo se toca `Bancos.kt`. El nombre de la derecha tiene que coincidir
con un lector de `lib/lectores.ts` en el servidor:

```kotlin
"com.bancolombia.app" to "bancolombia",
```

Para saber el nombre del paquete: Ajustes → Aplicaciones → la app, y
mira la URL de Play Store (`?id=com.loquesea`).

## Detalles que importan

**La cola.** Si no hay señal cuando llega la notificación, el mensaje se
guarda en disco y se reintenta al reconectar. La notificación del banco
llega una sola vez: sin cola, un rato sin cobertura pierde ese gasto
para siempre y sin avisar.

**La hora.** Se manda la hora en que llegó la notificación, no la del
envío. Un mensaje que estuvo dos horas en cola sigue siendo un gasto de
cuando ocurrió.

**Texto completo.** Se lee `EXTRA_BIG_TEXT` antes que `EXTRA_TEXT`:
Android recorta el segundo con «…» y ahí es justo donde los bancos ponen
el saldo y la referencia.

**Duplicados.** No se controlan aquí a propósito: el servidor los
descarta por la huella de app + texto + minuto. Reintentar de más es
seguro; reintentar de menos pierde dinero.

## Si tu Android es 15 o más

Ajustes → Notificaciones → desactiva **«Notificaciones mejoradas»**. Con
esa función activa, Android puede ocultar el contenido de algunas
notificaciones y llegaría vacío.
