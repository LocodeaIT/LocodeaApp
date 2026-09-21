/**
 * Sincronización de reuniones con el calendario de Outlook.
 *
 * La reunión de Dataverse manda: el evento del calendario es su reflejo. Por eso
 * cada reunión guarda el `eventoId` que devuelve Outlook, y a partir de ahí se
 * actualiza o se borra el mismo evento en vez de crear duplicados.
 *
 * Todo lo de aquí es "mejor esfuerzo": si el calendario falla, la reunión se
 * guarda igual en Dataverse. No queremos perder la reunión por un problema de
 * conector, así que los errores se avisan pero no cortan la operación.
 */
import { Office365OutlookService } from '../generated/services/Office365OutlookService'
import type { Miembro, Reunion } from '../domain/types'

/* eslint-disable @typescript-eslint/no-explicit-any */
type Cualquiera = any

/** Id del calendario predeterminado del usuario, cacheado por sesión. */
let calendarioId: string | null = null

async function calendarioPorDefecto(): Promise<string | null> {
  if (calendarioId) return calendarioId
  try {
    const r = await Office365OutlookService.CalendarGetTables()
    const tablas = ((r as Cualquiera)?.data?.value ?? []) as Cualquiera[]
    if (!tablas.length) return null
    // El primero es el calendario principal del buzón.
    calendarioId = String(tablas[0].Name ?? tablas[0].name ?? '')
    return calendarioId || null
  } catch {
    return null
  }
}

/** Outlook espera hora local sin zona: '2026-09-23T10:00:00'. */
function horaLocal(iso: string): string {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:00`
}

function fin(iso: string, minutos: number): string {
  return horaLocal(new Date(new Date(iso).getTime() + minutos * 60000).toISOString())
}

/** Los asistentes viajan como correos separados por punto y coma. */
function correos(ids: string[], miembros: Miembro[]): string {
  return ids
    .map(id => miembros.find(m => m.id === id)?.email)
    .filter((e): e is string => !!e && e.includes('@'))
    .join(';')
}

/** El orden del día se manda en el cuerpo del evento: es lo que la gente lee. */
function cuerpo(r: Reunion): string {
  if (!r.temas.length) return r.notas
  const temas = r.temas.map((t, i) => `${i + 1}. ${t.texto}`).join('\n')
  return [r.notas, '', 'Temas a tratar:', temas].filter(Boolean).join('\n')
}

function evento(r: Reunion, miembros: Miembro[]) {
  return {
    subject: r.titulo,
    start: horaLocal(r.fecha),
    end: fin(r.fecha, r.duracionMin || 60),
    timeZone: 'Romance Standard Time' as Cualquiera,
    requiredAttendees: correos(r.asistentesIds, miembros),
    body: cuerpo(r),
    location: r.lugar,
    responseRequested: true,
  }
}

/**
 * Crea el evento y devuelve su id, o null si no se pudo.
 * El id se guarda en la reunión para poder actualizarlo después.
 */
export async function crearEvento(r: Reunion, miembros: Miembro[]): Promise<string | null> {
  const cal = await calendarioPorDefecto()
  if (!cal) return null
  try {
    const res = await Office365OutlookService.V4CalendarPostItem(cal, evento(r, miembros) as Cualquiera)
    const id = (res as Cualquiera)?.data?.id
    return id ? String(id) : null
  } catch {
    return null
  }
}

/** Actualiza el evento ya creado. Si no existía, intenta crearlo. */
export async function actualizarEvento(r: Reunion, miembros: Miembro[]): Promise<string | null> {
  if (!r.eventoId) return crearEvento(r, miembros)
  const cal = await calendarioPorDefecto()
  if (!cal) return r.eventoId
  try {
    await Office365OutlookService.V4CalendarPatchItem(cal, r.eventoId, evento(r, miembros) as Cualquiera)
    return r.eventoId
  } catch {
    return r.eventoId
  }
}

/** Borra el evento del calendario. Silencioso: si ya no está, no pasa nada. */
export async function borrarEvento(eventoId: string | null): Promise<void> {
  if (!eventoId) return
  const cal = await calendarioPorDefecto()
  if (!cal) return
  try {
    await Office365OutlookService.CalendarDeleteItem(cal, eventoId)
  } catch { /* el evento ya no existe o el conector no responde */ }
}
