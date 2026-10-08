import { describe, expect, it } from 'vitest'
import type { ConfigVerifactu, RegistroFacturacion } from '../types'
import { verifactuInicial } from '../types'
import { compra, crmCon, cuenta, gasto, gestionCon, gestoriaCon, linea, perfilCon, presentacion, venta } from './datosPrueba'
import { revisar } from './revision'

const cuentas = [
  cuenta({ id: 'malNif', nombre: 'Cliente Mal NIF SL', cif: 'B12345678' }),
  cuenta({ id: 'fr', nombre: 'Client Paris SAS', cif: 'FR12345678901', codigoPais: 'FR', tipoIdFiscal: 'nifiva', viesValido: null }),
  cuenta({ id: 'es', nombre: 'Cliente Bueno SL', cif: 'B12345674' }),
  cuenta({ id: 'prof', nombre: 'Ana Profesional', cif: '12345678Z' }),
  cuenta({ id: 'prov', nombre: 'Proveedor SL', cif: 'B87654323' }),
]

const config: ConfigVerifactu = { ...verifactuInicial(), id: 'vf', creadoEl: '2026-06-01T00:00:00Z', altaEl: '2026-08-01' }
const registro = (facturaId: string, estado: RegistroFacturacion['estado']): RegistroFacturacion => ({
  id: `r-${facturaId}`, creadoEl: '2026-08-20T10:00:00Z', tipo: 'alta', facturaId, nifEmisor: '', serieNumero: '', fechaExpedicion: '', tipoFactura: 'F1',
  cuotaTotal: 0, importeTotal: 0, huella: '', huellaAnterior: '', fechaHoraGeneracion: '', xml: '', estado, entorno: 'preparacion', codigoError: '4102',
  descripcionError: 'NIF no identificado', csv: '', envioId: null, orden: 1,
})

const crm = crmCon({
  cuentas,
  facturasVenta: [
    // antes del alta en Verifactu: no se le pide registro
    venta({ id: 'v1', no: 'FV-26001', cuentaId: 'malNif', fecha: '2026-07-10', registradaEl: '2026-07-10T09:00:00Z', lineas: [linea(100)] }),
    // salto: falta FV-26002
    venta({ id: 'v3', no: 'FV-26003', cuentaId: 'es', fecha: '2026-08-10', registradaEl: '2026-08-10T09:00:00Z', lineas: [linea(100)] }),
    // cliente de la UE con operación interior
    venta({ id: 'v4', no: 'FV-26004', cuentaId: 'fr', fecha: '2026-08-12', registradaEl: '2026-08-12T09:00:00Z', lineas: [linea(100)] }),
    // empresa de la UE sin VIES comprobado; registro rechazado
    venta({ id: 'v5', no: 'FV-26005', cuentaId: 'fr', fecha: '2026-08-20', registradaEl: '2026-08-20T09:00:00Z', lineas: [linea(100)], tipoOperacion: 'ue-empresa' }),
    // rectificativa sin factura rectificada, en su propia serie (sin salto)
    venta({ id: 'r1', no: 'FR-26001', cuentaId: 'es', fecha: '2026-09-01', registradaEl: '2026-09-01T09:00:00Z', lineas: [linea(-50)], tipoFactura: 'R4' }),
    // borrador sin número
    venta({ id: 'vb', no: '', cuentaId: 'es', fecha: '2026-09-15', estado: 'borrador', lineas: [linea(100)] }),
  ],
  facturasCompra: [
    compra({ id: 'c1', no: 'FC-26001', noProveedor: '2026/7', cuentaId: 'prof', fecha: '2026-07-15', lineas: [linea(1000)], irpf: 15, claveRetencion: 'ninguna' }),
    compra({ id: 'c2', no: 'FC-26002', noProveedor: 'A-1', cuentaId: 'prov', fecha: '2026-07-20', lineas: [linea(200)], enlace: '' }),
    compra({ id: 'c3', no: 'FC-26003', noProveedor: 'a 1', cuentaId: 'prov', fecha: '2026-07-21', lineas: [linea(200)] }),
    compra({ id: 'cp', no: 'FC-26004', cuentaId: 'prov', fecha: '2026-09-25', lineas: [linea(80)], estado: 'pendiente' }),
  ],
})

