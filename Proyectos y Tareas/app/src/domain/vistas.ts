/**
 * Filtrado, ordenación y agrupación de tareas según una Vista. Es lo que
 * comparten Tablero, Lista, Calendario y Gantt.
 */
import type { AgruparPor, FiltrosVista, Miembro, OrdenarPor, Proyecto, Objetivo, Tarea, Vista } from './types'
import { ETIQUETA_ESTADO_TAREA, ETIQUETA_PRIORIDAD, ORDEN_ESTADOS_TAREA } from './types'
import type { Nuevo } from '../data/repo'

export interface Catalogos {
  miembros: Miembro[]
  proyectos: Proyecto[]
  objetivos: Objetivo[]
}

export function filtrarTareas(tareas: Tarea[], f: FiltrosVista, yoId: string | null): Tarea[] {
  const q = f.texto.trim().toLowerCase()
  return tareas.filter(t =>
    !t.personal
    && (f.mostrarSubtareas || !t.padreId)
    && (!f.proyectoId || t.proyectoId === f.proyectoId)
    && (!f.asignadoId || t.asignadoId === f.asignadoId)
    && (!f.soloMias || t.asignadoId === yoId)
    && (!f.ocultarHechas || t.estado !== 'hecha')
    && (!f.estados.length || f.estados.includes(t.estado))
    && (!f.prioridades.length || f.prioridades.includes(t.prioridad))
    && (!q || t.titulo.toLowerCase().includes(q) || t.etiquetas.some(e => e.toLowerCase().includes(q))),
  )
}

const PESO_PRIORIDAD = { alta: 0, media: 1, baja: 2 }

export function ordenarTareas(tareas: Tarea[], ordenar: OrdenarPor, desc: boolean): Tarea[] {
  const cmp = (a: Tarea, b: Tarea): number => {
    switch (ordenar) {
      case 'orden': return a.orden - b.orden
      case 'vence': return (a.vence ?? '9999').localeCompare(b.vence ?? '9999')
      case 'prioridad': return PESO_PRIORIDAD[a.prioridad] - PESO_PRIORIDAD[b.prioridad]
      case 'titulo': return a.titulo.localeCompare(b.titulo, 'es')
      case 'creadoEl': return a.creadoEl.localeCompare(b.creadoEl)
    }
  }
  const lista = [...tareas].sort((a, b) => cmp(a, b) || a.orden - b.orden)
  return desc ? lista.reverse() : lista
}

export interface Grupo {
  clave: string
  nombre: string
  color: string
  tareas: Tarea[]
  /** Cambio que hay que aplicar a una tarea al soltarla en este grupo. */
  cambio: Partial<Tarea>
}

export function claveGrupo(t: Tarea, agrupar: AgruparPor): string {
  switch (agrupar) {
    case 'ninguno': return 'todas'
    case 'estado': return t.estado
    case 'proyecto': return t.proyectoId ?? 'sin'
    case 'asignado': return t.asignadoId ?? 'sin'
    case 'prioridad': return t.prioridad
    case 'objetivo': return t.objetivoId ?? 'sin'
  }
}

