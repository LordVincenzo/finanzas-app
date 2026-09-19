package com.finanzas.oyente

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import kotlin.concurrent.thread

/**
 * El servicio que lee las notificaciones.
 *
 * Android entrega aquí TODAS las del teléfono. No se puede pedir menos:
 * el permiso es todo o nada. Por eso el primer filtro es lo primero que
 * pasa, y lo que no sea de un banco de la lista se descarta sin leerlo
 * siquiera. Nada sale del teléfono salvo el texto de esas cuatro apps.
 *
 * El trabajo de red va en otro hilo. Este método lo llama el sistema en
 * el hilo principal y bloquear ahí le da a Android permiso para matar el
 * servicio — que es como se pierden notificaciones sin enterarse.
 */
class OyenteNotificaciones : NotificationListenerService() {

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        val fuente = Bancos.fuenteDe(sbn.packageName, tituloDe(sbn)) ?: return

        val texto = textoDe(sbn) ?: return
        if (texto.isBlank()) return

        thread(isDaemon = true) {
            try {
                Enviador(applicationContext).encolarYEnviar(fuente, texto)
            } catch (e: Exception) {
                // Pase lo que pase, este servicio no puede caerse: si se
                // cae, Android deja de entregarle notificaciones hasta
                // que alguien vuelva a activarlo a mano.
            }
        }
    }

    /**
     * Cuando Android reconecta el servicio —tras un reinicio, o tras
     * matarlo por memoria— es el momento de vaciar lo que quedó
     * pendiente.
     */
    override fun onListenerConnected() {
        thread(isDaemon = true) {
            try {
                Enviador(applicationContext).vaciarCola()
            } catch (e: Exception) {
            }
        }
    }

    private fun tituloDe(sbn: StatusBarNotification): String? =
        sbn.notification?.extras?.getCharSequence(Notification.EXTRA_TITLE)?.toString()

    /**
     * El texto de la notificación.
     *
     * Se prefiere EXTRA_BIG_TEXT: los bancos mandan mensajes largos y
     * Android los recorta en EXTRA_TEXT con un "…". Leer el recortado
     * significaría perder justo el final, que es donde suele ir el
     * saldo o la referencia.
     */
    private fun textoDe(sbn: StatusBarNotification): String? {
        val extras = sbn.notification?.extras ?: return null
        val grande = extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString()
        if (!grande.isNullOrBlank()) return grande.trim()
        return extras.getCharSequence(Notification.EXTRA_TEXT)?.toString()?.trim()
    }
}
