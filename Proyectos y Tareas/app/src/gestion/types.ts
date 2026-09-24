/**
 * Modelo del módulo Gestión: gastos (con ticket) y documentos (con caducidad).
 * Lo demás del módulo —caja, trimestre, calendario fiscal— se calcula a partir
 * de estos registros y de las facturas del CRM; no se guarda.
 *
 * Las fechas «de día» viajan como YYYY-MM-DD y los instantes como ISO, igual
 * que en el resto de la app.
 */

export type CategoriaGasto = 'viajes' | 'dietas' | 'software' | 'hosting' | 'material' | 'formacion' | 'marketing' | 'asesoria' | 'telefonia' | 'suministros' | 'otros'
export type EstadoGasto = 'pendiente' | 'pagado' | 'reembolsar' | 'reembolsado'
export type MetodoPagoGasto = 'tarjeta' | 'transferencia' | 'domiciliacion' | 'efectivo'
export type TipoDocumento = 'contrato' | 'nda' | 'sepa' | 'certificado' | 'escritura' | 'cif' | 'lopd' | 'poder' | 'otro'

export interface RegistroGestion {
  id: string
  creadoEl: string
  actualizadoEl?: string | null
}

export interface Gasto extends RegistroGestion {
  /** G-26001… lo asigna el módulo al crear. */
  no: string
  concepto: string
  fecha: string
  /** Base imponible. */
  base: number
  /** IVA en %. */
  iva: number
  /** Retención de IRPF en % (facturas de profesionales). */
  irpf: number
  /** Total pagado, tal cual pone el ticket. */
  total: number
  categoria: CategoriaGasto
  estado: EstadoGasto
  metodoPago: MetodoPagoGasto
  /** Gasto fijo que se repite cada mes (licencias, hosting…): entra en la previsión de caja. */
  recurrente: boolean
  /** Día del mes en que se cobra el gasto fijo (1–28). */
  diaCargo: number
  deducible: boolean
  noFactura: string
  /** Enlace al PDF o al ticket en SharePoint / OneDrive. */
  enlace: string
  /** Foto del ticket comprimida, como data URL (jpeg). Vacío si no hay. */
  foto: string
  notas: string
  proveedorId: string | null
  proyectoId: string | null
  /** Quién lo ha pagado (para reembolsos). */
  pagadorId: string | null
  /** Si el gasto es una factura de compra del CRM, se enlaza para no contarlo dos veces. */
  facturaCompraId: string | null
}

export interface DocumentoGestion extends RegistroGestion {
  nombre: string
  tipo: TipoDocumento
  caduca: string | null
  /** Con cuántos días de antelación avisar de la caducidad. */
  avisoDias: number
  enlace: string
  firmado: boolean
  firmadoEl: string | null
  notas: string
  /** Cuenta a la que pertenece; vacío si es de Locodea (escrituras, certificados…). */
  cuentaId: string | null
  responsableId: string | null
}

export interface GestionInstantanea {
  gastos: Gasto[]
  documentos: DocumentoGestion[]
}

export type ColGestion = keyof GestionInstantanea
export type RegistroGestionDe<K extends ColGestion> = GestionInstantanea[K][number]

export const COLECCIONES_GESTION: ColGestion[] = ['gastos', 'documentos']
export const GESTION_VACIA: GestionInstantanea = { gastos: [], documentos: [] }

// ─────────────────────────────────────────────── catálogos

export const CATEGORIA_GASTO: Record<CategoriaGasto, string> = {
  viajes: 'Viajes y transporte', dietas: 'Dietas y comidas', software: 'Software y licencias', hosting: 'Hosting e infraestructura',
  material: 'Material y equipos', formacion: 'Formación', marketing: 'Marketing', asesoria: 'Asesoría y gestoría',
  telefonia: 'Telefonía e internet', suministros: 'Suministros y oficina', otros: 'Otros',
}
export const ESTADO_GASTO: Record<EstadoGasto, string> = { pendiente: 'Pendiente de pago', pagado: 'Pagado', reembolsar: 'Pendiente de reembolso', reembolsado: 'Reembolsado' }
export const METODO_PAGO_GASTO: Record<MetodoPagoGasto, string> = { tarjeta: 'Tarjeta', transferencia: 'Transferencia', domiciliacion: 'Domiciliación', efectivo: 'Efectivo' }
export const TIPO_DOCUMENTO: Record<TipoDocumento, string> = {
  contrato: 'Contrato', nda: 'NDA / confidencialidad', sepa: 'Mandato SEPA', certificado: 'Certificado digital', escritura: 'Escritura',
  cif: 'CIF / NIF', lopd: 'LOPD / RGPD', poder: 'Poder', otro: 'Otro',
}
export const TIPOS_IVA = [21, 10, 4, 0]

/** Tono del chip de cada estado (clases `chip` de la app). */
export const TONO_ESTADO_GASTO: Record<EstadoGasto, string> = { pendiente: 'aviso', pagado: 'ok', reembolsar: 'error', reembolsado: 'ok' }

/** Serie de numeración de los gastos, como las del CRM. */
export const SERIE_GASTO: [string, number] = ['G-', 26000]

export function opcionesDe<T extends string>(m: Record<T, string>): { valor: T; etiqueta: string }[] {
  return (Object.keys(m) as T[]).map(k => ({ valor: k, etiqueta: m[k] }))
}
