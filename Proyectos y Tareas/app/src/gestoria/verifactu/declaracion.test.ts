import { describe, expect, it } from 'vitest'
import { configDePrueba } from './datos-de-prueba'
import { textoDeclaracionResponsable } from './declaracion'

const productor = { nombre: 'Locodea SL', nif: 'B12345674', direccion: 'Calle Mayor 1, 28013 Madrid, España', lugar: 'Madrid - España' }

describe('textoDeclaracionResponsable', () => {
  it('empieza con el título y lleva las letras a) a l) en orden', () => {
    const t = textoDeclaracionResponsable(configDePrueba(), productor)
    expect(t.startsWith('DECLARACIÓN RESPONSABLE DEL SISTEMA INFORMÁTICO DE FACTURACIÓN\n')).toBe(true)
    const posiciones = 'abcdefghijkl'.split('').map(l => t.indexOf(`\n${l}) `))
    expect(posiciones.every(p => p > 0)).toBe(true)
    expect([...posiciones].sort((a, b) => a - b)).toEqual(posiciones)
  })

  it('incluye los datos del sistema y del productor', () => {
    const t = textoDeclaracionResponsable(configDePrueba(), productor)
    for (const dato of ['Locodea App', '\nLA\n', '\n1.0\n', 'S - Sí', 'N - No', 'B12345674', 'Calle Mayor 1, 28013 Madrid, España', '7 de octubre de 2026', 'Madrid - España',
      'artículo 29.2.j) de la Ley 58/2003', 'Real Decreto 1007/2023', 'Orden HAC/1177/2024', 'Firmado por: Marco']) {
      expect(t).toContain(dato)
    }
  })

  it('marca lo que falta', () => {
    const t = textoDeclaracionResponsable(configDePrueba({ declaracionFirmadaEl: null }), { nombre: 'Locodea SL', nif: '', direccion: '' })
    expect(t).toContain('Fecha: (pendiente de completar)')
    expect(t).toContain('Lugar: (pendiente de completar)')
  })
})
