import { describe, expect, it } from 'vitest'
import type { PerfilFiscal } from '../types'
import { perfilInicial } from '../types'
import { ejercicioBase202, impuestoSociedades, limiteCompensacion, lineasAsientoImpuesto, pagoFraccionado202, tipoGravamen } from './impuesto'

const perfil = (x: Partial<PerfilFiscal> = {}): PerfilFiscal => ({ ...perfilInicial(), nuevaCreacion: false, ...x })
const base = { resultadoContable: 0, ajustesPositivos: 0, ajustesNegativos: 0, basesNegativas: {}, retenciones: 0, pagosFraccionados: 0 }

describe('tipo de gravamen', () => {
  it('nueva creación: 15 % el primer ejercicio con base positiva y el siguiente', () => {
    const p = perfil({ nuevaCreacion: true })
    expect(tipoGravamen(2026, p, 1000).tramos).toEqual([{ hasta: null, tipo: 15 }])
    const p2 = perfil({ nuevaCreacion: true, primerEjercicioPositivo: 2026 })
    expect(tipoGravamen(2027, p2, 1000).tramos).toEqual([{ hasta: null, tipo: 15 }])
    expect(tipoGravamen(2028, p2, 1000).tramos).toEqual([{ hasta: 50000, tipo: 17 }, { hasta: null, tipo: 20 }])
  })

  it('microempresa con la escala transitoria de la Ley 7/2024', () => {
    expect(tipoGravamen(2025, perfil(), 1).tramos).toEqual([{ hasta: 50000, tipo: 21 }, { hasta: null, tipo: 22 }])
    expect(tipoGravamen(2026, perfil(), 1).tramos).toEqual([{ hasta: 50000, tipo: 19 }, { hasta: null, tipo: 21 }])
    expect(tipoGravamen(2027, perfil(), 1).tramos).toEqual([{ hasta: 50000, tipo: 17 }, { hasta: null, tipo: 20 }])
    expect(tipoGravamen(2024, perfil(), 1).tramos).toEqual([{ hasta: null, tipo: 23 }])
    // periodo de 92 días: los 50.000 € se prorratean
    expect(tipoGravamen(2026, perfil(), 1, 92).tramos[0].hasta).toBe(12602.74)
  })

  it('reducida dimensión y tipo general', () => {
    const erd = perfil({ cifraNegocios: 2e6 })
    expect([2025, 2026, 2027, 2028, 2029].map(a => tipoGravamen(a, erd, 1).tramos[0].tipo)).toEqual([24, 23, 22, 21, 20])
    expect(tipoGravamen(2026, perfil({ cifraNegocios: 20e6 }), 1).tramos).toEqual([{ hasta: null, tipo: 25 }])
  })
})

describe('liquidación del IS', () => {
  it('microempresa en 2026 por tramos, con deducciones, retenciones y pagos a cuenta', () => {
    const r = impuestoSociedades({ ...base, ejercicio: 2026, perfil: perfil(), resultadoContable: 60000, deducciones: 500, retenciones: 200, pagosFraccionados: 1000 })
    expect(r.tramos.map(t => [t.base, t.tipo, t.cuota])).toEqual([[50000, 19, 9500], [10000, 21, 2100]])
    expect(r.cuotaIntegra).toBe(11600)
    expect(r.cuotaLiquida).toBe(11100)
    expect(r.cuotaDiferencial).toBe(9900)
  })

  it('las deducciones no superan la cuota íntegra', () => {
    const r = impuestoSociedades({ ...base, ejercicio: 2026, perfil: perfil({ nuevaCreacion: true }), resultadoContable: 1000, deducciones: 5000, pagosFraccionados: 50 })
    expect(r.cuotaIntegra).toBe(150)
    expect(r.deducciones).toBe(150)
    expect(r.cuotaDiferencial).toBe(-50)
    expect(lineasAsientoImpuesto(r).map(l => [l.cuenta, l.debe, l.haber])).toEqual([['473', 0, 50], ['4709', 50, 0]])
  })

  it('base negativa: no hay cuota y se guarda para compensar', () => {
    const r = impuestoSociedades({ ...base, ejercicio: 2026, perfil: perfil({ nuevaCreacion: true }), resultadoContable: -5000, ajustesPositivos: 100 })
    expect(r.baseImponible).toBe(-4900)
    expect(r.cuotaIntegra).toBe(0)
    expect(r.basesNegativasGeneradas).toBe(4900)
    expect(r.basesNegativasPendientes).toEqual({ 2026: 4900 })
    expect(r.primerEjercicioPositivo).toBe(0)
  })
})

