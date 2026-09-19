plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.finanzas.oyente"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.finanzas.oyente"
        // 24 = Android 7. NotificationListenerService existe desde
        // mucho antes, pero por debajo de 24 no vale la pena probar.
        minSdk = 24
        targetSdk = 35
        versionCode = 3
        versionName = "2.1"

        // A dónde apunta la app. Va aquí y no en una pantalla de
        // ajustes porque nadie debería tener que escribir una URL para
        // usar su propia app de finanzas. La pantalla de ajustes sigue
        // existiendo para diagnosticar y para apuntar al PC durante el
        // desarrollo, pero con esto ya arranca funcionando.
        buildConfigField(
            "String",
            "SERVIDOR",
            "\"https://finanzas-app-delta-six.vercel.app\""
        )
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        viewBinding = true
        buildConfig = true
    }
}

dependencies {
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("com.google.android.material:material:1.12.0")

    // androidx.webkit es de Google, no de un tercero, y está aquí por
    // una razón de seguridad concreta.
    //
    // La forma clásica de comunicar la web con la app —
    // addJavascriptInterface— inyecta el objeto en TODOS los marcos de
    // la página, incluidos los iframes de otros dominios. En una app
    // que puede acuñar un token de ingesta, eso es demasiado.
    //
    // addWebMessageListener, que viene de esta librería, ata el puente
    // a un origen concreto: si la página no es la nuestra, window.Oyente
    // sencillamente no existe. Ver Puente.kt.
    implementation("androidx.webkit:webkit:1.12.1")
}
