/**
 * Ejercicio de ejemplo de Locodea (2026, constituida en octubre): capital de
 * 3.000 €, ventas interiores y a la UE, compras con retención e inversión
 * del sujeto pasivo, un gasto adelantado por un socio, una multa y un
 * ordenador amortizable.
 */
import { describe, expect, it } from 'vitest'
import type { CrmInstantanea, FacturaCompra, FacturaVenta, LineaDocumento } from '../../crm/types'
import { CRM_VACIO } from '../../crm/types'
import type { Gasto, GestionInstantanea } from '../../gestion/types'
import type { AsientoManual, GestoriaInstantanea, PerfilFiscal, Presentacion } from '../types'
import { GESTORIA_VACIA, perfilInicial } from '../types'
import {
  ajustesFiscales, apunte, asientoRegularizacion, asientosDelEjercicio, balance, cuadra, cuadroAmortizacion, cuentaDeCompra,
  cuentaDeGasto, finDePlazo, impuestoSociedades, libroDiario, lineasAsientoImpuesto, mayor, nombreCuenta, pasosCierre,
  perdidasYGanancias, sumasYSaldos,
} from './index'
import type { Asiento } from './index'

// ─────────────────────────────────────────────── fábricas

const linea = (descripcion: string, precio: number, iva = 21, cantidad = 1): LineaDocumento =>
  ({ productoId: '', descripcion, cantidad, unidad: '', precio, dto: 0, iva })

function venta(x: Partial<FacturaVenta> & Pick<FacturaVenta, 'id' | 'fecha' | 'lineas'>): FacturaVenta {
  return {
    no: x.id.toUpperCase(), creadoEl: '', cuentaId: 'c1', contactoId: null, propietarioId: null, condicionesPago: '30', metodoPago: 'transferencia',
    referencia: '', notas: '', estado: 'registrada', pedidoId: null, vencimiento: '', registradaEl: null, pagadaEl: null, importeCobrado: 0,
    tipoOperacion: 'interior', tipoFactura: 'F1', rectificadaId: null, motivoRectificacion: '', estadoVerifactu: 'sin-registro', huella: '', ...x,
  }
}

function compra(x: Partial<FacturaCompra> & Pick<FacturaCompra, 'id' | 'fecha' | 'lineas'>): FacturaCompra {
  return {
    no: x.id.toUpperCase(), creadoEl: '', cuentaId: 'p1', contactoId: null, propietarioId: null, condicionesPago: '30', metodoPago: 'transferencia',
    referencia: '', notas: '', estado: 'registrada', pedidoId: null, noProveedor: '', vencimiento: '', registradaEl: null, pagadaEl: null,
    importePagado: 0, tipoOperacion: 'interior', irpf: 0, claveRetencion: 'ninguna', fechaRecepcion: '', bienInversion: false, vidaUtil: 0,
    ivaDeducible: true, enlace: '', ...x,
  }
}

function gasto(x: Partial<Gasto> & Pick<Gasto, 'id' | 'fecha' | 'concepto' | 'base' | 'total'>): Gasto {
  return {
    creadoEl: '', no: x.id.toUpperCase(), iva: 0, irpf: 0, categoria: 'otros', estado: 'pagado', metodoPago: 'tarjeta', recurrente: false, diaCargo: 1,
    deducible: true, facturaCompleta: true, deducibleIs: true, noFactura: '', enlace: '', foto: '', tieneFoto: false, notas: '', proveedorId: null, proyectoId: null,
    pagadorId: null, facturaCompraId: null, ...x,
  }
}

function presentacion(x: Partial<Presentacion> & Pick<Presentacion, 'id' | 'modelo' | 'periodo' | 'estado' | 'importe'>): Presentacion {
  return { creadoEl: '', presentadaEl: null, csv: '', nrc: '', justificante: '', casillas: {}, incluidos: [], complementariaDe: null, notas: '', ...x }
}

const capital: AsientoManual = {
  id: 'cap', creadoEl: '', fecha: '2026-10-01', ejercicio: 2026, tipo: 'capital', concepto: 'Aportación de capital en la constitución',
  lineas: [{ cuenta: '572', debe: 3000, haber: 0 }, { cuenta: '100', debe: 0, haber: 3000 }],
}

