/**
 * Modelo de Gestoría: la parte de la app que actúa como gestoría fiscal y
 * mercantil de Locodea SL. No da de alta facturas ni gastos (eso es del CRM):
 * guarda solo lo propio de la gestoría.
 *
 *  - Perfil fiscal de la sociedad (una fila): decide qué modelos aplican.
 *  - Presentaciones: el estado de cada modelo y periodo, con la foto de las
 *    casillas y el justificante una vez presentado.
 *  - Asientos manuales: capital, ajustes de cierre, impuesto… (los demás
 *    asientos salen solos del CRM).
 *  - Verifactu: configuración (una fila), registros de facturación
 *    encadenados y envíos a la AEAT.
 *
 * Las fechas «de día» viajan como YYYY-MM-DD y los instantes como ISO, igual
 * que en el resto de la app.
 */
import type { TipoFactura } from '../crm/types'

export interface RegistroGestoria {
  id: string
  creadoEl: string
  actualizadoEl?: string | null
}

// ─────────────────────────────────────────────── perfil fiscal

export type PeriodicidadIva = 'trimestral' | 'mensual'

export interface PerfilFiscal extends RegistroGestoria {
  razonSocial: string
  nif: string
  domicilio: string
  /** Fecha de la escritura de constitución. Vacía mientras la SL está en constitución. */
  fechaConstitucion: string
  /** Mes de cierre del ejercicio (12 = 31 de diciembre). */
  mesCierre: number
  periodicidadIva: PeriodicidadIva
  /** Régimen especial del criterio de caja. Locodea: no (devengo). */
  criterioCaja: boolean
  /** Alta en el registro de operadores intracomunitarios (se pide en el 036 de alta). */
  roi: boolean
  /** Acogida a la ventanilla única (OSS, modelo 369). */
  oss: boolean
  /** Entidad de nueva creación: 15 % el primer ejercicio con base imponible positiva y el siguiente. */
  nuevaCreacion: boolean
  /** Primer ejercicio con base imponible positiva (para el 15 %); 0 mientras no lo haya. */
  primerEjercicioPositivo: number
  /** Importe neto de la cifra de negocios del último ejercicio cerrado. */
  cifraNegocios: number
  administradoresRetribuidos: boolean
  /** Retención de los administradores en %: 35, o 19 si la cifra de negocios es menor de 100.000 €. */
  retencionAdministradores: number
  empleados: boolean
  alquilerLocal: boolean
  /** Reparto de dividendos o préstamos de socios con intereses (modelos 123 y 193). */
  dividendosOPrestamosSocios: boolean
  /** Operaciones vinculadas por encima de los umbrales del 232. */
  operacionesVinculadas: boolean
  ibanDomiciliacion: string
  /** Saldo del banco para la Caja del CRM (antes vivía solo en el navegador). */
  saldoBanco: number
  saldoBancoFecha: string
  /** Bases imponibles negativas pendientes de compensar, por ejercicio de origen: { "2026": 1200 }. */
  basesNegativas: Record<string, number>
  notas: string
}

// ─────────────────────────────────────────────── presentaciones

/** Modelos de la AEAT y obligaciones del Registro Mercantil que lleva Gestoría. */
export type ModeloFiscal =
  | '303' | '390' | '349' | '111' | '190' | '115' | '180' | '123' | '193' | '347' | '369' | '202' | '200' | '232' | '036'
  | 'formulacion' | 'legalizacion' | 'junta' | 'deposito'

export type EstadoPresentacion = 'pendiente' | 'preparada' | 'presentada' | 'pagada' | 'domiciliada' | 'no-procede'

export interface Presentacion extends RegistroGestoria {
  modelo: ModeloFiscal
  /** '2026-3T' (trimestre), '2026-09' (mes), '2026' (año), '2026-2P' (pago fraccionado del 202). */
  periodo: string
  estado: EstadoPresentacion
  /** Resultado: positivo a ingresar, negativo a compensar o a devolver. */
  importe: number
  presentadaEl: string | null
  /** Código seguro de verificación del justificante de la AEAT. */
  csv: string
  /** Número de referencia completo del pago, si se pagó sin domiciliar. */
  nrc: string
  /** Enlace al justificante en PDF (SharePoint u OneDrive). */
  justificante: string
  /** Foto de las casillas al presentar: { "27": 2100, "45": 340, … }. No se recalcula después. */
  casillas: Record<string, number>
  /** Ids de las facturas y gastos incluidos al presentar. */
  incluidos: string[]
  /** Complementaria o sustitutiva de otra presentación (su id). */
  complementariaDe: string | null
  notas: string
}

// ─────────────────────────────────────────────── contabilidad

export type TipoAsiento = 'apertura' | 'capital' | 'ajuste' | 'amortizacion' | 'periodificacion' | 'impuesto' | 'regularizacion' | 'cierre' | 'otro'

export interface LineaAsiento {
  /** Cuenta del PGC de pymes (3 a 4 dígitos: 572, 4751…). */
  cuenta: string
  debe: number
  haber: number
  concepto?: string
}

/** Asiento escrito a mano. Los de ventas, compras, cobros, pagos y amortizaciones salen solos del CRM. */
export interface AsientoManual extends RegistroGestoria {
  fecha: string
  ejercicio: number
  tipo: TipoAsiento
  concepto: string
  lineas: LineaAsiento[]
}

