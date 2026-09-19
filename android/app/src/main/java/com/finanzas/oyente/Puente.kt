package com.finanzas.oyente

import android.content.Context
import android.os.Build
import android.os.Handler
import android.os.Looper
import androidx.webkit.JavaScriptReplyProxy
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import android.webkit.WebView
import android.net.Uri
import org.json.JSONObject
import kotlin.concurrent.thread

/**
 * El puente entre la web y la parte nativa.
 *
 * POR QUÉ EXISTE. Sin esto, conectar el teléfono significaba copiar un
 * token de 64 caracteres de una pantalla a otra, y escribir a mano la
 * dirección del servidor. Con la web dentro de la app eso sobra: la
 * página ya sabe quién eres —tiene tu sesión— así que puede pedir el
 * token ella misma y pasárselo al oyente. Nadie escribe nada.
 *
 * POR QUÉ addWebMessageListener Y NO addJavascriptInterface. El de
 * siempre, addJavascriptInterface, inyecta el objeto en todos los
 * marcos de la página: un iframe de otro dominio podría llamar a
 * guardarToken() o pedir el estado. Aquí se acuña un token que escribe
 * en tu bandeja, así que eso no vale.
 *
 * addWebMessageListener ata el puente a una lista de orígenes. Si la
 * página no viene del servidor configurado, window.Oyente no existe y
 * no hay nada que llamar. La comprobación la hace el propio WebView
 * antes de inyectar, no nuestro código: no hay manera de que se nos
 * olvide validarlo en un método nuevo.
 *
 * EL PROTOCOLO es de mensajes, no de llamadas: la web manda
 * {id, accion, datos} y recibe {id, ok, datos} con el mismo id. Ver
 * lib/puente.ts en el lado de la web.
 */
class Puente(private val contexto: Context) {

    companion object {
        /** El nombre con el que la web lo encuentra: window.Oyente. */
        const val NOMBRE = "Oyente"

        fun disponible(): Boolean =
            WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)

        /**
         * Los orígenes que pueden hablar con el puente.
         *
         * Solo el servidor configurado. Se deriva de la URL en vez de
         * escribirse aparte para que no puedan desincronizarse: si la
         * app carga una página, esa misma página es la que puede
         * hablar, y ninguna otra.
         */
        fun origenesPermitidos(servidor: String): Set<String> {
            val uri = Uri.parse(servidor)
            val esquema = uri.scheme ?: return emptySet()
            val host = uri.host ?: return emptySet()
            val puerto = if (uri.port > 0) ":${uri.port}" else ""
            return setOf("$esquema://$host$puerto")
        }
    }

    /** Para devolver las respuestas al hilo principal. Ver enviar(). */
    private val principal = Handler(Looper.getMainLooper())

    /** Lo pone MainActivity: abrir los ajustes del sistema necesita una Activity. */
    var alPedirPermiso: (() -> Unit)? = null

    /** Lo pone MainActivity: ¿nos concedió Android el acceso a notificaciones? */
    var tienePermiso: (() -> Boolean)? = null

    fun instalar(web: WebView, servidor: String) {
        if (!disponible()) return
        val origenes = origenesPermitidos(servidor)
        if (origenes.isEmpty()) return

        WebViewCompat.addWebMessageListener(
            web, NOMBRE, origenes
        ) { _, mensaje, _, esMarcoPrincipal, respuesta ->
            // Solo la página en sí, no un iframe. El origen ya lo filtra
            // el WebView, pero esto cierra también la puerta a que algo
            // incrustado dentro de nuestra propia página acuñe tokens.
            if (esMarcoPrincipal) atender(mensaje.data ?: "", respuesta)
        }
    }

    private fun atender(crudo: String, respuesta: JavaScriptReplyProxy) {
        val peticion = try {
            JSONObject(crudo)
        } catch (e: Exception) {
            return   // no es nuestro protocolo: se ignora
        }

        val id = peticion.optInt("id", -1)
        val accion = peticion.optString("accion")
        val datos = peticion.optString("datos")

        when (accion) {
            "estado" -> responder(respuesta, id, estado())

            "pedirPermiso" -> {
                alPedirPermiso?.invoke()
                responder(respuesta, id, JSONObject().put("abierto", true))
            }

            "guardarToken" -> {
                val ajustes = Ajustes(contexto)
                ajustes.token = datos
                // Vaciar la cola aquí importa: si el teléfono estuvo
                // leyendo notificaciones sin token configurado, están
                // esperando en disco desde entonces.
                thread(isDaemon = true) {
                    try {
                        Enviador(contexto).vaciarCola()
                    } catch (e: Exception) {
                    }
                }
                responder(respuesta, id, estado())
            }

            "olvidarToken" -> {
                Ajustes(contexto).token = ""
                responder(respuesta, id, estado())
            }

            "probar" -> {
                // En otro hilo: esto hace una petición de red y estamos
                // en el hilo principal.
                thread(isDaemon = true) {
                    val texto = try {
                        Enviador(contexto).probar()
                    } catch (e: Exception) {
                        "No se pudo probar: ${e.message}"
                    }
                    responder(respuesta, id, JSONObject().put("mensaje", texto))
                }
            }

            else -> responderError(respuesta, id, "Acción desconocida: $accion")
        }
    }

    private fun estado(): JSONObject {
        val ajustes = Ajustes(contexto)
        return JSONObject()
            .put("permiso", tienePermiso?.invoke() ?: false)
            .put("token", ajustes.token.isNotEmpty())
            .put("servidor", ajustes.servidor)
            .put("modelo", modelo())
            .put("enviadas", ajustes.enviadas)
            .put("cola", Cola(contexto).cuantos())
            .put("ultimo", ajustes.ultimoResultado)
            .put("bancos", Bancos.resumen())
    }

    /** "Samsung Galaxy A34", para nombrar el dispositivo sin preguntar. */
    private fun modelo(): String {
        val marca = Build.MANUFACTURER?.replaceFirstChar { it.uppercase() } ?: ""
        val modelo = Build.MODEL ?: ""
        return when {
            modelo.startsWith(marca, ignoreCase = true) -> modelo
            marca.isBlank() -> modelo
            else -> "$marca $modelo"
        }.trim().ifEmpty { "Celular" }
    }

    private fun responder(respuesta: JavaScriptReplyProxy, id: Int, datos: JSONObject) {
        enviar(respuesta, JSONObject().put("id", id).put("ok", true).put("datos", datos))
    }

    private fun responderError(respuesta: JavaScriptReplyProxy, id: Int, error: String) {
        enviar(respuesta, JSONObject().put("id", id).put("ok", false).put("error", error))
    }

    /**
     * Responder SIEMPRE desde el hilo principal.
     *
     * postMessage() del WebView no es seguro fuera de él, y la acción
     * "probar" contesta desde un hilo de fondo porque hace una petición
     * de red. Sin este salto sería una carrera: unas veces funciona y
     * otras revienta, que es la peor clase de error.
     */
    private fun enviar(respuesta: JavaScriptReplyProxy, cuerpo: JSONObject) {
        principal.post {
            try {
                respuesta.postMessage(cuerpo.toString())
            } catch (e: Exception) {
                // La página se fue mientras respondíamos. No hay nada
                // que hacer, y desde luego no hay que tumbar la app.
            }
        }
    }
}
