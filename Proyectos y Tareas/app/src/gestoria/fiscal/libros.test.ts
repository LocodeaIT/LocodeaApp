import { describe, expect, it } from 'vitest'
import { apuntesFiscales } from './apuntes'
import { compra, crmCon, cuenta, gestionCon, linea } from './datosPrueba'
import { crm, gestion } from './escenario'
import { csvLibro, libroBienesInversion, libroExpedidas, libroRecibidas } from './libros'

const apuntes = apuntesFiscales(crm, gestion)

describe('libros registro', () => {
  it('expedidas: una fila por factura y tipo, con serie, número y calificación', () => {
    const filas = libroExpedidas(apuntes, '2026-07-01', '2026-09-30')
    expect(filas.map(f => f.serie + f.numero)).toEqual(['FV-26001', 'FV-26002', 'FV-26003', 'FV-26004'])
    expect(filas[0]).toMatchObject({ base: 1000, tipo: 21, cuota: 210, total: 1210, calificacion: 'S1', nifDestinatario: 'B12345674' })
    expect(filas[2]).toMatchObject({ calificacion: 'N2', cuota: 0, codigoPais: 'FR' })
  })

  it('recibidas: compras y gastos por fecha de recepción, con la cuota deducible', () => {
    const filas = libroRecibidas(apuntes, '2026-07-01', '2026-09-30')
    expect(filas.map(f => f.registro)).toEqual(['FC-26001', 'FC-26002', 'FC-26003', 'G-26001', 'FC-26004'])
    expect(filas[0]).toMatchObject({ numero: 'IE-881', inversionSujetoPasivo: true, cuota: 210, cuotaDeducible: 210, fechaRecepcion: '2026-07-02' })
    expect(filas[2]).toMatchObject({ cuota: 105, cuotaDeducible: 0 })
    expect(filas[4]).toMatchObject({ retencionPct: 15, retencion: 150 })
  })

  it('bienes de inversión: amortización lineal y año final de regularización', () => {
    const datos = crmCon({
      cuentas: [cuenta({ id: 'p' })],
      facturasCompra: [compra({ id: 'pc', no: 'FC-26010', cuentaId: 'p', fecha: '2026-01-01', lineas: [linea(4000)], bienInversion: true, vidaUtil: 4 })],
    })
    const [f] = libroBienesInversion(apuntesFiscales(datos, gestionCon()), '2026-12-31')
    expect(f).toMatchObject({ base: 4000, cuotaDeducible: 840, amortizacionAnual: 1000, amortizacionAcumulada: 1000, valorNeto: 3000, regularizarHasta: 2030, bienInversionIva: true })
  })

  it('CSV con BOM, título, «;» y decimales con coma', () => {
    const csv = csvLibro(libroExpedidas(apuntes, '2026-07-01', '2026-09-30'), 'Libro de facturas expedidas · 3T 2026')
    expect(csv.startsWith('﻿"Libro de facturas expedidas · 3T 2026"\r\n')).toBe(true)
    const [, cabecera, primera] = csv.slice(1).split('\r\n')
    expect(cabecera.split(';')).toContain('"Base imponible"')
    expect(cabecera).not.toContain('docId')
    expect(primera).toContain(';1000,00;21,00;210,00;')
    expect(primera.startsWith('2026-07-10;2026-07-10;"FV-";"26001"')).toBe(true)
  })
})
