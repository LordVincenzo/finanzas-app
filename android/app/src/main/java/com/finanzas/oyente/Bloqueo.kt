package com.finanzas.oyente

import android.content.Context
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricManager.Authenticators.BIOMETRIC_WEAK
import androidx.biometric.BiometricManager.Authenticators.DEVICE_CREDENTIAL

/**
 * El bloqueo de la app.
 *
 * POR QUÉ. Esta app enseña cuánto dinero tienes y en qué te lo gastas.
 * Un teléfono desbloqueado encima de una mesa lo enseña todo a
 * cualquiera que lo levante. Ninguna app de banco se abre sin volver a
 * preguntar quién eres, y esta tiene los mismos datos.
 *
 * QUÉ CUENTA COMO "SALIR". No basta con cerrar la app: irse a WhatsApp
 * y volver es lo que se hace veinte veces al día, y en medio el
 * teléfono puede cambiar de manos. Se bloquea al perder el foco, con
 * una gracia corta —ver GRACIA— para que mirar una notificación y
 * volver no obligue a poner el dedo otra vez.
 *
 * LA APP NUNCA VE LA HUELLA. El diálogo lo dibuja Android y solo
 * devuelve un sí o un no. Es lo que hace que esto se pueda añadir a una
 * app de finanzas sin que sea peor el remedio.
 *
 * SE PUEDE ENTRAR CON EL PIN del teléfono además de con la huella
 * (DEVICE_CREDENTIAL). Sin eso, un dedo mojado o una pantalla sucia
 * dejarían a alguien fuera de sus propias cuentas, y ese es el fallo
 * que hace que la gente apague el bloqueo entero.
 */
class Bloqueo(contexto: Context) {

    private val contexto = contexto.applicationContext
    private val prefs = this.contexto
        .getSharedPreferences("oyente", Context.MODE_PRIVATE)

    /** ¿Lo quiere la persona? Apagado hasta que lo enciende. */
    var activo: Boolean
        get() = prefs.getBoolean(CLAVE_ACTIVO, false)
        set(valor) = prefs.edit().putBoolean(CLAVE_ACTIVO, valor).apply()

    /**
     * ¿Puede este teléfono pedir huella o PIN?
     *
     * Si no hay nada configurado —ni huella, ni patrón, ni PIN— ofrecer
     * el bloqueo sería ofrecer un botón que deja la app inaccesible o
     * que no hace nada. Se comprueba antes de enseñar el interruptor.
     */
    fun disponible(): Boolean {
        val estado = BiometricManager.from(contexto)
            .canAuthenticate(BIOMETRIC_WEAK or DEVICE_CREDENTIAL)
        return estado == BiometricManager.BIOMETRIC_SUCCESS
    }

    /* ---- Cuándo hay que volver a preguntar ------------------------ */

    /** Momento en que la app dejó de verse. 0 = nunca. */
    private var salida: Long
        get() = prefs.getLong(CLAVE_SALIDA, 0)
        set(valor) = prefs.edit().putLong(CLAVE_SALIDA, valor).apply()

    fun alSalir() {
        salida = System.currentTimeMillis()
    }

    /** Tras desbloquear, se olvida la salida para no volver a pedirlo. */
    fun alEntrar() {
        salida = 0
    }

    /**
     * ¿Hay que pedir el dedo ahora?
     *
     * Con salida == 0 se pide igual: es el primer arranque de la app,
     * que es justo cuando más hay que preguntar.
     */
    fun hayQuePreguntar(): Boolean {
        if (!activo) return false
        val cuando = salida
        if (cuando == 0L) return true
        return System.currentTimeMillis() - cuando > GRACIA
    }

    private companion object {
        const val CLAVE_ACTIVO = "bloqueo_activo"
        const val CLAVE_SALIDA = "bloqueo_salida"

        /**
         * Cuánto se puede salir sin que vuelva a preguntar.
         *
         * 30 segundos es el hueco entre "miro quién me escribió y
         * vuelvo" y "dejé el teléfono en la mesa". Más corto molesta en
         * el uso normal —y lo que molesta se apaga—; más largo deja la
         * app abierta el rato suficiente para que la vea otra persona.
         */
        const val GRACIA = 30_000L
    }
}
