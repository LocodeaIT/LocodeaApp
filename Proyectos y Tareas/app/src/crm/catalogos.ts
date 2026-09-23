/**
 * Catálogos del CRM: etiquetas de cada valor, probabilidades del proceso de
 * venta, tonos de los estados y series de numeración.
 */
import type {
  ColEntidad, ColReferente, CondicionPago, EstadoActividad, EstadoActivo, EstadoFacturaVisible, EstadoOferta,
  EstadoOportunidad, EstadoPedidoCompra, EstadoPedidoVenta, EstadoPotencial, Fase, MetodoPago, OrigenPotencial,
  PrioridadCrm, Puntuacion, TipoActividad, TipoCuenta, TipoProducto, Unidad,
} from './types'

export const TIPO_CUENTA: Record<TipoCuenta, string> = { cliente: 'Cliente', proveedor: 'Proveedor', ambos: 'Cliente y proveedor' }
export const ESTADO_ACTIVO: Record<EstadoActivo, string> = { activo: 'Activo', inactivo: 'Inactivo' }
export const EMPLEADOS: Record<string, string> = { '': 'Sin indicar', '1–10': '1–10', '11–50': '11–50', '51–200': '51–200', '201–500': '201–500', '500+': 'Más de 500' }
export const ORIGEN: Record<OrigenPotencial, string> = { web: 'Sitio web', referido: 'Referido', linkedin: 'LinkedIn', evento: 'Evento', llamada: 'Llamada en frío', partner: 'Partner' }
export const PUNTUACION: Record<Puntuacion, string> = { caliente: 'Caliente', templado: 'Templado', frio: 'Frío' }
export const ESTADO_POTENCIAL: Record<EstadoPotencial, string> = { abierto: 'Abierto', calificado: 'Calificado', descalificado: 'Descalificado' }

/** Flujo de proceso de negocio de las oportunidades, con su probabilidad por fase. */
export const FASES: Fase[] = ['calificar', 'desarrollar', 'proponer', 'cerrar']
export const FASE: Record<Fase, string> = { calificar: 'Calificar', desarrollar: 'Desarrollar', proponer: 'Proponer', cerrar: 'Cerrar' }
export const PROBABILIDAD_FASE: Record<Fase, number> = { calificar: 10, desarrollar: 35, proponer: 60, cerrar: 85 }

export const ESTADO_OPORTUNIDAD: Record<EstadoOportunidad, string> = { abierta: 'Abierta', ganada: 'Ganada', perdida: 'Perdida' }
export const ESTADO_OFERTA: Record<EstadoOferta, string> = { borrador: 'Borrador', enviada: 'Enviada', aceptada: 'Aceptada', rechazada: 'Rechazada', expirada: 'Expirada', convertida: 'Convertida en pedido' }
export const ESTADO_PEDIDO_VENTA: Record<EstadoPedidoVenta, string> = { abierto: 'Abierto', liberado: 'Liberado', enviado: 'Enviado', facturado: 'Facturado', cancelado: 'Cancelado' }
export const ESTADO_PEDIDO_COMPRA: Record<EstadoPedidoCompra, string> = { abierto: 'Abierto', liberado: 'Liberado', recibido: 'Recibido', facturado: 'Facturado', cancelado: 'Cancelado' }
export const ESTADO_FACTURA_VENTA: Partial<Record<EstadoFacturaVisible, string>> = { borrador: 'Borrador', registrada: 'Registrada', vencida: 'Vencida', pagada: 'Pagada', anulada: 'Anulada' }
export const ESTADO_FACTURA_COMPRA: Partial<Record<EstadoFacturaVisible, string>> = { pendiente: 'Pendiente', registrada: 'Registrada', vencida: 'Vencida', pagada: 'Pagada', anulada: 'Anulada' }
export const TIPO_ACTIVIDAD: Record<TipoActividad, string> = { tarea: 'Tarea', llamada: 'Llamada de teléfono', correo: 'Correo electrónico', cita: 'Cita' }
export const ESTADO_ACTIVIDAD: Record<EstadoActividad, string> = { abierta: 'Abierta', completada: 'Completada', cancelada: 'Cancelada' }
export const PRIORIDAD: Record<PrioridadCrm, string> = { baja: 'Baja', normal: 'Normal', alta: 'Alta' }
export const CONDICIONES_PAGO: Record<CondicionPago, string> = { contado: 'Al contado', '15': '15 días', '30': '30 días', '60': '60 días' }
export const DIAS_PAGO: Record<CondicionPago, number> = { contado: 0, '15': 15, '30': 30, '60': 60 }
export const METODO_PAGO: Record<MetodoPago, string> = { transferencia: 'Transferencia', domiciliacion: 'Domiciliación', tarjeta: 'Tarjeta' }
export const TIPO_PRODUCTO: Record<TipoProducto, string> = { servicio: 'Servicio', licencia: 'Licencia', producto: 'Producto' }
export const UNIDAD: Record<Unidad, string> = { hora: 'Hora', dia: 'Día', mes: 'Mes', ud: 'Unidad', proyecto: 'Proyecto' }
export const SI_NO: Record<'si' | 'no', string> = { si: 'Sí', no: 'No' }