describe('compensación de bases imponibles negativas (art. 26 LIS)', () => {
  const p = perfil({ primerEjercicioPositivo: 2020 })

  it('70 % de la base previa cuando supera el millón, empezando por las más antiguas', () => {
    const r = impuestoSociedades({ ...base, ejercicio: 2026, perfil: p, resultadoContable: 2e6, basesNegativas: { 2021: 800000, 2020: 1500000 } })
    expect(r.limiteCompensacion).toBe(1400000)
    expect(r.compensaciones).toEqual([{ ejercicio: '2020', importe: 1400000 }])
    expect(r.basesNegativasPendientes).toEqual({ 2020: 100000, 2021: 800000 })
    expect(r.baseImponible).toBe(600000)
  })

  it('en todo caso hasta 1 M€ (sin pasar de la base previa)', () => {
    expect(limiteCompensacion({ ejercicio: 2026, perfil: p, baseImponiblePrevia: 1.2e6 })).toBe(1e6)
    const r = impuestoSociedades({ ...base, ejercicio: 2026, perfil: p, resultadoContable: 500000, basesNegativas: { 2024: 800000 } })
    expect(r.compensacionBins).toBe(500000)
    expect(r.baseImponible).toBe(0)
    expect(r.basesNegativasPendientes).toEqual({ 2024: 300000 })
  })

  it('el millón se prorratea si el periodo dura menos de un año', () => {
    // 73 días: 200.000 € en todo caso (más que el 70 % de 250.000 €)
    expect(limiteCompensacion({ ejercicio: 2026, perfil: p, baseImponiblePrevia: 250000, diasPeriodo: 73 })).toBe(200000)
    expect(limiteCompensacion({ ejercicio: 2026, perfil: p, baseImponiblePrevia: 250000 })).toBe(250000)
  })

  it('no compensa bases del propio ejercicio ni de ejercicios posteriores', () => {
    const r = impuestoSociedades({ ...base, ejercicio: 2026, perfil: p, resultadoContable: 1000, basesNegativas: { 2026: 500, 2027: 500 } })
    expect(r.compensacionBins).toBe(0)
  })

  it('nueva creación: sin límite en los 3 primeros periodos con base positiva', () => {
    const nueva = perfil({ nuevaCreacion: true, primerEjercicioPositivo: 2026 })
    const r = impuestoSociedades({ ...base, ejercicio: 2027, perfil: nueva, resultadoContable: 2e6, basesNegativas: { 2025: 1.9e6 } })
    expect(r.compensacionBins).toBe(1.9e6)
    expect(r.baseImponible).toBe(100000)
    expect(r.tramos[0].tipo).toBe(15)
    expect(limiteCompensacion({ ejercicio: 2029, perfil: nueva, baseImponiblePrevia: 2e6 })).toBe(1.4e6)
  })
})

describe('pago fraccionado (modelo 202)', () => {
  it('el primer ejercicio no hay pago ni obligación', () => {
    const r = pagoFraccionado202({ ejercicio: 2026, periodo: 3, cuotaUltimoIS: 0, cifraNegocios: 0, primerEjercicio: true })
    expect(r).toMatchObject({ importe: 0, modalidad: 'art40.2', obligado: false })
  })

  it('18 % de la cuota del último IS declarado', () => {
    expect(pagoFraccionado202({ ejercicio: 2027, periodo: 2, cuotaUltimoIS: 1000, cifraNegocios: 50000, primerEjercicio: false }))
      .toMatchObject({ importe: 180, modalidad: 'art40.2', obligado: true })
    expect(pagoFraccionado202({ ejercicio: 2027, periodo: 1, cuotaUltimoIS: 0, cifraNegocios: 50000, primerEjercicio: false }).obligado).toBe(false)
    expect(ejercicioBase202(2027, 1)).toBe(2025)
    expect(ejercicioBase202(2027, 2)).toBe(2026)
  })

  it('más de 6 M€: modalidad del art. 40.3, obligatoria aunque salga a cero', () => {
    expect(pagoFraccionado202({ ejercicio: 2027, periodo: 1, cuotaUltimoIS: 0, cifraNegocios: 7e6, primerEjercicio: false }))
      .toMatchObject({ importe: 0, modalidad: 'art40.3', obligado: true })
    // 5/7 de 25 = 17,86 → 17 %
    expect(pagoFraccionado202({ ejercicio: 2027, periodo: 1, cuotaUltimoIS: 0, cifraNegocios: 7e6, primerEjercicio: false, baseImponiblePeriodo: 100000 }).importe).toBe(17000)
  })
})
