/**
 * Pantallas del CRM dentro de la navegación de la app y su colección. La
 * ficha abierta y el estado de cada lista viven en el contexto del CRM.
 */
import type { ColEntidad } from './types'

export type PantallaCrm =
  | 'crm-inicio' | 'crm-cuentas' | 'crm-contactos' | 'crm-potenciales' | 'crm-oportunidades' | 'crm-actividades'
  | 'crm-ofertas' | 'crm-pedidos-venta' | 'crm-facturas-venta' | 'crm-pedidos-compra' | 'crm-facturas-compra' | 'crm-productos'

export const PANTALLA_DE: Record<ColEntidad, PantallaCrm> = {
  cuentas: 'crm-cuentas', contactos: 'crm-contactos', potenciales: 'crm-potenciales', oportunidades: 'crm-oportunidades',
  actividades: 'crm-actividades', ofertas: 'crm-ofertas', pedidosVenta: 'crm-pedidos-venta', facturasVenta: 'crm-facturas-venta',
  pedidosCompra: 'crm-pedidos-compra', facturasCompra: 'crm-facturas-compra', productos: 'crm-productos',
}

export const COL_DE_PANTALLA = Object.fromEntries(Object.entries(PANTALLA_DE).map(([c, p]) => [p, c])) as Partial<Record<PantallaCrm, ColEntidad>>

export const PANTALLAS_CRM: PantallaCrm[] = ['crm-inicio', ...Object.values(PANTALLA_DE)]

export const esPantallaCrm = (p: string): p is PantallaCrm => (PANTALLAS_CRM as string[]).includes(p)

// ─────────────────────────────────────────────── enlaces (#crm/…)

/** Destino del CRM: inicio (sin colección), lista (sin id) o ficha ('nuevo' o el id). */
export interface Destino {
  col: ColEntidad | null
  id: string | null
  prefill?: Record<string, unknown> | null
}

/** La app no usa el hash; el CRM lo reserva con este prefijo. */
export const PREFIJO = '#crm/'

const tramo = (col: ColEntidad) => PANTALLA_DE[col].slice('crm-'.length)

/** #crm/inicio, #crm/cuentas o #crm/cuentas/<id> */
export function hashDe(d: Destino): string {
  if (!d.col) return PREFIJO + 'inicio'
  return PREFIJO + tramo(d.col) + (d.id ? '/' + encodeURIComponent(d.id) : '')
}

export function leerHash(): Destino | null {
  let h = ''
  try { h = location.hash } catch { return null }
  if (!h.startsWith(PREFIJO)) return null
  const [t, id] = h.slice(PREFIJO.length).split('/')
  if (t === 'inicio') return { col: null, id: null }
  const col = COL_DE_PANTALLA[('crm-' + t) as PantallaCrm]
  return col ? { col, id: id ? decodeURIComponent(id) : null } : null
}
