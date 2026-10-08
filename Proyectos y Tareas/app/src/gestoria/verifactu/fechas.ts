/**
 * Fechas de Verifactu: la fecha, hora y huso de generación del registro
 * (FechaHoraHusoGenRegistro, ISO 8601 con desfase) y las fechas de día en el
 * formato dd-mm-aaaa que piden el XML, la huella y el QR.
 *
 * Fuentes:
 *  - Especificaciones de la huella, ejemplos (2024-01-01T19:20:30+01:00 y 01-01-2024):
 *    https://www.agenciatributaria.es/static_files/AEAT_Desarrolladores/EEDD/IVA/VERI-FACTU/Veri-Factu_especificaciones_huella_hash_registros.pdf
 *  - Diseño de registro (el huso es el que usa el sistema al generar el registro):
 *    https://www.agenciatributaria.es/static_files/AEAT_Desarrolladores/EEDD/IVA/VERI-FACTU/DsRegistroVeriFactu.xlsx
 *  - SuministroInformacion.xsd, tipo «fecha» (\d{2}-\d{2}-\d{4}).
 */

/** Zona horaria del sistema de facturación de Locodea (península). */
export const ZONA_VERIFACTU = 'Europe/Madrid'

const dd = (n: number) => String(n).padStart(2, '0')

const formateador = new Intl.DateTimeFormat('en-US', {
  timeZone: ZONA_VERIFACTU, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
})

interface Partes { anio: number; mes: number; dia: number; hora: number; minuto: number; segundo: number }

/** Fecha y hora de pared en Madrid. */
function partesMadrid(d: Date): Partes {
  const p: Record<string, string> = {}
  for (const x of formateador.formatToParts(d)) p[x.type] = x.value
  return { anio: +p.year, mes: +p.month, dia: +p.day, hora: +p.hour % 24, minuto: +p.minute, segundo: +p.second }
}

/** Desfase de Madrid respecto a UTC en minutos: 60 en invierno, 120 en verano. */
export function desfaseMadrid(d: Date): number {
  const p = partesMadrid(d)
  const comoUtc = Date.UTC(p.anio, p.mes - 1, p.dia, p.hora, p.minuto, p.segundo)
  return Math.round((comoUtc - Math.floor(d.getTime() / 1000) * 1000) / 60000)
}

/** Instante en hora de Madrid con su desfase, sin milisegundos: 2027-01-04T10:15:00+01:00. */
export function fechaHoraHuso(d: Date): string {
  if (Number.isNaN(d.getTime())) throw new Error('Fecha y hora de generación no válida')
  const p = partesMadrid(d)
  const desfase = desfaseMadrid(d)
  const abs = Math.abs(desfase)
  const huso = `${desfase < 0 ? '-' : '+'}${dd(Math.floor(abs / 60))}:${dd(abs % 60)}`
  return `${p.anio}-${dd(p.mes)}-${dd(p.dia)}T${dd(p.hora)}:${dd(p.minuto)}:${dd(p.segundo)}${huso}`
}

/** Día (YYYY-MM-DD) que es en Madrid en ese instante. */
export function diaMadrid(d: Date): string {
  const p = partesMadrid(d)
  return `${p.anio}-${dd(p.mes)}-${dd(p.dia)}`
}

/** YYYY-MM-DD (o un ISO completo) → dd-mm-aaaa. Si ya viene como dd-mm-aaaa, la deja igual. */
export function ddmmaaaa(dia: string): string {
  const s = String(dia ?? '').trim()
  if (/^\d{2}-\d{2}-\d{4}$/.test(s)) return s
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  if (!m) throw new Error(`Fecha no válida: «${dia}» (se esperaba YYYY-MM-DD)`)
  return `${m[3]}-${m[2]}-${m[1]}`
}

/** El día existe en el calendario (descarta 2026-02-30). */
export function diaValido(dia: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dia ?? ''))
  if (!m) return false
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]))
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3]
}

/** Formato ISO 8601 con desfase obligatorio, como FechaHoraHusoGenRegistro. */
export const esFechaHoraHuso = (s: string) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/.test(String(s ?? ''))
