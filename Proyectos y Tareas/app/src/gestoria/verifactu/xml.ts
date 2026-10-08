/**
 * XML de Verifactu: el fragmento de cada registro (RegistroAlta o
 * RegistroAnulacion) y el sobre SOAP completo de RegFactuSistemaFacturacion.
 *
 * Fuentes:
 *  - WSDL (SOAP 1.1 document/literal) y esquemas:
 *    https://prewww2.aeat.es/static_files/common/internet/dep/aplicaciones/es/aeat/tikeV1.0/cont/ws/SistemaFacturacion.wsdl
 *    https://prewww2.aeat.es/static_files/common/internet/dep/aplicaciones/es/aeat/tikeV1.0/cont/ws/SuministroLR.xsd
 *    https://prewww2.aeat.es/static_files/common/internet/dep/aplicaciones/es/aeat/tikeV1.0/cont/ws/SuministroInformacion.xsd
 *    (RegistroFactura maxOccurs=1000; DetalleDesglose maxOccurs=12; IDVersion «1.0»;
 *    PrimerRegistro «S»; TipoHuella «01» = SHA-256; IDType 02–07.)
 *  - Descripción del servicio web v1.0.3 (28/07/2025), ejemplos 9.1.1.1 y 9.2.1.1,
 *    máximo de 1.000 registros por envío, escapado de & y <:
 *    https://www.agenciatributaria.es/static_files/AEAT_Desarrolladores/EEDD/IVA/VERI-FACTU/Veri-Factu_Descripcion_SWeb.pdf
 *
 * Cada fragmento declara su propio espacio de nombres (xmlns:sum1) para que el
 * XML guardado en el registro sea válido por sí solo; dentro del sobre la
 * declaración se repite sin efecto.
 */
import type { TipoFactura } from '../../crm/types'
import type { ConfigVerifactu } from '../types'
import { ddmmaaaa } from './fechas'
import { desescaparXml, escaparXml, importeTexto, porcentajeTexto } from './formato'

export const NS_SOAP = 'http://schemas.xmlsoap.org/soap/envelope/'
export const NS_SUMINISTRO_LR = 'https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/SuministroLR.xsd'
export const NS_SUMINISTRO_INFORMACION = 'https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/SuministroInformacion.xsd'

/** Máximo de registros por envío (SuministroLR.xsd, RegistroFactura maxOccurs=1000). */
export const MAX_REGISTROS_POR_ENVIO = 1000
/** Máximo de líneas de desglose por registro (DetalleDesglose maxOccurs=12). */
export const MAX_DETALLES_DESGLOSE = 12

export type CalificacionOperacion = 'S1' | 'S2' | 'N1' | 'N2'

/** Identificación de una factura: emisor, serie y número, y fecha de expedición (YYYY-MM-DD). */
export interface IdFacturaXml { nifEmisor: string; serieNumero: string; fechaExpedicion: string }

/** Registro anterior de la cadena, para el bloque Encadenamiento/RegistroAnterior. */
export interface AnteriorXml extends IdFacturaXml { huella: string }

/** Destinatario: NIF español o IDOtro (CodigoPais, IDType, ID). */
export interface DestinatarioXml {
  nombre: string
  nif?: string
  idOtro?: { codigoPais?: string; idType: string; id: string }
}

/** Una línea de Desglose/DetalleDesglose. */
export interface DetalleDesglose {
  /** 01 = IVA. */
  impuesto: '01'
  claveRegimen: string
  calificacion?: CalificacionOperacion
  /** Causa de exención (E1–E6); excluyente con la calificación. */
  exenta?: string
  /** Solo en S1 (y 0 en S2). */
  tipoImpositivo?: number
  /** Base imponible, o importe no sujeto en N1/N2. */
  base: number
  /** Solo en S1 (y 0 en S2). */
  cuota?: number
}

/** Bloque SistemaInformatico (lo produce Locodea para sí misma). */
export interface SistemaXml {
  nombreRazon: string
  nif: string
  nombreSistema: string
  idSistema: string
  version: string
  numeroInstalacion: string
  soloVerifactu: boolean
  multiOT: boolean
  indicadorMultiplesOT: boolean
}

export interface DatosRegistroAlta {
  idFactura: IdFacturaXml
  nombreRazonEmisor: string
  tipoFactura: TipoFactura
  /** S sustitutiva, I por diferencias. Obligatorio en R1–R5. */
  tipoRectificativa?: 'S' | 'I'
  facturasRectificadas?: IdFacturaXml[]
  descripcionOperacion: string
  destinatarios: DestinatarioXml[]
  desglose: DetalleDesglose[]
  cuotaTotal: number
  importeTotal: number
  /** null = primer registro de la cadena. */
  anterior: AnteriorXml | null
  sistema: SistemaXml
  fechaHoraGeneracion: string
  huella: string
}

