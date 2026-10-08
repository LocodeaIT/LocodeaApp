import { describe, expect, it } from 'vitest'
import { apuntesDelPeriodo, apuntesFiscales } from './apuntes'
import { crm, gestion } from './escenario'

const apuntes = apuntesFiscales(crm, gestion)
const de = (docId: string) => apuntes.find(a => a.docId === docId)!

describe('apuntes fiscales', () => {
  it('toma ventas y compras registradas o pagadas y gastos sin factura enlazada', () => {
    const ids = apuntes.map(a => a.docId).sort()
    expect(ids).toEqual(['c1', 'c2', 'c3', 'c4', 'c5', 'g1', 'v1', 'v2', 'v3', 'v4'])
  })

  it('autorrepercute el IVA de la licencia de la UE al 21 % y lo deduce', () => {
    expect(de('c1')).toMatchObject({ base: 1000, cuota: 210, cuotaDeducible: 210, total: 1000, inversionSujetoPasivo: true, fechaDevengo: '2026-07-02', numero: 'IE-881', registro: 'FC-26001' })
  })

  it('deja a cero la cuota deducible de lo que no da derecho a deducir', () => {
    expect(de('c3')).toMatchObject({ cuota: 105, cuotaDeducible: 0 })
    expect(de('g1')).toMatchObject({ cuota: 10.5, cuotaDeducible: 0, tipoFactura: 'F2' })
  })

  it('calcula la retención del profesional', () => {
    expect(de('c4')).toMatchObject({ retencionPct: 15, retencion: 150, claveRetencion: 'profesional', total: 1060 })
  })

  it('las ventas sin IVA llevan cuota cero', () => {
    expect(de('v3')).toMatchObject({ base: 2000, cuota: 0, desglose: [{ tipo: 0, base: 2000, cuota: 0 }] })
    expect(de('v1')).toMatchObject({ base: 1000, cuota: 210, total: 1210, terceroNif: 'B12345674', codigoPais: 'ES' })
  })

  it('filtra por fecha de devengo (la de recepción en compras)', () => {
    expect(apuntesDelPeriodo(apuntes, '2026-07-01', '2026-09-30').map(a => a.docId)).not.toContain('c5')
    expect(apuntesDelPeriodo(apuntes, '2026-10-01', '2026-12-31').map(a => a.docId)).toEqual(['c5'])
  })
})
