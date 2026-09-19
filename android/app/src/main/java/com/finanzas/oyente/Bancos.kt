package com.finanzas.oyente

/**
 * Qué notificaciones nos interesan y cómo se llaman en el servidor.
 *
 * Es la única lista que hay que tocar para añadir un banco: el valor de
 * la derecha es el mismo `fuente` que despacha los lectores de
 * lib/lectores.ts. Si aquí dice "nequi", allá tiene que haber un
 * leerNequi().
 *
 * LO QUE NO ESTÁ EN ESTA LISTA NO SE MANDA. La app tiene permiso para
 * leer todas las notificaciones del teléfono —Android no deja pedir
 * menos— así que el filtro es lo único que separa "lee tus bancos" de
 * "lee tu WhatsApp". Por eso es una lista blanca y no una lista negra:
 * una app nueva instalada mañana no empieza a enviarse sola.
 */
object Bancos {

    /**
     * Paquete de la app -> nombre de la fuente en el servidor.
     *
     * ESTOS NOMBRES SE COMPRUEBAN, NO SE DEDUCEN. Los dos primeros
     * estuvieron mal desde el principio —`com.nequi.NeQuI` y
     * `co.nu.production`, sacados de la URL de Play Store— y el fallo no
     * se ve por ninguna parte: la notificación llega, no encaja, se
     * descarta, y lo único que se nota es que la bandeja sigue vacía.
     *
     * El nombre de verdad lo enseña la pantalla de diagnóstico, que
     * apunta el paquete de todo lo que llega (ver Vistas.kt). Antes de
     * añadir un banco aquí, mírala.
     */
    private val PAQUETES = mapOf(
        // Comprobados con notificaciones reales.
        "com.nequi.MobileApp" to "nequi",
        "com.nu.production" to "nu",

        // SIN COMPROBAR: vienen de la misma fuente equivocada que los de
        // arriba. Cuando llegue una notificación de estos bancos, mira
        // el diagnóstico y corrige el nombre si hace falta.
        "com.daviplata" to "daviplata",
        "com.davivienda.bancamovil" to "davivienda",
    )

    /**
     * Apps de mensajes. DaviPlata y Davivienda avisan también por SMS,
     * y a veces el SMS trae más detalle que la notificación de la app.
     *
     * El truco: el SMS llega como una notificación de la app de
     * mensajes, con el remitente en el TÍTULO. Así se puede leer sin
     * pedir el permiso de SMS, que es de los más invasivos que hay y
     * que Google restringe con razón.
     */
    private val APPS_DE_MENSAJES = setOf(
        "com.google.android.apps.messaging",
        "com.samsung.android.messaging",
        "com.android.mms",
        "com.android.messaging",
    )

    /** Remitente del SMS -> nombre de la fuente. */
    private val REMITENTES = mapOf(
        "85888" to "daviplata",
        "85555" to "davivienda",
    )

    /**
     * Devuelve la fuente para esta notificación, o null si no nos
     * interesa — que es el caso de casi todo lo que llega al teléfono.
     */
    fun fuenteDe(paquete: String, titulo: String?): String? {
        PAQUETES[paquete]?.let { return it }

        if (paquete in APPS_DE_MENSAJES && titulo != null) {
            // El título del SMS suele ser el remitente tal cual, pero a
            // veces trae adornos ("SMS de 85555"). Se busca dentro.
            for ((remitente, fuente) in REMITENTES) {
                if (titulo.contains(remitente)) return fuente
            }
        }

        return null
    }

    /** Para la pantalla de ajustes: qué está escuchando la app. */
    fun resumen(): String {
        val apps = PAQUETES.values.joinToString(", ")
        val sms = REMITENTES.keys.joinToString(", ")
        return "Apps: $apps\nSMS de: $sms"
    }
}
