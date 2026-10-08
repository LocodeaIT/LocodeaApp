/**
 * Datos de ejemplo para las pruebas del motor de Verifactu. Usa el NIF de
 * pruebas de la AEAT (89890001K), que aparece en sus documentos técnicos.
 */
import type { Cuenta, FacturaVenta, LineaDocumento } from '../../crm/types'
import type { ConfigVerifactu } from '../types'

export const NIF_PRUEBAS = '89890001K'

export function configDePrueba(parcial: Partial<ConfigVerifactu> = {}): ConfigVerifactu {
  return {
    id: 'cfg', creadoEl: '2026-10-01T00:00:00Z', entorno: 'pruebas', nifEmisor: NIF_PRUEBAS, razonSocial: 'Locodea SL',
    certificadoRef: 'certificado-locodea-sl', certificadoCaduca: null, servicioUrl: 'https://verifactu.ejemplo/api/registrar',
    sistemaNombre: 'Locodea App', sistemaId: 'LA', sistemaVersion: '1.0', numeroInstalacion: '1',
    altaEl: null, declaracionFirmadaEl: '2026-10-07', declaracionFirmante: 'Marco', ...parcial,
  }
}

export function cuentaDePrueba(parcial: Partial<Cuenta> = {}): Cuenta {
  return {
    id: 'c1', no: 'C1001', creadoEl: '2026-01-01T00:00:00Z', nombre: 'Cliente Ejemplo SL', tipo: 'cliente', estado: 'activo',
    cif: 'B12345674', sector: '', direccion: '', cp: '', ciudad: 'Madrid', provincia: 'Madrid', pais: 'España', web: '', telefono: '',
    email: '', empleados: '', propietarioId: null, condicionesPago: '30', metodoPago: 'transferencia', iva: 21, iban: '',
    regimenIva: 'general', codigoPais: 'ES', tipoIdFiscal: 'nif', particular: false, viesValido: null, viesComprobadoEl: null, notas: '',
    ...parcial,
  }
}

export const linea = (precio: number, iva = 21, cantidad = 1, dto = 0, descripcion = 'Consultoría'): LineaDocumento =>
  ({ productoId: '', descripcion, cantidad, unidad: 'ud', precio, dto, iva })

export function facturaDePrueba(parcial: Partial<FacturaVenta> = {}): FacturaVenta {
  return {
    id: 'f1', no: 'F-26001', creadoEl: '2026-10-05T09:00:00Z', cuentaId: 'c1', contactoId: null, fecha: '2026-10-05',
    propietarioId: null, lineas: [linea(1000, 21, 1, 0, 'Desarrollo de la app'), linea(100, 10, 2, 10, 'Formación')],
    condicionesPago: '30', metodoPago: 'transferencia', referencia: '', notas: '', estado: 'registrada', pedidoId: null,
    vencimiento: '2026-11-04', registradaEl: '2026-10-05T09:00:00Z', pagadaEl: null, importeCobrado: 0,
    tipoOperacion: 'interior', tipoFactura: 'F1', rectificadaId: null, motivoRectificacion: '', estadoVerifactu: 'sin-registro', huella: '',
    ...parcial,
  }
}
