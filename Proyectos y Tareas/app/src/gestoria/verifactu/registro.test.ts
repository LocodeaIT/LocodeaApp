import { describe, expect, it } from 'vitest'
import type { RegistroFacturacion } from '../types'
import { configDePrueba, cuentaDePrueba, facturaDePrueba, linea, NIF_PRUEBAS } from './datos-de-prueba'
import { huellaAlta } from './huella'
import { crearRegistroAlta, crearRegistroAnulacion, desgloseDe, ultimoDeLaCadena } from './registro'
import { validarRegistro } from './validar'
import { bloquesXml, valorXml } from './xml'

const ahora = new Date('2026-10-05T09:00:00Z')
const config = configDePrueba()
const conId = (r: Omit<RegistroFacturacion, 'id' | 'creadoEl'>, id: string): RegistroFacturacion => ({ ...r, id, creadoEl: ahora.toISOString() })

describe('desgloseDe', () => {
  it('agrupa por tipo de IVA (S1)', () => {
    expect(desgloseDe(facturaDePrueba())).toEqual([
      { impuesto: '01', claveRegimen: '01', calificacion: 'S1', tipoImpositivo: 21, base: 1000, cuota: 210 },
      { impuesto: '01', claveRegimen: '01', calificacion: 'S1', tipoImpositivo: 10, base: 180, cuota: 18 },
    ])
  })

  it('no sujeta (N2): importe no sujeto, sin tipo ni cuota', () => {
    expect(desgloseDe(facturaDePrueba({ tipoOperacion: 'fuera-ue', lineas: [linea(500, 0), linea(300, 0)] })))
      .toEqual([{ impuesto: '01', claveRegimen: '01', calificacion: 'N2', base: 800 }])
  })

  it('inversión del sujeto pasivo (S2) y exenta (E1)', () => {
    expect(desgloseDe(facturaDePrueba({ tipoOperacion: 'isp-interior', lineas: [linea(100, 0)] })))
      .toEqual([{ impuesto: '01', claveRegimen: '01', calificacion: 'S2', tipoImpositivo: 0, base: 100, cuota: 0 }])
    expect(desgloseDe(facturaDePrueba({ tipoOperacion: 'exenta', lineas: [linea(100, 0)] })))
      .toEqual([{ impuesto: '01', claveRegimen: '01', exenta: 'E1', base: 100 }])
  })
})

