/**
 * Utilidades de fechas. Todas las fechas «de día» viajan como YYYY-MM-DD para
 * que no dependan de la zona horaria del navegador.
 */
import {
  addDays, differenceInCalendarDays, format, getISOWeek, isSameDay, parseISO, startOfWeek,
} from 'date-fns'
import { es } from 'date-fns/locale'

export function hoy(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

export function aIso(d: Date): string {
  return format(d, 'yyyy-MM-dd')
}

/** Lunes de la semana a la que pertenece la fecha. */
export function lunesDe(fecha: string | Date): string {
  const d = typeof fecha === 'string' ? parseISO(fecha) : fecha
  return aIso(startOfWeek(d, { weekStartsOn: 1 }))
}

export function sumarDias(fecha: string, dias: number): string {
  return aIso(addDays(parseISO(fecha), dias))
}

/** «Semana 38 · 14–20 sep». */
export function etiquetaSemana(lunes: string): string {
  const ini = parseISO(lunes)
  const fin = addDays(ini, 6)
  const mismoMes = ini.getMonth() === fin.getMonth()
  const rango = mismoMes
    ? `${format(ini, 'd', { locale: es })}–${format(fin, 'd MMM', { locale: es })}`
    : `${format(ini, 'd MMM', { locale: es })} – ${format(fin, 'd MMM', { locale: es })}`
  return `Semana ${getISOWeek(ini)} · ${rango}`
}

export function etiquetaSemanaCorta(lunes: string): string {
  const ini = parseISO(lunes)
  return `S${getISOWeek(ini)} · ${format(ini, 'd MMM', { locale: es })}`
}

export function fechaLarga(fecha: string): string {
  return format(parseISO(fecha), "EEEE, d 'de' MMMM", { locale: es })
}

export function fechaCorta(fecha: string): string {
  return format(parseISO(fecha), 'd MMM', { locale: es })
}

export function fechaHora(iso: string): string {
  return format(new Date(iso), "d MMM, HH:mm", { locale: es })
}

/** «Hoy», «Mañana», «Ayer», «Vence en 3 días», «Venció hace 2 días». */
export function relativoVencimiento(fecha: string): { texto: string; tono: 'vencida' | 'hoy' | 'pronto' | 'normal' } {
  const d = parseISO(fecha)
  const ahora = new Date()
  if (isSameDay(d, ahora)) return { texto: 'Hoy', tono: 'hoy' }
  const dias = differenceInCalendarDays(d, ahora)
  if (dias === 1) return { texto: 'Mañana', tono: 'pronto' }
  if (dias === -1) return { texto: 'Ayer', tono: 'vencida' }
  if (dias < 0) return { texto: `Hace ${-dias} días`, tono: 'vencida' }
  if (dias <= 3) return { texto: `En ${dias} días`, tono: 'pronto' }
  return { texto: fechaCorta(fecha), tono: 'normal' }
}

export function esVencida(fecha: string | null): boolean {
  if (!fecha) return false
  return differenceInCalendarDays(parseISO(fecha), new Date()) < 0
}

export function dentroDeSemana(fecha: string, lunes: string): boolean {
  return fecha >= lunes && fecha <= sumarDias(lunes, 6)
}

export function ahoraIso(): string {
  return new Date().toISOString()
}
