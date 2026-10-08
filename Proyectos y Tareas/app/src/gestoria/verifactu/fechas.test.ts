import { describe, expect, it } from 'vitest'
import { ddmmaaaa, diaMadrid, diaValido, esFechaHoraHuso, fechaHoraHuso } from './fechas'

describe('fechaHoraHuso', () => {
  it('invierno: +01:00', () => {
    expect(fechaHoraHuso(new Date('2027-01-04T09:15:00Z'))).toBe('2027-01-04T10:15:00+01:00')
  })

  it('verano: +02:00', () => {
    expect(fechaHoraHuso(new Date('2026-07-01T10:00:00Z'))).toBe('2026-07-01T12:00:00+02:00')
  })

  it('cambio de hora de marzo y de octubre', () => {
    expect(fechaHoraHuso(new Date('2026-03-29T00:59:59Z'))).toBe('2026-03-29T01:59:59+01:00')
    expect(fechaHoraHuso(new Date('2026-03-29T01:00:00Z'))).toBe('2026-03-29T03:00:00+02:00')
    expect(fechaHoraHuso(new Date('2026-10-25T00:30:00Z'))).toBe('2026-10-25T02:30:00+02:00')
    expect(fechaHoraHuso(new Date('2026-10-25T01:30:00Z'))).toBe('2026-10-25T02:30:00+01:00')
  })

  it('medianoche y sin milisegundos', () => {
    expect(fechaHoraHuso(new Date('2026-10-05T22:00:00.987Z'))).toBe('2026-10-06T00:00:00+02:00')
  })

  it('el resultado representa el mismo instante', () => {
    const d = new Date('2026-12-31T23:59:59Z')
    const s = fechaHoraHuso(d)
    expect(esFechaHoraHuso(s)).toBe(true)
    expect(Date.parse(s)).toBe(d.getTime())
  })

  it('día en Madrid', () => {
    expect(diaMadrid(new Date('2026-12-31T23:30:00Z'))).toBe('2027-01-01')
  })
})

describe('ddmmaaaa', () => {
  it('convierte YYYY-MM-DD y deja igual dd-mm-aaaa', () => {
    expect(ddmmaaaa('2024-01-01')).toBe('01-01-2024')
    expect(ddmmaaaa('2026-10-05T09:00:00Z')).toBe('05-10-2026')
    expect(ddmmaaaa('05-10-2026')).toBe('05-10-2026')
  })

  it('rechaza fechas sin formato', () => {
    expect(() => ddmmaaaa('5/10/2026')).toThrow(/Fecha no válida/)
  })

  it('días que no existen', () => {
    expect(diaValido('2026-02-30')).toBe(false)
    expect(diaValido('2028-02-29')).toBe(true)
  })
})