describe('crearRegistroAlta', () => {
  it('primer registro: orden 1, sin huella anterior, huella correcta y XML con los nodos clave', async () => {
    const r = await crearRegistroAlta({ factura: facturaDePrueba(), cuenta: cuentaDePrueba(), config, anterior: null, ahora })
    expect(r).toMatchObject({
      tipo: 'alta', facturaId: 'f1', nifEmisor: NIF_PRUEBAS, serieNumero: 'F-26001', fechaExpedicion: '2026-10-05', tipoFactura: 'F1',
      cuotaTotal: 228, importeTotal: 1408, huellaAnterior: '', fechaHoraGeneracion: '2026-10-05T11:00:00+02:00',
      estado: 'pendiente', entorno: 'pruebas', orden: 1, envioId: null,
    })
    expect(r.huella).toBe(await huellaAlta({ ...r, huellaAnterior: '' }))
    const x = r.xml
    expect(x.startsWith('<sum1:RegistroAlta xmlns:sum1="https://www2.agenciatributaria.gob.es/')).toBe(true)
    expect(valorXml(x, 'IDVersion')).toBe('1.0')
    expect(x).toContain('<sum1:IDFactura><sum1:IDEmisorFactura>89890001K</sum1:IDEmisorFactura><sum1:NumSerieFactura>F-26001</sum1:NumSerieFactura><sum1:FechaExpedicionFactura>05-10-2026</sum1:FechaExpedicionFactura></sum1:IDFactura>')
    expect(valorXml(x, 'NombreRazonEmisor')).toBe('Locodea SL')
    expect(valorXml(x, 'DescripcionOperacion')).toBe('Desarrollo de la app; Formación')
    expect(x).toContain('<sum1:IDDestinatario><sum1:NombreRazon>Cliente Ejemplo SL</sum1:NombreRazon><sum1:NIF>B12345674</sum1:NIF></sum1:IDDestinatario>')
    expect(x).toContain('<sum1:DetalleDesglose><sum1:Impuesto>01</sum1:Impuesto><sum1:ClaveRegimen>01</sum1:ClaveRegimen><sum1:CalificacionOperacion>S1</sum1:CalificacionOperacion><sum1:TipoImpositivo>21.00</sum1:TipoImpositivo><sum1:BaseImponibleOimporteNoSujeto>1000.00</sum1:BaseImponibleOimporteNoSujeto><sum1:CuotaRepercutida>210.00</sum1:CuotaRepercutida></sum1:DetalleDesglose>')
    expect(valorXml(x, 'CuotaTotal')).toBe('228.00')
    expect(valorXml(x, 'ImporteTotal')).toBe('1408.00')
    expect(x).toContain('<sum1:Encadenamiento><sum1:PrimerRegistro>S</sum1:PrimerRegistro></sum1:Encadenamiento>')
    expect(valorXml(x, 'IdSistemaInformatico')).toBe('LA')
    expect(valorXml(x, 'TipoUsoPosibleSoloVerifactu')).toBe('S')
    expect(valorXml(x, 'TipoUsoPosibleMultiOT')).toBe('N')
    expect(valorXml(x, 'FechaHoraHusoGenRegistro')).toBe('2026-10-05T11:00:00+02:00')
    expect(valorXml(x, 'TipoHuella')).toBe('01')
    expect(x.endsWith(`<sum1:Huella>${r.huella}</sum1:Huella></sum1:RegistroAlta>`)).toBe(true)
    expect(validarRegistro(r, ahora)).toEqual([])
  })

  it('preparación: estado simulado', async () => {
    const r = await crearRegistroAlta({ factura: facturaDePrueba(), cuenta: cuentaDePrueba(), config: configDePrueba({ entorno: 'preparacion' }), anterior: null, ahora })
    expect(r.estado).toBe('simulado')
    expect(r.entorno).toBe('preparacion')
  })

  it('encadena con el anterior: orden + 1, huella anterior y RegistroAnterior en el XML', async () => {
    const r1 = conId(await crearRegistroAlta({ factura: facturaDePrueba(), cuenta: cuentaDePrueba(), config, anterior: null, ahora }), 'r1')
    const r2 = await crearRegistroAlta({
      factura: facturaDePrueba({ id: 'f2', no: 'F-26002' }), cuenta: cuentaDePrueba(), config, anterior: r1, ahora: new Date('2026-10-05T09:05:00Z'),
    })
    expect(r2.orden).toBe(2)
    expect(r2.huellaAnterior).toBe(r1.huella)
    expect(r2.xml).toContain(`<sum1:RegistroAnterior><sum1:IDEmisorFactura>89890001K</sum1:IDEmisorFactura><sum1:NumSerieFactura>F-26001</sum1:NumSerieFactura><sum1:FechaExpedicionFactura>05-10-2026</sum1:FechaExpedicionFactura><sum1:Huella>${r1.huella}</sum1:Huella></sum1:RegistroAnterior>`)
    expect(r2.xml).not.toContain('PrimerRegistro')
  })

  it('no encadena con otra cadena ni con un reloj que va hacia atrás', async () => {
    const r1 = conId(await crearRegistroAlta({ factura: facturaDePrueba(), cuenta: cuentaDePrueba(), config, anterior: null, ahora }), 'r1')
    await expect(crearRegistroAlta({ factura: facturaDePrueba(), config: configDePrueba({ entorno: 'produccion' }), anterior: r1, ahora })).rejects.toThrow(/otra cadena/)
    await expect(crearRegistroAlta({ factura: facturaDePrueba(), config, anterior: r1, ahora: new Date('2026-10-05T08:58:00Z') })).rejects.toThrow(/reloj/)
  })

  it('empresa de la UE: N2 con IDOtro e IDType 02', async () => {
    const r = await crearRegistroAlta({
      factura: facturaDePrueba({ tipoOperacion: 'ue-empresa', lineas: [linea(2000, 0)] }),
      cuenta: cuentaDePrueba({ nombre: 'Client SARL', codigoPais: 'FR', tipoIdFiscal: 'nifiva', cif: '12345678901' }),
      config, anterior: null, ahora,
    })
    expect(r.xml).toContain('<sum1:IDOtro><sum1:CodigoPais>FR</sum1:CodigoPais><sum1:IDType>02</sum1:IDType><sum1:ID>FR12345678901</sum1:ID></sum1:IDOtro>')
    expect(r.xml).toContain('<sum1:CalificacionOperacion>N2</sum1:CalificacionOperacion><sum1:BaseImponibleOimporteNoSujeto>2000.00</sum1:BaseImponibleOimporteNoSujeto></sum1:DetalleDesglose>')
    expect(r.xml).not.toContain('TipoImpositivo')
    expect(r).toMatchObject({ cuotaTotal: 0, importeTotal: 2000 })
    expect(validarRegistro(r, ahora)).toEqual([])
  })

  it('rectificativa: TipoRectificativa I y factura rectificada', async () => {
    const original = facturaDePrueba()
    const r = await crearRegistroAlta({
      factura: facturaDePrueba({ id: 'f3', no: 'R-26001', tipoFactura: 'R4', rectificadaId: 'f1', motivoRectificacion: 'Descuento acordado', lineas: [linea(-100, 21)] }),
      cuenta: cuentaDePrueba(), config, anterior: null, ahora, rectificada: original,
    })
    expect(valorXml(r.xml, 'TipoRectificativa')).toBe('I')
    expect(r.xml).toContain('<sum1:FacturasRectificadas><sum1:IDFacturaRectificada><sum1:IDEmisorFactura>89890001K</sum1:IDEmisorFactura><sum1:NumSerieFactura>F-26001</sum1:NumSerieFactura><sum1:FechaExpedicionFactura>05-10-2026</sum1:FechaExpedicionFactura></sum1:IDFacturaRectificada></sum1:FacturasRectificadas>')
    expect(valorXml(r.xml, 'DescripcionOperacion')).toBe('Rectificación de la factura F-26001: Descuento acordado. Consultoría')
    expect(r).toMatchObject({ cuotaTotal: -21, importeTotal: -121 })
    expect(validarRegistro(r, ahora)).toEqual([])
  })

  it('escapa los caracteres reservados de XML', async () => {
    const r = await crearRegistroAlta({
      factura: facturaDePrueba({ lineas: [linea(10, 21, 1, 0, 'I+D <fase 1> & "pruebas"')] }),
      cuenta: cuentaDePrueba({ nombre: "O'Neill & Hijos" }), config, anterior: null, ahora,
    })
    expect(r.xml).toContain('<sum1:DescripcionOperacion>I+D &lt;fase 1&gt; &amp; &quot;pruebas&quot;</sum1:DescripcionOperacion>')
    expect(r.xml).toContain('<sum1:NombreRazon>O&apos;Neill &amp; Hijos</sum1:NombreRazon>')
    expect(valorXml(bloquesXml(r.xml, 'IDDestinatario')[0], 'NombreRazon')).toBe("O'Neill & Hijos")
  })
})