// ─────────────────────────────────────────────── Verifactu

/** preparacion: genera registros, huellas y QR sin enviar nada. pruebas/produccion: envía por el servicio de Azure. */
export type EntornoVerifactu = 'preparacion' | 'pruebas' | 'produccion'

export interface ConfigVerifactu extends RegistroGestoria {
  entorno: EntornoVerifactu
  nifEmisor: string
  razonSocial: string
  /** Nombre del secreto del certificado en Azure Key Vault. El certificado nunca pasa por la app. */
  certificadoRef: string
  certificadoCaduca: string | null
  /** URL de la función de Azure que envía a la AEAT. */
  servicioUrl: string
  /** Datos del sistema informático de facturación (los pide el registro y la declaración responsable). */
  sistemaNombre: string
  /** Identificador de dos caracteres del sistema. */
  sistemaId: string
  sistemaVersion: string
  numeroInstalacion: string
  /** Fecha desde la que las facturas pasan por Verifactu en producción. */
  altaEl: string | null
  declaracionFirmadaEl: string | null
  declaracionFirmante: string
}

export type TipoRegistro = 'alta' | 'anulacion'
/** simulado: generado en modo preparación, no se ha enviado ni se enviará. */
export type EstadoRegistro = 'simulado' | 'pendiente' | 'correcto' | 'aceptado-errores' | 'rechazado'

export interface RegistroFacturacion extends RegistroGestoria {
  tipo: TipoRegistro
  /** Factura de venta del CRM. */
  facturaId: string
  nifEmisor: string
  serieNumero: string
  fechaExpedicion: string
  tipoFactura: TipoFactura
  cuotaTotal: number
  importeTotal: number
  huella: string
  /** Huella del registro anterior de la cadena; vacía en el primero. */
  huellaAnterior: string
  /** Fecha, hora y huso de generación (ISO 8601 con zona, p. ej. 2027-01-04T10:15:00+01:00). */
  fechaHoraGeneracion: string
  xml: string
  estado: EstadoRegistro
  entorno: EntornoVerifactu
  codigoError: string
  descripcionError: string
  csv: string
  envioId: string | null
  /** Posición en la cadena del emisor y entorno: 1, 2, 3… */
  orden: number
}

export type EstadoEnvio = 'correcto' | 'parcial' | 'incorrecto' | 'error'

export interface EnvioVerifactu extends RegistroGestoria {
  fecha: string
  entorno: EntornoVerifactu
  registros: number
  estado: EstadoEnvio
  csv: string
  respuesta: string
  /** Segundos de espera que pide la AEAT antes del siguiente envío. */
  esperaSegundos: number
}

// ─────────────────────────────────────────────── instantánea

export interface GestoriaInstantanea {
  /** Cero o una fila. */
  perfil: PerfilFiscal[]
  presentaciones: Presentacion[]
  asientos: AsientoManual[]
  /** Cero o una fila. */
  verifactu: ConfigVerifactu[]
  registros: RegistroFacturacion[]
  envios: EnvioVerifactu[]
}

export type ColGestoria = keyof GestoriaInstantanea
export type RegistroGestoriaDe<K extends ColGestoria> = GestoriaInstantanea[K][number]

export const COLECCIONES_GESTORIA: ColGestoria[] = ['perfil', 'presentaciones', 'asientos', 'verifactu', 'registros', 'envios']
export const GESTORIA_VACIA: GestoriaInstantanea = { perfil: [], presentaciones: [], asientos: [], verifactu: [], registros: [], envios: [] }

/**
 * Perfil de partida de Locodea, con lo decidido en la propuesta (7 de octubre
 * de 2026): sociedad nueva, IVA trimestral por devengo, sin nóminas, sin
 * alquiler y sin socios que cobren; puede haber clientes en la UE y fuera.
 */
export function perfilInicial(): PerfilFiscal {
  return {
    id: '', creadoEl: '', razonSocial: 'Locodea SL', nif: '', domicilio: '', fechaConstitucion: '', mesCierre: 12,
    periodicidadIva: 'trimestral', criterioCaja: false, roi: true, oss: false, nuevaCreacion: true, primerEjercicioPositivo: 0,
    cifraNegocios: 0, administradoresRetribuidos: false, retencionAdministradores: 19, empleados: false, alquilerLocal: false,
    dividendosOPrestamosSocios: false, operacionesVinculadas: false, ibanDomiciliacion: '', saldoBanco: 0, saldoBancoFecha: '',
    basesNegativas: {}, notas: '',
  }
}

/** Configuración de Verifactu de partida: modo preparación hasta que exista el certificado de la SL. */
export function verifactuInicial(): ConfigVerifactu {
  return {
    id: '', creadoEl: '', entorno: 'preparacion', nifEmisor: '', razonSocial: 'Locodea SL', certificadoRef: 'certificado-locodea-sl',
    certificadoCaduca: null, servicioUrl: '', sistemaNombre: 'Locodea App', sistemaId: 'LA', sistemaVersion: '1.0',
    numeroInstalacion: '1', altaEl: null, declaracionFirmadaEl: null, declaracionFirmante: '',
  }
}
