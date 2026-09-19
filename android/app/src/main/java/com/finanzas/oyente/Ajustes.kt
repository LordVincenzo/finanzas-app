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

    init {
        migrar()
    }

    /**
     * Arrastres de versiones anteriores.
     *
     * La 1 no traía servidor de fábrica: había que escribirlo a mano, y
     * lo normal era poner el PC de casa. La 2 se instala ENCIMA de la 1
     * —mismo applicationId— y conserva lo guardado, así que sin esto la
     * app nueva seguiría abriendo una IP de la red local: en casa
     * funcionaría a medias y fuera de casa no cargaría nada, sin que
     * nada explique por qué.
     *
     * Se borra el servidor guardado una sola vez. El token NO se toca:
     * sigue siendo válido y volver a pedirlo crearía un dispositivo
     * duplicado en la lista.
     */
    private fun migrar() {
        if (prefs.getInt(CLAVE_VERSION, 1) >= VERSION) return
        prefs.edit()
            .remove(CLAVE_SERVIDOR)
            .putInt(CLAVE_VERSION, VERSION)
            .apply()
    }

    /**
     * A dónde se manda.
     *
     * Si no hay nada guardado, el de fábrica (BuildConfig.SERVIDOR):
     * nadie debería tener que escribir una URL para usar su propia app.
     * Guardar cadena vacía vuelve al de fábrica en vez de dejar la app
     * apuntando a ninguna parte.
     */
    var servidor: String
        get() = prefs.getString(CLAVE_SERVIDOR, "")?.ifEmpty { null }
            ?: BuildConfig.SERVIDOR
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
        /** Sube cuando un ajuste guardado deja de ser válido. Ver migrar(). */
        const val VERSION = 2

        const val CLAVE_VERSION = "version_ajustes"
        const val CLAVE_SERVIDOR = "servidor"
        const val CLAVE_TOKEN = "token"
        const val CLAVE_ENVIADAS = "enviadas"
        const val CLAVE_ULTIMO = "ultimo"
    }
}