const perfil: PerfilFiscal = { ...perfilInicial(), fechaConstitucion: '2026-10-01', saldoBanco: 3338, saldoBancoFecha: '2026-12-31' }

function ejemplo() {
  const crm: CrmInstantanea = {
    ...CRM_VACIO,
    facturasVenta: [
      venta({ id: 'fv1', fecha: '2026-10-15', lineas: [linea('Desarrollo de la app', 2000)], estado: 'pagada', pagadaEl: '2026-11-10T09:00:00Z' }),
      // a una empresa francesa: sin IVA (inversión del sujeto pasivo); se cobra en 2027
      venta({ id: 'fv2', fecha: '2026-11-05', lineas: [linea('Consultoría', 1500, 0)], tipoOperacion: 'ue-empresa', cuentaId: 'c2', estado: 'pagada', pagadaEl: '2027-01-20' }),
      venta({ id: 'fv3', fecha: '2026-11-20', lineas: [linea('Borrador', 999)], estado: 'borrador' }),
      venta({ id: 'fv4', fecha: '2026-11-21', lineas: [linea('Anulada', 500)], estado: 'anulada' }),
    ],
    facturasCompra: [
      // asesor con retención del 15 %
      compra({
        id: 'fc1', fecha: '2026-10-20', fechaRecepcion: '2026-10-21', lineas: [linea('Asesoría de constitución', 500)], irpf: 15, claveRetencion: 'profesional',
        estado: 'pagada', pagadaEl: '2026-10-30',
      }),
      // suscripción a un proveedor irlandés: inversión del sujeto pasivo
      compra({ id: 'fc2', fecha: '2026-11-10', lineas: [linea('Suscripción de servicios en la nube', 100)], tipoOperacion: 'ue', cuentaId: 'p2' }),
      // ordenador: bien de inversión a 4 años
      compra({ id: 'fc3', fecha: '2026-10-15', lineas: [linea('Portátil', 1200)], bienInversion: true, vidaUtil: 4, estado: 'pagada', pagadaEl: '2026-10-16', cuentaId: 'p3' }),
      compra({ id: 'fc4', fecha: '2026-11-15', lineas: [linea('Pendiente de revisar', 300)], estado: 'pendiente' }),
    ],
  }
  const gestion: GestionInstantanea = {
    documentos: [],
    gastos: [
      // comida con un cliente que pagó un socio: pendiente de reembolso
      gasto({ id: 'g1', fecha: '2026-11-20', concepto: 'Comida con cliente', base: 50, iva: 10, total: 55, categoria: 'dietas', estado: 'reembolsar' }),
      gasto({ id: 'g2', fecha: '2026-12-10', concepto: 'Multa de aparcamiento', base: 100, total: 100, deducible: false, facturaCompleta: false, deducibleIs: false }),
      // ya está como factura de compra del CRM: no se cuenta dos veces
      gasto({ id: 'g3', fecha: '2026-10-20', concepto: 'Asesoría (duplicado)', base: 500, iva: 21, irpf: 15, total: 530, facturaCompraId: 'fc1' }),
    ],
  }
  const gestoria: GestoriaInstantanea = {
    ...GESTORIA_VACIA,
    perfil: [perfil],
    asientos: [capital],
    presentaciones: [
      presentacion({ id: 'p303', modelo: '303', periodo: '2026-4T', estado: 'domiciliada', importe: 58, presentadaEl: '2027-01-10T10:00:00Z' }),
      presentacion({ id: 'p111', modelo: '111', periodo: '2026-4T', estado: 'pagada', importe: 75, presentadaEl: '2027-01-15T10:00:00Z' }),
    ],
  }
  return { crm, gestion, gestoria, perfil }
}

const de = (asientos: Asiento[], id: string) => asientos.find(a => a.id === id)!
const saldo = (a: Asiento, cuenta: string) => a.lineas.filter(l => l.cuenta === cuenta).reduce((s, l) => s + l.debe - l.haber, 0)

