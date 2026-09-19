package com.finanzas.oyente

import android.content.ComponentName
import android.content.Intent
import android.os.Bundle
import android.provider.Settings
import android.widget.Toast
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import androidx.appcompat.app.AppCompatActivity
import com.finanzas.oyente.databinding.ActivityAjustesBinding
import kotlin.concurrent.thread

/**
 * La pantalla de diagnóstico.
 *
 * YA NO ES LA PRINCIPAL. Antes era la única cosa que tenía la app y
 * había que rellenarla a mano: servidor, token, permiso. Ahora eso lo
 * resuelve la propia web desde dentro (ver Puente.kt), y esta pantalla
 * queda para cuando algo no funciona y hace falta ver qué pasa:
 * cuántas se han enviado, qué dijo el último intento, cuántas esperan
 * en la cola.
 *
 * También deja apuntar la app a otro servidor, que es como se prueba
 * contra el PC durante el desarrollo sin recompilar.
 *
 * Se llega desde el botón de la pantalla de error, cuando la web no
 * carga — que es justo el momento en que uno necesita saber a dónde
 * está intentando conectarse.
 */
class AjustesActivity : AppCompatActivity() {

    private lateinit var vista: ActivityAjustesBinding
    private lateinit var ajustes: Ajustes

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        vista = ActivityAjustesBinding.inflate(layoutInflater)
        setContentView(vista.root)

        ajustes = Ajustes(this)

        vista.servidor.setText(ajustes.servidor)

        vista.guardar.setOnClickListener {
            ajustes.servidor = vista.servidor.text.toString()
            vista.servidor.setText(ajustes.servidor)   // ya normalizado
            avisar("Guardado")
            refrescar()
        }

        vista.restablecer.setOnClickListener {
            ajustes.servidor = ""
            vista.servidor.setText(ajustes.servidor)
            avisar("De vuelta al servidor de fábrica")
            refrescar()
        }

        vista.permiso.setOnClickListener {
            // No se puede conceder desde código: lo da la persona en los
            // ajustes del sistema. Lo único que se puede hacer es
            // llevarla hasta ahí.
            startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))
        }

        vista.probar.setOnClickListener {
            vista.probar.isEnabled = false
            vista.probar.text = getString(R.string.probando)
            thread {
                val resultado = Enviador(applicationContext).probar()
                runOnUiThread {
                    vista.probar.isEnabled = true
                    vista.probar.setText(R.string.probar)
                    vista.resultado.text = resultado
                    refrescar()
                }
            }
        }
    }

    override fun onResume() {
        super.onResume()
        refrescar()
    }

    private fun refrescar() {
        val escuchando = tienePermisoDeNotificaciones(this)
        val cola = Cola(this).cuantos()

        vista.estado.text = buildString {
            append(if (escuchando) "✓ Escuchando notificaciones"
                   else "✗ Falta el permiso de notificaciones")
            append("\n")
            append(if (ajustes.token.isNotEmpty()) "✓ Token guardado"
                   else "✗ Sin token — ábrelo desde «Por confirmar» en la app")
            append("\n")
            append("Enviadas: ${ajustes.enviadas}")
            if (cola > 0) append(" · $cola esperando")
        }

        vista.resultado.text = ajustes.ultimoResultado
        vista.bancos.text = queSeHaVisto()
    }

    /**
     * Lo que de verdad ha llegado, con una marca en lo que encaja en la
     * lista blanca.
     *
     * Es la pantalla que dice POR QUÉ un banco no entra: si su app está
     * aquí con una cruz, el nombre del paquete que manda no es el que
     * está en Bancos.kt, y se copia de aquí.
     */
    private fun queSeHaVisto(): String {
        val vistas = Vistas(this).todas()
        if (vistas.isEmpty()) {
            return "Configurada para:\n${Bancos.resumen()}\n\n" +
                "Todavía no ha llegado ninguna notificación. Si acabas de " +
                "dar el permiso, haz una transacción y vuelve."
        }

        val hora = SimpleDateFormat("HH:mm", Locale.US)
        val lista = vistas.joinToString("\n") { v ->
            val marca = if (v.aceptado) "✓" else "·"
            "$marca ${v.paquete}   ${hora.format(Date(v.cuando))}"
        }
        return "Configurada para:\n${Bancos.resumen()}\n\n" +
            "Apps que han notificado (✓ = se manda):\n$lista"
    }

    private fun avisar(texto: String) =
        Toast.makeText(this, texto, Toast.LENGTH_SHORT).show()
}

/**
 * ¿Nos dio Android permiso de leer notificaciones?
 *
 * La lista de servicios autorizados vive en un ajuste del sistema, como
 * texto separado por dos puntos. No hay una API mejor.
 *
 * Está fuera de la clase porque lo usan las dos pantallas: esta y la
 * del WebView, que se lo pasa a la web por el puente.
 */
fun tienePermisoDeNotificaciones(contexto: android.content.Context): Boolean {
    val activos = Settings.Secure.getString(
        contexto.contentResolver, "enabled_notification_listeners"
    ) ?: return false
    val propio = ComponentName(contexto, OyenteNotificaciones::class.java)
    return activos.split(":").any {
        ComponentName.unflattenFromString(it) == propio
    }
}
