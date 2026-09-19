package com.finanzas.oyente

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

/**
 * Lo que todavía no se ha podido mandar.
 *
 * POR QUÉ EXISTE. La notificación del banco llega una sola vez. Si en
 * ese momento no hay señal —el ascensor, el metro, el campo— y la app
 * solo intentara mandarla una vez, ese gasto se perdería para siempre y
 * sin avisar. En algo que uno deja corriendo todos los días, eso no es
 * un fallo raro: es martes.
 *
 * Se guarda en un archivo JSON dentro del almacenamiento privado de la
 * app. Un archivo y no una base de datos porque aquí nunca va a haber
 * más de un puñado de mensajes esperando, y una dependencia menos es
 * una cosa menos que puede romperse.
 *
 * Los duplicados no importan: el servidor ya los descarta por la huella
 * de app + texto + minuto. Así que reintentar de más es seguro, y
 * reintentar de menos es perder dinero. Se reintenta de más.
 */
class Cola(contexto: Context) {

    private val archivo = File(contexto.applicationContext.filesDir, "pendientes.json")

    data class Mensaje(
        val fuente: String,
        val texto: String,
        val recibido: String,
    )

    @Synchronized
    fun añadir(mensaje: Mensaje) {
        val todos = leer().toMutableList()
        // Un tope por si algo va muy mal: mejor perder lo más viejo que
        // llenar el teléfono con un archivo que crece sin freno.
        if (todos.size >= MAXIMO) todos.removeAt(0)
        todos.add(mensaje)
        escribir(todos)
    }

    @Synchronized
    fun quitar(mensaje: Mensaje) {
        val todos = leer().toMutableList()
        todos.removeAll { it.recibido == mensaje.recibido && it.texto == mensaje.texto }
        escribir(todos)
    }

    @Synchronized
    fun pendientes(): List<Mensaje> = leer()

    @Synchronized
    fun cuantos(): Int = leer().size

    private fun leer(): List<Mensaje> {
        if (!archivo.exists()) return emptyList()
        return try {
            val raiz = JSONArray(archivo.readText())
            (0 until raiz.length()).map { i ->
                val o = raiz.getJSONObject(i)
                Mensaje(
                    fuente = o.getString("fuente"),
                    texto = o.getString("texto"),
                    recibido = o.getString("recibido"),
                )
            }
        } catch (e: Exception) {
            // Archivo corrupto: se descarta antes que dejar la app
            // atascada intentando leerlo en cada notificación.
            emptyList()
        }
    }

    private fun escribir(mensajes: List<Mensaje>) {
        try {
            val raiz = JSONArray()
            for (m in mensajes) {
                raiz.put(
                    JSONObject()
                        .put("fuente", m.fuente)
                        .put("texto", m.texto)
                        .put("recibido", m.recibido)
                )
            }
            archivo.writeText(raiz.toString())
        } catch (e: Exception) {
            // Si no se puede escribir no hay nada que hacer aquí: lo
            // importante es no tumbar el servicio de notificaciones.
        }
    }

    private companion object {
        const val MAXIMO = 200
    }
}