const gestion = gestionCon([
  gasto({ id: 'g1', no: 'G-26001', concepto: 'Comida', fecha: '2026-08-03', deducible: true, facturaCompleta: false, foto: '', tieneFoto: false, enlace: '' }),
])

const gestoria = gestoriaCon({
  perfil: [perfilCon({ nif: '' })],
  verifactu: [config],
  registros: [registro('v5', 'rechazado'), registro('r1', 'correcto')],
  presentaciones: [presentacion({ modelo: '303', periodo: '2026-3T', presentadaEl: '2026-10-10T12:00:00Z', incluidos: ['v1', 'v3', 'v4', 'v5', 'r1', 'c1', 'c2', 'c3', 'g1'] })],
})

describe('revisión del 3T 2026', () => {
  const lista = revisar({ crm, gestion, gestoria, desde: '2026-07-01', hasta: '2026-09-30' })
  const tipos = new Set(lista.map(i => i.tipo))
  const de = (tipo: string) => lista.filter(i => i.tipo === tipo)

  it('detecta los tipos de incidencia esperados', () => {
    for (const t of [
      'perfil-sin-nif', 'nif-invalido', 'operacion-incoherente', 'vies', 'retencion-sin-clave', 'sin-justificante', 'compra-duplicada',
      'salto-numeracion', 'ticket-deducible', 'compra-pendiente', 'venta-borrador', 'rectificativa-sin-original', 'verifactu-sin-registro', 'verifactu-rechazado',
    ]) expect(tipos, t).toContain(t)
  })

  it('señala el NIF inválido y la operación incoherente en su registro', () => {
    expect(de('nif-invalido')).toMatchObject([{ gravedad: 'error', col: 'cuentas', registroId: 'malNif' }])
    expect(de('operacion-incoherente').map(i => i.registroId)).toEqual(['v4'])
    expect(de('vies')[0]).toMatchObject({ gravedad: 'aviso', registroId: 'fr' })
  })

  it('numera por serie y solo con las registradas: falta FV-26002, la serie FR- no tiene saltos', () => {
    const saltos = de('salto-numeracion')
    expect(saltos).toHaveLength(1)
    expect(saltos[0].texto).toContain('FV-26002')
  })

  it('Verifactu: solo las facturas registradas desde el alta', () => {
    expect(de('verifactu-sin-registro').map(i => i.registroId).sort()).toEqual(['v3', 'v4'])
    expect(de('verifactu-rechazado').map(i => i.registroId)).toEqual(['v5'])
  })

  it('duplicado por proveedor y número de factura', () => {
    expect(de('compra-duplicada')).toMatchObject([{ gravedad: 'error', registroId: 'c3' }])
  })

  it('avisa de cambios después de presentar el 303', () => {
    const cambiada = crmCon({ ...crm, facturasVenta: crm.facturasVenta.map(f => (f.id === 'v3' ? { ...f, actualizadoEl: '2026-10-12T08:00:00Z' } : f)) })
    const otra = revisar({ crm: cambiada, gestion, gestoria, desde: '2026-07-01', hasta: '2026-09-30' })
    expect(otra.filter(i => i.tipo === 'complementaria').map(i => i.registroId)).toEqual(['v3'])
    expect(lista.some(i => i.tipo === 'complementaria')).toBe(false)
  })

  it('pone los errores primero', () => {
    const g = lista.map(i => i.gravedad)
    expect(g.indexOf('aviso')).toBeGreaterThan(g.lastIndexOf('error'))
  })
})