export interface DatosRegistroAnulacion {
  idFactura: IdFacturaXml
  anterior: AnteriorXml | null
  sistema: SistemaXml
  fechaHoraGeneracion: string
  huella: string
}

// ─────────────────────────────────────────────── construcción

const e = (nombre: string, contenido: string) => `<sum1:${nombre}>${contenido}</sum1:${nombre}>`
const t = (nombre: string, valor: string | number) => e(nombre, escaparXml(String(valor ?? '').trim()))
const sn = (b: boolean) => (b ? 'S' : 'N')

const idFacturaAlta = (f: IdFacturaXml) =>
  t('IDEmisorFactura', f.nifEmisor) + t('NumSerieFactura', f.serieNumero) + t('FechaExpedicionFactura', ddmmaaaa(f.fechaExpedicion))

function encadenamiento(a: AnteriorXml | null): string {
  if (!a) return e('Encadenamiento', t('PrimerRegistro', 'S'))
  return e('Encadenamiento', e('RegistroAnterior', idFacturaAlta(a) + t('Huella', a.huella)))
}

function sistemaInformatico(s: SistemaXml): string {
  return e('SistemaInformatico',
    t('NombreRazon', s.nombreRazon) + t('NIF', s.nif) + t('NombreSistemaInformatico', s.nombreSistema) +
    t('IdSistemaInformatico', s.idSistema) + t('Version', s.version) + t('NumeroInstalacion', s.numeroInstalacion) +
    t('TipoUsoPosibleSoloVerifactu', sn(s.soloVerifactu)) + t('TipoUsoPosibleMultiOT', sn(s.multiOT)) +
    t('IndicadorMultiplesOT', sn(s.indicadorMultiplesOT)))
}

function destinatario(d: DestinatarioXml): string {
  const id = d.idOtro
    ? e('IDOtro', (d.idOtro.codigoPais ? t('CodigoPais', d.idOtro.codigoPais) : '') + t('IDType', d.idOtro.idType) + t('ID', d.idOtro.id))
    : t('NIF', d.nif ?? '')
  return e('IDDestinatario', t('NombreRazon', d.nombre) + id)
}

function detalle(d: DetalleDesglose): string {
  return e('DetalleDesglose',
    t('Impuesto', d.impuesto) + t('ClaveRegimen', d.claveRegimen) +
    (d.exenta ? t('OperacionExenta', d.exenta) : t('CalificacionOperacion', d.calificacion ?? '')) +
    (d.tipoImpositivo !== undefined ? t('TipoImpositivo', porcentajeTexto(d.tipoImpositivo)) : '') +
    t('BaseImponibleOimporteNoSujeto', importeTexto(d.base)) +
    (d.cuota !== undefined ? t('CuotaRepercutida', importeTexto(d.cuota)) : ''))
}

/** Bloque SistemaInformatico a partir de la configuración: Locodea produce su propio sistema, solo VERI*FACTU y para un único obligado. */
export function sistemaDe(config: ConfigVerifactu): SistemaXml {
  return {
    nombreRazon: config.razonSocial, nif: config.nifEmisor, nombreSistema: config.sistemaNombre, idSistema: config.sistemaId,
    version: config.sistemaVersion, numeroInstalacion: config.numeroInstalacion, soloVerifactu: true, multiOT: false, indicadorMultiplesOT: false,
  }
}

/** Fragmento <sum1:RegistroAlta> en el orden del esquema. */
export function xmlRegistroAlta(d: DatosRegistroAlta): string {
  const rectificativa = d.tipoFactura.startsWith('R')
  return `<sum1:RegistroAlta xmlns:sum1="${NS_SUMINISTRO_INFORMACION}">` +
    t('IDVersion', '1.0') +
    e('IDFactura', idFacturaAlta(d.idFactura)) +
    t('NombreRazonEmisor', d.nombreRazonEmisor) +
    t('TipoFactura', d.tipoFactura) +
    (rectificativa && d.tipoRectificativa ? t('TipoRectificativa', d.tipoRectificativa) : '') +
    (rectificativa && d.facturasRectificadas?.length
      ? e('FacturasRectificadas', d.facturasRectificadas.map(f => e('IDFacturaRectificada', idFacturaAlta(f))).join(''))
      : '') +
    t('DescripcionOperacion', d.descripcionOperacion) +
    (d.destinatarios.length ? e('Destinatarios', d.destinatarios.map(destinatario).join('')) : '') +
    e('Desglose', d.desglose.map(detalle).join('')) +
    t('CuotaTotal', importeTexto(d.cuotaTotal)) +
    t('ImporteTotal', importeTexto(d.importeTotal)) +
    encadenamiento(d.anterior) +
    sistemaInformatico(d.sistema) +
    t('FechaHoraHusoGenRegistro', d.fechaHoraGeneracion) +
    t('TipoHuella', '01') +
    t('Huella', d.huella) +
    '</sum1:RegistroAlta>'
}

