/**
 * Modelo de dominio del CRM: cuentas, contactos, clientes potenciales,
 * oportunidades, documentos de venta y compra, productos, actividades y notas.
 *
 * Las fechas «de día» viajan como YYYY-MM-DD y los instantes como ISO, igual
 * que en el resto de la app. Los propietarios son ids de `Miembro`.
 */

export type TipoCuenta = 'cliente' | 'proveedor' | 'ambos'
export type EstadoActivo = 'activo' | 'inactivo'
export type OrigenPotencial = 'web' | 'referido' | 'linkedin' | 'evento' | 'llamada' | 'partner'
export type Puntuacion = 'caliente' | 'templado' | 'frio'
export type EstadoPotencial = 'abierto' | 'calificado' | 'descalificado'
/** Fases del proceso de venta (flujo de proceso de negocio). */
export type Fase = 'calificar' | 'desarrollar' | 'proponer' | 'cerrar'
export type EstadoOportunidad = 'abierta' | 'ganada' | 'perdida'
export type EstadoOferta = 'borrador' | 'enviada' | 'aceptada' | 'rechazada' | 'expirada' | 'convertida'
export type EstadoPedidoVenta = 'abierto' | 'liberado' | 'enviado' | 'facturado' | 'cancelado'
export type EstadoPedidoCompra = 'abierto' | 'liberado' | 'recibido' | 'facturado' | 'cancelado'
export type EstadoFacturaVenta = 'borrador' | 'registrada' | 'pagada' | 'anulada'
export type EstadoFacturaCompra = 'pendiente' | 'registrada' | 'pagada' | 'anulada'
/** Estado que se muestra: una factura registrada y pasada de fecha aparece como vencida. */
export type EstadoFacturaVisible = EstadoFacturaVenta | EstadoFacturaCompra | 'vencida'
export type TipoActividad = 'tarea' | 'llamada' | 'correo' | 'cita'
export type EstadoActividad = 'abierta' | 'completada' | 'cancelada'
export type PrioridadCrm = 'baja' | 'normal' | 'alta'
export type CondicionPago = 'contado' | '15' | '30' | '60'
export type MetodoPago = 'transferencia' | 'domiciliacion' | 'tarjeta'
export type TipoProducto = 'servicio' | 'licencia' | 'producto'
export type Unidad = 'hora' | 'dia' | 'mes' | 'ud' | 'proyecto'

/** Lo que comparten todos los registros. */
export interface RegistroBase {
  id: string
  /** Número de serie (C1001, OF-26001…). Lo asigna el CRM al crear. */
  no?: string
  creadoEl: string
  actualizadoEl?: string | null
}

export interface Cuenta extends RegistroBase {
  no: string
  nombre: string
  tipo: TipoCuenta
  estado: EstadoActivo
  cif: string
  sector: string
  direccion: string
  cp: string
  ciudad: string
  provincia: string
  pais: string
  web: string
  telefono: string
  email: string
  empleados: string
  propietarioId: string | null
  condicionesPago: CondicionPago
  metodoPago: MetodoPago
  iva: number
  iban: string
  notas: string
}

export interface Contacto extends RegistroBase {
  no: string
  nombre: string
  apellidos: string
  cuentaId: string | null
  cargo: string
  email: string
  telefono: string
  movil: string
  ciudad: string
  linkedin: string
  propietarioId: string | null
  estado: EstadoActivo
  notas: string
}

export interface Potencial extends RegistroBase {
  no: string
  tema: string
  nombre: string
  apellidos: string
  empresa: string
  cargo: string
  email: string
  telefono: string
  ciudad: string
  sector: string
  origen: OrigenPotencial
  puntuacion: Puntuacion
  estado: EstadoPotencial
  fase: Fase
  importeEst: number
  propietarioId: string | null
  descripcion: string
  calificadoEl: string | null
  descalificadoEl: string | null
  motivo: string
  /** Lo que se creó al calificarlo. */
  cuentaId: string | null
  contactoId: string | null
  oportunidadId: string | null
}

export interface Oportunidad extends RegistroBase {
  no: string
  titulo: string
  cuentaId: string | null
  contactoId: string | null
  importe: number
  fase: Fase
  estado: EstadoOportunidad
  probabilidad: number
  cierrePrevisto: string
  propietarioId: string | null
  notas: string
  cerradaEl: string | null
  motivoPerdida: string
  potencialId: string | null
}

export interface LineaDocumento {
  productoId: string
  descripcion: string
  cantidad: number
  unidad: Unidad | ''
  /** En venta es el precio; en compra, el coste. */
  precio: number
  /** Descuento en %. */
  dto: number
  /** IVA en %. */
  iva: number
}

