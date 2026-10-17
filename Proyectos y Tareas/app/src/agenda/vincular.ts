/**
 * Casar una reunión del calendario con el cliente del CRM y decidir qué citas
 * hay que crear o actualizar. Todo puro: sin red, sin estado, con pruebas.
 *
 * Una reunión es «con clientes» cuando tiene algún asistente de fuera del
 * equipo. El cliente se busca por los correos de esos asistentes, de lo más
 * seguro a lo menos:
 *
 *   1. correo exacto de un contacto,
 *   2. correo exacto de un cliente potencial sin calificar,
 *   3. correo exacto de una cuenta,
 *   4. dominio de la empresa (web o correo de la cuenta, de sus contactos o del
 *      potencial), salvo los de correo gratuito (gmail, outlook…), que no dicen
 *      de qué empresa es nadie.
 */
import type { Miembro } from '../domain/types'
import type { ActividadCrm, ColReferente, CrmInstantanea } from '../crm/types'
import type { Asistente, EventoAgenda, Vinculo } from './tipos'

/** Dominios de correo personal: compartirlos no hace a dos personas de la misma empresa. */
export const DOMINIOS_GENERICOS = new Set([
  'gmail.com', 'googlemail.com', 'hotmail.com', 'hotmail.es', 'outlook.com', 'outlook.es', 'live.com', 'live.es', 'msn.com',
  'yahoo.com', 'yahoo.es', 'icloud.com', 'me.com', 'aol.com', 'proton.me', 'protonmail.com', 'gmx.com', 'gmx.es', 'telefonica.net', 'movistar.es',
])

const limpio = (s: string) => s.trim().toLowerCase()

/**
 * Solo se leen calendarios de cuentas de Locodea. Alguien del equipo puede
 * tener también cuenta en un cliente (Jesús en Ortoalresa): esas reuniones no
 * son de Locodea y no entran, aunque la cuenta se comparta o el miembro tenga
 * ese correo apuntado.
 */
export const DOMINIO_LOCODEA = 'locodea.com'
export const esCuentaLocodea = (email: string | null | undefined) => limpio(email ?? '').endsWith('@' + DOMINIO_LOCODEA)

/** El miembro del equipo dueño de un calendario: por su correo de Locodea, nunca por el nombre. */
export function miembroDelCalendario(propietario: string | null | undefined, miembros: Miembro[]): string | null {
  if (!esCuentaLocodea(propietario)) return null
  return miembros.find(m => esCuentaLocodea(m.email) && limpio(m.email) === limpio(propietario ?? ''))?.id ?? null
}

