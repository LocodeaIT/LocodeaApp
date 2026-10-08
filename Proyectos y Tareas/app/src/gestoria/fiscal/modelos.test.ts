import { describe, expect, it } from 'vitest'
import { apuntesFiscales } from './apuntes'
import { compra, crmCon, cuenta, gasto, gestionCon, linea, presentacion, venta } from './datosPrueba'
import { crm, gestion } from './escenario'
import { calcularModelo, modelo111, modelo190, modelo303, modelo347, modelo349, modelo369, modelo390 } from './modelos'

const apuntes = apuntesFiscales(crm, gestion)
const T3 = { anio: 2026, tipo: 'T' as const, n: 3 }

describe('modelo 303', () => {
  const r = modelo303(apuntes, T3)

  it('declara las ventas interiores por tipo', () => {
    expect(r.casillas).toMatchObject({ '07': 1000, '08': 21, '09': 210, '04': 500, '05': 10, '06': 50 })
  })

  it('lleva el servicio a la empresa francesa a la 59 y el de EE. UU. a la 120', () => {
    expect(r.casillas['59']).toBe(2000)
    expect(r.casillas['120']).toBe(3000)
    expect(r.casillas['60']).toBeUndefined()
  })

  it('autorrepercute la licencia de la UE en devengado y deducible: efecto cero', () => {
    expect(r.casillas).toMatchObject({ '10': 1000, '11': 210, '36': 1000, '37': 210 })
    expect(r.casillas['11']).toBe(r.casillas['37'])
  })

  it('no deduce la compra con IVA no deducible ni el ticket', () => {
    // 28/29: compra c2 (200) y profesional c4 (1000); ni c3 ni el ticket g1
    expect(r.casillas).toMatchObject({ '28': 1200, '29': 252 })
  })

  it('cuadra totales y resultado', () => {
    expect(r.casillas).toMatchObject({ '27': 470, '45': 462, '46': 8, '64': 8, '65': 100, '66': 8, '69': 8, '71': 8 })
    expect(r.resultado).toBe(8)
    expect(r.sinActividad).toBe(false)
    expect(r.incluidos).toContain('c1')
    expect(r.incluidos).not.toContain('c5')
    expect(r.lineas.find(l => l.casilla === '71')!.importe).toBe(8)
  })

  it('aplica las cuotas a compensar hasta dejar el resultado a cero', () => {
    const c = modelo303(apuntes, T3, { cuotasACompensar: 100 })
    expect(c.casillas).toMatchObject({ '110': 100, '78': 8, '87': 92 })
    expect(c.resultado).toBe(0)
  })

  it('sin documentos sale «sin actividad»', () => {
    const v = modelo303(apuntes, { anio: 2026, tipo: 'T', n: 1 })
    expect(v.sinActividad).toBe(true)
    expect(v.resultado).toBe(0)
    expect(v.avisos.join(' ')).toMatch(/sin actividad/)
  })

  it('calcularModelo toma las cuotas a compensar del último 303 presentado negativo', () => {
    const presentaciones = [
      presentacion({ modelo: '303', periodo: '2026-2T', importe: -150, estado: 'presentada', casillas: { '87': 0 } }),
      presentacion({ modelo: '303', periodo: '2026-1T', importe: 300, estado: 'pagada' }),
      presentacion({ modelo: '303', periodo: '2026-3T', importe: 999, estado: 'pendiente' }),
    ]
    const c = calcularModelo('303', '2026-3T', { apuntes, presentaciones })!
    expect(c.casillas).toMatchObject({ '110': 150, '78': 8, '87': 142 })
    expect(c.resultado).toBe(0)
    expect(calcularModelo('200', '2026', { apuntes, presentaciones })).toBeNull()
    expect(calcularModelo('202', '2026-2P', { apuntes, presentaciones })).toBeNull()
  })
})

describe('modelo 349', () => {
  it('declara la prestación de servicios a Francia (S) y la adquisición de la licencia irlandesa (I)', () => {
    const r = modelo349(apuntes, T3)
    expect(r.operadores).toEqual([
      { nif: '6388047V', nombre: 'Software Dublin Ltd', codigoPais: 'IE', clave: 'I', base: 1000 },
      { nif: '12345678901', nombre: 'Client Paris SAS', codigoPais: 'FR', clave: 'S', base: 2000 },
    ])
    expect(r.casillas).toEqual({ '01': 2, '02': 3000 })
    expect(r.resultado).toBe(0)
  })
})

