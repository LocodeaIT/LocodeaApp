/**
 * Libros registro del IVA: facturas expedidas, facturas recibidas y bienes de
 * inversión, con una fila por tipo de IVA de cada factura, y su exportación a
 * CSV para Excel (separador «;», decimales con coma y BOM, como `csvTrimestre`).
 *
 * Contenido mínimo (RIVA arts. 63, 64 y 65): número y serie, fechas de expedición y de operación, NIF y nombre del
 * tercero, base, tipo, cuota y, en recibidas, la fecha de recepción y el número de recepción. La calificación de la
 * operación (S1, S2, N1, N2, E1–E6) sigue las claves de los libros de la AEAT y del SII.
 *  https://www.boe.es/buscar/act.php?id=BOE-A-1992-28925
 *  Regularización de bienes de inversión: cuatro años naturales siguientes al de adquisición (nueve en inmuebles),
 *  art. 107 LIVA; bienes de valor inferior a 3.005,06 € no son de inversión a efectos del IVA, art. 108.Dos.5.º.
 *  https://www.boe.es/buscar/act.php?id=BOE-A-1992-28740
 */
import type { ApunteFiscal } from './apuntes'
import { apuntesDelPeriodo, esRectificativa } from './apuntes'
import { UMBRAL_BIEN_INVERSION } from './modelos'
import { r2, sumarDiasF } from './periodos'

/** S1 sujeta y no exenta; S2 con inversión del sujeto pasivo; N2 no sujeta por localización; E1 exenta art. 20; E2 exportación; E5 entrega intracomunitaria. */
export type Calificacion = 'S1' | 'S2' | 'N1' | 'N2' | 'E1' | 'E2' | 'E5' | 'E6'

export interface FilaExpedida {
  fechaExpedicion: string
  fechaOperacion: string
  serie: string
  numero: string
  tipoFactura: string
  rectificada: string
  nifDestinatario: string
  codigoPais: string
  nombreDestinatario: string
  tipoOperacion: string
  calificacion: Calificacion
  base: number
  tipo: number
  cuota: number
  recargo: number
  retencion: number
  total: number
  estado: string
  docId: string
}

export interface FilaRecibida {
  fechaExpedicion: string
  fechaRecepcion: string
  registro: string
  numero: string
  nifEmisor: string
  codigoPais: string
  nombreEmisor: string
  tipoOperacion: string
  inversionSujetoPasivo: boolean
  bienInversion: boolean
  base: number
  tipo: number
  cuota: number
  cuotaDeducible: number
  recargo: number
  retencionPct: number
  retencion: number
  total: number
  origen: string
  estado: string
  docId: string
}

export interface FilaBienInversion {
  fechaAdquisicion: string
  fechaInicioUtilizacion: string
  registro: string
  numero: string
  nombreEmisor: string
  nifEmisor: string
  /** Valor de adquisición (base imponible). */
  base: number
  cuota: number
  cuotaDeducible: number
  /** A efectos del IVA solo si vale 3.005,06 € o más (art. 108 LIVA). */
  bienInversionIva: boolean
  /** Último año en que hay que regularizar la deducción (año de adquisición + 4). */
  regularizarHasta: number
  prorrata: number
  vidaUtil: number
  amortizacionAnual: number
  amortizacionAcumulada: number
  valorNeto: number
  docId: string
}

/** 'FV-26001' → ['FV-', '26001']. */
export function serieYNumero(numero: string): [string, string] {
  const m = /^(.*?)(\d+)$/.exec(String(numero ?? '').trim())
  return m ? [m[1], m[2]] : ['', String(numero ?? '')]
}

export function calificacion(a: ApunteFiscal): Calificacion {
  switch (a.tipoOperacion) {
    case 'interior': case 'ue-particular': return 'S1'
    case 'isp-interior': return 'S2'
    case 'ue-empresa': return a.baseBienes ? 'E5' : 'N2'
    case 'fuera-ue': return a.baseBienes ? 'E2' : 'N2'
    case 'ue-oss': return 'N2'
    case 'exenta': return 'E1'
    default: return 'S1'
  }
}

