import { describe, expect, it } from 'vitest'
import {
  condicionesHabituales, cuadrarImportes, escribirCalculoYPresupuesto, hitosPorFase, leerCalculoYPresupuesto, lineasCondiciones,
  normalizarPresupuesto, presupuestoVacio, semanasTotales, sumaFases,
} from './presupuesto'
import type { CalculoGuardado } from '../tarifas/motor'

const calculo = { entrada: { lineas: [] }, precio: 1150, opcion: 'recomendado', aplicadoEl: '2026-11-10T10:00:00Z' } as unknown as CalculoGuardado
const fases = [
  { fase: '0', titulo: 'Arranque', descripcion: '', semanas: '1 - 3', importe: 3200 },
  { fase: '1', titulo: 'Comercial', descripcion: 'Oportunidades', semanas: '4 - 7', importe: 5000 },
  { fase: '5', titulo: 'Cierre', descripcion: '', semanas: '14', importe: 2000 },
]

describe('guardar el presupuesto con el cálculo', () => {
  it('ida y vuelta por el mismo JSON', () => {
    const p = { ...presupuestoVacio(), concepto: 'Plataforma', fases }
    const texto = escribirCalculoYPresupuesto(calculo, p)!
    const leido = leerCalculoYPresupuesto(texto)
    expect(leido.calculo).toEqual(calculo)
    expect(leido.presupuesto).toEqual(p)
  })

  it('sin cálculo, el presupuesto se guarda solo y el cálculo se lee como vacío', () => {
    const leido = leerCalculoYPresupuesto(escribirCalculoYPresupuesto(null, { ...presupuestoVacio(), concepto: 'X' }))
    expect(leido.calculo).toBeNull()
    expect(leido.presupuesto?.concepto).toBe('X')
  })

  it('los cálculos antiguos se leen igual y un presupuesto vacío no se guarda', () => {
    expect(leerCalculoYPresupuesto(JSON.stringify(calculo))).toEqual({ calculo, presupuesto: null })
    expect(JSON.parse(escribirCalculoYPresupuesto(calculo, presupuestoVacio())!)).toEqual(calculo)
    expect(escribirCalculoYPresupuesto(null, presupuestoVacio())).toBeNull()
    expect(leerCalculoYPresupuesto('no es json')).toEqual({ calculo: null, presupuesto: null })
  })

  it('completa lo que falte', () => {
    expect(normalizarPresupuesto({ fases: [{ importe: '12.5' } as never] })).toEqual({
      concepto: '', condiciones: '', moneda: 'EUR', hitos: [], fases: [{ fase: '', titulo: '', descripcion: '', semanas: '', importe: 12.5 }],
    })
  })
})

describe('importes', () => {
  it('cuadra manteniendo proporciones y la suma es exacta', () => {
    const r = cuadrarImportes([1, 1, 1], 100)
    expect(r).toEqual([33.33, 33.33, 33.34])
    expect(cuadrarImportes([3200, 5000, 2000], 20400)).toEqual([6400, 10000, 4000])
    expect(cuadrarImportes([0, 0], 1150)).toEqual([575, 575])
  })

  it('suma las fases', () => {
    expect(sumaFases({ ...presupuestoVacio(), fases })).toBe(10200)
  })
})

describe('partida de hitos y condiciones', () => {
  it('saca las semanas del proyecto de las fases', () => {
    expect(semanasTotales(fases)).toBe(14)
    expect(semanasTotales([])).toBe(0)
  })

  it('un hito por fase', () => {
    expect(hitosPorFase(fases).map(h => h.vencimiento)).toEqual(['A la firma del presupuesto', 'Al cierre y validación de la fase', 'Al cierre del proyecto'])
    expect(hitosPorFase(fases)[1]).toMatchObject({ hito: 'Fase 1', importe: 5000 })
  })

  it('condiciones con plazo y mantenimiento', () => {
    const c = condicionesHabituales(fases, 300, n => `${n} €`)
    expect(c).toContain('Plazo de ejecución estimado: 14 semanas desde la firma.')
    expect(c).toContain('300 € al mes')
    expect(condicionesHabituales([], 0, String)).not.toMatch(/Plazo|mantenimiento/)
  })

  it('una condición por línea, sin viñetas', () => {
    expect(lineasCondiciones({ ...presupuestoVacio(), condiciones: '• Uno\n\n- Dos\r\n  Tres ' })).toEqual(['Uno', 'Dos', 'Tres'])
  })
})
