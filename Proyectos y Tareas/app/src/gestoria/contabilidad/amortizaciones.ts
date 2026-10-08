/**
 * Amortización lineal de los bienes de inversión (facturas de compra marcadas
 * como bien de inversión): cuota del ejercicio = valor × días de uso en el
 * ejercicio / 365 / vida útil, hasta agotar el valor.
 */
import type { CrmInstantanea } from '../../crm/types'
import { anioDe, desgloseCompra, facturaCuenta, fechaCompra, r2 } from './desglose'

export interface FilaAmortizacion {
  facturaId: string
  descripcion: string
  /** Cuenta del bien: 217 (equipos) o 206 (aplicaciones informáticas). */
  cuenta: string
  /** Cuenta de amortización acumulada (281 o 280) y de dotación (681 o 680). */
  cuentaAcumulada: string
  cuentaDotacion: string
  /** Precio de adquisición: base + IVA no deducible. */
  valor: number
  /** Fecha de puesta en funcionamiento: la de recepción de la factura. */
  inicio: string
  vidaUtil: number
  cuotaEjercicio: number
  /** Amortización acumulada al cierre del ejercicio (incluida la del ejercicio). */
  acumulada: number
  pendiente: number
}

/**
 * Vida útil por defecto si la factura no la trae: el periodo mínimo de la
 * tabla de coeficientes del art. 12.1.a LIS (equipos para procesos de
 * información 25 % → 4 años; sistemas y programas informáticos 33 % → 3 años).
 */
// Comprobar: la vida útil contable puede ser mayor; la fiscal no puede bajar del coeficiente máximo de la tabla.
export const vidaUtilPorDefecto = (cuenta: string) => cuenta === '206' ? 3 : 4

const diaNum = (d: string) => Math.round(Date.parse(d + 'T00:00:00Z') / 86400000)

/** Días de uso del bien dentro del año (como máximo 365, para que un año bisiesto no amortice de más). */
function diasDeUso(inicio: string, anio: number): number {
  const desde = inicio > `${anio}-01-01` ? inicio : `${anio}-01-01`
  const hasta = `${anio}-12-31`
  if (desde > hasta) return 0
  return Math.min(365, diaNum(hasta) - diaNum(desde) + 1)
}

/** Cuadro de amortización de los bienes de inversión al cierre del ejercicio, un bien (y cuenta) por fila. */
export function cuadroAmortizacion(crm: CrmInstantanea, ejercicio: number): FilaAmortizacion[] {
  const filas: FilaAmortizacion[] = []
  for (const f of crm.facturasCompra) {
    if (!f.bienInversion || !facturaCuenta(f)) continue
    const inicio = fechaCompra(f)
    const anio0 = anioDe(inicio)
    if (!anio0 || anio0 > ejercicio) continue
    for (const g of desgloseCompra(f).grupos) {
      if (g.valor <= 0) continue
      const vida = Number(f.vidaUtil) > 0 ? Number(f.vidaUtil) : vidaUtilPorDefecto(g.cuenta)
      let acumulada = 0, cuota = 0
      for (let anio = anio0; anio <= ejercicio; anio++) {
        const q = Math.max(0, Math.min(r2(g.valor * diasDeUso(inicio, anio) / 365 / vida), r2(g.valor - acumulada)))
        acumulada = r2(acumulada + q)
        if (anio === ejercicio) cuota = q
      }
      const intangible = g.cuenta.startsWith('20')
      filas.push({
        facturaId: f.id, descripcion: `${g.descripcion} (${f.noProveedor || f.no})`, cuenta: g.cuenta,
        cuentaAcumulada: intangible ? '280' : '281', cuentaDotacion: intangible ? '680' : '681',
        valor: g.valor, inicio, vidaUtil: vida, cuotaEjercicio: cuota, acumulada, pendiente: r2(g.valor - acumulada),
      })
    }
  }
  return filas.sort((a, b) => a.inicio.localeCompare(b.inicio) || a.descripcion.localeCompare(b.descripcion))
}
