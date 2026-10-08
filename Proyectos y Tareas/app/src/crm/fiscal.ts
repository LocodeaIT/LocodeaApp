/**
 * Datos fiscales del CRM que necesita la Gestoría: valores por defecto de
 * cuentas y facturas, catálogos para los desplegables y las reglas que
 * proponen el tipo de operación a partir del país y del tipo de cliente.
 *
 * El CRM registra; la Gestoría declara. Aquí solo se decide qué propone el
 * CRM al rellenar una factura: el usuario lo puede cambiar y la revisión de
 * Gestoría avisa si queda incoherente.
 */
import type {
  ClaveRetencion, Cuenta, EstadoVerifactu, FacturaCompra, FacturaVenta, TipoFactura, TipoIdFiscal, TipoOperacionCompra, TipoOperacionVenta,
} from './types'

/** Estados miembros de la UE (código ISO 3166-1 alfa-2; Grecia es GR, aunque su NIF-IVA empiece por EL). */
export const PAISES_UE = ['AT', 'BE', 'BG', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR', 'HU', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK']

export const esUE = (codigoPais: string | null | undefined) => PAISES_UE.includes(String(codigoPais || '').toUpperCase())
export const esEspana = (codigoPais: string | null | undefined) => !codigoPais || String(codigoPais).toUpperCase() === 'ES'

/** Países más habituales para el desplegable (el resto se escribe con su código). */
export const PAISES: Record<string, string> = {
  ES: 'España', PT: 'Portugal', FR: 'Francia', DE: 'Alemania', IT: 'Italia', IE: 'Irlanda', NL: 'Países Bajos', BE: 'Bélgica', LU: 'Luxemburgo',
  AT: 'Austria', SE: 'Suecia', DK: 'Dinamarca', FI: 'Finlandia', PL: 'Polonia', CZ: 'Chequia', RO: 'Rumanía', GR: 'Grecia', HR: 'Croacia',
  HU: 'Hungría', SK: 'Eslovaquia', SI: 'Eslovenia', BG: 'Bulgaria', EE: 'Estonia', LV: 'Letonia', LT: 'Lituania', CY: 'Chipre', MT: 'Malta',
  GB: 'Reino Unido', CH: 'Suiza', NO: 'Noruega', US: 'Estados Unidos', CA: 'Canadá', MX: 'México', AR: 'Argentina', CO: 'Colombia',
  CL: 'Chile', PE: 'Perú', AD: 'Andorra', MA: 'Marruecos', AU: 'Australia', JP: 'Japón', IN: 'India', IL: 'Israel', AE: 'Emiratos Árabes Unidos',
}

/** Del nombre libre del país (como lo guardaba el CRM) a su código; vacío si no se reconoce. */
export function codigoDePais(nombre: string): string {
  const n = String(nombre || '').trim().toLowerCase()
  if (!n) return ''
  if (/^[a-z]{2}$/.test(n)) return n.toUpperCase()
  const hit = Object.entries(PAISES).find(([, v]) => v.toLowerCase() === n)
  return hit?.[0] ?? ''
}

// ─────────────────────────────────────────────── catálogos

export const TIPO_ID_FISCAL: Record<TipoIdFiscal, string> = {
  nif: 'NIF español', nifiva: 'NIF-IVA (UE)', pasaporte: 'Pasaporte', docoficial: 'Documento oficial del país', residencia: 'Certificado de residencia',
  otro: 'Otro documento', nocensado: 'No censado',
}
export const TIPO_OPERACION_VENTA: Record<TipoOperacionVenta, string> = {
  interior: 'Interior · IVA español', 'ue-empresa': 'Empresa de la UE · inversión del sujeto pasivo', 'ue-particular': 'Particular de la UE · IVA español',
  'ue-oss': 'Particular de la UE · ventanilla única (OSS)', 'fuera-ue': 'Fuera de la UE · no sujeta', 'isp-interior': 'Inversión del sujeto pasivo en España',
  exenta: 'Exenta',
}
export const TIPO_OPERACION_COMPRA: Record<TipoOperacionCompra, string> = {
  interior: 'Interior · IVA español', ue: 'Proveedor de la UE · autorrepercusión', 'fuera-ue': 'Servicios de fuera de la UE · autorrepercusión',
  importacion: 'Importación con DUA', 'isp-interior': 'Inversión del sujeto pasivo en España', exenta: 'Exenta o sin IVA',
}
export const TIPO_FACTURA: Record<TipoFactura, string> = {
  F1: 'F1 · Completa', F2: 'F2 · Simplificada', F3: 'F3 · Sustituye a simplificadas', R1: 'R1 · Rectificativa (error fundado en derecho)',
  R2: 'R2 · Rectificativa (concurso)', R3: 'R3 · Rectificativa (deuda incobrable)', R4: 'R4 · Rectificativa (resto de causas)', R5: 'R5 · Rectificativa de simplificada',
}
export const ESTADO_VERIFACTU: Record<EstadoVerifactu, string> = {
  'sin-registro': 'Sin registro', preparado: 'Preparado (sin enviar)', pendiente: 'Pendiente de envío', correcto: 'Correcto',
  'aceptado-errores': 'Aceptado con errores', rechazado: 'Rechazado', anulado: 'Anulado',
}
export const CLAVE_RETENCION: Record<ClaveRetencion, string> = {
  ninguna: 'Sin retención', profesional: 'Profesional (111)', arrendamiento: 'Alquiler de local (115)', otros: 'Otras retenciones (111)',
}
/** Retención por defecto de cada clave, en %. */
export const RETENCION_POR_DEFECTO: Record<ClaveRetencion, number> = { ninguna: 0, profesional: 15, arrendamiento: 19, otros: 15 }