const ordenar = <T extends { fechaExpedicion: string }>(f: T[], k: (x: T) => string) => f.sort((a, b) => a.fechaExpedicion.localeCompare(b.fechaExpedicion) || k(a).localeCompare(k(b)))

/** Libro registro de facturas expedidas: ventas con devengo entre `desde` y `hasta`, una fila por tipo. */
export function libroExpedidas(apuntes: ApunteFiscal[], desde: string, hasta: string): FilaExpedida[] {
  const filas: FilaExpedida[] = []
  const porId = new Map(apuntes.filter(a => a.origen === 'venta').map(a => [a.docId, a]))
  for (const a of apuntesDelPeriodo(apuntes, desde, hasta)) {
    if (a.origen !== 'venta') continue
    const [serie, numero] = serieYNumero(a.numero)
    const desglose = a.desglose.length ? a.desglose : [{ tipo: 0, base: 0, cuota: 0 }]
    for (const l of desglose) {
      filas.push({
        fechaExpedicion: a.fechaExpedicion, fechaOperacion: a.fechaDevengo, serie, numero, tipoFactura: a.tipoFactura ?? '',
        rectificada: esRectificativa(a) && a.rectificadaId ? porId.get(a.rectificadaId)?.numero ?? '' : '',
        nifDestinatario: a.terceroNif, codigoPais: a.codigoPais, nombreDestinatario: a.terceroNombre, tipoOperacion: a.tipoOperacion,
        calificacion: calificacion(a), base: l.base, tipo: l.tipo, cuota: l.cuota, recargo: 0, retencion: a.retencion, total: a.total,
        estado: a.estado, docId: a.docId,
      })
    }
  }
  return ordenar(filas, f => f.serie + f.numero.padStart(12, '0'))
}

/** Libro registro de facturas recibidas: compras y gastos con fecha de recepción entre `desde` y `hasta`. */
export function libroRecibidas(apuntes: ApunteFiscal[], desde: string, hasta: string): FilaRecibida[] {
  const filas: FilaRecibida[] = []
  for (const a of apuntesDelPeriodo(apuntes, desde, hasta)) {
    if (a.origen === 'venta') continue
    const proporcion = a.cuota ? a.cuotaDeducible / a.cuota : 0
    for (const l of a.desglose.length ? a.desglose : [{ tipo: 0, base: 0, cuota: 0 }]) {
      filas.push({
        fechaExpedicion: a.fechaExpedicion, fechaRecepcion: a.fechaDevengo, registro: a.registro, numero: a.numero,
        nifEmisor: a.terceroNif, codigoPais: a.codigoPais, nombreEmisor: a.terceroNombre, tipoOperacion: a.tipoOperacion,
        inversionSujetoPasivo: a.inversionSujetoPasivo, bienInversion: a.bienInversion, base: l.base, tipo: l.tipo, cuota: l.cuota,
        cuotaDeducible: r2(l.cuota * proporcion), recargo: 0, retencionPct: a.retencionPct, retencion: a.retencion, total: a.total,
        origen: a.origen === 'gasto' ? 'Gasto' : 'Factura de compra', estado: a.estado, docId: a.docId,
      })
    }
  }
  return ordenar(filas, f => f.registro)
}

