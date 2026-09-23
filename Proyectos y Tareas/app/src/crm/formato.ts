/**
 * Formato de importes y fechas del CRM. Las fechas de día reutilizan las
 * utilidades de domain/fechas.ts (YYYY-MM-DD, sin zona horaria).
 */
import { differenceInCalendarDays, format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { hoy } from '../domain/fechas'

// es-ES no agrupa los miles en cifras de 4 dígitos (2023 €); se fuerza para que salga 2.023 € como en Business Central
function numFmt(o: Intl.NumberFormatOptions): Intl.NumberFormat {
  try { return new Intl.NumberFormat('es-ES', { ...o, useGrouping: 'always' }) } catch { return new Intl.NumberFormat('es-ES', o) }
}
const EUR = numFmt({ style: 'currency', currency: 'EUR' })
const EUR0 = numFmt({ style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })

export const eur = (v: number | null | undefined) => EUR.format(Number(v) || 0)
export const eur0 = (v: number | null | undefined) => EUR0.format(Number(v) || 0)
/** Importes compactos para gráficos: 48,5 k€. */
export const eurK = (v: number) => Math.abs(v) >= 1000
  ? (v / 1000).toLocaleString('es-ES', { maximumFractionDigits: Math.abs(v) >= 100000 ? 0 : 1 }) + ' k€'
  : eur0(v)
export const pct = (v: number | null | undefined) => `${Number(v) || 0} %`

/** Acepta fecha de día o instante ISO. */
function aFecha(iso: string): Date {
  return iso.length === 10 ? parseISO(iso) : new Date(iso)
}

/** 23/09/2026 */
export function fecha(iso: string | null | undefined): string {
  return iso ? format(aFecha(iso), 'dd/MM/yyyy') : '—'
}

/** 10:30 (solo si el valor lleva hora). */
export function hora(iso: string | null | undefined): string {
  return iso && iso.length > 10 ? format(new Date(iso), 'HH:mm') : ''
}

export function fechaHora(iso: string | null | undefined): string {
  return iso ? fecha(iso) + (hora(iso) ? ' ' + hora(iso) : '') : '—'
}

/** Días naturales desde hoy (negativo = en el pasado). */
export function diasDesdeHoy(iso: string): number {
  return differenceInCalendarDays(aFecha(iso), new Date())
}

/** «hoy», «mañana», «ayer», «en 3 días», «hace 5 días» o la fecha. */
export function relativo(iso: string | null | undefined): string {
  if (!iso) return '—'
  const n = diasDesdeHoy(iso)
  if (n === 0) return 'hoy'
  if (n === 1) return 'mañana'
  if (n === -1) return 'ayer'
  if (n > 1 && n < 7) return `en ${n} días`
  if (n < -1 && n > -30) return `hace ${-n} días`
  return fecha(iso)
}

/** true si la fecha de día ya pasó. */
export const pasada = (dia: string | null | undefined) => !!dia && dia < hoy()

/** Nombre del mes corto: «sep». */
export const mesCorto = (d: Date) => format(d, 'MMM', { locale: es }).replace('.', '')

/** Texto normalizado para buscar sin tildes ni mayúsculas. */
export function normalizar(s: unknown): string {
  return String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

export function iniciales(n: string): string {
  return String(n || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()
}
