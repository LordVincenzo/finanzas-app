package com.finanzas.oyente

import android.content.Context

/**
 * Los dos datos que la app necesita: a dónde mandar y con qué token.
 *
 * Se guardan en SharedPreferences, que en Android vive en el
 * almacenamiento privado de la app: ninguna otra app puede leerlo.
 *
 * El token es el mismo que da la pantalla "Conectar un celular" de
 * Finanzas, y cada teléfono tiene el suyo: así se puede revocar el de
 * uno sin tocar el del otro.
 */
class Ajustes(contexto: Context) {

    private val prefs =
        contexto.applicationContext.getSharedPreferences("oyente", Context.MODE_PRIVATE)

    var servidor: String
        get() = prefs.getString(CLAVE_SERVIDOR, "") ?: ""
        set(valor) = prefs.edit().putString(CLAVE_SERVIDOR, limpiar(valor)).apply()

    var token: String
        get() = prefs.getString(CLAVE_TOKEN, "") ?: ""
        set(valor) = prefs.edit().putString(CLAVE_TOKEN, valor.trim()).apply()

    /** Cuántas notificaciones se han enviado bien, para dar señales de vida. */
    var enviadas: Int
        get() = prefs.getInt(CLAVE_ENVIADAS, 0)
        set(valor) = prefs.edit().putInt(CLAVE_ENVIADAS, valor).apply()

    /** El último resultado, para poder diagnosticar sin conectar el cable. */
    var ultimoResultado: String
        get() = prefs.getString(CLAVE_ULTIMO, "") ?: ""
        set(valor) = prefs.edit().putString(CLAVE_ULTIMO, valor).apply()

    val configurado: Boolean
        get() = servidor.isNotEmpty() && token.length >= 32

    /** La URL completa a la que se hace el POST. */
    fun urlDeIngesta(fuente: String): String =
        "$servidor/api/ingesta?app=$fuente"

    private fun limpiar(url: String): String {
        var u = url.trim()
        while (u.endsWith("/")) u = u.dropLast(1)
        // Sin esquema no es una URL: se asume http, que es lo que se usa
        // mientras el servidor está en la red de casa.
        if (u.isNotEmpty() && !u.startsWith("http://") && !u.startsWith("https://")) {
            u = "http://$u"
        }
        return u
    }

    private companion object {
        const val CLAVE_SERVIDOR = "servidor"
        const val CLAVE_TOKEN = "token"
        const val CLAVE_ENVIADAS = "enviadas"
        const val CLAVE_ULTIMO = "ultimo"
    }
}
