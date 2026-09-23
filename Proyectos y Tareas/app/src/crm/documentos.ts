/**
 * Documentos de venta y compra: importes de línea, totales, estado visible de
 * las facturas y numeración por series.
 */
import type { ColEntidad, EstadoFacturaVisible, FacturaCompra, FacturaVenta, LineaDocumento, RegistroBase } from './types'
import { SERIES } from './catalogos'
import { hoy } from '../domain/fechas'

export const brutoLinea = (l: LineaDocumento) => (Number(l.cantidad) || 0) * (Number(l.precio) || 0)
export const importeLinea = (l: LineaDocumento) => brutoLinea(l) * (1 - (Number(l.dto) || 0) / 100)

export interface Totales { subtotal: number; descuento: number; base: number; iva: number; total: number }

export function totales(doc: { lineas?: LineaDocumento[] } | null | undefined): Totales {
  const lineas = doc?.lineas ?? []
  const suma = (f: (l: LineaDocumento) => number) => lineas.reduce((a, l) => a + (f(l) || 0), 0)
  const subtotal = suma(brutoLinea)
  const base = suma(importeLinea)
  const iva = suma(l => importeLinea(l) * (Number(l.iva ?? 21) || 0) / 100)
  return { subtotal, descuento: subtotal - base, base, iva, total: base + iva }
}

export const totalDoc = (doc: { lineas?: LineaDocumento[] }) => totales(doc).total

/** Una factura registrada y pasada de fecha se muestra como vencida sin cambiar su estado real. */
export function estadoFactura(f: FacturaVenta | FacturaCompra): EstadoFacturaVisible {
  return f.estado === 'registrada' && f.vencimiento && f.vencimiento < hoy() ? 'vencida' : f.estado
}

export const nuevaLinea = (): LineaDocumento => ({ productoId: '', descripcion: '', cantidad: 1, unidad: '', precio: 0, dto: 0, iva: 21 })

export const copiarLineas = (lineas: LineaDocumento[] | undefined): LineaDocumento[] => (lineas ?? []).map(l => ({ ...l }))

/** Siguiente número de la serie de la colección: el mayor usado + 1. */
export function siguienteNo(col: ColEntidad, existentes: RegistroBase[]): string | undefined {
  const serie = SERIES[col]
  if (!serie) return undefined
  const [prefijo, base] = serie
  const n = existentes.reduce((m, o) => Math.max(m, parseInt(String(o.no ?? '').replace(/\D/g, ''), 10) || 0), base)
  return prefijo + (n + 1)
}
