package com.finanzas.oyente

import android.content.Context
import java.io.BufferedReader
import java.net.HttpURLConnection
import java.net.URL
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

/**
 * Manda los mensajes al endpoint /api/ingesta.
 *
 * HttpURLConnection y nada más: viene en Android, no hay que auditar
 * ninguna librería de red en una app que ve tus notificaciones.
 *
 * EL TEXTO VA SOLO EN EL CUERPO, sin JSON alrededor, y el token en una
 * cabecera. Así una notificación con comillas no puede romper nada —que
 * es lo que pasaba armando el JSON a mano— y el token no acaba escrito
 * en los registros del servidor, como pasaría en la URL.
 */
class Enviador(contexto: Context) {

    private val ajustes = Ajustes(contexto)
    private val cola = Cola(contexto)

    /** Resultado de un intento, para poder decidir si reintentar. */
    sealed class Resultado {
        object Bien : Resultado()
        /** El servidor contestó, pero que no. Reintentar no arregla nada. */
        data class Rechazado(val codigo: Int, val detalle: String) : Resultado()
        /** No se pudo ni preguntar: sin red, servidor apagado... */
        data class SinRed(val detalle: String) : Resultado()
    }

    /**
     * Encola y trata de vaciar. Encolar SIEMPRE va primero: si el envío
     * falla a mitad, el mensaje ya está a salvo en disco.
     */
    fun encolarYEnviar(fuente: String, texto: String) {
        cola.añadir(Cola.Mensaje(fuente, texto, ahoraISO()))
        vaciarCola()
    }

    /**
     * Intenta mandar todo lo pendiente, lo más viejo primero.
     *
     * Un rechazo del servidor (token malo, mensaje vacío) saca el
     * mensaje de la cola: reintentarlo daría el mismo resultado para
     * siempre y taparía los que vienen detrás. Un fallo de red lo deja
     * donde está, para el próximo intento.
     */
    fun vaciarCola() {
        if (!ajustes.configurado) return

        for (mensaje in cola.pendientes()) {
            when (val r = enviarUno(mensaje)) {
                is Resultado.Bien -> {
                    cola.quitar(mensaje)
                    ajustes.enviadas = ajustes.enviadas + 1
                    ajustes.ultimoResultado = "Enviado a las ${hora()}"
                }
                is Resultado.Rechazado -> {
                    cola.quitar(mensaje)
                    ajustes.ultimoResultado = "Rechazado (${r.codigo}): ${r.detalle}"
                }
                is Resultado.SinRed -> {
                    ajustes.ultimoResultado =
                        "Sin conexión, quedan ${cola.cuantos()} por enviar"
                    return   // no seguir: los demás fallarían igual
                }
            }
        }
    }

    private fun enviarUno(mensaje: Cola.Mensaje): Resultado {
        var conexion: HttpURLConnection? = null
        return try {
            val url = URL(ajustes.urlDeIngesta(mensaje.fuente))
            conexion = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                connectTimeout = 15_000
                readTimeout = 15_000
                doOutput = true
                setRequestProperty("Content-Type", "text/plain; charset=utf-8")
                setRequestProperty("X-Token", ajustes.token)
                setRequestProperty("X-Recibido", mensaje.recibido)
            }

            conexion.outputStream.use { it.write(mensaje.texto.toByteArray(Charsets.UTF_8)) }

            val codigo = conexion.responseCode
            if (codigo in 200..299) {
                Resultado.Bien
            } else {
                val cuerpo = conexion.errorStream
                    ?.bufferedReader()
                    ?.use(BufferedReader::readText)
                    ?.take(200) ?: ""
                Resultado.Rechazado(codigo, cuerpo)
            }
        } catch (e: Exception) {
            Resultado.SinRed(e.message ?: "sin detalle")
        } finally {
            conexion?.disconnect()
        }
    }

    /** Una prueba manual desde la pantalla de ajustes. */
    fun probar(): String {
        if (!ajustes.configurado) return "Falta el servidor o el token"
        val prueba = Cola.Mensaje(
            "nequi",
            "Prueba desde la app. Enviaste \$1.000 a la cuenta 3000000000.",
            ahoraISO()
        )
        return when (val r = enviarUno(prueba)) {
            is Resultado.Bien -> "Funciona: mira la bandeja en Finanzas"
            is Resultado.Rechazado -> "El servidor dijo que no (${r.codigo}): ${r.detalle}"
            is Resultado.SinRed -> "No se pudo conectar: ${r.detalle}"
        }
    }

    private fun ahoraISO(): String {
        val f = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US)
        f.timeZone = TimeZone.getTimeZone("UTC")
        return f.format(Date())
    }

    private fun hora(): String =
        SimpleDateFormat("HH:mm", Locale.US).format(Date())
}
