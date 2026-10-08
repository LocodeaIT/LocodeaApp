/**
 * Remisión de un lote de registros a la AEAT: arma el sobre, lee el
 * certificado, llama al servicio VerifactuSOAP y traduce la respuesta al JSON
 * que espera la app (`app/src/gestoria/verifactu/servicio.ts`).
 * La usan la función HTTP `registrar` y el temporizador `reintentos`.
 */
import { enviarSoap, type RespuestaHttp } from './aeat/cliente'
import { endpointAeat } from './aeat/endpoints'
import { interpretarRespuesta } from './aeat/respuesta'
import { MAX_REGISTROS_POR_ENVIO, claveRegistro, identificarRegistro, sobreSoap } from './aeat/xml'
import { leerCertificado, olvidarCertificado } from './certificado'
import { configuracion, type EntornoAeat } from './configuracion'
import { ESPERA_INICIAL_SEGUNDOS } from './flujo'

export type EstadoEnvio = 'correcto' | 'parcial' | 'incorrecto' | 'error'
export type EstadoRegistro = 'pendiente' | 'correcto' | 'aceptado-errores' | 'rechazado'

export interface Entrada {
  entorno: EntornoAeat
  cabecera: { nif: string; razonSocial: string }
  registros: { id: string; xml: string }[]
  /** Reenvío tras una incidencia técnica (RemisionVoluntaria/Incidencia = S). */
  incidencia?: boolean
}

export interface Salida {
  estado: EstadoEnvio
  csv: string
  esperaSegundos: number
  respuestas: { registroId: string; estado: EstadoRegistro; codigoError: string; descripcionError: string }[]
}

/** Error de la petición (400): datos que faltan o no cuadran. */
export class ErrorEntrada extends Error {}

/** Comprueba la forma de la petición de la app. */
export function validarEntrada(cuerpo: unknown): Entrada {
  const c = (cuerpo ?? {}) as Partial<Entrada>
  if (c.entorno !== 'pruebas' && c.entorno !== 'produccion') throw new ErrorEntrada('El entorno debe ser «pruebas» o «produccion»')
  const nif = String(c.cabecera?.nif ?? '').trim(), razonSocial = String(c.cabecera?.razonSocial ?? '').trim()
  if (!nif || !razonSocial) throw new ErrorEntrada('Falta la cabecera (NIF y razón social del obligado a emitir)')
  if (!Array.isArray(c.registros) || !c.registros.length) throw new ErrorEntrada('No hay registros que enviar')
  if (c.registros.length > MAX_REGISTROS_POR_ENVIO) throw new ErrorEntrada(`Un envío admite como máximo ${MAX_REGISTROS_POR_ENVIO} registros`)
  const registros = c.registros.map((r, i) => {
    const id = String(r?.id ?? '').trim(), xml = String(r?.xml ?? '')
    if (!id || !xml) throw new ErrorEntrada(`El registro ${i + 1} no tiene id o XML`)
    const ident = identificarRegistro(xml)
    if (!ident) throw new ErrorEntrada(`El registro ${id} no es un RegistroAlta ni un RegistroAnulacion`)
    // La AEAT exige que el emisor de cada registro sea el obligado de la cabecera.
    if (ident.nif !== nif) throw new ErrorEntrada(`El registro ${id} es del emisor ${ident.nif}, no de ${nif}`)
    return { id, xml }
  })
  return { entorno: c.entorno, cabecera: { nif, razonSocial }, registros, incidencia: c.incidencia === true }
}

const ESTADO_ENVIO: Record<string, EstadoEnvio> = { Correcto: 'correcto', ParcialmenteCorrecto: 'parcial', Incorrecto: 'incorrecto' }
const ESTADO_REGISTRO: Record<string, EstadoRegistro> = { Correcto: 'correcto', AceptadoConErrores: 'aceptado-errores', Incorrecto: 'rechazado' }

/** Todos los registros siguen pendientes (no han llegado a la AEAT o no se sabe): se reintentarán. */
function todosPendientes(e: Entrada, codigo: string, descripcion: string, esperaSegundos = ESPERA_INICIAL_SEGUNDOS): Salida {
  return {
    estado: 'error', csv: '', esperaSegundos,
    respuestas: e.registros.map(r => ({ registroId: r.id, estado: 'pendiente' as const, codigoError: codigo, descripcionError: descripcion })),
  }
}

export async function remitir(e: Entrada, log: (mensaje: string) => void): Promise<Salida> {
  const sobre = sobreSoap(e.cabecera, e.registros.map(r => r.xml), e.incidencia)
  const url = endpointAeat(e.entorno, configuracion.certificadoSello())
  let http: RespuestaHttp
  try {
    const certificado = await leerCertificado()
    http = await enviarSoap(url, sobre, certificado, configuracion.timeoutMs())
  } catch (error) {
    // Sin conexión, TLS rechazado o Key Vault inaccesible: nada ha llegado a la AEAT.
    olvidarCertificado()
    const mensaje = error instanceof Error ? error.message : String(error)
    log(`Error al contactar con la AEAT (${e.entorno}): ${mensaje}`)
    return todosPendientes(e, '', `No se pudo enviar a la AEAT: ${mensaje}`)
  }

  const respuesta = interpretarRespuesta(http.cuerpo)
  if (respuesta.fallo) {
    // SOAP Fault: la AEAT rechaza el envío entero (formato o cabecera). Los registros no constan en la
    // AEAT; quedan pendientes con el código para corregir el problema y reenviarlos.
    log(`SOAP Fault ${respuesta.fallo.codigo}: ${respuesta.fallo.mensaje}`)
    return todosPendientes(e, respuesta.fallo.codigo, respuesta.fallo.mensaje)
  }
  if (http.status !== 200 || !respuesta.estadoEnvio) {
    log(`Respuesta inesperada de la AEAT (HTTP ${http.status}): ${http.cuerpo.slice(0, 500)}`)
    return todosPendientes(e, String(http.status), `Respuesta inesperada de la AEAT (HTTP ${http.status})`)
  }

  const porClave = new Map(respuesta.lineas.map(l => [l.clave, l]))
  const mismaCantidad = respuesta.lineas.length === e.registros.length
  return {
    estado: ESTADO_ENVIO[respuesta.estadoEnvio] ?? 'error',
    csv: respuesta.csv,
    esperaSegundos: respuesta.esperaSegundos ?? ESPERA_INICIAL_SEGUNDOS,
    respuestas: e.registros.map((r, i) => {
      const ident = identificarRegistro(r.xml)!
      // Se casa por tipo de operación e identificación de la factura; si no, por posición.
      const linea = porClave.get(claveRegistro(ident.tipo, ident.nif, ident.numero, ident.fecha)) ?? (mismaCantidad ? respuesta.lineas[i] : undefined)
      if (!linea) return { registroId: r.id, estado: 'pendiente' as const, codigoError: '', descripcionError: 'La AEAT no devolvió el resultado de este registro' }
      return {
        registroId: r.id,
        estado: ESTADO_REGISTRO[linea.estado] ?? 'pendiente',
        codigoError: linea.codigo,
        descripcionError: linea.descripcion,
      }
    }),
  }
}
