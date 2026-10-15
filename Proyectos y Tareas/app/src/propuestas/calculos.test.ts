import { describe, expect, it } from 'vitest'
import { columna, inicialesCliente, ordenAlFinal, probabilidadDe, resumirEmbudo } from './calculos'
import { propuestaVacia, type Propuesta } from './types'

let n = 0
const p = (parcial: Partial<Propuesta>): Propuesta => ({
  ...propuestaVacia(), id: `p${++n}`, creadoEl: `2026-10-0${n % 9 + 1}T10:00:00Z`, actualizadoEl: null, ...parcial,
})

describe('probabilidadDe', () => {
  it('usa la fijada o la típica del estado', () => {
    expect(probabilidadDe({ estado: 'planificacion', probabilidad: null })).toBe(50)
    expect(probabilidadDe({ estado: 'planificacion', probabilidad: 80 })).toBe(80)
  })
  it('aceptado es 100 y descartado 0, pongan lo que pongan', () => {
    expect(probabilidadDe({ estado: 'aceptado', probabilidad: 30 })).toBe(100)
    expect(probabilidadDe({ estado: 'descartado', probabilidad: 90 })).toBe(0)
  })
})

describe('resumirEmbudo', () => {
  const lista = [
    p({ estado: 'apunte', importe: 1000 }),
    p({ estado: 'enviada', importe: 10000, probabilidad: 60, fechaPrevista: '2026-10-01' }),
    p({ estado: 'aceptado', importe: 5000 }),
    p({ estado: 'descartado', importe: 3000 }),
    p({ estado: 'descartado' }),
  ]
  const r = resumirEmbudo(lista, '2026-10-15')

  it('cuenta las abiertas y el valor en juego', () => {
    expect(r.abiertas).toBe(2)
    expect(r.enJuego).toBe(11000)
    expect(r.ponderado).toBe(1000 * 0.1 + 10000 * 0.6)
  })
  it('calcula la tasa de éxito sobre las cerradas', () => {
    expect(r.aceptadas).toBe(1)
    expect(r.descartadas).toBe(2)
    expect(r.tasaExito).toBe(33)
    expect(r.importeAceptado).toBe(5000)
  })
  it('marca como atrasadas las abiertas con fecha pasada', () => {
    expect(r.atrasadas).toBe(1)
  })
  it('sin cerradas no hay tasa', () => {
    expect(resumirEmbudo([p({ estado: 'apunte' })], '2026-10-15').tasaExito).toBeNull()
  })
})

describe('tablero', () => {
  it('ordena cada columna y calcula el siguiente hueco', () => {
    const a = p({ estado: 'apunte', orden: 2 }), b = p({ estado: 'apunte', orden: 0 }), c = p({ estado: 'enviada', orden: 5 })
    expect(columna([a, b, c], 'apunte').map(x => x.id)).toEqual([b.id, a.id])
    expect(ordenAlFinal([a, b, c], 'apunte')).toBe(3)
    expect(ordenAlFinal([a, b, c], 'aceptado')).toBe(0)
  })
})

describe('inicialesCliente', () => {
  it('toma las iniciales de las palabras con peso', () => {
    expect(inicialesCliente('Talleres Moreno')).toBe('TM')
    expect(inicialesCliente('Aislapol')).toBe('AI')
    expect(inicialesCliente('Grupo de la Vega')).toBe('GV')
    expect(inicialesCliente('  ')).toBe('?')
  })
})

describe('adjuntos', async () => {
  const { bytesDeDataUrl, extension, formatoTamano, MAX_ARCHIVO, MAX_DATOS } = await import('./adjuntos')
  it('calcula los bytes reales del base64', () => {
    expect(bytesDeDataUrl('data:text/plain;base64,aG9sYQ==')).toBe(4)  // «hola»
    expect(bytesDeDataUrl('data:text/plain;base64,aG9sYSE=')).toBe(5)  // «hola!»
  })
  it('un archivo del tamaño máximo cabe en la columna', () => {
    expect(Math.ceil(MAX_ARCHIVO / 3) * 4 + 100).toBeLessThanOrEqual(MAX_DATOS)
  })
  it('formatea tamaños y extensiones', () => {
    expect(formatoTamano(512)).toBe('512 B')
    expect(formatoTamano(2048)).toBe('2 KB')
    expect(extension('Oferta final.pdf', 'application/pdf')).toBe('PDF')
    expect(extension('sin-extension', 'image/png')).toBe('PNG')
  })
})