// ─────────────────────────────────────────────── plan

describe('plan de cuentas', () => {
  it('da nombre a las cuentas y a sus subcuentas', () => {
    expect(nombreCuenta('4751')).toBe('Hacienda Pública, acreedora por retenciones practicadas')
    expect(nombreCuenta('57200001')).toBe('Bancos e instituciones de crédito c/c vista, euros')
    expect(nombreCuenta('999')).toBe('')
  })

  it('elige la cuenta de cada gasto y compra', () => {
    expect(cuentaDeGasto('marketing')).toBe('627')
    expect(cuentaDeGasto('asesoria')).toBe('623')
    expect(cuentaDeGasto('suministros')).toBe('628')
    expect(cuentaDeGasto('hosting')).toBe('629')
    expect(cuentaDeGasto('material', true)).toBe('217')
    expect(cuentaDeGasto('sanciones')).toBe('678')
    const { crm } = ejemplo()
    expect(cuentaDeCompra(crm.facturasCompra[0])).toBe('623')
    expect(cuentaDeCompra(crm.facturasCompra[2])).toBe('217')
    expect(cuentaDeCompra(compra({ id: 'x', fecha: '2026-11-01', lineas: [linea('Licencia perpetua de software de diseño', 600)], bienInversion: true }))).toBe('206')
    expect(cuentaDeCompra(compra({ id: 'y', fecha: '2026-11-01', lineas: [linea('Alquiler', 600)], claveRetencion: 'arrendamiento' }))).toBe('621')
  })
})

// ─────────────────────────────────────────────── asientos

