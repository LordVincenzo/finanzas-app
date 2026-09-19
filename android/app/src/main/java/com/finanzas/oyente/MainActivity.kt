package com.finanzas.oyente

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.view.View
import android.webkit.CookieManager
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import com.finanzas.oyente.databinding.ActivityMainBinding

/**
 * La app: tu Finanzas, con el oyente de notificaciones dentro.
 *
 * POR QUÉ UN WEBVIEW Y NO LA VÍA "OFICIAL". Google recomienda envolver
 * una web con una Trusted Web Activity, que usa Chrome de verdad. Pero
 * una TWA está aislada por diseño: no se le puede tender un puente. Y
 * sin puente hay que volver a copiar el token a mano de una pantalla a
 * otra, que es justo lo que esta versión viene a quitar.
 *
 * LO QUE HAY QUE VIGILAR de un WebView, y que aquí está resuelto:
 *
 *   - Los enlaces a otros dominios se abren en el navegador del
 *     teléfono, nunca aquí dentro. Un WebView con puente no es sitio
 *     para páginas ajenas.
 *   - El botón Atrás navega hacia atrás en la web antes de cerrar la
 *     app. Sin esto, Atrás desde cualquier pantalla te echa fuera.
 *   - El selector de archivos hay que implementarlo: sin él, subir la
 *     foto de perfil no hace nada al tocar el botón, y encima en
 *     silencio.
 *   - Si no hay red, sale una pantalla propia con un botón a los
 *     ajustes, en vez del error en inglés del WebView.
 */
class MainActivity : AppCompatActivity() {

    private lateinit var vista: ActivityMainBinding
    private lateinit var ajustes: Ajustes
    private lateinit var puente: Puente

    /** El callback del selector de archivos que está esperando respuesta. */
    private var esperandoArchivos: ValueCallback<Array<Uri>>? = null

    private lateinit var selectorArchivos: ActivityResultLauncher<Intent>
    private lateinit var permisoAvisos: ActivityResultLauncher<String>

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        vista = ActivityMainBinding.inflate(layoutInflater)
        setContentView(vista.root)

        ajustes = Ajustes(this)

        selectorArchivos = registerForActivityResult(
            ActivityResultContracts.StartActivityForResult()
        ) { resultado ->
            // Hay que contestar SIEMPRE, incluso si la persona canceló:
            // si no, el <input type="file"> de la web se queda colgado
            // para siempre y no se puede volver a intentar.
            val uris = WebChromeClient.FileChooserParams.parseResult(
                resultado.resultCode, resultado.data
            )
            esperandoArchivos?.onReceiveValue(uris)
            esperandoArchivos = null
        }

        // Sin nada que hacer con la respuesta: si dice que no, lo único
        // que se pierde es el recordatorio.
        permisoAvisos = registerForActivityResult(
            ActivityResultContracts.RequestPermission()
        ) { }

        pedirPermisoDeAvisos()
        configurarWeb()
        configurarAtras()

        vista.reintentar.setOnClickListener { cargar() }
        vista.ajustes.setOnClickListener {
            startActivity(Intent(this, AjustesActivity::class.java))
        }