describe('crearRegistroAnulacion y ultimoDeLaCadena', () => {
  it('anulación encadenada con el alta', async () => {
    const r1 = conId(await crearRegistroAlta({ factura: facturaDePrueba(), cuenta: cuentaDePrueba(), config, anterior: null, ahora }), 'r1')
    const a = await crearRegistroAnulacion({ factura: facturaDePrueba(), config, anterior: r1, ahora: new Date('2026-10-05T10:00:00Z') })
    expect(a).toMatchObject({ tipo: 'anulacion', orden: 2, huellaAnterior: r1.huella, cuotaTotal: 0, importeTotal: 0, estado: 'pendiente' })
    expect(a.xml).toContain('<sum1:IDFactura><sum1:IDEmisorFacturaAnulada>89890001K</sum1:IDEmisorFacturaAnulada><sum1:NumSerieFacturaAnulada>F-26001</sum1:NumSerieFacturaAnulada><sum1:FechaExpedicionFacturaAnulada>05-10-2026</sum1:FechaExpedicionFacturaAnulada></sum1:IDFactura>')
    expect(a.xml.startsWith('<sum1:RegistroAnulacion ')).toBe(true)
    expect(validarRegistro(a, ahora)).toEqual([])
  })

  it('el último es el de mayor orden del emisor y entorno', async () => {
    const r1 = conId(await crearRegistroAlta({ factura: facturaDePrueba(), cuenta: cuentaDePrueba(), config, anterior: null, ahora }), 'r1')
    const r2 = conId(await crearRegistroAlta({ factura: facturaDePrueba({ no: 'F-26002' }), cuenta: cuentaDePrueba(), config, anterior: r1, ahora }), 'r2')
    const otro = { ...r2, id: 'r3', orden: 9, entorno: 'produccion' as const }
    expect(ultimoDeLaCadena([r2, otro, r1], NIF_PRUEBAS, 'pruebas')?.id).toBe('r2')
    expect(ultimoDeLaCadena([r2, otro, r1], NIF_PRUEBAS, 'produccion')?.id).toBe('r3')
    expect(ultimoDeLaCadena([r1], 'B12345674', 'pruebas')).toBeNull()
  })
})
