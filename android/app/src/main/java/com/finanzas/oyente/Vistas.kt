package com.finanzas.oyente

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/**
 * Qué apps han mandado notificaciones últimamente.
 *
 * POR QUÉ EXISTE. Para que la app lea un banco nuevo hay que añadir su
 * nombre de paquete a Bancos.kt, y averiguarlo desde fuera es incómodo:
 * Android no lo enseña en ninguna pantalla normal, la URL de Play Store
 * a veces no coincide con lo que manda la notificación, y adivinarlo
 * falla en silencio — las notificaciones llegan, no encajan en la lista
 * blanca y se descartan sin dejar rastro. Eso es exactamente lo que
 * pasó con Nequi y Nu la primera vez.
 *
 * Con esto, la pantalla de diagnóstico enseña lo que de verdad llegó, y
 * añadir un banco es copiar una línea.
 *
 * SE GUARDA EL PAQUETE Y LA HORA. NO EL CONTENIDO. La app ve las
 * notificaciones de todo el teléfono —Android no deja pedir menos— así
 * que guardar en disco los títulos de WhatsApp para depurar sería
 * cambiar un problema pequeño por uno grande. El nombre del paquete
 * basta para lo único que hace falta.
 */
class Vistas(contexto: Context) {

    private val prefs = contexto.applicationContext
        .getSharedPreferences("oyente", Context.MODE_PRIVATE)

    data class Vista(
        val paquete: String,
        /** Milisegundos desde 1970, para ordenar y mostrar la hora. */
        val cuando: Long,
        /** ¿Estaba en la lista blanca? */
        val aceptado: Boolean,
    )

    @Synchronized
    fun anotar(paquete: String, aceptado: Boolean) {
        val todas = leer().toMutableList()

        /* Una entrada por app, no una por notificación: si no, diez
           mensajes de WhatsApp empujan fuera al banco que buscamos, que
           es justo el que hace falta ver. */
        todas.removeAll { it.paquete == paquete }
        todas.add(0, Vista(paquete, System.currentTimeMillis(), aceptado))

        escribir(todas.take(MAXIMO))
    }

    @Synchronized
    fun todas(): List<Vista> = leer()

    private fun leer(): List<Vista> {
        val crudo = prefs.getString(CLAVE, null) ?: return emptyList()
        return try {
            val raiz = JSONArray(crudo)
            (0 until raiz.length()).map { i ->
                val o = raiz.getJSONObject(i)
                Vista(
                    paquete = o.getString("paquete"),
                    cuando = o.getLong("cuando"),
                    aceptado = o.getBoolean("aceptado"),
                )
            }
        } catch (e: Exception) {
            emptyList()
        }
    }

    private fun escribir(vistas: List<Vista>) {
        try {
            val raiz = JSONArray()
            for (v in vistas) {
                raiz.put(
                    JSONObject()
                        .put("paquete", v.paquete)
                        .put("cuando", v.cuando)
                        .put("aceptado", v.aceptado)
                )
            }
            prefs.edit().putString(CLAVE, raiz.toString()).apply()
        } catch (e: Exception) {
            // Esto es diagnóstico: si no se puede guardar, no pasa nada
            // que merezca arriesgar el servicio de notificaciones.
        }
    }

    private companion object {
        const val CLAVE = "vistas"
        const val MAXIMO = 25
    }
}
