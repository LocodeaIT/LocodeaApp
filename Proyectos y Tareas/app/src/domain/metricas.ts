/**
 * Cálculos de análisis: cumplimiento de objetivos, carga por miembro, avance
 * de proyectos… Todo puro, sin estado, para poder usarlo desde cualquier
 * pantalla y probarlo aparte.
 */
import type { Miembro, Objetivo, Proyecto, Semana, Tarea } from './types'
import { dentroDeSemana, esVencida, lunesDe } from './fechas'

export interface ResumenSemana {
  semana: Semana
  total: number
  cumplidos: number
  pendientes: number
  /** cumplidos / total, o null si la semana no tiene objetivos. */
  cumplimiento: number | null
}

export function resumenSemana(semana: Semana, objetivos: Objetivo[], responsableId?: string): ResumenSemana {
  const mios = objetivos.filter(o => o.semanaId === semana.id && (!responsableId || o.responsableId === responsableId))
  const cumplidos = mios.filter(o => o.estado === 'cumplido').length
  return {
    semana,
    total: mios.length,
    cumplidos,
    pendientes: mios.length - cumplidos,
    cumplimiento: mios.length ? Math.round((cumplidos / mios.length) * 100) : null,
  }
}

/** Avance de un objetivo a partir de sus tareas enlazadas (0-100). */
export function avanceObjetivo(objetivo: Objetivo, tareas: Tarea[]): { hechas: number; total: number; pct: number } {
  if (objetivo.estado === 'cumplido') return { hechas: 0, total: 0, pct: 100 }
  const propias = tareas.filter(t => t.objetivoId === objetivo.id)
  const hechas = propias.filter(t => t.estado === 'hecha').length
  return { hechas, total: propias.length, pct: propias.length ? Math.round((hechas / propias.length) * 100) : 0 }
}

export interface CargaMiembro {
  miembro: Miembro
  abiertas: number
  enCurso: number
  vencidas: number
  hechasSemana: number
  horasEstimadas: number
  horasReales: number
}

export function cargaPorMiembro(miembros: Miembro[], tareas: Tarea[], lunes: string): CargaMiembro[] {
  return miembros.filter(m => m.activo).map(m => {
    const suyas = tareas.filter(t => t.asignadoId === m.id && !t.personal)
    const abiertas = suyas.filter(t => t.estado !== 'hecha')
    return {
      miembro: m,
      abiertas: abiertas.length,
      enCurso: suyas.filter(t => t.estado === 'en_curso').length,
      vencidas: abiertas.filter(t => esVencida(t.vence)).length,
      hechasSemana: suyas.filter(t => t.completadoEl && dentroDeSemana(t.completadoEl.slice(0, 10), lunes)).length,
      horasEstimadas: abiertas.reduce((s, t) => s + (t.estimadoH ?? 0), 0),
      horasReales: suyas.reduce((s, t) => s + (t.realH ?? 0), 0),
    }
  })
}

export interface SaludProyecto {
  proyecto: Proyecto
  total: number
  hechas: number
  vencidas: number
  pct: number
  horasEstimadas: number
  horasReales: number
  objetivosAbiertos: number
}

export function saludProyectos(proyectos: Proyecto[], tareas: Tarea[], objetivos: Objetivo[]): SaludProyecto[] {
  return proyectos.map(p => {
    const suyas = tareas.filter(t => t.proyectoId === p.id)
    const hechas = suyas.filter(t => t.estado === 'hecha').length
    return {
      proyecto: p,
      total: suyas.length,
      hechas,
      vencidas: suyas.filter(t => t.estado !== 'hecha' && esVencida(t.vence)).length,
      pct: suyas.length ? Math.round((hechas / suyas.length) * 100) : 0,
      horasEstimadas: suyas.reduce((s, t) => s + (t.estimadoH ?? 0), 0),
      horasReales: suyas.reduce((s, t) => s + (t.realH ?? 0), 0),
      objetivosAbiertos: objetivos.filter(o => o.proyectoId === p.id && o.estado === 'pendiente').length,
    }
  })
}

/** Serie de cumplimiento por semana y miembro, de la más antigua a la más reciente. */
export function serieCumplimiento(semanas: Semana[], objetivos: Objetivo[], miembros: Miembro[], ultimas = 8) {
  const ordenadas = [...semanas].sort((a, b) => a.inicio.localeCompare(b.inicio)).slice(-ultimas)
  return ordenadas.map(s => {
    const fila: Record<string, string | number | null> = { semana: s.inicio }
    fila.equipo = resumenSemana(s, objetivos).cumplimiento
    for (const m of miembros) fila[m.id] = resumenSemana(s, objetivos, m.id).cumplimiento
    return fila
  })
}

/** Tareas hechas por semana (velocidad), últimas N semanas. */
export function serieVelocidad(tareas: Tarea[], miembros: Miembro[], ultimas = 8) {
  const lunesActual = lunesDe(new Date())
  const filas = []
  for (let i = ultimas - 1; i >= 0; i--) {
    const d = new Date(lunesActual)
    d.setDate(d.getDate() - i * 7)
    const lunes = lunesDe(d)
    const fila: Record<string, string | number> = { semana: lunes }
    for (const m of miembros) {
      fila[m.id] = tareas.filter(t => t.asignadoId === m.id && !t.personal && t.completadoEl && dentroDeSemana(t.completadoEl.slice(0, 10), lunes)).length
    }
    filas.push(fila)
  }
  return filas
}

export function tareasPorEstado(tareas: Tarea[]) {
  const visibles = tareas.filter(t => !t.personal)
  const cuenta = (e: Tarea['estado']) => visibles.filter(t => t.estado === e).length
  return [
    { estado: 'pendiente', nombre: 'Por hacer', valor: cuenta('pendiente') },
    { estado: 'en_curso', nombre: 'En curso', valor: cuenta('en_curso') },
    { estado: 'bloqueada', nombre: 'Bloqueadas', valor: cuenta('bloqueada') },
    { estado: 'revision', nombre: 'En revisión', valor: cuenta('revision') },
    { estado: 'hecha', nombre: 'Hechas', valor: cuenta('hecha') },
  ]
}