/** Fragmento <sum1:RegistroAnulacion> en el orden del esquema. */
export function xmlRegistroAnulacion(d: DatosRegistroAnulacion): string {
  const f = d.idFactura
  return `<sum1:RegistroAnulacion xmlns:sum1="${NS_SUMINISTRO_INFORMACION}">` +
    t('IDVersion', '1.0') +
    e('IDFactura', t('IDEmisorFacturaAnulada', f.nifEmisor) + t('NumSerieFacturaAnulada', f.serieNumero) +
      t('FechaExpedicionFacturaAnulada', ddmmaaaa(f.fechaExpedicion))) +
    encadenamiento(d.anterior) +
    sistemaInformatico(d.sistema) +
    t('FechaHoraHusoGenRegistro', d.fechaHoraGeneracion) +
    t('TipoHuella', '01') +
    t('Huella', d.huella) +
    '</sum1:RegistroAnulacion>'
}

/**
 * Sobre SOAP completo de RegFactuSistemaFacturacion con la Cabecera
 * (ObligadoEmision) y de 1 a 1.000 registros. Con `incidencia` se marca
 * RemisionVoluntaria/Incidencia = S (envío retrasado por una incidencia
 * técnica, art. 16.4 de la Orden HAC/1177/2024).
 */
export function sobreSoap(config: Pick<ConfigVerifactu, 'nifEmisor' | 'razonSocial'>, registros: string[], opciones: { incidencia?: boolean } = {}): string {
  if (!registros.length) throw new Error('No hay registros que enviar')
  if (registros.length > MAX_REGISTROS_POR_ENVIO) {
    throw new Error(`Un envío admite como máximo ${MAX_REGISTROS_POR_ENVIO} registros (hay ${registros.length}): divídelo en varios`)
  }
  const cabecera = '<sum:Cabecera>' +
    e('ObligadoEmision', t('NombreRazon', config.razonSocial) + t('NIF', config.nifEmisor)) +
    (opciones.incidencia ? e('RemisionVoluntaria', t('Incidencia', 'S')) : '') +
    '</sum:Cabecera>'
  const cuerpo = registros.map(x => `<sum:RegistroFactura>${x.replace(/^\s*<\?xml[^>]*\?>\s*/, '').trim()}</sum:RegistroFactura>`).join('')
  return '<?xml version="1.0" encoding="UTF-8"?>' +
    `<soapenv:Envelope xmlns:soapenv="${NS_SOAP}" xmlns:sum="${NS_SUMINISTRO_LR}" xmlns:sum1="${NS_SUMINISTRO_INFORMACION}">` +
    '<soapenv:Header/><soapenv:Body><sum:RegFactuSistemaFacturacion>' + cabecera + cuerpo +
    '</sum:RegFactuSistemaFacturacion></soapenv:Body></soapenv:Envelope>'
}

// ─────────────────────────────────────────────── lectura (para validar y verificar)

const patron = (nombre: string) => new RegExp(`<(?:[\\w.-]+:)?${nombre}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[\\w.-]+:)?${nombre}>`, 'g')

/** Contenido (sin desescapar) de cada elemento con ese nombre local, con cualquier prefijo. */
export function bloquesXml(xml: string, nombre: string): string[] {
  return [...String(xml ?? '').matchAll(patron(nombre))].map(m => m[1])
}

/** Valores de texto (desescapados y sin espacios a los lados) de cada elemento con ese nombre. */
export const valoresXml = (xml: string, nombre: string) => bloquesXml(xml, nombre).map(x => desescaparXml(x).trim())

/** Valor del primer elemento con ese nombre, o null si no está. */
export function valorXml(xml: string, nombre: string): string | null {
  const v = valoresXml(xml, nombre)
  return v.length ? v[0] : null
}
