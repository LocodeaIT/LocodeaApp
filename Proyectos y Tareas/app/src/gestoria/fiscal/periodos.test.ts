import { describe, expect, it } from 'vitest'
import { clavePeriodo, etiquetaPeriodo, finDeMes, periodoDeClave, rangoPeriodo, sumarMeses } from './periodos'

describe('periodos', () => {
  it('convierte entre periodo y clave', () => {
    for (const clave of ['2026-3T', '2026-09', '2026', '2026-2P']) expect(clavePeriodo(periodoDeClave(clave)!)).toBe(clave)
    expect(periodoDeClave('2026-5T')).toBeNull()
    expect(periodoDeClave('2026-13')).toBeNull()
  })

  it('da el rango de cada tipo de periodo', () => {
    expect(rangoPeriodo({ anio: 2026, tipo: 'T', n: 3 })).toEqual({ desde: '2026-07-01', hasta: '2026-09-30' })
    expect(rangoPeriodo({ anio: 2028, tipo: 'M', n: 2 })).toEqual({ desde: '2028-02-01', hasta: '2028-02-29' })
    expect(rangoPeriodo({ anio: 2026, tipo: 'A', n: 0 })).toEqual({ desde: '2026-01-01', hasta: '2026-12-31' })
    expect(rangoPeriodo({ anio: 2026, tipo: 'P', n: 2 })).toEqual({ desde: '2026-01-01', hasta: '2026-09-30' })
    expect(rangoPeriodo({ anio: 2026, tipo: 'P', n: 3 }).hasta).toBe('2026-11-30')
  })

  it('pone etiquetas en español', () => {
    expect(etiquetaPeriodo({ anio: 2026, tipo: 'T', n: 3 })).toBe('3T 2026')
    expect(etiquetaPeriodo({ anio: 2026, tipo: 'M', n: 9 })).toBe('Septiembre 2026')
    expect(etiquetaPeriodo({ anio: 2026, tipo: 'A', n: 0 })).toBe('Ejercicio 2026')
    expect(etiquetaPeriodo({ anio: 2026, tipo: 'P', n: 2 })).toBe('2.º pago 2026')
  })

  it('suma meses recortando al último día', () => {
    expect(sumarMeses('2027-06-30', 1)).toBe('2027-07-30')
    expect(sumarMeses('2027-01-31', 1)).toBe('2027-02-28')
    expect(finDeMes(2026, 15)).toBe('2027-03-31')
  })
})
