/**
 * POST /api/registrar: recibe de la app los registros de facturación ya
 * generados (con su XML y su huella), los remite a la AEAT y devuelve el
 * resultado de cada uno.
 *
 * Petición:  { entorno: 'pruebas' | 'produccion', cabecera: { nif, razonSocial }, registros: [{ id, xml }] }
 * Respuesta: { estado, csv, esperaSegundos, respuestas: [{ registroId, estado, codigoError, descripcionError }] }
 *
 * Errores: 400 petición mal formada · 401/403 sin sesión o entorno no
 * habilitado · 429 aún no ha pasado el tiempo de espera de la AEAT (con
 * Retry-After y esperaSegundos) · 500 fallo interno.
 */
import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions'
import { motivoRechazo } from '../autenticacion'
import { configuracion } from '../configuracion'
import { anotarEnvio, esperaPendiente } from '../flujo'
import { ErrorEntrada, remitir, validarEntrada } from '../remision'

export async function registrar(req: HttpRequest, contexto: InvocationContext): Promise<HttpResponseInit> {
  const rechazo = motivoRechazo(req)
  if (rechazo) return { status: 401, jsonBody: { error: rechazo } }

  let entrada
  try {
    entrada = validarEntrada(await req.json())
  } catch (e) {
    const mensaje = e instanceof ErrorEntrada ? e.message : 'El cuerpo de la petición no es JSON válido'
    return { status: 400, jsonBody: { error: mensaje } }
  }

  if (!configuracion.entornosPermitidos().includes(entrada.entorno)) {
    return { status: 403, jsonBody: { error: `El entorno «${entrada.entorno}» no está habilitado en este servicio (ENTORNOS_PERMITIDOS)` } }
  }

  // Control de flujo (art. 16.2 de la Orden): una cadena por emisor y entorno.
  const clave = `${entrada.cabecera.nif}|${entrada.entorno}`
  const espera = esperaPendiente(clave, entrada.registros.length)
  if (espera > 0) {
    return {
      status: 429,
      headers: { 'Retry-After': String(espera) },
      jsonBody: { error: `La AEAT pide esperar entre envíos: faltan ${espera} s`, esperaSegundos: espera },
    }
  }

  try {
    const salida = await remitir(entrada, m => contexto.warn(m))
    anotarEnvio(clave, salida.esperaSegundos)
    contexto.log(`Envío ${entrada.entorno} de ${entrada.registros.length} registros: ${salida.estado}${salida.csv ? ` (CSV ${salida.csv})` : ''}`)
    return { status: 200, jsonBody: salida }
  } catch (e) {
    contexto.error('Error al remitir a la AEAT', e)
    return { status: 500, jsonBody: { error: e instanceof Error ? e.message : 'Error interno al remitir a la AEAT' } }
  }
}

app.http('registrar', {
  methods: ['POST'],
  // La protección la da Easy Auth (Entra ID) y la comprobación de autenticacion.ts; una clave de
  // función no serviría porque quedaría a la vista en el navegador.
  authLevel: 'anonymous',
  route: 'registrar',
  handler: registrar,
})
