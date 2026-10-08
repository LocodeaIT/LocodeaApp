/**
 * Llamada al servicio de Azure que remite los registros a la AEAT. La app no
 * habla con la AEAT ni ve el certificado: manda los XML de los registros y
 * recibe el resultado de cada uno.
 *
 * Contrato con `verifactu-servicio/src/functions/registrar.ts`:
 *  POST { entorno, cabecera: { nif, razonSocial }, registros: [{ id, xml }] }
 *  → { estado, csv, esperaSegundos, respuestas: [{ registroId, estado, codigoError, descripcionError }] }
 *
 * Fuentes del control de flujo (máx. 1.000 registros por envío y orden de
 * generación, art. 16 de la Orden HAC/1177/2024):
 * https://www.boe.es/diario_boe/txt.php?id=BOE-A-2024-22138
 */
import type { ConfigVerifactu, EstadoEnvio, EstadoRegistro, RegistroFacturacion } from '../types'
import { MAX_REGISTROS_POR_ENVIO } from './xml'

export interface RespuestaRegistro { registroId: string; estado: EstadoRegistro; codigoError: string; descripcionError: string }

export interface RespuestaServicio {
  estado: EstadoEnvio
  csv: string
  /** Segundos que hay que esperar antes del siguiente envío (TiempoEsperaEnvio). */
  esperaSegundos: number
  respuestas: RespuestaRegistro[]
}

/** Espera inicial entre envíos que fija el art. 16.2 de la Orden. */
export const ESPERA_INICIAL_SEGUNDOS = 60

const ESTADOS_ENVIO: EstadoEnvio[] = ['correcto', 'parcial', 'incorrecto', 'error']
const ESTADOS_REGISTRO: EstadoRegistro[] = ['pendiente', 'correcto', 'aceptado-errores', 'rechazado']

/**
 * Envía los registros pendientes al servicio de Azure, en orden de
 * generación. `token` es el token de Entra ID para el servicio, si lo protege.
 */
export async function enviarAlServicio(
  config: ConfigVerifactu,
  registros: RegistroFacturacion[],
  opciones: { token?: string; fetch?: typeof fetch } = {},
): Promise<RespuestaServicio> {
  if (config.entorno === 'preparacion') throw new Error('Verifactu está en modo preparación: los registros se generan pero no se envían a la AEAT.')
  const url = String(config.servicioUrl ?? '').trim()
  if (!url) throw new Error('Falta la URL del servicio de envío a la AEAT en la configuración de Verifactu.')
  if (!registros.length) throw new Error('No hay registros que enviar.')
  if (registros.length > MAX_REGISTROS_POR_ENVIO) throw new Error(`Un envío admite como máximo ${MAX_REGISTROS_POR_ENVIO} registros (hay ${registros.length}).`)
  for (const r of registros) {
    if (r.entorno !== config.entorno) throw new Error(`El registro ${r.serieNumero} es del entorno «${r.entorno}» y la configuración está en «${config.entorno}».`)
    if (r.nifEmisor !== config.nifEmisor) throw new Error(`El registro ${r.serieNumero} es de otro emisor (${r.nifEmisor}).`)
    if (r.estado !== 'pendiente') throw new Error(`El registro ${r.serieNumero} no está pendiente de envío (estado «${r.estado}»).`)
    if (!r.xml) throw new Error(`El registro ${r.serieNumero} no tiene XML.`)
  }
  // Se remiten en el orden temporal de generación (art. 16.4).
  const ordenados = [...registros].sort((a, b) => a.orden - b.orden)
  const cuerpo = {
    entorno: config.entorno,
    cabecera: { nif: config.nifEmisor, razonSocial: config.razonSocial },
    registros: ordenados.map(r => ({ id: r.id, xml: r.xml })),
  }
  const hacerFetch = opciones.fetch ?? globalThis.fetch
  let res: Response
  try {
    res = await hacerFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(opciones.token ? { Authorization: `Bearer ${opciones.token}` } : {}) },
      body: JSON.stringify(cuerpo),
    })
  } catch (e) {
    throw new Error(`No se ha podido contactar con el servicio de envío a la AEAT: ${e instanceof Error ? e.message : String(e)}`)
  }
  const texto = await res.text()
  let datos: unknown = null
  try { datos = texto ? JSON.parse(texto) : null } catch { /* respuesta no JSON */ }
  if (!res.ok) {
    const detalle = (datos as { error?: string } | null)?.error ?? texto.slice(0, 300)
    const espera = (datos as { esperaSegundos?: number } | null)?.esperaSegundos
    throw new Error(`El servicio de envío respondió ${res.status}${detalle ? `: ${detalle}` : ''}${espera ? ` (espera ${espera} s)` : ''}`)
  }
  return normalizar(datos, ordenados)
}

/** Comprueba la forma de la respuesta y rellena lo que falte con valores seguros. */
function normalizar(datos: unknown, enviados: RegistroFacturacion[]): RespuestaServicio {
  const d = (datos ?? {}) as Partial<RespuestaServicio>
  if (!d || typeof d !== 'object' || !Array.isArray(d.respuestas)) throw new Error('El servicio de envío devolvió una respuesta sin el resultado de los registros.')
  const ids = new Set(enviados.map(r => r.id))
  return {
    estado: ESTADOS_ENVIO.includes(d.estado as EstadoEnvio) ? (d.estado as EstadoEnvio) : 'error',
    csv: String(d.csv ?? ''),
    esperaSegundos: Number.isFinite(Number(d.esperaSegundos)) && Number(d.esperaSegundos) >= 0 ? Number(d.esperaSegundos) : ESPERA_INICIAL_SEGUNDOS,
    respuestas: d.respuestas
      .filter(x => x && ids.has(String(x.registroId)))
      .map(x => ({
        registroId: String(x.registroId),
        estado: ESTADOS_REGISTRO.includes(x.estado) ? x.estado : 'pendiente',
        codigoError: String(x.codigoError ?? ''),
        descripcionError: String(x.descripcionError ?? ''),
      })),
  }
}
