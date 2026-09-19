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

## Compilar SIN instalar nada (recomendado)

Android Studio pide unos 8 GB de RAM. Si tu PC no da, GitHub lo compila
por ti:

1. Sube la rama: `git push`
2. En GitHub → pestaña **Actions** → **APK de Android** → **Run workflow**
3. Cuando termine (unos 3 minutos), entra a la ejecución y descarga
   **oyente-finanzas-apk** de la sección *Artifacts*
4. Descomprime, pasa el `.apk` al celular e instálalo (te pedirá
   permitir «orígenes desconocidos»)

El mismo APK sirve para los dos teléfonos.

## Compilar en tu PC (si tienes Android Studio)

1. Abre **Android Studio** → *Open* → elige la carpeta `android/` de
   este proyecto (no la raíz).
2. La primera vez pedirá descargar el **SDK de Android**. Acepta.
3. Conecta el celular por USB con la **depuración USB** activada
   (Ajustes → Acerca del teléfono → toca 7 veces «Número de
   compilación», y luego Opciones de desarrollador → Depuración USB).
4. Dale al botón ▶ **Run**.

Para el segundo teléfono: *Build → Build APK*, y pasa el archivo
`app/build/outputs/apk/debug/app-debug.apk` por WhatsApp o cable.

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
