import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { leerNotificacion } from '@/lib/lectores'

/**
 * La puerta de entrada de la bandeja: aquí llega lo que el celular lee
 * de las notificaciones del banco.
 *
 * Es el ÚNICO sitio del proyecto que acepta datos de fuera sin sesión,
 * así que conviene tener claro qué lo protege y qué no.
 *
 * AUTENTICACIÓN. El token del dispositivo, y nada más. Va en el cuerpo
 * y no en una cabecera porque MacroDroid y compañía mandan JSON con
 * mucha más facilidad de la que ponen cabeceras.
 *
 * NO HACE FALTA NINGUNA CLAVE SECRETA NUEVA. Esta ruta usa la clave
 * pública, la misma del navegador, y llama a recibir_ingesta(), que es
 * SECURITY DEFINER y valida el token contra su hash. El owner_id sale
 * del token, nunca de lo que mande el cliente: un token no puede
 * escribir en la bandeja de otra persona. Si en vez de eso usáramos la
 * clave de servicio, habría un secreto más que guardar y rotar, y una
 * llave que abre TODA la base viviendo en un endpoint público.
 *
 * Y sobre todo: esto NO escribe en el ledger. Lo peor que puede hacer
 * alguien con un token robado es llenarte la bandeja de mensajes falsos,
 * que se borran de un toque. Ni un peso se mueve hasta que tú confirmes.
 */

export const dynamic = 'force-dynamic'

/** Un cuerpo enorme no es un caso legítimo: una notificación son dos
 *  líneas. Cortamos antes de leerlo entero. */
const MAXIMO_BYTES = 8 * 1024

type Cuerpo = {
  token?: unknown
  fuente?: unknown
  app?: unknown       // alias cómodo: en MacroDroid "app" se lee mejor
  texto?: unknown
  recibido?: unknown
}

function texto(valor: unknown): string {
  return typeof valor === 'string' ? valor.trim() : ''
}

export async function POST(request: NextRequest) {
  const crudo = await request.text()

  if (crudo.length > MAXIMO_BYTES) {
    return NextResponse.json({ ok: false, error: 'Mensaje demasiado largo' },
      { status: 413 })
  }

  /* Dos formas de mandar lo mismo.
   *
   * La buena es JSON, con el token dentro del cuerpo — un token en la
   * URL acaba escrito en los registros del servidor.
   *
   * Pero el cuerpo lo arma MacroDroid pegando el texto de la
   * notificación dentro de la plantilla, sin escaparlo. Si un banco
   * mandara un mensaje con comillas, el JSON quedaría roto y el gasto se
   * perdería EN SILENCIO, que es el peor fallo posible en una tubería
   * que uno deja corriendo sola durante días.
   *
   * Por eso, si el cuerpo no es JSON válido, se toma entero como el
   * texto y el token y la app se leen de la URL. Es la red de seguridad,
   * no el camino recomendado. */
  let cuerpo: Cuerpo
  try {
    const leido: unknown = JSON.parse(crudo)
    if (!leido || typeof leido !== 'object' || Array.isArray(leido)) {
      throw new Error('no es un objeto')
    }
    cuerpo = leido as Cuerpo
  } catch {
    const parametros = request.nextUrl.searchParams
    cuerpo = {
      token: parametros.get('token') ?? undefined,
      app: parametros.get('app') ?? undefined,
      texto: crudo,
    }
  }

  /* El token puede venir por tres sitios, y el orden importa.
   *
   * 1. Una cabecera. Es el mejor: no se mete en el cuerpo, así que el
   *    texto de la notificación puede llevar comillas sin romper nada,
   *    y no acaba escrito en los registros del servidor como pasaría en
   *    la URL. Es lo que recomienda la pantalla de conectar.
   * 2. El cuerpo JSON. Sencillo de configurar, pero se rompe si un
   *    banco manda un mensaje con comillas.
   * 3. La URL. La red de seguridad de la que habla el bloque de arriba.
   */
  const cabecera = request.headers.get('x-token')
    ?? request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    ?? ''

  const token = texto(cabecera) || texto(cuerpo.token)
  const fuente = texto(cuerpo.fuente) || texto(cuerpo.app)
    || texto(request.nextUrl.searchParams.get('app'))
  const mensaje = texto(cuerpo.texto)

  if (!token) {
    return NextResponse.json({ ok: false, error: 'Falta el token' },
      { status: 401 })
  }
  if (!mensaje) {
    return NextResponse.json({ ok: false, error: 'Falta el texto' },
      { status: 400 })
  }

  /* La hora la manda el celular porque puede haber leído la
     notificación sin cobertura y reintentado después. Si no viene, o
     viene mal, se usa la de ahora: es mejor una hora aproximada que
     rechazar el mensaje. */
  const cuando = texto(cuerpo.recibido)
  const fecha = cuando ? new Date(cuando) : new Date()
  const recibido = Number.isNaN(fecha.getTime())
    ? new Date().toISOString()
    : fecha.toISOString()

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false } }
  )

  /* Se interpreta AQUÍ, antes de guardar. El texto original se guarda
     entero igual, así que siempre se podrá reinterpretar; guardar lo
     leído deja ver de un vistazo qué entendió el lector de cada mensaje.
     El día que un banco cambie su formato, los nuevos empiezan a entrar
     con monto vacío y eso salta a la vista en la bandeja.

     Lo que salga de aquí es una propuesta, no un dato cerrado: la
     persona lo ve y puede cambiarlo antes de confirmar. */
  const leido = leerNotificacion(fuente, mensaje)

  const { data, error } = await supabase.rpc('recibir_ingesta', {
    p_token: token,
    p_fuente: fuente || 'desconocida',
    p_texto: mensaje,
    p_recibido: recibido,
    p_monto: leido.monto,
    p_comercio: leido.comercio,
    p_direccion: leido.direccion,
  })

  if (error) {
    /* "Token invalido" es la única causa que se distingue, y a
       propósito: cualquier otra se devuelve genérica para no contar
       cómo está construida la base por un endpoint abierto. */
    const invalido = error.message.includes('Token invalido')
    return NextResponse.json(
      { ok: false, error: invalido ? 'Token inválido' : 'No se pudo recibir' },
      { status: invalido ? 401 : 500 }
    )
  }

  /* data == null significa que ese mensaje ya estaba: la notificación
     llegó repetida. Se responde 200 y no un error, para que el celular
     lo dé por bueno y no se quede reintentando algo que funcionó. */
  return NextResponse.json({
    ok: true,
    duplicado: data === null,
    leido: { monto: leido.monto, comercio: leido.comercio, direccion: leido.direccion },
    id: data ?? null,
  })
}

/** Para comprobar desde el navegador que la ruta existe y responde. */
export async function GET() {
  return NextResponse.json({
    ok: true,
    mensaje: 'Endpoint de ingesta activo. Manda un POST con { token, app, texto }.',
  })
}
