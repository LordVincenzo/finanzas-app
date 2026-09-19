# Oyente Finanzas — la app de Android

Lee las notificaciones de Nequi, Nu, DaviPlata y Davivienda y las manda
a la bandeja de entrada de Finanzas. Reemplaza a MacroDroid.

## Por qué existe

Con MacroDroid hay que repetir cuatro macros en cada teléfono, y sobre
todo: MacroDroid pide acceso a **todas** las notificaciones del
dispositivo — WhatsApp, códigos de banco, todo. Esta app tiene el mismo
permiso, porque Android no deja pedir menos, pero **solo manda lo de
cuatro paquetes concretos**, y esa lista está en `Bancos.kt`, a la
vista.

## Lo que NO tiene

Ninguna dependencia de terceros: ni librería de red, ni de JSON, ni de
interfaz. Solo el SDK de Android y lo que trae el JDK. En una app que ve
tus notificaciones, cada librería es algo más que auditar.

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

## Configurar (una vez por teléfono)

1. Abre **Oyente Finanzas**.
2. **Permiso** → te lleva a los ajustes de Android → activa «Oyente
   Finanzas» en la lista.
3. **Servidor**: `http://192.168.1.19:3000` mientras corras la app en el
   PC; el dominio real cuando esté desplegada.
4. **Token**: el que da Finanzas en *Por confirmar → Conectar un
   celular*. **Cada teléfono usa el suyo**, así se puede revocar uno sin
   tocar el otro.
5. **Probar el envío** → debería aparecer un mensaje en la bandeja.

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