describe('asientos del ejercicio 2026', () => {
  const e = ejemplo()
  const asientos = asientosDelEjercicio({ ...e, ejercicio: 2026 })

  it('genera solo los que tocan, ordenados y numerados desde 1', () => {
    expect(asientos.map(a => a.id)).toEqual([
      'man:cap', 'fv:fv1', 'fc:fc3', 'fc-pago:fc3', 'fc:fc1', 'fc-pago:fc1', 'fv:fv2', 'fv-cobro:fv1', 'fc:fc2', 'g:g1', 'g:g2',
      'amort:2026:fc3:217', 'iva:2026-4T',
    ])
    expect(asientos.map(a => a.numero)).toEqual(asientos.map((_, i) => i + 1))
    expect(asientos.some(a => a.origen.id === 'g3' || a.origen.id === 'fv3' || a.origen.id === 'fv4' || a.origen.id === 'fc4')).toBe(false)
    expect(de(asientos, 'man:cap').automatico).toBe(false)
  })

  it('todos los asientos cuadran', () => {
    for (const a of asientos) expect(cuadra(a), `${a.numero} ${a.concepto}`).toBe(true)
    const d = libroDiario(asientos)
    expect(d.descuadrados).toEqual([])
    expect(d.debe).toBe(d.haber)
  })

  it('venta interior: 430 / 705 + 477; venta a la UE sin 477', () => {
    const fv1 = de(asientos, 'fv:fv1')
    expect(fv1.lineas).toEqual([{ cuenta: '430', debe: 2420, haber: 0 }, { cuenta: '705', debe: 0, haber: 2000 }, { cuenta: '477', debe: 0, haber: 420 }])
    const fv2 = de(asientos, 'fv:fv2')
    expect(fv2.lineas.map(l => l.cuenta)).toEqual(['430', '705'])
    expect(saldo(de(asientos, 'fv-cobro:fv1'), '572')).toBe(2420)
  })

  it('compra a un profesional con retención: 623 + 472 / 4751 + 410', () => {
    const fc1 = de(asientos, 'fc:fc1')
    expect(fc1.fecha).toBe('2026-10-21')
    expect(saldo(fc1, '623')).toBe(500)
    expect(saldo(fc1, '472')).toBe(105)
    expect(saldo(fc1, '4751')).toBe(-75)
    expect(saldo(fc1, '410')).toBe(-530)
    expect(saldo(de(asientos, 'fc-pago:fc1'), '572')).toBe(-530)
  })

  it('inversión del sujeto pasivo: 472 al debe y 477 al haber por la cuota autorrepercutida', () => {
    const fc2 = de(asientos, 'fc:fc2')
    expect(saldo(fc2, '629')).toBe(100)
    expect(saldo(fc2, '472')).toBe(21)
    expect(saldo(fc2, '477')).toBe(-21)
    expect(saldo(fc2, '410')).toBe(-100)
  })

  it('bien de inversión contra proveedores de inmovilizado y amortización por días', () => {
    const fc3 = de(asientos, 'fc:fc3')
    expect(saldo(fc3, '217')).toBe(1200)
    expect(saldo(fc3, '523')).toBe(-1452)
    // 1.200 × 78 días (15/10 a 31/12) / 365 / 4 años
    const am = de(asientos, 'amort:2026:fc3:217')
    expect(am.lineas).toEqual([{ cuenta: '681', debe: 64.11, haber: 0 }, { cuenta: '281', debe: 0, haber: 64.11 }])
    const [fila] = cuadroAmortizacion(e.crm, 2026)
    expect(fila).toMatchObject({ facturaId: 'fc3', cuenta: '217', valor: 1200, inicio: '2026-10-15', vidaUtil: 4, cuotaEjercicio: 64.11, acumulada: 64.11, pendiente: 1135.89 })
  })

  it('gastos: el adelantado por un socio va a 551 y la multa a 678', () => {
    const g1 = de(asientos, 'g:g1')
    expect(saldo(g1, '629')).toBe(50)
    expect(saldo(g1, '472')).toBe(5)
    expect(saldo(g1, '551')).toBe(-55)
    const g2 = de(asientos, 'g:g2')
    expect(g2.lineas).toEqual([{ cuenta: '678', debe: 100, haber: 0 }, { cuenta: '572', debe: 0, haber: 100 }])
  })

  it('el reembolso al socio salda 551 contra el banco', () => {
    const x = ejemplo()
    x.gestion.gastos[0] = { ...x.gestion.gastos[0], estado: 'reembolsado', actualizadoEl: '2026-12-15T08:00:00Z' }
    const as = asientosDelEjercicio({ ...x, ejercicio: 2026 })
    const r = de(as, 'g-reembolso:g1')
    expect(r.fecha).toBe('2026-12-15')
    expect(r.lineas).toEqual([{ cuenta: '551', debe: 55, haber: 0 }, { cuenta: '572', debe: 0, haber: 55 }])
  })

  it('liquida el IVA del 4T: 477 − 472 a 4750', () => {
    const iva = de(asientos, 'iva:2026-4T')
    expect(iva.fecha).toBe('2026-12-31')
    expect(saldo(iva, '477')).toBe(441)
    expect(saldo(iva, '472')).toBe(-383)
    expect(saldo(iva, '4750')).toBe(-58)
    expect(asientos.at(-1)!.id).toBe('iva:2026-4T')
  })

  it('un resultado de IVA negativo va a 4700 y se compensa en el trimestre siguiente', () => {
    const x = ejemplo()
    x.crm.facturasVenta = [venta({ id: 'a', fecha: '2026-11-02', lineas: [linea('Servicio', 100)] }), venta({ id: 'b', fecha: '2027-02-01', lineas: [linea('Servicio', 1000)] })]
    const a26 = asientosDelEjercicio({ ...x, ejercicio: 2026 })
    expect(saldo(de(a26, 'iva:2026-4T'), '4700')).toBe(383 - 21 - 21)
    const a27 = asientosDelEjercicio({ ...x, ejercicio: 2027 })
    expect(saldo(a27[0], '4700')).toBe(341)
    // 1T 2027: 210 € repercutidos, compensados con los 341 € pendientes; no queda nada a ingresar
    const t1 = de(a27, 'iva:2027-1T')
    expect(saldo(t1, '4700')).toBe(-210)
    expect(saldo(t1, '4750')).toBe(0)
    expect(cuadra(t1)).toBe(true)
  })

  it('las rectificativas con importes negativos cambian de lado', () => {
    expect(apunte('430', -242, 'debe')).toEqual({ cuenta: '430', debe: 0, haber: 242 })
    const x = ejemplo()
    x.crm.facturasVenta.push(venta({ id: 'r1', fecha: '2026-12-01', tipoFactura: 'R1', lineas: [linea('Abono', -200)] }))
    const r = de(asientosDelEjercicio({ ...x, ejercicio: 2026 }), 'fv:r1')
    expect(r.lineas).toEqual([{ cuenta: '430', debe: 0, haber: 242 }, { cuenta: '705', debe: 200, haber: 0 }, { cuenta: '477', debe: 42, haber: 0 }])
  })
})

