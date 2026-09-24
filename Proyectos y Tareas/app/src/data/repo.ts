/**
 * Contrato de acceso a datos. La UI solo conoce esta interfaz.
 *
 * La implementacion viva es `repoDataverse` (./dataverse.ts), que habla con las
 * tablas loc_* del entorno Locodea PROD a traves de los servicios generados por
 * `pa app add data-source` en ../generated.
 *
 * El esquema se crea con los scripts de despliegue; el modelo de dominio que
 * esas tablas reflejan esta en ../domain/types.ts.
 */
import type { Actividad, Contenido, Miembro, Objetivo, Proyecto, RecursoIA, Reunion, Semana, Tarea, Vista } from '../domain/types'

export interface Instantanea {
  miembros: Miembro[]
  proyectos: Proyecto[]
  semanas: Semana[]
  objetivos: Objetivo[]
  tareas: Tarea[]
  actividad: Actividad[]
  vistas: Vista[]
  reuniones: Reunion[]
  contenidos: Contenido[]
  recursosIA: RecursoIA[]
}

export type Nuevo<T> = Omit<T, 'id' | 'creadoEl'>

export interface Repositorio {
  /** Carga inicial completa. */
  cargar(): Promise<Instantanea>

  crearMiembro(m: Omit<Miembro, 'id'>): Promise<Miembro>
  actualizarMiembro(m: Miembro): Promise<Miembro>

  crearProyecto(p: Nuevo<Proyecto>): Promise<Proyecto>
  actualizarProyecto(p: Proyecto): Promise<Proyecto>
  borrarProyecto(id: string): Promise<void>

  /** Devuelve la semana cuyo lunes es `inicio`, creándola si no existe. */
  asegurarSemana(inicio: string): Promise<Semana>
  actualizarSemana(s: Semana): Promise<Semana>

  crearObjetivo(o: Nuevo<Objetivo>): Promise<Objetivo>
  actualizarObjetivo(o: Objetivo): Promise<Objetivo>
  /** Actualización en lote (reordenar, cerrar semana…). */
  actualizarObjetivos(os: Objetivo[]): Promise<Objetivo[]>
  borrarObjetivo(id: string): Promise<void>

  crearTarea(t: Nuevo<Tarea>): Promise<Tarea>
  actualizarTarea(t: Tarea): Promise<Tarea>
  actualizarTareas(ts: Tarea[]): Promise<Tarea[]>
  borrarTarea(id: string): Promise<void>

  crearActividad(a: Omit<Actividad, 'id' | 'fecha'>): Promise<Actividad>

  crearReunion(r: Nuevo<Reunion>): Promise<Reunion>
  actualizarReunion(r: Reunion): Promise<Reunion>
  borrarReunion(id: string): Promise<void>

  crearContenido(c: Nuevo<Contenido>): Promise<Contenido>
  actualizarContenido(c: Contenido): Promise<Contenido>
  borrarContenido(id: string): Promise<void>

  crearRecursoIA(r: Nuevo<RecursoIA>): Promise<RecursoIA>
  actualizarRecursoIA(r: RecursoIA): Promise<RecursoIA>
  borrarRecursoIA(id: string): Promise<void>

  crearVista(v: Nuevo<Vista>): Promise<Vista>
  actualizarVista(v: Vista): Promise<Vista>
  borrarVista(id: string): Promise<void>
}

export function nuevoId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}
