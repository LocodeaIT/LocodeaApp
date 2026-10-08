/**
 * Avisos del CRM a otros módulos. El CRM registra las facturas; la Gestoría
 * escucha cuándo se emite o se anula una de venta para crear su registro de
 * Verifactu. Así el CRM no depende de la Gestoría (que va dentro de su
 * proveedor) y la Gestoría se entera en el momento.
 */
import type { FacturaVenta } from './types'

export type EventoFactura = { tipo: 'registrada' | 'anulada'; factura: FacturaVenta }
type Oyente = (e: EventoFactura) => void | Promise<void>

const oyentes = new Set<Oyente>()

/** Se suscribe a las facturas de venta emitidas o anuladas. Devuelve la función para darse de baja. */
export function alCambiarFacturaVenta(fn: Oyente): () => void {
  oyentes.add(fn)
  return () => { oyentes.delete(fn) }
}

/** Lo llama el CRM después de guardar la factura. Un oyente que falla no impide los demás. */
export async function avisarFacturaVenta(e: EventoFactura): Promise<void> {
  for (const fn of oyentes) {
    try { await fn(e) } catch (err) { console.error(err) }
  }
}
