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
        versionCode = 1
        versionName = "1.0"
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
    }
}

dependencies {
    // Solo esto. Nada de librerías de red ni de JSON: HttpURLConnection
    // y org.json vienen en el propio Android.
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("com.google.android.material:material:1.12.0")
}