/** Nombre en singular de cada tipo de registro. */
export const NOMBRE_REGISTRO: Record<ColEntidad, string> = {
  cuentas: 'Cuenta', contactos: 'Contacto', potenciales: 'Cliente potencial', oportunidades: 'Oportunidad',
  ofertas: 'Oferta', pedidosVenta: 'Pedido de venta', facturasVenta: 'Factura de venta', pedidosCompra: 'Pedido de compra',
  facturasCompra: 'Factura de compra', productos: 'Producto', actividades: 'Actividad',
}
export const REFERENTES: ColReferente[] = ['cuentas', 'contactos', 'potenciales', 'oportunidades', 'ofertas', 'pedidosVenta', 'facturasVenta', 'pedidosCompra', 'facturasCompra', 'productos']

/** Tono del chip de cada estado (clases `chip` de la app). */
export type Tono = 'ok' | 'acento' | 'error' | 'aviso' | 'apagado' | ''
const TONOS: Record<string, Tono> = {
  activo: 'ok', inactivo: 'apagado', abierto: 'acento', calificado: 'ok', descalificado: 'apagado', abierta: 'acento', ganada: 'ok', perdida: 'error',
  borrador: 'apagado', enviada: 'acento', aceptada: 'ok', rechazada: 'error', expirada: 'aviso', convertida: 'ok', liberado: 'acento', enviado: 'acento',
  facturado: 'ok', cancelado: 'apagado', recibido: 'acento', registrada: 'acento', pagada: 'ok', vencida: 'error', anulada: 'apagado', pendiente: 'aviso',
  completada: 'ok', cancelada: 'apagado', caliente: 'error', templado: 'aviso', frio: 'apagado', alta: 'error', normal: '', baja: 'apagado', si: 'ok', no: 'apagado',
}
export const tonoDe = (estado: string): Tono => TONOS[estado] ?? ''

/** Series de numeración, como en Business Central: prefijo y último número usado por defecto. */
export const SERIES: Partial<Record<ColEntidad, [string, number]>> = {
  cuentas: ['C', 1000], contactos: ['CT', 1000], potenciales: ['CP', 1000], oportunidades: ['OP', 1000], productos: ['P', 1000],
  ofertas: ['OF-', 26000], pedidosVenta: ['PV-', 26000], pedidosCompra: ['PC-', 26000], facturasVenta: ['FV-', 26000], facturasCompra: ['FC-', 26000],
}

/** Convierte un catálogo en opciones para `Select`. */
export function opcionesDe<T extends string>(m: Partial<Record<T, string>>): { valor: T; etiqueta: string }[] {
  return (Object.keys(m) as T[]).map(k => ({ valor: k, etiqueta: m[k] ?? k }))
}