// ─────────────────────────────────────────────── informes

describe('informes de 2026', () => {
  const e = ejemplo()
  const asientos = asientosDelEjercicio({ ...e, ejercicio: 2026 })

  it('sumas y saldos cuadran', () => {
    const s = sumasYSaldos(asientos)
    expect(s.totales.debe).toBe(s.totales.haber)
    expect(s.totales.saldoDeudor).toBe(s.totales.saldoAcreedor)
    expect(s.filas.find(f => f.cuenta === '572')).toMatchObject({ saldoDeudor: 3338, saldoAcreedor: 0 })
  })

  it('el mayor de una cuenta de 3 dígitos agrupa sus subcuentas', () => {
    const m = mayor(asientos, '475')
    expect(new Set(m.movimientos.map(x => x.cuenta))).toEqual(new Set(['4750', '4751']))
    expect(m.saldo).toBe(-133)
    const banco = mayor(asientos, '572')
    expect(banco.movimientos[0].saldo).toBe(3000)
    expect(banco.saldo).toBe(3338)
  })

  it('pérdidas y ganancias con la estructura de pymes', () => {
    const p = perdidasYGanancias(asientos)
    const partida = (k: string) => p.partidas.find(x => x.clave === k)!.importe
    expect(partida('1')).toBe(3500)
    expect(partida('7')).toBe(-650)
    expect(partida('8')).toBe(-64.11)
    expect(partida('OR')).toBe(-100)
    expect(p.resultadoExplotacion).toBe(2685.89)
    expect(p.resultadoFinanciero).toBe(0)
    expect(p.resultadoAntesImpuestos).toBe(2685.89)
    expect(p.resultadoEjercicio).toBe(2685.89)
    expect(p.partidas.map(x => x.clave).slice(-4)).toEqual(['A.2', 'A.3', '17', 'A.4'])
  })

  it('el balance cuadra: activo = patrimonio neto + pasivo', () => {
    const b = balance(asientos)
    expect(b.cuadra).toBe(true)
    expect(b.activo.total).toBe(5973.89)
    expect(b.patrimonioNetoYPasivo.total).toBe(5973.89)
    const p = (m: { partidas: { clave: string; importe: number }[] }, k: string) => m.partidas.find(x => x.clave === k)!.importe
    expect(p(b.activo.noCorriente, 'ANC.II')).toBe(1135.89)
    expect(p(b.activo.corriente, 'AC.II.1')).toBe(1500)
    expect(p(b.activo.corriente, 'AC.VI')).toBe(3338)
    expect(p(b.patrimonioNetoYPasivo.patrimonioNeto, 'PN.I')).toBe(3000)
    expect(p(b.patrimonioNetoYPasivo.patrimonioNeto, 'PN.VII')).toBe(2685.89)
    expect(p(b.patrimonioNetoYPasivo.pasivoCorriente, 'PC.II.3')).toBe(55)
    expect(p(b.patrimonioNetoYPasivo.pasivoCorriente, 'PC.IV.2')).toBe(233)
    expect(b.resultadoEjercicio).toBe(2685.89)
  })

  it('la regularización salda los grupos 6 y 7 contra 129 sin cambiar el balance', () => {
    const reg = asientoRegularizacion(asientos, 2026)
    expect(cuadra(reg)).toBe(true)
    expect(reg.numero).toBe(asientos.length + 1)
    expect(saldo(reg, '129')).toBe(-2685.89)
    const con = [...asientos, reg]
    expect(sumasYSaldos(con).filas.filter(f => /^[67]/.test(f.cuenta)).every(f => f.saldoDeudor === 0 && f.saldoAcreedor === 0)).toBe(true)
    const b = balance(con)
    expect(b.cuadra).toBe(true)
    expect(b.resultadoEjercicio).toBe(2685.89)
    // la PyG no tiene en cuenta la regularización
    expect(perdidasYGanancias(con).resultadoEjercicio).toBe(2685.89)
  })
})

