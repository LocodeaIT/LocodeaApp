/**
 * Mapeo de los datos del CRM a las claves de Verifactu: clave de régimen,
 * calificación u exención de la operación, tipo de identificación (IDType) y
 * destinatario.
 *
 * Fuentes:
 *  - SuministroInformacion.xsd (CalificacionOperacionType S1/S2/N1/N2,
 *    OperacionExentaType, PersonaFisicaJuridicaIDTypeType 02–07):
 *    https://prewww2.aeat.es/static_files/common/internet/dep/aplicaciones/es/aeat/tikeV1.0/cont/ws/SuministroInformacion.xsd
 *  - Diseño de registro, lista L8A (01 régimen general; 17 OSS e IOSS):
 *    https://www.agenciatributaria.es/static_files/AEAT_Desarrolladores/EEDD/IVA/VERI-FACTU/DsRegistroVeriFactu.xlsx
 *  - FAQ de la AEAT, «Registros de facturación: alta» (OSS → clave 17):
 *    https://sede.agenciatributaria.gob.es/Sede/iva/sistemas-informaticos-facturacion-verifactu/preguntas-frecuentes/registros-facturacion-alta.html
 *  - FAQ para desarrolladores (04/12/2025), pregunta 24: servicios a empresa de
 *    la UE con NIF-IVA (IDType 02) y a empresa de fuera de la UE → clave 01, N2:
 *    https://www.agenciatributaria.es/static_files/AEAT_Desarrolladores/EEDD/IVA/VERI-FACTU/FAQs-Desarrolladores.pdf
 *  - Validaciones y errores v1.2.2, apdo. 5 (significado de N1/N2 y E1–E6):
 *    https://www.agenciatributaria.es/static_files/AEAT_Desarrolladores/EEDD/IVA/VERI-FACTU/Validaciones_Errores_Veri-Factu.pdf
 */
import type { Cuenta, TipoIdFiscal, TipoOperacionVenta } from '../../crm/types'
import type { CalificacionOperacion, DestinatarioXml } from './xml'

export interface Calificado {
  claveRegimen: string
  calificacion?: CalificacionOperacion
  /** Causa de exención; excluyente con la calificación. */
  exenta?: string
}

/** Claves de régimen (lista L8A) que usa Locodea. */
export const CLAVES_REGIMEN: Record<string, string> = {
  '01': 'Operación de régimen general',
  '17': 'Operación acogida a alguno de los regímenes previstos en el Capítulo XI del Título IX (OSS e IOSS)',
}

export const CALIFICACIONES: Record<CalificacionOperacion, string> = {
  S1: 'Sujeta y no exenta, sin inversión del sujeto pasivo',
  S2: 'Sujeta y no exenta, con inversión del sujeto pasivo',
  N1: 'No sujeta por los artículos 7, 14 u otros de la Ley del IVA',
  N2: 'No sujeta por reglas de localización',
}

/** Causas de exención de la lista L10 para el IVA. */
export const EXENCIONES: Record<string, string> = {
  E1: 'Exenta por el artículo 20 de la Ley del IVA',
  E2: 'Exenta por el artículo 21 de la Ley del IVA',
  E3: 'Exenta por el artículo 22 de la Ley del IVA',
  E4: 'Exenta por los artículos 23 y 24 de la Ley del IVA',
  E5: 'Exenta por el artículo 25 de la Ley del IVA',
  E6: 'Exenta por otra causa de la Ley del IVA',
}

/** Tipos de identificación de IDOtro (lista L7). El 01 no existe: el NIF español va en el campo NIF. */
export const ID_TYPES: Record<string, string> = {
  '02': 'NIF-IVA', '03': 'Pasaporte', '04': 'Documento oficial de identificación del país de residencia',
  '05': 'Certificado de residencia', '06': 'Otro documento probatorio', '07': 'No censado',
}

/**
 * Clave de régimen y calificación (o exención) de cada tipo de operación de venta.
 * Locodea presta servicios, así que no hay exportaciones de bienes (clave 02, E2).
 */
export function calificacion(tipo: TipoOperacionVenta): Calificado {
  switch (tipo) {
    case 'interior':
    case 'ue-particular':
      return { claveRegimen: '01', calificacion: 'S1' }
    case 'ue-empresa':
    case 'fuera-ue':
      return { claveRegimen: '01', calificacion: 'N2' }
    case 'ue-oss':
      // Clave 17 confirmada en la FAQ de la AEAT. La calificación no la fija ninguna fuente: el IVA es
      // del Estado del cliente, así que en España se trata como no sujeta por reglas de localización.
      // Comprobar: calificación N2 y si la cuota extranjera puede ir en el desglose (la v1.0.6 de
      // «Validaciones y errores» quitó la excepción de la clave 17 en N1/N2). Falta respuesta de la AEAT.
      return { claveRegimen: '17', calificacion: 'N2' }
    case 'isp-interior':
      return { claveRegimen: '01', calificacion: 'S2' }
    case 'exenta':
      return { claveRegimen: '01', exenta: 'E1' }
  }
}

/** IDType de la AEAT para cada tipo de identificación del CRM; null = NIF español (campo NIF). */
export function idTypeDe(t: TipoIdFiscal): string | null {
  switch (t) {
    case 'nif': return null
    case 'nifiva': return '02'
    case 'pasaporte': return '03'
    case 'docoficial': return '04'
    case 'residencia': return '05'
    case 'otro': return '06'
    case 'nocensado': return '07'
  }
}

/** Quita espacios, guiones y puntos y pasa a mayúsculas: «b-12.345.674» → «B12345674». */
export const normalizarId = (s: string) => String(s ?? '').toUpperCase().replace(/[\s.\-/]/g, '')

/** Prefijo de país del NIF-IVA (Grecia usa EL, no GR). */
export const prefijoIva = (codigoPais: string) => (codigoPais.toUpperCase() === 'GR' ? 'EL' : codigoPais.toUpperCase())

/**
 * Destinatario a partir de la cuenta. Un NIF español solo vale para España: si
 * la cuenta es de otro país y está marcada como NIF, sale como IDOtro sin
 * IDType para que la validación lo señale en lugar de inventarlo.
 */
export function destinatarioDe(c: Cuenta): DestinatarioXml {
  const nombre = String(c.nombre ?? '').trim()
  const pais = String(c.codigoPais || 'ES').trim().toUpperCase()
  const id = normalizarId(c.cif)
  const idType = idTypeDe(c.tipoIdFiscal)
  if (idType === null) return pais === 'ES' ? { nombre, nif: id } : { nombre, idOtro: { codigoPais: pais, idType: '', id } }
  if (idType === '02') {
    // El NIF-IVA lleva delante el prefijo del Estado miembro (formato VIES).
    const prefijo = prefijoIva(pais)
    const conPrefijo = id.startsWith(prefijo) ? id : pais === 'GR' && id.startsWith('GR') ? prefijo + id.slice(2) : prefijo + id
    return { nombre, idOtro: { codigoPais: pais, idType, id: conPrefijo } }
  }
  return { nombre, idOtro: { codigoPais: pais, idType, id } }
}
