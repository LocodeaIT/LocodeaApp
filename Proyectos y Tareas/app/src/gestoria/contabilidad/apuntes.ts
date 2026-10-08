/**
 * Piezas comunes de los asientos: apuntes al debe o al haber, saldos por
 * cuenta, orden y numeración del diario y asiento de regularización.
 */
import type { LineaAsiento } from '../types'
import type { Asiento } from './asientos'
import { anioDe, r2 } from './desglose'

/**
 * Apunte de una cuenta. Un importe negativo (rectificativas, abonos) pasa al
 * lado contrario; un importe cero no genera apunte.
 */
export function apunte(cuenta: string, importe: number, lado: 'debe' | 'haber', concepto?: string): LineaAsiento | null {
  const x = r2(importe)
  if (!x) return null
  const alDebe = (lado === 'debe') === (x > 0)
  const l: LineaAsiento = { cuenta, debe: alDebe ? Math.abs(x) : 0, haber: alDebe ? 0 : Math.abs(x) }
  if (concepto) l.concepto = concepto
  return l
}

export const alDebe = (cuenta: string, importe: number, concepto?: string) => apunte(cuenta, importe, 'debe', concepto)
export const alHaber = (cuenta: string, importe: number, concepto?: string) => apunte(cuenta, importe, 'haber', concepto)

/** Asiento sin numerar con los apuntes no nulos; null si no queda ninguno. */
export function nuevoAsiento(
  datos: Pick<Asiento, 'id' | 'fecha' | 'concepto' | 'tipo' | 'origen'> & { automatico?: boolean },
  lineas: (LineaAsiento | null)[],
): Asiento | null {
  const ls = lineas.filter((l): l is LineaAsiento => !!l)
  if (!ls.length) return null
  return { ...datos, numero: 0, automatico: datos.automatico ?? true, lineas: ls }
}

/** Sumas del debe y del haber de un asiento. */
export function sumas(a: Pick<Asiento, 'lineas'>): { debe: number; haber: number } {
  return {
    debe: r2(a.lineas.reduce((s, l) => s + (Number(l.debe) || 0), 0)),
    haber: r2(a.lineas.reduce((s, l) => s + (Number(l.haber) || 0), 0)),
  }
}

/** Saldo deudor (debe − haber) de cada cuenta en los asientos dados. */
export function saldos(asientos: Asiento[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const a of asientos) for (const l of a.lineas) m.set(l.cuenta, (m.get(l.cuenta) ?? 0) + (Number(l.debe) || 0) - (Number(l.haber) || 0))
  for (const [k, v] of m) m.set(k, r2(v))
  return m
}

/** Orden de los asientos de un mismo día: apertura, operaciones, ajustes, IVA, impuesto, regularización y cierre. */
const PRIORIDAD: Record<string, number> = {
  apertura: 0, amortizacion: 2, periodificacion: 2, ajuste: 2, 'liquidacion-iva': 3, impuesto: 4, regularizacion: 5, cierre: 6,
}
export const prioridad = (tipo: string) => PRIORIDAD[tipo] ?? 1

/** Ordena por fecha (y por tipo dentro del día) y numera desde 1. */
export function ordenarYNumerar(asientos: Asiento[]): Asiento[] {
  return [...asientos]
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || prioridad(a.tipo) - prioridad(b.tipo))
    .map((a, i) => ({ ...a, numero: i + 1 }))
}

/** Asientos que no forman parte del resultado ni del balance del ejercicio en curso (la regularización y el cierre los anulan). */
export const esCierre = (a: Asiento) => a.tipo === 'regularizacion' || a.tipo === 'cierre'

/**
 * Regularización: salda las cuentas de los grupos 6 y 7 del ejercicio contra
 * 129 Resultado del ejercicio. No tiene en cuenta otra regularización o
 * cierre que ya esté entre los asientos.
 */
export function regularizacion(asientos: Asiento[], ejercicio: number): Asiento {
  const del = asientos.filter(a => anioDe(a.fecha) === ejercicio && !esCierre(a))
  const s = [...saldos(del).entries()].filter(([c, v]) => (c[0] === '6' || c[0] === '7') && v).sort((a, b) => a[0].localeCompare(b[0]))
  const resultado = r2(-s.reduce((t, [, v]) => t + v, 0))
  const lineas = [...s.map(([c, v]) => alHaber(c, v)), alHaber('129', resultado)].filter((l): l is LineaAsiento => !!l)
  const numero = asientos.reduce((m, a) => Math.max(m, a.numero), 0) + 1
  return {
    id: `regularizacion:${ejercicio}`, numero, fecha: `${ejercicio}-12-31`, concepto: `Regularización del ejercicio ${ejercicio}`,
    tipo: 'regularizacion', origen: { col: null, id: null }, lineas, automatico: true,
  }
}