export function dominio(texto: string): string {
  const t = limpio(texto)
  if (!t) return ''
  if (t.includes('@')) return t.split('@').pop() ?? ''
  // una web: «https://www.empresa.es/contacto» → «empresa.es»
  return t.replace(/^[a-z]+:\/\//, '').replace(/^www\./, '').split(/[/?#:]/)[0]
}

/** Dominios del equipo: los de los correos de los miembros, y siempre locodea.com. */
export function dominiosInternos(miembros: Miembro[]): Set<string> {
  const s = new Set(['locodea.com'])
  for (const m of miembros) { const d = dominio(m.email); if (d && m.email.includes('@')) s.add(d) }
  return s
}

/** «a@x.com; b@y.com;» → asistentes sin repetir, marcando los del equipo. */
export function asistentesDe(listas: (string | undefined)[], internos: Set<string>): Asistente[] {
  const vistos = new Set<string>()
  const r: Asistente[] = []
  for (const l of listas) for (const parte of (l ?? '').split(/[;,]/)) {
    const email = limpio(parte)
    if (!email.includes('@') || vistos.has(email)) continue
    vistos.add(email)
    r.push({ email, interno: internos.has(dominio(email)) })
  }
  return r
}

export const externos = (e: Pick<EventoAgenda, 'asistentes'>) => e.asistentes.filter(a => !a.interno)

export const conClientes = (e: Pick<EventoAgenda, 'asistentes' | 'cancelado'>) => !e.cancelado && externos(e).length > 0

/** Busca el registro del CRM de la reunión, o null si nadie de fuera está en el CRM. */
export function vincular(e: Pick<EventoAgenda, 'asistentes'>, d: CrmInstantanea): Vinculo | null {
  const fuera = externos(e).map(a => a.email)
  if (!fuera.length) return null
  const igual = (a: string, b: string) => !!a && limpio(a) === b

  for (const email of fuera) {
    const c = d.contactos.find(x => igual(x.email, email))
    if (c) return { col: 'contactos', id: c.id, cuentaId: c.cuentaId, por: 'correo', email }
  }
  for (const email of fuera) {
    const p = d.potenciales.find(x => igual(x.email, email) && x.estado !== 'calificado')
    if (p) return { col: 'potenciales', id: p.id, cuentaId: p.cuentaId, por: 'correo', email }
  }
  for (const email of fuera) {
    const a = d.cuentas.find(x => igual(x.email, email))
    if (a) return { col: 'cuentas', id: a.id, cuentaId: a.id, por: 'correo', email }
  }
  // un potencial ya calificado vive ahora en su cuenta
  for (const email of fuera) {
    const p = d.potenciales.find(x => igual(x.email, email) && x.cuentaId)
    if (p?.cuentaId) return { col: 'cuentas', id: p.cuentaId, cuentaId: p.cuentaId, por: 'correo', email }
  }

  for (const email of fuera) {
    const dom = dominio(email)
    if (!dom || DOMINIOS_GENERICOS.has(dom)) continue
    const a = d.cuentas.find(x => dominio(x.web) === dom || dominio(x.email) === dom)
    if (a) return { col: 'cuentas', id: a.id, cuentaId: a.id, por: 'dominio', email }
    const c = d.contactos.find(x => x.cuentaId && dominio(x.email) === dom)
    if (c?.cuentaId) return { col: 'cuentas', id: c.cuentaId, cuentaId: c.cuentaId, por: 'dominio', email }
    const p = d.potenciales.find(x => x.estado !== 'calificado' && (dominio(x.email) === dom || dominio(x.web) === dom))
    if (p) return { col: 'potenciales', id: p.id, cuentaId: p.cuentaId, por: 'dominio', email }
  }
  return null
}

/** Une los eventos de varios calendarios: la misma reunión en el de Marco y en el de Jesús es una. */
export function unirEventos(porCalendario: { miembroId: string | null; eventos: Omit<EventoAgenda, 'miembrosIds'>[] }[]): EventoAgenda[] {
  const m = new Map<string, EventoAgenda>()
  for (const { miembroId, eventos } of porCalendario) for (const e of eventos) {
    const ya = m.get(e.id)
    if (!ya) { m.set(e.id, { ...e, miembrosIds: miembroId ? [miembroId] : [] }); continue }
    if (miembroId && !ya.miembrosIds.includes(miembroId)) ya.miembrosIds.push(miembroId)
    // si alguien lo tiene cancelado y otro no, manda el que lo organiza: nos quedamos con el no cancelado
    if (ya.cancelado && !e.cancelado) Object.assign(ya, { ...e, miembrosIds: ya.miembrosIds })
  }
  return [...m.values()].sort((a, b) => a.inicio.localeCompare(b.inicio))
}

// ─────────────────────────────────────────────── citas del CRM

const p2 = (n: number) => String(n).padStart(2, '0')
const diaLocal = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`
const horaLocal = (d: Date) => `${p2(d.getHours())}:${p2(d.getMinutes())}`

/** Quién lleva la cita: quien la organiza si es del equipo; si no, el primero en cuyo calendario está. */
export function propietarioDe(e: EventoAgenda, miembros: Miembro[]): string | null {
  const org = miembros.find(m => m.email && limpio(m.email) === limpio(e.organizador))
  return org?.id ?? e.miembrosIds[0] ?? null
}

export function descripcionCita(e: EventoAgenda, miembros: Miembro[]): string {
  const ini = new Date(e.inicio), fin = new Date(e.fin)
  const cuando = e.todoElDia
    ? ini.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }) + ', todo el día'
    : `${ini.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}, ${horaLocal(ini)}–${horaLocal(fin)}`
  const equipo = e.miembrosIds.map(id => miembros.find(m => m.id === id)?.nombre).filter(Boolean).join(', ')
  const datos = [
    `Cuándo: ${cuando}`,
    e.lugar && `Dónde: ${e.lugar}`,
    `Con: ${externos(e).map(a => a.email).join(', ')}`,
    equipo && `Del equipo: ${equipo}`,
    e.enlace && `Abrir en Outlook: ${e.enlace}`,
  ].filter(Boolean)
  return ['Reunión del calendario de Outlook. Se actualiza sola al sincronizar: las notas, mejor en la escala de tiempo.', '', ...datos].join('\n')
}

export interface PlanSincronizacion {
  crear: ActividadCrm[]
  actualizar: ActividadCrm[]
  /** Reuniones con gente de fuera que no está en el CRM. */
  sinVincular: EventoAgenda[]
}

/**
 * Qué citas crear o tocar para que el CRM refleje las reuniones con clientes.
 *
 * - Una cita por reunión (por iCalUId), aunque esté en tres calendarios.
 * - Si alguien cambió a mano a qué registro se refiere la cita, se respeta.
 * - Una cita abierta cuya reunión ya terminó se da por completada.
 * - Si la reunión se canceló o desapareció del calendario antes de celebrarse,
 *   la cita se cancela; solo cuando se han podido leer todos los calendarios
 *   (`completo`), para no cancelar nada por un fallo de conexión.
 */
export function planSincronizacion(
  eventos: EventoAgenda[], d: CrmInstantanea, miembros: Miembro[],
  opciones: { ahora: string; desde: string; hasta: string; completo: boolean; nuevoId: () => string },
): PlanSincronizacion {
  const { ahora, desde, hasta, completo, nuevoId } = opciones
  const porEvento = new Map(d.actividades.filter(a => a.eventoId).map(a => [a.eventoId!, a]))
  const plan: PlanSincronizacion = { crear: [], actualizar: [], sinVincular: [] }
  const vistos = new Set<string>()

  for (const e of eventos) {
    if (!externos(e).length) continue
    vistos.add(e.id)
    const ya = porEvento.get(e.id)
    const ini = new Date(e.inicio)
    const terminada = e.fin <= ahora
    const base = {
      asunto: (e.titulo || 'Reunión').slice(0, 300),
      fecha: diaLocal(ini),
      hora: e.todoElDia ? '' : horaLocal(ini),
      descripcion: descripcionCita(e, miembros),
    }

    if (!ya) {
      if (e.cancelado) continue
      const v = vincular(e, d)
      if (!v) { plan.sinVincular.push(e); continue }
      plan.crear.push({
        id: nuevoId(), creadoEl: ahora, actualizadoEl: ahora, ...base, tipo: 'cita', eventoId: e.id,
        referenteTipo: v.col as ColReferente, referenteId: v.id, cuentaId: v.cuentaId,
        propietarioId: propietarioDe(e, miembros), prioridad: 'normal',
        estado: terminada ? 'completada' : 'abierta', completadaEl: terminada ? e.fin : null,
      })
      continue
    }

    const cambio: ActividadCrm = { ...ya, ...base }
    // una cita que alguien dejó sin registro se vuelve a intentar casar
    if (!ya.referenteId) {
      const v = vincular(e, d)
      if (v) Object.assign(cambio, { referenteTipo: v.col, referenteId: v.id, cuentaId: v.cuentaId })
    }
    if (e.cancelado && ya.estado === 'abierta') cambio.estado = 'cancelada'
    else if (!e.cancelado && ya.estado === 'abierta' && terminada) Object.assign(cambio, { estado: 'completada', completadaEl: e.fin })
    else if (!e.cancelado && ya.estado === 'cancelada' && !terminada) cambio.estado = 'abierta'
    if (distinta(ya, cambio)) plan.actualizar.push(cambio)
  }

  // citas de reuniones que ya no están en ningún calendario
  if (completo) for (const a of porEvento.values()) {
    if (vistos.has(a.eventoId!) || a.estado !== 'abierta' || !a.fecha) continue
    const instante = new Date(`${a.fecha}T${a.hora || '00:00'}`).toISOString()
    if (instante >= desde && instante < hasta && instante > ahora) plan.actualizar.push({ ...a, estado: 'cancelada' })
  }
  return plan
}

const CAMPOS: (keyof ActividadCrm)[] = ['asunto', 'fecha', 'hora', 'descripcion', 'estado', 'completadaEl', 'referenteTipo', 'referenteId', 'cuentaId']
const distinta = (a: ActividadCrm, b: ActividadCrm) => CAMPOS.some(k => (a[k] ?? null) !== (b[k] ?? null))
