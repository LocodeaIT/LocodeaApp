import { describe, expect, it } from 'vitest'
import type { RegistroFacturacion } from '../types'
import { verificarCadena } from './cadena'
import { configDePrueba, cuentaDePrueba, facturaDePrueba } from './datos-de-prueba'
import { crearRegistroAlta, crearRegistroAnulacion } from './registro'

const config = configDePrueba()

/** Cadena de tres registros: alta, alta y anulación de la segunda. */
async function cadena(): Promise<RegistroFacturacion[]> {
  const t = (min: number) => new Date(Date.UTC(2026, 9, 5, 9, min))
  const conId = (r: Omit<RegistroFacturacion, 'id' | 'creadoEl'>, id: string): RegistroFacturacion => ({ ...r, id, creadoEl: '' })
  const r1 = conId(await crearRegistroAlta({ factura: facturaDePrueba(), cuenta: cuentaDePrueba(), config, anterior: null, ahora: t(0) }), 'r1')
  const f2 = facturaDePrueba({ id: 'f2', no: 'F-26002' })
  const r2 = conId(await crearRegistroAlta({ factura: f2, cuenta: cuentaDePrueba(), config, anterior: r1, ahora: t(5) }), 'r2')
  const r3 = conId(await crearRegistroAnulacion({ factura: f2, config, anterior: r2, ahora: t(10) }), 'r3')
  return [r1, r2, r3]
}

describe('verificarCadena', () => {
  it('una cadena bien formada es correcta (en cualquier orden de entrada)', async () => {
    const [r1, r2, r3] = await cadena()
    expect(await verificarCadena([r3, r1, r2])).toEqual({ ok: true, errores: [] })
  })

  it('detecta un importe modificado después de generar la huella', async () => {
    const [r1, r2, r3] = await cadena()
    const res = await verificarCadena([r1, { ...r2, importeTotal: 1.5 }, r3])
    expect(res.ok).toBe(false)
    expect(res.errores).toContainEqual({ orden: 2, motivo: 'La huella no corresponde a los datos del registro (¿se ha modificado?)' })
  })

  it('detecta una cadena rota (huella anterior que no es la del registro previo)', async () => {
    const [r1, r2, r3] = await cadena()
    const res = await verificarCadena([r1, r2, { ...r3, huellaAnterior: r1.huella }])
    expect(res.errores.some(e => e.orden === 3 && /huella anterior no coincide con la del registro 2/.test(e.motivo))).toBe(true)
  })

  it('detecta un registro que falta y uno repetido', async () => {
    const [r1, , r3] = await cadena()
    expect((await verificarCadena([r1, r3])).errores).toContainEqual({ orden: 3, motivo: 'Falta el registro 2 antes del 3' })
    expect((await verificarCadena([r1, { ...r1, id: 'x' }])).errores.some(e => /Orden repetido/.test(e.motivo))).toBe(true)
  })

  it('detecta un XML que no corresponde al registro', async () => {
    const [r1, r2] = await cadena()
    const res = await verificarCadena([r1, { ...r2, xml: r1.xml }])
    expect(res.errores.map(e => e.motivo)).toContain('La huella del XML no coincide con la del registro')
  })

  it('separa las cadenas por emisor y entorno', async () => {
    const [r1, r2] = await cadena()
    const otro = { ...r1, entorno: 'produccion' as const }
    expect((await verificarCadena([r1, r2, otro])).ok).toBe(true)
  })
})
