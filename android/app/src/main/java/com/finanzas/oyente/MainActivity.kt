package com.finanzas.oyente

import android.content.ComponentName
import android.content.Intent
import android.os.Bundle
import android.provider.Settings
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.finanzas.oyente.databinding.ActivityMainBinding
import kotlin.concurrent.thread

/**
 * La única pantalla: dónde está el servidor, cuál es el token, y si
 * Android nos dejó escuchar.
 *
 * Se configura una vez por teléfono y no se vuelve a abrir. Por eso no
 * tiene navegación ni menús: lo que hace falta es que quien la abra por
 * primera vez sepa exactamente qué falta para que funcione.
 */
class MainActivity : AppCompatActivity() {

    private lateinit var vista: ActivityMainBinding
    private lateinit var ajustes: Ajustes

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        vista = ActivityMainBinding.inflate(layoutInflater)
        setContentView(vista.root)

        ajustes = Ajustes(this)

        vista.servidor.setText(ajustes.servidor)
        vista.token.setText(ajustes.token)
        vista.bancos.text = Bancos.resumen()

        vista.guardar.setOnClickListener {
            ajustes.servidor = vista.servidor.text.toString()
            ajustes.token = vista.token.text.toString()
            vista.servidor.setText(ajustes.servidor)   // ya normalizado
            avisar(if (ajustes.configurado) "Guardado" else "Falta el servidor o el token")
            refrescar()
        }

        vista.permiso.setOnClickListener {
            // No se puede conceder desde código: lo da la persona en los
            // ajustes del sistema. Lo único que se puede hacer es
            // llevarla hasta ahí.
            startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))
        }

        vista.probar.setOnClickListener {
            ajustes.servidor = vista.servidor.text.toString()
            ajustes.token = vista.token.text.toString()
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
        val escuchando = tienePermiso()
        val cola = Cola(this).cuantos()

        vista.estado.text = buildString {
            append(if (escuchando) "✓ Escuchando notificaciones"
                   else "✗ Falta el permiso de notificaciones")
            append("\n")
            append(if (ajustes.configurado) "✓ Servidor y token guardados"
                   else "✗ Falta el servidor o el token")
            append("\n")
            append("Enviadas: ${ajustes.enviadas}")
            if (cola > 0) append(" · $cola esperando")
        }

        vista.resultado.text = ajustes.ultimoResultado
    }

    /**
     * ¿Nos dio Android permiso de leer notificaciones?
     *
     * La lista de servicios autorizados vive en un ajuste del sistema,
     * como texto separado por dos puntos. No hay una API mejor.
     */
    private fun tienePermiso(): Boolean {
        val activos = Settings.Secure.getString(
            contentResolver, "enabled_notification_listeners"
        ) ?: return false
        val propio = ComponentName(this, OyenteNotificaciones::class.java)
        return activos.split(":").any {
            ComponentName.unflattenFromString(it) == propio
        }
    }

    private fun avisar(texto: String) =
        Toast.makeText(this, texto, Toast.LENGTH_SHORT).show()
}