// ─────────────────────────────────────────────── impuesto y cierre

describe('impuesto y cierre de 2026', () => {
  const e = ejemplo()
  const asientos = asientosDelEjercicio({ ...e, ejercicio: 2026 })

  it('ajusta la multa y aplica el 15 % de nueva creación', () => {
    const aj = ajustesFiscales({ gestion: e.gestion, asientos, ejercicio: 2026 })
    expect(aj.positivos).toBe(100)
    expect(aj.detalle).toHaveLength(1)
    const r = impuestoSociedades({
      ejercicio: 2026, perfil, resultadoContable: perdidasYGanancias(asientos).resultadoEjercicio, ajustesPositivos: aj.positivos,
      ajustesNegativos: aj.negativos, basesNegativas: {}, retenciones: 0, pagosFraccionados: 0,
    })
    expect(r.baseImponible).toBe(2785.89)
    expect(r.tramos).toEqual([{ desde: 0, hasta: null, tipo: 15, base: 2785.89, cuota: 417.88 }])
    expect(r.cuotaIntegra).toBe(417.88)
    expect(r.cuotaDiferencial).toBe(417.88)
    expect(r.primerEjercicioPositivo).toBe(2026)
    expect(r.tipoAplicado).toContain('15 %')
  })

  it('con el asiento del impuesto, el gasto por IS se ajusta y la base no cambia', () => {
    const x = ejemplo()
    const lineas = lineasAsientoImpuesto(impuestoSociedades({
      ejercicio: 2026, perfil, resultadoContable: 2685.89, ajustesPositivos: 100, ajustesNegativos: 0, basesNegativas: {}, retenciones: 0, pagosFraccionados: 0,
    }))
    expect(lineas).toEqual([{ cuenta: '6300', debe: 417.88, haber: 0, concepto: 'Impuesto corriente' }, { cuenta: '4752', debe: 0, haber: 417.88, concepto: 'Cuota a ingresar' }])
    x.gestoria.asientos.push({ id: 'is', creadoEl: '', fecha: '2026-12-31', ejercicio: 2026, tipo: 'impuesto', concepto: 'Impuesto sobre Sociedades 2026', lineas })
    const as = asientosDelEjercicio({ ...x, ejercicio: 2026 })
    expect(as.at(-1)!.id).toBe('man:is')
    const p = perdidasYGanancias(as)
    expect(p.impuestos).toBe(-417.88)
    expect(p.resultadoEjercicio).toBe(2268.01)
    const aj = ajustesFiscales({ gestion: x.gestion, asientos: as, ejercicio: 2026 })
    expect(aj.positivos).toBe(517.88)
    expect(r2(p.resultadoEjercicio + aj.positivos)).toBe(2785.89)
    expect(balance(as).cuadra).toBe(true)
    expect(pasosCierre({ ejercicio: 2026, asientos: as, gestoria: x.gestoria, crm: x.crm, perfil, gestion: x.gestion, hoy: '2027-02-15' })
      .find(p => p.clave === 'impuesto')!.estado).toBe('hecho')
  })

  it('pasos del cierre', () => {
    const pasos = pasosCierre({ ejercicio: 2026, asientos, gestoria: e.gestoria, crm: e.crm, perfil, gestion: e.gestion, hoy: '2027-02-15' })
    const estado = Object.fromEntries(pasos.map(p => [p.clave, p.estado]))
    expect(estado).toEqual({
      amortizaciones: 'hecho', 'iva-4t': 'hecho', 'conciliacion-banco': 'hecho', 'asientos-cuadrados': 'hecho', impuesto: 'pendiente',
      formulacion: 'pendiente', legalizacion: 'pendiente', junta: 'pendiente', deposito: 'pendiente', 'modelo-200': 'pendiente',
    })
    expect(pasos.find(p => p.clave === 'impuesto')!.detalle).toContain('15 %')
    expect(pasos.find(p => p.clave === 'modelo-200')!.plazo).toBe('2027-07-25')

    const tarde = pasosCierre({ ejercicio: 2026, asientos, gestoria: e.gestoria, crm: e.crm, perfil: { ...perfil, saldoBanco: 3000 }, hoy: '2027-04-05' })
    expect(tarde.find(p => p.clave === 'formulacion')!.estado).toBe('aviso')
    expect(tarde.find(p => p.clave === 'legalizacion')!.estado).toBe('pendiente')
    expect(tarde.find(p => p.clave === 'conciliacion-banco')!.estado).toBe('aviso')
  })

  it('el depósito vence un mes después de la junta', () => {
    const x = ejemplo()
    x.gestoria.presentaciones.push(presentacion({ id: 'j', modelo: 'junta', periodo: '2026', estado: 'presentada', importe: 0, presentadaEl: '2027-05-31T10:00:00Z' }))
    const pasos = pasosCierre({ ejercicio: 2026, asientos, gestoria: x.gestoria, crm: x.crm, perfil, hoy: '2027-06-10' })
    expect(pasos.find(p => p.clave === 'junta')!.estado).toBe('hecho')
    expect(pasos.find(p => p.clave === 'deposito')!.plazo).toBe('2027-06-30')
  })
})

