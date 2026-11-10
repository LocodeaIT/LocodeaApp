import { describe, expect, it } from 'vitest'
import {
  condicionesHabituales, cuadrarImportes, escribirCalculoYPresupuesto, filasDe, filasDesdeLineas, formaPagoHabitual, leerCalculoYPresupuesto, lineasCondiciones,
  normalizarPresupuesto, pagosPorFase, presupuestoConDatos, presupuestoVacio, semanasTotales, sumaFases,
} from './presupuesto'
import type { CalculoGuardado } from '../tarifas/motor'

const calculo = { entrada: { lineas: [] }, precio: 1150, opcion: 'recomendado', aplicadoEl: '2026-11-10T10:00:00Z' } as unknown as CalculoGuardado
const fases = [
  { fase: '0', titulo: 'Arranque', descripcion: '', semanas: '1 - 3', pago: '', importe: 3200 },
  { fase: '1', titulo: 'Finanzas', descripcion: 'Cobranza', semanas: '4 - 7', pago: '', importe: 5000 },
  { fase: '5', titulo: 'Cierre', descripcion: '', semanas: '14', pago: '', importe: 2000 },
]

describe('guardar el presupuesto con el cálculo', () => {
  it('ida y vuelta por el mismo JSON', () => {
    const p = { ...presupuestoVacio(), concepto: 'Plataforma', fases, incluir: { ...presupuestoVacio().incluir, firmas: false } }
    const leido = leerCalculoYPresupuesto(escribirCalculoYPresupuesto(calculo, p))
    expect(leido.calculo).toEqual(calculo)
    expect(leido.presupuesto).toEqual(p)
  })

  it('sin cálculo, el presupuesto se guarda solo y el cálculo se lee como vacío', () => {
    const leido = leerCalculoYPresupuesto(escribirCalculoYPresupuesto(null, { ...presupuestoVacio(), modo: 'concepto' }))
    expect(leido.calculo).toBeNull()
    expect(leido.presupuesto?.modo).toBe('concepto')
  })

  it('los cálculos antiguos se leen igual y un presupuesto vacío no se guarda', () => {
    expect(leerCalculoYPresupuesto(JSON.stringify(calculo))).toEqual({ calculo, presupuesto: null })
    expect(JSON.parse(escribirCalculoYPresupuesto(calculo, presupuestoVacio())!)).toEqual(calculo)
    expect(escribirCalculoYPresupuesto(null, presupuestoVacio())).toBeNull()
    expect(presupuestoConDatos({ ...presupuestoVacio(), incluir: { ...presupuestoVacio().incluir, pago: false } })).toBe(true)
    expect(leerCalculoYPresupuesto('no es json')).toEqual({ calculo: null, presupuesto: null })
  })

  it('completa lo que falte, también los presupuestos guardados con la primera versión (hitos)', () => {
    const p = normalizarPresupuesto({ fases: [{ importe: '12.5' }], hitos: [{ hito: 'Fase 0' }], modo: 'raro' } as never)
    expect(p.modo).toBe('fases')
    expect(p.fases[0]).toEqual({ fase: '', titulo: '', descripcion: '', semanas: '', pago: '', importe: 12.5 })
    expect(p.incluir.condiciones).toBe(true)
    expect(p.conceptos).toEqual([])
    expect(p.lineas).toEqual([])
    expect('mantenimiento' in normalizarPresupuesto({ mantenimiento: { cuota: 250 } } as never)).toBe(false)
    expect('hitos' in p).toBe(false)
  })
})

describe('importes', () => {
  it('cuadra manteniendo proporciones y la suma es exacta', () => {
    expect(cuadrarImportes([1, 1, 1], 100)).toEqual([33.33, 33.33, 33.34])
    expect(cuadrarImportes([3200, 5000, 2000], 20400)).toEqual([6400, 10000, 4000])
    expect(cuadrarImportes([0, 0], 1150)).toEqual([575, 575])
  })

  it('suma las fases', () => {
    expect(sumaFases({ ...presupuestoVacio(), fases })).toBe(10200)
  })

  it('cada modo tiene sus filas', () => {
    const p = { ...presupuestoVacio(), fases, conceptos: [{ ...fases[0], titulo: 'Proyecto' }] }
    expect(filasDe(p)).toBe(p.fases)
    expect(filasDe({ ...p, modo: 'concepto' })[0].titulo).toBe('Proyecto')
    expect(filasDe({ ...p, modo: 'lineas' })).toEqual([])
  })

  it('las filas desde las líneas llevan el importe neto, sin descuento a la vista', () => {
    const f = filasDesdeLineas([{ productoId: '', descripcion: 'Power Apps', cantidad: 2, unidad: 'ud', precio: 1000, dto: 10, iva: 21 }])
    expect(f).toEqual([{ fase: '', titulo: 'Power Apps', descripcion: '', semanas: '', pago: '', importe: 1800 }])
  })
})

describe('textos de partida', () => {
  it('saca las semanas del proyecto de las fases', () => {
    expect(semanasTotales(fases)).toBe(14)
    expect(semanasTotales([])).toBe(0)
  })

  it('pago de cada fase: la primera a la firma, el resto antes de su primera semana', () => {
    expect(pagosPorFase(fases).map(f => f.pago)).toEqual(['A la firma', 'Antes de sem. 4', 'Antes de sem. 14'])
  })

  it('forma de pago y condiciones', () => {
    expect(formaPagoHabitual('fases')).toContain('columna «Pago»')
    expect(formaPagoHabitual('concepto')).not.toContain('fase')
    expect(condicionesHabituales(fases)).toContain('Plazo de ejecución estimado: 14 semanas desde la firma.')
    expect(condicionesHabituales([])).not.toMatch(/Plazo/)
  })

  it('una condición por línea, sin viñetas', () => {
    expect(lineasCondiciones({ ...presupuestoVacio(), condiciones: '• Uno\n\n- Dos\r\n  Tres ' })).toEqual(['Uno', 'Dos', 'Tres'])
  })
})
