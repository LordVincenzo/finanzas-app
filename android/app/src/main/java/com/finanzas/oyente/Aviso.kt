package com.finanzas.oyente

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat

/**
 * El aviso de «te quedan N por confirmar».
 *
 * POR QUÉ ES SILENCIOSO, Y POR QUÉ ES UNO SOLO.
 *
 * El banco ya te avisó. Sonar otra vez por el mismo movimiento sería
 * dos pitidos para lo mismo: ruido, y del que enseña a ignorar los
 * avisos. Lo que aquí falta no es enterarse de que gastaste —de eso ya
 * te enteraste— sino acordarte de que hay algo esperando a que lo
 * mires.
 *
 * Por eso es una sola notificación que lleva la cuenta, en un canal de
 * importancia baja: aparece en la lista, sin sonido y sin vibrar, se
 * actualiza sola según van llegando, y desaparece cuando no queda
 * ninguna. Nunca hay dos.
 *
 * NO ES ONGOING a propósito. Una notificación que no se puede quitar es
 * una que acabas silenciando entera desde los ajustes de Android, y
 * entonces ya no sirve para nada.
 */
object Aviso {

    private const val CANAL = "por_confirmar"
    private const val ID = 1

    /**
     * Pone el aviso en N, o lo quita si N es 0.
     *
     * Se puede llamar desde cualquier hilo y tantas veces como haga
     * falta: siempre es el mismo ID, así que reemplaza en vez de
     * apilar.
     */
    fun actualizar(contexto: Context, pendientes: Int) {
        val gestor = NotificationManagerCompat.from(contexto)

        if (pendientes <= 0) {
            gestor.cancel(ID)
            return
        }

        crearCanal(contexto)

        val abrir = Intent(contexto, MainActivity::class.java).apply {
            // Si la app ya está abierta, se trae al frente en vez de
            // apilar otra copia encima.
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val toque = PendingIntent.getActivity(
            contexto, 0, abrir,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val texto = if (pendientes == 1) "1 movimiento por confirmar"
                    else "$pendientes movimientos por confirmar"

        val aviso = NotificationCompat.Builder(contexto, CANAL)
            .setSmallIcon(android.R.drawable.ic_dialog_email)
            .setContentTitle("Finanzas")
            .setContentText(texto)
            .setContentIntent(toque)
            .setAutoCancel(true)
            .setOnlyAlertOnce(true)          // no vuelve a sonar al actualizar
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .build()

        try {
            gestor.notify(ID, aviso)
        } catch (e: SecurityException) {
            // Android 13+ sin el permiso de notificaciones concedido.
            // No es un fallo que merezca tumbar nada: el mensaje ya
            // llegó al servidor, que es lo que importa.
        }
    }

    /**
     * El canal.
     *
     * IMPORTANCE_LOW es lo que hace que no suene ni vibre. Ojo: Android
     * congela la importancia la PRIMERA vez que se crea el canal, y
     * cambiarla luego desde el código no tiene ningún efecto — solo la
     * persona puede, desde los ajustes. Así que si algún día se quiere
     * subir, hay que crear un canal con otro id.
     */
    private fun crearCanal(contexto: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return

        val canal = NotificationChannel(
            CANAL,
            "Por confirmar",
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = "Recuerda los movimientos que esperan a que los revises"
            setShowBadge(true)
            enableVibration(false)
        }

        contexto.getSystemService(NotificationManager::class.java)
            ?.createNotificationChannel(canal)
    }
}
