/**
 * Periodos fiscales: trimestres, meses, ejercicios y pagos fraccionados del
 * 202, con su clave (la misma que guarda `Presentacion.periodo`), su rango de
 * fechas y su etiqueta. También las utilidades de fechas «de día» que usa el
 * motor fiscal (en UTC, para no depender de la zona horaria del navegador).
 *
 * Fuentes:
 *  - Periodos del 303 (1T…4T, 01…12): https://sede.agenciatributaria.gob.es/Sede/todas-gestiones/impuestos-tasas/iva/modelo-303-iva-autoliquidacion_/instrucciones-2026/instrucciones-02-12-2t-4t-2026.html
 *  - Pagos fraccionados del 202 (art. 40 LIS: abril, octubre y diciembre, por los 3, 9 y 11 primeros meses):
 *    https://www.boe.es/buscar/act.php?id=BOE-A-2014-12328
 */

export interface Periodo {
  anio: number
  /** T trimestre (1–4), M mes (1–12), A año, P pago fraccionado del 202 (1–3). */
  tipo: 'T' | 'M' | 'A' | 'P'
  n: number
}

export const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

// ─────────────────────────────────────────────── fechas «de día»

const dd = (n: number) => String(n).padStart(2, '0')

/** YYYY-MM-DD a partir de año, mes (1–12, admite desbordes) y día. */
export function fechaDe(anio: number, mes: number, dia: number): string {
  const d = new Date(Date.UTC(anio, mes - 1, dia))
  return `${d.getUTCFullYear()}-${dd(d.getUTCMonth() + 1)}-${dd(d.getUTCDate())}`
}

const partes = (dia: string) => [Number(dia.slice(0, 4)), Number(dia.slice(5, 7)), Number(dia.slice(8, 10))] as const

export const sumarDiasF = (dia: string, n: number) => { const [a, m, d] = partes(dia); return fechaDe(a, m, d + n) }

/** Último día del mes (mes 1–12; admite desbordes: 14 = febrero del año siguiente). */
export function finDeMes(anio: number, mes: number): string {
  return fechaDe(anio, mes + 1, 0)
}

/** Suma meses conservando el día, recortado al último del mes (30 jun + 1 = 30 jul; 31 ene + 1 = 28 feb). */
export function sumarMeses(dia: string, n: number): string {
  const [a, m, d] = partes(dia)
  const ultimo = Number(finDeMes(a, m + n).slice(8, 10))
  return fechaDe(a, m + n, Math.min(d, ultimo))
}

/** Día de la semana: 0 domingo … 6 sábado. */
export const diaSemana = (dia: string) => { const [a, m, d] = partes(dia); return new Date(Date.UTC(a, m - 1, d)).getUTCDay() }

export const enRango = (dia: string | null | undefined, desde: string, hasta: string) => !!dia && dia.slice(0, 10) >= desde && dia.slice(0, 10) <= hasta

// ─────────────────────────────────────────────── periodos

/** '2026-3T' | '2026-09' | '2026' | '2026-2P'. */
export function clavePeriodo(p: Periodo): string {
  switch (p.tipo) {
    case 'T': return `${p.anio}-${p.n}T`
    case 'M': return `${p.anio}-${dd(p.n)}`
    case 'P': return `${p.anio}-${p.n}P`
    default: return `${p.anio}`
  }
}

/** Inversa de `clavePeriodo`; null si la clave no se reconoce. */
export function periodoDeClave(s: string): Periodo | null {
  const v = String(s ?? '').trim().toUpperCase()
  let m = /^(\d{4})-([1-4])T$/.exec(v)
  if (m) return { anio: Number(m[1]), tipo: 'T', n: Number(m[2]) }
  m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(v)
  if (m) return { anio: Number(m[1]), tipo: 'M', n: Number(m[2]) }
  m = /^(\d{4})-([1-3])P$/.exec(v)
  if (m) return { anio: Number(m[1]), tipo: 'P', n: Number(m[2]) }
  m = /^(\d{4})$/.exec(v)
  if (m) return { anio: Number(m[1]), tipo: 'A', n: 0 }
  return null
}

/** Meses que cubre cada pago fraccionado del 202 desde el 1 de enero (art. 40.3 LIS): 3, 9 y 11. */
const MESES_PAGO: Record<number, number> = { 1: 3, 2: 9, 3: 11 }

/** Rango de fechas del periodo. El 2P del 202 va de enero a septiembre, el 3P de enero a noviembre. */
export function rangoPeriodo(p: Periodo): { desde: string; hasta: string } {
  switch (p.tipo) {
    case 'T': return { desde: fechaDe(p.anio, (p.n - 1) * 3 + 1, 1), hasta: finDeMes(p.anio, p.n * 3) }
    case 'M': return { desde: fechaDe(p.anio, p.n, 1), hasta: finDeMes(p.anio, p.n) }
    case 'P': return { desde: fechaDe(p.anio, 1, 1), hasta: finDeMes(p.anio, MESES_PAGO[p.n] ?? 3) }
    default: return { desde: fechaDe(p.anio, 1, 1), hasta: fechaDe(p.anio, 12, 31) }
  }
}

/** '3T 2026', 'Septiembre 2026', 'Ejercicio 2026', '2.º pago 2026'. */
export function etiquetaPeriodo(p: Periodo): string {
  switch (p.tipo) {
    case 'T': return `${p.n}T ${p.anio}`
    case 'M': return `${MESES[p.n - 1] ?? p.n} ${p.anio}`
    case 'P': return `${p.n}.º pago ${p.anio}`
    default: return `Ejercicio ${p.anio}`
  }
}

/** Etiqueta a partir de la clave; devuelve la clave tal cual si no se reconoce. */
export const etiquetaDeClave = (clave: string) => { const p = periodoDeClave(clave); return p ? etiquetaPeriodo(p) : clave }

/** Trimestre o mes que contiene el día. */
export function periodoDeFecha(dia: string, tipo: 'T' | 'M' | 'A'): Periodo {
  const anio = Number(dia.slice(0, 4)), mes = Number(dia.slice(5, 7))
  if (tipo === 'M') return { anio, tipo, n: mes }
  if (tipo === 'A') return { anio, tipo, n: 0 }
  return { anio, tipo, n: Math.floor((mes - 1) / 3) + 1 }
}

/** Último periodo de liquidación del año (4T o diciembre): en él se puede pedir la devolución. */
export const esUltimoDelAnio = (p: Periodo) => (p.tipo === 'T' && p.n === 4) || (p.tipo === 'M' && p.n === 12)

/** Periodos del año del tipo pedido, en orden. */
export function periodosDelAnio(anio: number, tipo: Periodo['tipo']): Periodo[] {
  const n = tipo === 'T' ? 4 : tipo === 'M' ? 12 : tipo === 'P' ? 3 : 1
  return Array.from({ length: n }, (_, i) => ({ anio, tipo, n: tipo === 'A' ? 0 : i + 1 }))
}

/** Redondeo a céntimos. */
export const r2 = (n: number) => Math.round(((Number(n) || 0) + Number.EPSILON) * 100) / 100