// ─────────────────────────────────────────────── ejercicio siguiente

describe('ejercicio 2027', () => {
  const e = ejemplo()
  const asientos = asientosDelEjercicio({ ...e, ejercicio: 2027 })

  it('abre con los saldos de 2026 ya regularizados', () => {
    const ap = asientos[0]
    expect(ap).toMatchObject({ numero: 1, tipo: 'apertura', fecha: '2027-01-01' })
    expect(cuadra(ap)).toBe(true)
    expect(saldo(ap, '572')).toBe(3338)
    expect(saldo(ap, '430')).toBe(1500)
    expect(saldo(ap, '281')).toBe(-64.11)
    expect(saldo(ap, '129')).toBe(-2685.89)
    expect(ap.lineas.some(l => /^[67]/.test(l.cuenta))).toBe(false)
  })

  it('cobra la venta a la UE, paga los modelos del 4T y sigue amortizando', () => {
    expect(asientos.map(a => a.id)).toEqual(['apertura:2027', 'pres:p111', 'fv-cobro:fv2', 'pres:p303', 'amort:2027:fc3:217'])
    expect(de(asientos, 'pres:p303')).toMatchObject({ fecha: finDePlazo('303', '2026-4T'), lineas: [{ cuenta: '4750', debe: 58, haber: 0 }, { cuenta: '572', debe: 0, haber: 58 }] })
    expect(de(asientos, 'pres:p111').fecha).toBe('2027-01-15')
    expect(saldo(de(asientos, 'amort:2027:fc3:217'), '681')).toBe(300)
    expect(cuadroAmortizacion(e.crm, 2027)[0]).toMatchObject({ acumulada: 364.11, pendiente: 835.89 })
    for (const a of asientos) expect(cuadra(a)).toBe(true)
  })

  it('el balance cuadra y el resultado de 2026 queda en resultados de ejercicios anteriores', () => {
    const b = balance(asientos)
    expect(b.cuadra).toBe(true)
    expect(b.activo.total).toBe(5540.89)
    const pn = b.patrimonioNetoYPasivo.patrimonioNeto.partidas
    expect(pn.find(p => p.clave === 'PN.V')!.importe).toBe(2685.89)
    expect(pn.find(p => p.clave === 'PN.VII')!.importe).toBe(-300)
    expect(perdidasYGanancias(asientos).resultadoEjercicio).toBe(-300)
  })
})

const r2 = (n: number) => Math.round(n * 100) / 100