/** Devuelve los grupos en orden, incluidos los vacíos (para poder soltar en ellos). */
export function agruparTareas(tareas: Tarea[], agrupar: AgruparPor, cat: Catalogos): Grupo[] {
  const base = (clave: string, nombre: string, color: string, cambio: Partial<Tarea>): Grupo => ({ clave, nombre, color, cambio, tareas: [] })
  let grupos: Grupo[]
  switch (agrupar) {
    case 'ninguno': grupos = [base('todas', 'Todas las tareas', 'var(--bronze)', {})]; break
    case 'estado': grupos = ORDEN_ESTADOS_TAREA.map(e => base(e, ETIQUETA_ESTADO_TAREA[e], COLOR_ESTADO[e], { estado: e })); break
    case 'proyecto': grupos = [...cat.proyectos.filter(p => p.estado !== 'cerrado').map(p => base(p.id, p.nombre, p.color, { proyectoId: p.id })), base('sin', 'Sin proyecto', '#9e9e9e', { proyectoId: null })]; break
    case 'asignado': grupos = [...cat.miembros.filter(m => m.activo).map(m => base(m.id, m.nombre, m.color, { asignadoId: m.id })), base('sin', 'Sin asignar', '#9e9e9e', { asignadoId: null })]; break
    case 'prioridad': grupos = (['alta', 'media', 'baja'] as const).map(p => base(p, `Prioridad ${ETIQUETA_PRIORIDAD[p].toLowerCase()}`, COLOR_PRIORIDAD[p], { prioridad: p })); break
    case 'objetivo': grupos = [...cat.objetivos.map(o => base(o.id, o.titulo, '#5b5fc7', { objetivoId: o.id })), base('sin', 'Sin objetivo', '#9e9e9e', { objetivoId: null })]; break
  }
  const porClave = new Map(grupos.map(g => [g.clave, g]))
  for (const t of tareas) {
    const g = porClave.get(claveGrupo(t, agrupar))
    if (g) g.tareas.push(t)
    else {
      // p. ej. proyecto cerrado u objetivo de otra semana: se crea el grupo al vuelo
      const nuevo = base(claveGrupo(t, agrupar), nombreGrupoSuelto(t, agrupar, cat), '#9e9e9e', {})
      nuevo.tareas.push(t)
      grupos.push(nuevo)
      porClave.set(nuevo.clave, nuevo)
    }
  }
  return grupos
}

function nombreGrupoSuelto(t: Tarea, agrupar: AgruparPor, cat: Catalogos): string {
  if (agrupar === 'proyecto') return cat.proyectos.find(p => p.id === t.proyectoId)?.nombre ?? 'Otro'
  if (agrupar === 'objetivo') return cat.objetivos.find(o => o.id === t.objetivoId)?.titulo ?? 'Otro'
  if (agrupar === 'asignado') return cat.miembros.find(m => m.id === t.asignadoId)?.nombre ?? 'Otro'
  return 'Otro'
}

// Colores del sistema locodea., por token: así siguen al tema y a la marca blanca.
export const COLOR_ESTADO: Record<Tarea['estado'], string> = { pendiente: 'var(--gris-calido)', en_curso: 'var(--bronze)', bloqueada: 'var(--danger)', revision: 'var(--purple)', hecha: 'var(--ok)' }
export const COLOR_PRIORIDAD: Record<Tarea['prioridad'], string> = { alta: 'var(--danger)', media: 'var(--warn)', baja: 'var(--gris-calido)' }

export function vistaNueva(tipo: Vista['tipo'], miembroId: string | null): Nuevo<Vista> {
  return {
    nombre: { tablero: 'Nuevo tablero', lista: 'Nueva lista', calendario: 'Nuevo calendario', gantt: 'Nuevo Gantt' }[tipo],
    tipo, miembroId,
    filtros: { texto: '', proyectoId: null, asignadoId: null, estados: [], prioridades: [], ocultarHechas: tipo === 'lista', soloMias: false, mostrarSubtareas: tipo === 'lista' || tipo === 'gantt' },
    agrupar: tipo === 'tablero' ? 'estado' : tipo === 'gantt' ? 'proyecto' : 'ninguno',
    ordenar: tipo === 'tablero' ? 'orden' : 'vence', ordenDesc: false,
    columnas: ['proyecto', 'asignado', 'estado', 'prioridad', 'vence', 'subtareas'],
    escala: tipo === 'gantt' ? 'dia' : 'mes',
    esPredeterminada: false,
  }
}

export function vistasIguales(a: Vista, b: Vista): boolean {
  return JSON.stringify({ ...a, creadoEl: '' }) === JSON.stringify({ ...b, creadoEl: '' })
}
