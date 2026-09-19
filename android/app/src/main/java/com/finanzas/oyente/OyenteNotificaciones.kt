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
        val fuente = Bancos.fuenteDe(sbn.packageName, tituloDe(sbn))

        /* Se anota SIEMPRE, encaje o no, y antes de mirar el contenido:
           solo el nombre del paquete y la hora. Es lo que permite ver en
           el diagnóstico por qué un banco no entra —el paquete real no
           es el que está en Bancos.kt— en vez de quedarse mirando una
           bandeja vacía sin ninguna pista. Ver Vistas.kt. */
        try {
            Vistas(applicationContext).anotar(sbn.packageName, fuente != null)
        } catch (e: Exception) {
        }

        if (fuente == null) return

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
     * El texto que se manda: TÍTULO Y CUERPO, en dos líneas.
     *
     * Antes iba solo el cuerpo, y eso perdía dinero de verdad. Nu manda
     * esto:
     *
     *     Título:  Enviaste $100,00
     *     Cuerpo:  Le enviaste a Bri***** Cas***** en su cuenta de Nequi.
     *
     * El monto está SOLO en el título. Con el cuerpo a secas, el lector
     * no encuentra ninguna cifra y el movimiento entra vacío — y un
     * movimiento vacío hay que teclearlo a mano, que es justo lo que
     * esto viene a evitar.
     *
     * Nequi se salvaba de casualidad porque repite el monto en el
     * cuerpo. Depender de esa casualidad, banco por banco, no es un
     * diseño.
     *
     * Se prefiere EXTRA_BIG_TEXT para el cuerpo: los bancos mandan
     * mensajes largos y Android recorta EXTRA_TEXT con un "…", justo
     * donde suele ir el saldo o la referencia.
     */
    private fun textoDe(sbn: StatusBarNotification): String? {
        val extras = sbn.notification?.extras ?: return null

        val titulo = extras.getCharSequence(Notification.EXTRA_TITLE)
            ?.toString()?.trim().orEmpty()

        val grande = extras.getCharSequence(Notification.EXTRA_BIG_TEXT)
            ?.toString()?.trim().orEmpty()
        val corto = extras.getCharSequence(Notification.EXTRA_TEXT)
            ?.toString()?.trim().orEmpty()
        val cuerpo = grande.ifEmpty { corto }

        return when {
            titulo.isEmpty() -> cuerpo.ifEmpty { null }
            cuerpo.isEmpty() -> titulo
            // Algunas apps repiten el título dentro del cuerpo. Mandarlo
            // dos veces haría que un lector encontrara el mismo monto
            // por partida doble.
            cuerpo.contains(titulo) -> cuerpo
            else -> "$titulo\n$cuerpo"
        }
    }
}