        cargar()
    }

    override fun onResume() {
        super.onResume()
        // Al volver de los ajustes de Android —donde se concede el
        // acceso a notificaciones— la web tiene que enterarse de que
        // ahora sí lo tiene. Es la misma señal que usa el navegador al
        // volver a una pestaña, así que la web ya sabe escucharla.
        vista.web.evaluateJavascript(
            "document.dispatchEvent(new Event('visibilitychange'))", null
        )
    }

    /**
     * El permiso para mostrar el aviso de «N por confirmar».
     *
     * Solo hace falta pedirlo desde Android 13; antes bastaba con
     * declararlo en el manifiesto.
     *
     * Se pide al abrir y no se insiste: si la persona dice que no, lo
     * único que se pierde es un recordatorio. El resto —leer las
     * notificaciones del banco y mandarlas— no depende de esto, y una
     * app que vuelve a preguntar cada vez que la abres es una app que
     * se desinstala.
     */
    private fun pedirPermisoDeAvisos() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return

        val permiso = Manifest.permission.POST_NOTIFICATIONS
        if (ContextCompat.checkSelfPermission(this, permiso)
            == PackageManager.PERMISSION_GRANTED) return

        // El lanzador está registrado en onCreate y no aquí:
        // registerForActivityResult tiene que llamarse siempre y antes
        // de que la Activity arranque. Registrarlo dentro de un `if`
        // revienta con "attempting to register while current state is
        // STARTED" el día que este método se llame un poco más tarde.
        permisoAvisos.launch(permiso)
    }

    private fun configurarWeb() {
        val web = vista.web

        web.settings.apply {
            javaScriptEnabled = true
            // La sesión de Supabase y el service worker de la PWA
            // necesitan almacenamiento; sin esto habría que iniciar
            // sesión en cada arranque.
            domStorageEnabled = true
            useWideViewPort = true
            loadWithOverviewMode = true
            // El zoom con los dedos molesta en una app y descoloca el
            // diseño, que ya está hecho para esta pantalla.
            setSupportZoom(false)
            builtInZoomControls = false
        }

        CookieManager.getInstance().setAcceptCookie(true)
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, true)

        puente = Puente(applicationContext).apply {
            tienePermiso = { tienePermisoDeNotificaciones(this@MainActivity) }
            alPedirPermiso = {
                startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))
            }
            alAbrirDiagnostico = {
                startActivity(Intent(this@MainActivity, AjustesActivity::class.java))
            }
        }
        puente.instalar(web, ajustes.servidor)

        web.webViewClient = object : WebViewClient() {

            /**
             * Todo lo que no sea nuestro servidor se abre fuera.
             *
             * No es cosmético: window.Oyente vive en este WebView, y
             * aunque el puente solo se inyecta en nuestro origen, una
             * página ajena aquí dentro tendría nuestras cookies a un
             * fallo de distancia. Fuera, en el navegador, no.
             */
            override fun shouldOverrideUrlLoading(
                view: WebView, peticion: WebResourceRequest
            ): Boolean {
                val destino = peticion.url
                if (esNuestro(destino)) return false

                try {
                    startActivity(Intent(Intent.ACTION_VIEW, destino))
                } catch (e: Exception) {
                    // Sin navegador que lo abra no hay nada que hacer,
                    // pero tampoco se carga aquí dentro.
                }
                return true
            }

            override fun onPageFinished(view: WebView, url: String) {
                mostrarError(false)
            }

            override fun onReceivedError(
                view: WebView, peticion: WebResourceRequest, error: WebResourceError
            ) {
                // Solo el marco principal: que falle una imagen no es
                // motivo para tapar la app con una pantalla de error.
                if (peticion.isForMainFrame) mostrarError(true)
            }
        }

        web.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(
                webView: WebView,
                callback: ValueCallback<Array<Uri>>,
                parametros: FileChooserParams
            ): Boolean {
                // Si había otro esperando, cerrarlo: dejarlo colgado
                // bloquea el <input> de la web para siempre.
                esperandoArchivos?.onReceiveValue(null)
                esperandoArchivos = callback
                return try {
                    selectorArchivos.launch(parametros.createIntent())
                    true
                } catch (e: Exception) {
                    esperandoArchivos = null
                    false
                }
            }
        }
    }

    /** ¿Esta URL es de nuestro servidor? */
    private fun esNuestro(url: Uri): Boolean {
        val nuestro = Uri.parse(ajustes.servidor)
        return url.scheme == nuestro.scheme
            && url.host == nuestro.host
            && url.port == nuestro.port
    }

    private fun configurarAtras() {
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (vista.web.canGoBack()) vista.web.goBack() else finish()
            }
        })
    }

    private fun cargar() {
        mostrarError(false)
        vista.web.loadUrl(ajustes.servidor)
    }

    private fun mostrarError(hay: Boolean) {
        vista.error.visibility = if (hay) View.VISIBLE else View.GONE
        vista.web.visibility = if (hay) View.GONE else View.VISIBLE
        if (hay) {
            vista.errorDetalle.text =
                "No se pudo abrir ${ajustes.servidor}\n\n" +
                "Comprueba que tienes conexión. Si cambiaste de servidor, " +
                "revísalo en Ajustes."
        }
    }
}
