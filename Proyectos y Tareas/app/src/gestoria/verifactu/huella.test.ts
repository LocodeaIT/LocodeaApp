/**
 * Pruebas de la huella con los tres ejemplos de la AEAT («Detalle de las
 * especificaciones técnicas para generación de la huella o hash», v0.1.2, apdo. 6):
 * https://www.agenciatributaria.es/static_files/AEAT_Desarrolladores/EEDD/IVA/VERI-FACTU/Veri-Factu_especificaciones_huella_hash_registros.pdf
 */
import { describe, expect, it } from 'vitest'
import { cadenaHuellaAlta, cadenaHuellaAnulacion, esHuella, huellaAlta, huellaAnulacion } from './huella'

const HUELLA_1 = '3C464DAF61ACB827C65FDA19F352A4E3BDC2C640E9E9FC4CC058073F38F12F60'
const HUELLA_2 = 'F7B94CFD8924EDFF273501B01EE5153E4CE8F259766F88CF6ACB8935802A2B97'
const HUELLA_3 = '177547C0D57AC74748561D054A9CEC14B4C4EA23D1BEFD6F2E69E3A388F90C68'

const caso1 = {
  nifEmisor: '89890001K', serieNumero: '12345678/G33', fechaExpedicion: '2024-01-01', tipoFactura: 'F1' as const,
  cuotaTotal: 12.35, importeTotal: 123.45, huellaAnterior: '', fechaHoraGeneracion: '2024-01-01T19:20:30+01:00',
}
const caso2 = { ...caso1, serieNumero: '12345679/G34', huellaAnterior: HUELLA_1, fechaHoraGeneracion: '2024-01-01T19:20:35+01:00' }
const caso3 = {
  nifEmisor: '89890001K', serieNumero: '12345679/G34', fechaExpedicion: '2024-01-01', huellaAnterior: HUELLA_2,
  fechaHoraGeneracion: '2024-01-01T19:20:40+01:00',
}

describe('huella de la AEAT', () => {
  it('caso 1: primer registro de alta (huella anterior vacía)', async () => {
    expect(cadenaHuellaAlta(caso1)).toBe(
      'IDEmisorFactura=89890001K&NumSerieFactura=12345678/G33&FechaExpedicionFactura=01-01-2024&TipoFactura=F1' +
      '&CuotaTotal=12.35&ImporteTotal=123.45&Huella=&FechaHoraHusoGenRegistro=2024-01-01T19:20:30+01:00')
    expect(await huellaAlta(caso1)).toBe(HUELLA_1)
  })

  it('caso 2: alta encadenada con el registro anterior', async () => {
    expect(cadenaHuellaAlta(caso2)).toContain(`&Huella=${HUELLA_1}&FechaHoraHusoGenRegistro=2024-01-01T19:20:35+01:00`)
    expect(await huellaAlta(caso2)).toBe(HUELLA_2)
  })

  it('caso 3: anulación encadenada', async () => {
    expect(cadenaHuellaAnulacion(caso3)).toBe(
      'IDEmisorFacturaAnulada=89890001K&NumSerieFacturaAnulada=12345679/G34&FechaExpedicionFacturaAnulada=01-01-2024' +
      `&Huella=${HUELLA_2}&FechaHoraHusoGenRegistro=2024-01-01T19:20:40+01:00`)
    expect(await huellaAnulacion(caso3)).toBe(HUELLA_3)
  })

  it('quita espacios a los lados y acepta la fecha ya en dd-mm-aaaa', async () => {
    expect(await huellaAlta({ ...caso1, serieNumero: ' 12345678/G33 ', fechaExpedicion: '01-01-2024' })).toBe(HUELLA_1)
  })

  it('los importes van siempre con dos decimales', () => {
    expect(cadenaHuellaAlta({ ...caso1, cuotaTotal: 21, importeTotal: 121.1 })).toContain('&CuotaTotal=21.00&ImporteTotal=121.10&')
  })

  it('cambiar un importe cambia la huella', async () => {
    expect(await huellaAlta({ ...caso1, importeTotal: 123.46 })).not.toBe(HUELLA_1)
  })

  it('formato de salida: 64 caracteres hexadecimales en mayúsculas', async () => {
    const h = await huellaAlta(caso1)
    expect(esHuella(h)).toBe(true)
    expect(esHuella(h.toLowerCase())).toBe(false)
  })
})