/** Libro de bienes de inversión hasta una fecha: amortización lineal por días según la vida útil. */
export function libroBienesInversion(apuntes: ApunteFiscal[], hasta: string): FilaBienInversion[] {
  return apuntes
    .filter(a => a.origen !== 'venta' && a.bienInversion && a.fechaDevengo <= hasta)
    .map(a => {
      const vida = a.vidaUtil > 0 ? a.vidaUtil : 0
      const anual = vida ? r2(a.base / vida) : 0
      const dias = Math.max(0, Math.round((Date.parse(sumarDiasF(hasta, 1)) - Date.parse(a.fechaDevengo)) / 86400000))
      const acumulada = vida ? r2(Math.min(a.base, a.base * dias / (365 * vida))) : 0
      return {
        fechaAdquisicion: a.fechaExpedicion, fechaInicioUtilizacion: a.fechaDevengo, registro: a.registro, numero: a.numero,
        nombreEmisor: a.terceroNombre, nifEmisor: a.terceroNif, base: a.base, cuota: a.cuota, cuotaDeducible: a.cuotaDeducible,
        bienInversionIva: Math.abs(a.base) >= UMBRAL_BIEN_INVERSION, regularizarHasta: Number(a.fechaDevengo.slice(0, 4)) + 4, prorrata: 100,
        vidaUtil: vida, amortizacionAnual: anual, amortizacionAcumulada: acumulada, valorNeto: r2(a.base - acumulada), docId: a.docId,
      }
    })
    .sort((a, b) => a.fechaInicioUtilizacion.localeCompare(b.fechaInicioUtilizacion))
}

// ─────────────────────────────────────────────── CSV

export const ETIQUETAS_LIBRO: Record<string, string> = {
  fechaExpedicion: 'Fecha de expedición', fechaOperacion: 'Fecha de operación', fechaRecepcion: 'Fecha de recepción',
  fechaAdquisicion: 'Fecha de adquisición', fechaInicioUtilizacion: 'Inicio de utilización', serie: 'Serie', numero: 'Número',
  registro: 'N.º de recepción', tipoFactura: 'Tipo de factura', rectificada: 'Factura rectificada',
  nifDestinatario: 'NIF destinatario', nombreDestinatario: 'Destinatario', nifEmisor: 'NIF emisor', nombreEmisor: 'Emisor',
  codigoPais: 'País', tipoOperacion: 'Tipo de operación', calificacion: 'Calificación', inversionSujetoPasivo: 'Inversión del sujeto pasivo',
  bienInversion: 'Bien de inversión', bienInversionIva: 'Bien de inversión (IVA)', base: 'Base imponible', tipo: 'Tipo IVA %',
  cuota: 'Cuota IVA', cuotaDeducible: 'Cuota deducible', recargo: 'Recargo de equivalencia', retencionPct: 'Retención %',
  retencion: 'Retención IRPF', total: 'Total factura', origen: 'Origen', estado: 'Estado', regularizarHasta: 'Regularizar hasta',
  prorrata: 'Prorrata %', vidaUtil: 'Vida útil (años)', amortizacionAnual: 'Amortización anual', amortizacionAcumulada: 'Amortización acumulada',
  valorNeto: 'Valor neto',
}

/** Columnas que no se exportan (ids internos). */
const OCULTAS = ['docId']
/** Columnas numéricas que son enteros (sin decimales). */
const ENTERAS = ['regularizarHasta']

/** CSV del libro con título en la primera línea: «;», decimales con coma, CRLF y BOM para Excel en español. */
export function csvLibro(filas: object[], titulo: string): string {
  const txt = (s: unknown) => `"${String(s ?? '').replace(/"/g, '""')}"`
  const claves = filas.length ? Object.keys(filas[0]).filter(k => !OCULTAS.includes(k)) : []
  const celda = (k: string, v: unknown) => {
    if (typeof v === 'number') return ENTERAS.includes(k) ? String(v) : v.toFixed(2).replace('.', ',')
    if (typeof v === 'boolean') return v ? 'Sí' : 'No'
    if (v == null) return ''
    return /^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? String(v) : txt(v)
  }
  const lineas = filas.map(f => claves.map(k => celda(k, (f as Record<string, unknown>)[k])).join(';'))
  return '﻿' + [txt(titulo), claves.map(k => txt(ETIQUETAS_LIBRO[k] ?? k)).join(';'), ...lineas].join('\r\n')
}
