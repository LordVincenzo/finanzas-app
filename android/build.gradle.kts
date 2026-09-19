// Sin dependencias de terceros en toda la app: solo el SDK de Android y
// lo que trae el JDK. Menos cosas que se desactualicen o que haya que
// auditar en algo que lee tus notificaciones.
plugins {
    id("com.android.application") version "8.7.3" apply false
    id("org.jetbrains.kotlin.android") version "2.0.21" apply false
}