describe('modelo 111', () => {
  it('declara al profesional al 15 % en actividades económicas', () => {
    const r = modelo111(apuntes, T3)
    expect(r.casillas).toEqual({ '07': 1, '08': 1000, '09': 150, '28': 150, '30': 150 })
    expect(r.resultado).toBe(150)
    expect(r.incluidos).toEqual(['c4'])
  })

  it('sin retenciones no se presenta', () => {
    const r = modelo111(apuntes, { anio: 2026, tipo: 'T', n: 1 })
    expect(r.sinActividad).toBe(true)
    expect(r.resultado).toBe(0)
  })

  it('el 190 recoge al perceptor con clave G', () => {
    const r = modelo190(apuntes, 2026)
    expect(r.perceptores).toMatchObject([{ nif: '12345678Z', clave: 'G', subclave: '01', percepcion: 1000, retencion: 150 }])
  })
})

describe('modelo 347', () => {
  const cuentas = [
    cuenta({ id: 'cli', nombre: 'Cliente Grande SL', cif: 'B12345674' }),
    cuenta({ id: 'fr', nombre: 'Client Paris SAS', cif: 'FR12345678901', codigoPais: 'FR', tipoIdFiscal: 'nifiva' }),
    cuenta({ id: 'prof', nombre: 'Ana Profesional', cif: '12345678Z' }),
    cuenta({ id: 'prov', nombre: 'Proveedor Pequeño SL', cif: 'B87654323' }),
    cuenta({ id: 'bar', nombre: 'Bar Pepe', cif: 'B11111119' }),
  ]
  const datos = crmCon({
    cuentas,
    facturasVenta: [
      venta({ id: 'a', cuentaId: 'cli', fecha: '2026-08-01', lineas: [linea(1000)] }),
      venta({ id: 'b', cuentaId: 'cli', fecha: '2026-11-01', lineas: [linea(2000)] }),
      venta({ id: 'c', cuentaId: 'fr', fecha: '2026-11-02', lineas: [linea(5000)], tipoOperacion: 'ue-empresa' }),
    ],
    facturasCompra: [
      compra({ id: 'd', cuentaId: 'prof', fecha: '2026-10-01', lineas: [linea(4000)], irpf: 15, claveRetencion: 'profesional' }),
      compra({ id: 'e', cuentaId: 'prov', fecha: '2026-10-05', lineas: [linea(2000)] }),
    ],
  })
  const tickets = gestionCon([gasto({ id: 't', proveedorId: 'bar', fecha: '2026-12-01', base: 3000, iva: 21, total: 3630, facturaCompleta: false })])
  const r = modelo347(apuntesFiscales(datos, tickets), 2026)

  it('declara solo al cliente que supera 3.005,06 €, IVA incluido y por trimestres', () => {
    expect(r.terceros).toHaveLength(1)
    expect(r.terceros[0]).toMatchObject({ nif: 'B12345674', clave: 'B', importe: 3630, trimestres: [0, 0, 1210, 2420], inversionSujetoPasivo: false })
    expect(r.casillas).toEqual({ '01': 1, '02': 3630 })
  })

  it('deja fuera las operaciones del 349, las sujetas a retención, los tickets y lo que no llega al umbral', () => {
    const nifs = r.terceros.map(t => t.nif)
    expect(nifs).not.toContain('FR12345678901')
    expect(nifs).not.toContain('12345678Z')
    expect(nifs).not.toContain('B11111119')
    expect(nifs).not.toContain('B87654323')
  })
})

describe('modelos 390 y 369', () => {
  it('resume el año con el mismo desglose que los 303', () => {
    const r = modelo390(apuntes, 2026)
    expect(r.casillas).toMatchObject({
      '05': 1000, '06': 210, '03': 500, '04': 50, '551': 1000, '552': 210, '637': 1000, '638': 210, '597': 1000, '598': 210,
      '605': 1300, '606': 273, '48': 1300, '49': 273, '103': 2000, '110': 3000, '99': 1500, '232': 550,
    })
    expect(r.casillas['47']).toBe(470)
    expect(r.casillas['65']).toBe(r2(470 - 273 - 210))
  })

  it('agrupa la ventanilla única por país y tipo', () => {
    const de = cuenta({ id: 'de', nombre: 'Kunde Berlin', cif: '', codigoPais: 'DE', particular: true, tipoIdFiscal: 'otro' })
    const datos = crmCon({ cuentas: [de], facturasVenta: [venta({ id: 'o', cuentaId: 'de', fecha: '2026-08-01', lineas: [linea(100, 19)], tipoOperacion: 'ue-oss' })] })
    const r = modelo369(apuntesFiscales(datos, gestionCon()), T3)
    expect(r.porPais).toEqual([{ codigoPais: 'DE', tipo: 19, base: 100, cuota: 19 }])
    expect(r.resultado).toBe(19)
    expect(modelo303(apuntesFiscales(datos, gestionCon()), T3).casillas['123']).toBe(100)
  })
})

function r2(n: number) { return Math.round(n * 100) / 100 }
