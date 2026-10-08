/**
 * Escenario de prueba del 3T 2026 de Locodea: ventas interiores al 21 % y al
 * 10 %, un servicio a una empresa francesa, otro a un cliente de EE. UU., una
 * licencia de un proveedor irlandés, una compra deducible, otra no deducible y
 * un profesional con retención del 15 %.
 */
import { compra, crmCon, cuenta, gasto, gestionCon, linea, venta } from './datosPrueba'

export const cuentas = {
  cliES: cuenta({ id: 'cliES', nombre: 'Cliente Madrid SL', cif: 'B12345674' }),
  cliFR: cuenta({ id: 'cliFR', nombre: 'Client Paris SAS', cif: 'FR12345678901', codigoPais: 'FR', tipoIdFiscal: 'nifiva', regimenIva: 'intracomunitario', viesValido: true }),
  cliUS: cuenta({ id: 'cliUS', nombre: 'Client Boston Inc', cif: '12-3456789', codigoPais: 'US', tipoIdFiscal: 'docoficial', regimenIva: 'extracomunitario' }),
  provIE: cuenta({ id: 'provIE', nombre: 'Software Dublin Ltd', cif: 'IE6388047V', codigoPais: 'IE', tipoIdFiscal: 'nifiva', regimenIva: 'intracomunitario', viesValido: true }),
  provES: cuenta({ id: 'provES', nombre: 'Material Oficina SL', cif: 'B87654323' }),
  provNoDed: cuenta({ id: 'provNoDed', nombre: 'Restaurante SL', cif: 'B11111119' }),
  prof: cuenta({ id: 'prof', nombre: 'Ana Profesional', cif: '12345678Z' }),
}

export const ventas = [
  venta({ id: 'v1', no: 'FV-26001', cuentaId: 'cliES', fecha: '2026-07-10', lineas: [linea(1000, 21)] }),
  venta({ id: 'v2', no: 'FV-26002', cuentaId: 'cliES', fecha: '2026-07-20', lineas: [linea(500, 10)] }),
  venta({ id: 'v3', no: 'FV-26003', cuentaId: 'cliFR', fecha: '2026-08-05', lineas: [linea(2000, 21)], tipoOperacion: 'ue-empresa' }),
  venta({ id: 'v4', no: 'FV-26004', cuentaId: 'cliUS', fecha: '2026-09-01', lineas: [linea(3000, 0)], tipoOperacion: 'fuera-ue' }),
  venta({ id: 'vb', no: '', cuentaId: 'cliES', fecha: '2026-09-15', lineas: [linea(9999, 21)], estado: 'borrador' }),
]

export const compras = [
  compra({ id: 'c1', no: 'FC-26001', noProveedor: 'IE-881', cuentaId: 'provIE', fecha: '2026-07-01', fechaRecepcion: '2026-07-02', lineas: [linea(1000, 0)], tipoOperacion: 'ue' }),
  compra({ id: 'c2', no: 'FC-26002', noProveedor: 'A-12', cuentaId: 'provES', fecha: '2026-08-10', lineas: [linea(200, 21)] }),
  compra({ id: 'c3', no: 'FC-26003', noProveedor: 'R-77', cuentaId: 'provNoDed', fecha: '2026-08-11', lineas: [linea(500, 21)], ivaDeducible: false }),
  compra({ id: 'c4', no: 'FC-26004', noProveedor: '2026/15', cuentaId: 'prof', fecha: '2026-09-05', lineas: [linea(1000, 21)], irpf: 15, claveRetencion: 'profesional', estado: 'pagada' }),
  // pendiente de registrar: no entra en los modelos
  compra({ id: 'cp', no: 'FC-26005', cuentaId: 'provES', fecha: '2026-09-20', lineas: [linea(300, 21)], estado: 'pendiente' }),
  // recibida en octubre: se deduce en el 4T
  compra({ id: 'c5', no: 'FC-26006', noProveedor: 'A-13', cuentaId: 'provES', fecha: '2026-09-29', fechaRecepcion: '2026-10-02', lineas: [linea(100, 21)] }),
]

export const crm = crmCon({ cuentas: Object.values(cuentas), facturasVenta: ventas, facturasCompra: compras })

export const gastos = [
  // ticket sin factura completa: el IVA no se deduce
  gasto({ id: 'g1', no: 'G-26001', fecha: '2026-08-20', base: 50, iva: 21, total: 60.5, deducible: true, facturaCompleta: false }),
  // ya es la factura c2: no cuenta dos veces
  gasto({ id: 'g2', no: 'G-26002', fecha: '2026-08-10', base: 200, iva: 21, total: 242, facturaCompraId: 'c2' }),
]

export const gestion = gestionCon(gastos)
