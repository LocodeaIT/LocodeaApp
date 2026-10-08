import { describe, expect, it } from 'vitest'
import { configDePrueba } from './datos-de-prueba'
import { NS_SOAP, NS_SUMINISTRO_INFORMACION, NS_SUMINISTRO_LR, bloquesXml, sobreSoap, valorXml, xmlRegistroAnulacion } from './xml'

const config = configDePrueba()
const anulacion = xmlRegistroAnulacion({
  idFactura: { nifEmisor: '89890001K', serieNumero: '12345679/G34', fechaExpedicion: '2024-01-01' },
  anterior: { nifEmisor: '89890001K', serieNumero: '12345678/G33', fechaExpedicion: '2024-01-01', huella: 'A'.repeat(64) },
  sistema: {
    nombreRazon: 'Locodea SL', nif: '89890001K', nombreSistema: 'Locodea App', idSistema: 'LA', version: '1.0', numeroInstalacion: '1',
    soloVerifactu: true, multiOT: false, indicadorMultiplesOT: false,
  },
  fechaHoraGeneracion: '2024-01-01T19:20:40+01:00', huella: 'B'.repeat(64),
})

describe('sobreSoap', () => {
  it('envelope con espacios de nombres, cabecera y registros', () => {
    const s = sobreSoap(config, [anulacion, anulacion])
    expect(s.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true)
    expect(s).toContain(`xmlns:soapenv="${NS_SOAP}"`)
    expect(s).toContain(`xmlns:sum="${NS_SUMINISTRO_LR}"`)
    expect(s).toContain(`xmlns:sum1="${NS_SUMINISTRO_INFORMACION}"`)
    expect(s).toContain('<soapenv:Header/><soapenv:Body><sum:RegFactuSistemaFacturacion><sum:Cabecera><sum1:ObligadoEmision><sum1:NombreRazon>Locodea SL</sum1:NombreRazon><sum1:NIF>89890001K</sum1:NIF></sum1:ObligadoEmision></sum:Cabecera>')
    expect(bloquesXml(s, 'RegistroFactura')).toHaveLength(2)
    expect(s.endsWith('</sum:RegFactuSistemaFacturacion></soapenv:Body></soapenv:Envelope>')).toBe(true)
    expect(s).not.toContain('RemisionVoluntaria')
  })

  it('marca la incidencia cuando se reenvía tras un fallo técnico', () => {
    expect(sobreSoap(config, [anulacion], { incidencia: true })).toContain('<sum1:RemisionVoluntaria><sum1:Incidencia>S</sum1:Incidencia></sum1:RemisionVoluntaria>')
  })

  it('entre 1 y 1.000 registros', () => {
    expect(() => sobreSoap(config, [])).toThrow(/No hay registros/)
    expect(() => sobreSoap(config, Array(1001).fill(anulacion))).toThrow(/1000/)
    expect(() => sobreSoap(config, Array(1000).fill(anulacion))).not.toThrow()
  })
})

describe('xmlRegistroAnulacion', () => {
  it('nodos en el orden del esquema', () => {
    const orden = ['IDVersion', 'IDFactura', 'Encadenamiento', 'SistemaInformatico', 'FechaHoraHusoGenRegistro', 'TipoHuella']
    const posiciones = orden.map(n => anulacion.indexOf(`<sum1:${n}>`))
    expect(posiciones.every(p => p > 0)).toBe(true)
    expect([...posiciones].sort((a, b) => a - b)).toEqual(posiciones)
    expect(valorXml(anulacion, 'NumSerieFacturaAnulada')).toBe('12345679/G34')
    expect(valorXml(anulacion, 'FechaExpedicionFacturaAnulada')).toBe('01-01-2024')
  })
})
