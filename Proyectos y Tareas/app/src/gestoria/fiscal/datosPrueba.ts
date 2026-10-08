/**
 * Constructores de registros para las pruebas del motor fiscal: valores por
 * defecto razonables y solo lo que cada prueba necesita cambiar.
 */
import type { CrmInstantanea, Cuenta, FacturaCompra, FacturaVenta, LineaDocumento } from '../../crm/types'
import { CRM_VACIO } from '../../crm/types'
import type { Gasto, GestionInstantanea } from '../../gestion/types'
import type { GestoriaInstantanea, PerfilFiscal, Presentacion } from '../types'
import { GESTORIA_VACIA, perfilInicial } from '../types'

export const linea = (precio: number, iva = 21, productoId = ''): LineaDocumento => ({ productoId, descripcion: '', cantidad: 1, unidad: 'ud', precio, dto: 0, iva })

export function cuenta(p: Partial<Cuenta> & { id: string }): Cuenta {
  return {
    no: p.id, nombre: p.id, tipo: 'ambos', estado: 'activo', cif: 'B12345674', sector: '', direccion: '', cp: '28001', ciudad: '', provincia: '',
    pais: '', web: '', telefono: '', email: '', empleados: '', propietarioId: null, condicionesPago: '30', metodoPago: 'transferencia', iva: 21,
    iban: '', regimenIva: 'general', codigoPais: 'ES', tipoIdFiscal: 'nif', particular: false, viesValido: null, viesComprobadoEl: null,
    notas: '', creadoEl: '2026-01-01T00:00:00Z', ...p,
  }
}

const doc = { contactoId: null, propietarioId: null, condicionesPago: '30' as const, metodoPago: 'transferencia' as const, referencia: '', notas: '', creadoEl: '2026-01-01T00:00:00Z' }

export function venta(p: Partial<FacturaVenta> & { id: string }): FacturaVenta {
  return {
    ...doc, no: p.id, cuentaId: null, fecha: '2026-08-01', lineas: [], estado: 'registrada', pedidoId: null, vencimiento: '', registradaEl: null,
    pagadaEl: null, importeCobrado: 0, tipoOperacion: 'interior', tipoFactura: 'F1', rectificadaId: null, motivoRectificacion: '',
    estadoVerifactu: 'sin-registro', huella: '', ...p,
  }
}

export function compra(p: Partial<FacturaCompra> & { id: string }): FacturaCompra {
  return {
    ...doc, no: p.id, cuentaId: null, fecha: '2026-08-01', lineas: [], estado: 'registrada', pedidoId: null, noProveedor: '', vencimiento: '',
    registradaEl: null, pagadaEl: null, importePagado: 0, tipoOperacion: 'interior', irpf: 0, claveRetencion: 'ninguna', fechaRecepcion: '',
    bienInversion: false, vidaUtil: 4, ivaDeducible: true, enlace: 'https://ejemplo/factura.pdf', ...p,
  }
}

export function gasto(p: Partial<Gasto> & { id: string }): Gasto {
  return {
    no: p.id, concepto: 'Gasto', fecha: '2026-08-01', base: 100, iva: 21, irpf: 0, total: 121, categoria: 'otros', estado: 'pagado',
    metodoPago: 'tarjeta', recurrente: false, diaCargo: 1, deducible: true, facturaCompleta: true, deducibleIs: true, noFactura: '', enlace: '',
    foto: '', tieneFoto: true, notas: '', proveedorId: null, proyectoId: null, pagadorId: null, facturaCompraId: null,
    creadoEl: '2026-01-01T00:00:00Z', ...p,
  }
}

export const crmCon = (p: Partial<CrmInstantanea>): CrmInstantanea => ({ ...CRM_VACIO, ...p })
export const gestionCon = (gastos: Gasto[] = []): GestionInstantanea => ({ gastos, documentos: [] })
export const gestoriaCon = (p: Partial<GestoriaInstantanea>): GestoriaInstantanea => ({ ...GESTORIA_VACIA, ...p })
export const perfilCon = (p: Partial<PerfilFiscal>): PerfilFiscal => ({ ...perfilInicial(), id: 'perfil', nif: 'B12345674', ...p })

export function presentacion(p: Partial<Presentacion> & { modelo: Presentacion['modelo']; periodo: string }): Presentacion {
  return {
    id: `${p.modelo}-${p.periodo}`, creadoEl: '2026-01-01T00:00:00Z', estado: 'presentada', importe: 0, presentadaEl: null, csv: '', nrc: '',
    justificante: '', casillas: {}, incluidos: [], complementariaDe: null, notas: '', ...p,
  }
}
