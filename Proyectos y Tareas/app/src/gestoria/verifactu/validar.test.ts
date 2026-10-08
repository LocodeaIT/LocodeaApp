import { describe, expect, it } from 'vitest'
import { configDePrueba, cuentaDePrueba, facturaDePrueba, linea } from './datos-de-prueba'
import { crearRegistroAlta } from './registro'
import { nifValido, validarRegistro } from './validar'

const ahora = new Date('2026-10-05T09:00:00Z')
const config = configDePrueba()
const alta = (p: Partial<Parameters<typeof crearRegistroAlta>[0]> = {}) =>
  crearRegistroAlta({ factura: facturaDePrueba(), cuenta: cuentaDePrueba(), config, anterior: null, ahora, ...p })

describe('nifValido', () => {
  it('DNI, NIE y NIF de sociedad con su control', () => {
    expect(nifValido('89890001K')).toBe(true)
    expect(nifValido('89890001A')).toBe(false)
    expect(nifValido('X1234567L')).toBe(true)
    expect(nifValido('B12345674')).toBe(true)
    expect(nifValido('B12345675')).toBe(false)
    expect(nifValido('')).toBe(false)
  })
})

describe('validarRegistro', () => {
  it('un registro correcto no tiene errores', async () => {
    expect(validarRegistro(await alta(), ahora)).toEqual([])
  })

  it('NIF del emisor vacío o mal formado', async () => {
    expect(validarRegistro(await alta({ config: configDePrueba({ nifEmisor: '' }) }), ahora)).toContain('Falta el NIF del emisor: complétalo en la configuración de Verifactu.')
    expect(validarRegistro(await alta({ config: configDePrueba({ nifEmisor: 'B12345675' }) }), ahora).join(' ')).toMatch(/NIF del emisor «B12345675» no es un NIF español válido/)
  })

  it('número de factura vacío, con caracteres prohibidos o no ASCII', async () => {
    expect(validarRegistro(await alta({ factura: facturaDePrueba({ no: '' }) }), ahora)).toContain('La factura no tiene número.')
    const errores = validarRegistro(await alta({ factura: facturaDePrueba({ no: 'Nº=1' }) }), ahora)
    expect(errores.join(' ')).toMatch(/ASCII imprimibles/)
    expect(errores.join(' ')).toMatch(/no puede contener comillas/)
  })

  it('fecha de expedición futura o anterior a la entrada en vigor', async () => {
    expect(validarRegistro(await alta({ factura: facturaDePrueba({ fecha: '2026-10-06' }) }), ahora)).toContain('La fecha de expedición no puede ser futura.')
    expect(validarRegistro(await alta({ factura: facturaDePrueba({ fecha: '2024-10-01' }) }), ahora)).toContain('La fecha de expedición no puede ser anterior al 28/10/2024.')
  })

  it('totales que no cuadran con el desglose', async () => {
    const r = await alta()
    const errores = validarRegistro({ ...r, cuotaTotal: 200, importeTotal: 1380 }, ahora)
    expect(errores).toContain('La cuota total del XML no coincide con la del registro.')
    expect(errores).toContain('La cuota total (200.00) no coincide con la suma de cuotas del desglose (228.00).')
    expect(errores).toContain('El importe total (1380.00) no coincide con base + cuota del desglose (1408.00).')
  })

  it('rectificativa sin factura rectificada', async () => {
    const r = await alta({ factura: facturaDePrueba({ tipoFactura: 'R4', lineas: [linea(-10)] }) })
    expect(validarRegistro(r, ahora)).toContain('La factura rectificativa no indica qué factura rectifica.')
  })

  it('destinatario extranjero sin IDType', async () => {
    const r = await alta({ factura: facturaDePrueba({ tipoOperacion: 'fuera-ue', lineas: [linea(100, 0)] }), cuenta: cuentaDePrueba({ codigoPais: 'US', tipoIdFiscal: 'nif', cif: '123456789' }) })
    expect(validarRegistro(r, ahora).join(' ')).toMatch(/es extranjero \(US\) y no tiene tipo de identificación \(IDType\)/)
  })

  it('factura completa sin destinatario y no censado fuera de España', async () => {
    expect(validarRegistro(await alta({ cuenta: undefined }), ahora)).toContain('Una factura F1 tiene que llevar destinatario: asigna un cliente a la factura.')
    const r = await alta({ cuenta: cuentaDePrueba({ codigoPais: 'PT', tipoIdFiscal: 'nocensado', cif: '123' }) })
    expect(validarRegistro(r, ahora).join(' ')).toMatch(/«No censado» \(07\) solo se admite con país ES/)
  })

  it('factura sin líneas', async () => {
    expect(validarRegistro(await alta({ factura: facturaDePrueba({ lineas: [] }) }), ahora)).toContain('La factura no tiene líneas: el desglose está vacío.')
  })

  it('identificador del sistema y huella mal formados', async () => {
    const r = await alta({ config: configDePrueba({ sistemaId: 'Ñ' }) })
    const errores = validarRegistro({ ...r, huella: 'abc' }, ahora)
    expect(errores).toContain('El identificador del sistema debe tener dos caracteres: letras mayúsculas (sin Ñ) o dígitos.')
    expect(errores).toContain('La huella no es un SHA-256 en hexadecimal y mayúsculas.')
  })
})