/** Mención obligatoria en la factura cuando no lleva IVA. */
export const MENCION_SIN_IVA: Partial<Record<TipoOperacionVenta, string>> = {
  'ue-empresa': 'Inversión del sujeto pasivo (art. 84.Uno.2.º y 69 de la Ley 37/1992 del IVA; art. 196 de la Directiva 2006/112/CE).',
  'fuera-ue': 'Operación no sujeta al IVA español por reglas de localización (art. 69 de la Ley 37/1992 del IVA).',
  'isp-interior': 'Inversión del sujeto pasivo (art. 84.Uno.2.º de la Ley 37/1992 del IVA).',
  exenta: 'Operación exenta de IVA (art. 20 de la Ley 37/1992 del IVA).',
}

/** La operación de venta lleva IVA español en la factura. */
export const ventaConIva = (t: TipoOperacionVenta) => t === 'interior' || t === 'ue-particular' || t === 'ue-oss'

// ─────────────────────────────────────────────── valores por defecto

export const FISCAL_CUENTA: Pick<Cuenta, 'codigoPais' | 'tipoIdFiscal' | 'particular' | 'viesValido' | 'viesComprobadoEl'> = {
  codigoPais: 'ES', tipoIdFiscal: 'nif', particular: false, viesValido: null, viesComprobadoEl: null,
}

export const FISCAL_VENTA: Pick<FacturaVenta, 'tipoOperacion' | 'tipoFactura' | 'rectificadaId' | 'motivoRectificacion' | 'estadoVerifactu' | 'huella'> = {
  tipoOperacion: 'interior', tipoFactura: 'F1', rectificadaId: null, motivoRectificacion: '', estadoVerifactu: 'sin-registro', huella: '',
}

export const FISCAL_COMPRA: Pick<FacturaCompra, 'tipoOperacion' | 'irpf' | 'claveRetencion' | 'fechaRecepcion' | 'bienInversion' | 'vidaUtil' | 'ivaDeducible' | 'enlace'> = {
  tipoOperacion: 'interior', irpf: 0, claveRetencion: 'ninguna', fechaRecepcion: '', bienInversion: false, vidaUtil: 4, ivaDeducible: true, enlace: '',
}

/** Tipo de documento fiscal que corresponde al país. */
export function tipoIdPorDefecto(codigoPais: string): TipoIdFiscal {
  if (esEspana(codigoPais)) return 'nif'
  return esUE(codigoPais) ? 'nifiva' : 'docoficial'
}

/** Tipo de operación que propone el CRM para una venta a esta cuenta. */
export function operacionVentaPorDefecto(c: Cuenta | null | undefined): TipoOperacionVenta {
  if (!c) return 'interior'
  if (c.regimenIva === 'exento') return 'exenta'
  const pais = c.codigoPais || 'ES'
  if (esEspana(pais)) return 'interior'
  if (esUE(pais)) return c.particular ? 'ue-particular' : 'ue-empresa'
  return 'fuera-ue'
}

/** Tipo de operación que propone el CRM para una compra a esta cuenta. */
export function operacionCompraPorDefecto(c: Cuenta | null | undefined): TipoOperacionCompra {
  if (!c) return 'interior'
  if (c.regimenIva === 'exento') return 'exenta'
  const pais = c.codigoPais || 'ES'
  if (esEspana(pais)) return 'interior'
  return esUE(pais) ? 'ue' : 'fuera-ue'
}

/** Régimen de IVA coherente con el país, para las cuentas que lo tenían en «general» por defecto. */
export function regimenPorPais(codigoPais: string): Cuenta['regimenIva'] {
  if (esEspana(codigoPais)) return 'general'
  return esUE(codigoPais) ? 'intracomunitario' : 'extracomunitario'
}
