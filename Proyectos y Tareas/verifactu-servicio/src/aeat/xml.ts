/**
 * Sobre SOAP de RegFactuSistemaFacturacion y lectura sencilla de XML.
 *
 * Es la misma estructura que `sobreSoap` del motor de la app
 * (app/src/gestoria/verifactu/xml.ts); se repite aquí porque el servicio se
 * despliega por separado. Si cambia una, hay que cambiar la otra.
 *
 * Fuentes:
 *  - SuministroLR.xsd y SuministroInformacion.xsd (espacios de nombres, Cabecera,
 *    RegistroFactura maxOccurs=1000, RemisionVoluntaria/Incidencia):
 *    https://prewww2.aeat.es/static_files/common/internet/dep/aplicaciones/es/aeat/tikeV1.0/cont/ws/SuministroLR.xsd
 *  - Descripción del servicio web v1.0.3, ejemplo 9.1.1.1:
 *    https://www.agenciatributaria.es/static_files/AEAT_Desarrolladores/EEDD/IVA/VERI-FACTU/Veri-Factu_Descripcion_SWeb.pdf
 */

export const NS_SOAP = 'http://schemas.xmlsoap.org/soap/envelope/'
export const NS_SUMINISTRO_LR = 'https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/SuministroLR.xsd'
export const NS_SUMINISTRO_INFORMACION = 'https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/SuministroInformacion.xsd'

export const MAX_REGISTROS_POR_ENVIO = 1000

export function escaparXml(s: string): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

export function desescaparXml(s: string): string {
  return String(s ?? '')
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')
}

/** Sobre completo con la cabecera del obligado y de 1 a 1.000 fragmentos RegistroAlta/RegistroAnulacion. */
export function sobreSoap(cabecera: { nif: string; razonSocial: string }, registros: string[], incidencia = false): string {
  if (!registros.length) throw new Error('No hay registros que enviar')
  if (registros.length > MAX_REGISTROS_POR_ENVIO) throw new Error(`Un envío admite como máximo ${MAX_REGISTROS_POR_ENVIO} registros`)
  const t = (n: string, v: string) => `<sum1:${n}>${escaparXml(v.trim())}</sum1:${n}>`
  return '<?xml version="1.0" encoding="UTF-8"?>' +
    `<soapenv:Envelope xmlns:soapenv="${NS_SOAP}" xmlns:sum="${NS_SUMINISTRO_LR}" xmlns:sum1="${NS_SUMINISTRO_INFORMACION}">` +
    '<soapenv:Header/><soapenv:Body><sum:RegFactuSistemaFacturacion><sum:Cabecera>' +
    `<sum1:ObligadoEmision>${t('NombreRazon', cabecera.razonSocial)}${t('NIF', cabecera.nif)}</sum1:ObligadoEmision>` +
    (incidencia ? `<sum1:RemisionVoluntaria>${t('Incidencia', 'S')}</sum1:RemisionVoluntaria>` : '') +
    '</sum:Cabecera>' +
    registros.map(x => `<sum:RegistroFactura>${x.replace(/^\s*<\?xml[^>]*\?>\s*/, '').trim()}</sum:RegistroFactura>`).join('') +
    '</sum:RegFactuSistemaFacturacion></soapenv:Body></soapenv:Envelope>'
}

const patron = (nombre: string) => new RegExp(`<(?:[\\w.-]+:)?${nombre}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[\\w.-]+:)?${nombre}>`, 'g')

/** Contenido de cada elemento con ese nombre local (con cualquier prefijo de espacio de nombres). */
export const bloques = (xml: string, nombre: string) => [...String(xml ?? '').matchAll(patron(nombre))].map(m => m[1])

/** Texto desescapado del primer elemento con ese nombre, o '' si no está. */
export function valor(xml: string, nombre: string): string {
  const b = bloques(xml, nombre)
  return b.length ? desescaparXml(b[0]).trim() : ''
}

export type TipoOperacion = 'Alta' | 'Anulacion'

/** Identificación de un registro para casarlo con su línea de respuesta: «Alta|NIF|número|dd-mm-aaaa». */
export const claveRegistro = (tipo: TipoOperacion, nif: string, numero: string, fecha: string) => `${tipo}|${nif.trim()}|${numero.trim()}|${fecha.trim()}`

/** Tipo e identificación de la factura de un fragmento RegistroAlta o RegistroAnulacion. */
export function identificarRegistro(xml: string): { tipo: TipoOperacion; nif: string; numero: string; fecha: string } | null {
  if (/<(?:[\w.-]+:)?RegistroAlta[\s>]/.test(xml)) {
    const id = bloques(xml, 'IDFactura')[0] ?? ''
    return { tipo: 'Alta', nif: valor(id, 'IDEmisorFactura'), numero: valor(id, 'NumSerieFactura'), fecha: valor(id, 'FechaExpedicionFactura') }
  }
  if (/<(?:[\w.-]+:)?RegistroAnulacion[\s>]/.test(xml)) {
    const id = bloques(xml, 'IDFactura')[0] ?? ''
    return { tipo: 'Anulacion', nif: valor(id, 'IDEmisorFacturaAnulada'), numero: valor(id, 'NumSerieFacturaAnulada'), fecha: valor(id, 'FechaExpedicionFacturaAnulada') }
  }
  return null
}