export interface DocumentoBase extends RegistroBase {
  no: string
  cuentaId: string | null
  contactoId: string | null
  fecha: string
  propietarioId: string | null
  lineas: LineaDocumento[]
  condicionesPago: CondicionPago
  metodoPago: MetodoPago
  referencia: string
  notas: string
}

export interface Oferta extends DocumentoBase {
  estado: EstadoOferta
  oportunidadId: string | null
  validaHasta: string
  pedidoId: string | null
}

export interface PedidoVenta extends DocumentoBase {
  estado: EstadoPedidoVenta
  ofertaId: string | null
  oportunidadId: string | null
  fechaEntrega: string
  /** Nº de pedido del cliente. */
  refCliente: string
  facturaId: string | null
}

export interface FacturaVenta extends DocumentoBase {
  estado: EstadoFacturaVenta
  pedidoId: string | null
  vencimiento: string
  registradaEl: string | null
  pagadaEl: string | null
}

export interface PedidoCompra extends DocumentoBase {
  estado: EstadoPedidoCompra
  recepcionPrevista: string
  /** Nº de pedido del proveedor. */
  refProveedor: string
  facturaId: string | null
}

export interface FacturaCompra extends DocumentoBase {
  estado: EstadoFacturaCompra
  pedidoId: string | null
  /** Nº de factura del proveedor. */
  noProveedor: string
  vencimiento: string
  registradaEl: string | null
  pagadaEl: string | null
}

export type Documento = Oferta | PedidoVenta | FacturaVenta | PedidoCompra | FacturaCompra

export interface Producto extends RegistroBase {
  no: string
  nombre: string
  tipo: TipoProducto
  categoria: string
  unidad: Unidad
  precio: number
  coste: number
  iva: number
  activo: boolean
  descripcion: string
}

/**
 * Actividad del CRM (tarea, llamada, correo o cita) «referente a» otro
 * registro. Es distinta de las tareas del módulo de Proyectos y Tareas.
 */
export interface ActividadCrm extends RegistroBase {
  asunto: string
  tipo: TipoActividad
  /** Fecha de vencimiento YYYY-MM-DD. */
  fecha: string | null
  /** HH:mm */
  hora: string
  referenteTipo: ColReferente | null
  referenteId: string | null
  /** Cuenta del registro referente: permite ver la actividad en la escala de tiempo de la cuenta. */
  cuentaId: string | null
  propietarioId: string | null
  prioridad: PrioridadCrm
  estado: EstadoActividad
  completadaEl: string | null
  descripcion: string
}

export interface Nota extends RegistroBase {
  texto: string
  referenteTipo: ColReferente
  referenteId: string
  cuentaId: string | null
  autorId: string | null
  /** Instante de la nota (ISO). */
  fecha: string
}

/** Todo el CRM cargado de una vez. */
export interface CrmInstantanea {
  cuentas: Cuenta[]
  contactos: Contacto[]
  potenciales: Potencial[]
  oportunidades: Oportunidad[]
  ofertas: Oferta[]
  pedidosVenta: PedidoVenta[]
  facturasVenta: FacturaVenta[]
  pedidosCompra: PedidoCompra[]
  facturasCompra: FacturaCompra[]
  productos: Producto[]
  actividades: ActividadCrm[]
  notas: Nota[]
}

export type Coleccion = keyof CrmInstantanea
export type RegistroDe<K extends Coleccion> = CrmInstantanea[K][number]
/** Colecciones con lista y ficha propias (las notas solo viven en la escala de tiempo). */
export type ColEntidad = Exclude<Coleccion, 'notas'>
/** A qué puede referirse una actividad o una nota. */
export type ColReferente = Exclude<Coleccion, 'notas' | 'actividades'>
export type ColDocumento = 'ofertas' | 'pedidosVenta' | 'facturasVenta' | 'pedidosCompra' | 'facturasCompra'

export const COLECCIONES: Coleccion[] = [
  'cuentas', 'contactos', 'potenciales', 'oportunidades', 'ofertas', 'pedidosVenta', 'facturasVenta',
  'pedidosCompra', 'facturasCompra', 'productos', 'actividades', 'notas',
]

export const CRM_VACIO: CrmInstantanea = {
  cuentas: [], contactos: [], potenciales: [], oportunidades: [], ofertas: [], pedidosVenta: [], facturasVenta: [],
  pedidosCompra: [], facturasCompra: [], productos: [], actividades: [], notas: [],
}
