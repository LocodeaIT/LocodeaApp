/**
 * Repositorio sobre Supabase (PostgreSQL).
 *
 * Implementa el mismo contrato que el resto de repositorios, así que la UI no
 * cambia. Lo único que traduce esta capa:
 *
 *  - La base usa snake_case y el dominio camelCase.
 *  - `id` es el uuid que genera Postgres; `creadoEl` es `creado_el`.
 *  - Los estados y prioridades son enums nativos de Postgres, así que viajan
 *    como las mismas cadenas que ya usan los tipos de TypeScript: sin mapeo.
 *  - `etiquetas` es text[] y `checklist`, `filtros` y `columnas` son jsonb.
 *
 * El esquema está en ../../../supabase/schema.sql.
 */
import type { Instantanea, Nuevo, Repositorio } from './repo'
import type {
  Actividad, ColumnaLista, FiltrosVista, ItemChecklist, Miembro, Objetivo,
  Proyecto, Semana, Tarea, Vista,
} from '../domain/types'
import { FILTROS_VACIOS } from '../domain/types'
import { supabase } from './cliente'

/* eslint-disable @typescript-eslint/no-explicit-any */
type Fila = any

/** Cualquier error de Supabase corta la operación con un mensaje legible. */
function comprobar<T>(r: { data: T | null; error: { message: string } | null }, donde: string): T {
  if (r.error) throw new Error(`${donde}: ${r.error.message}`)
  if (r.data === null) throw new Error(`${donde}: sin datos`)
  return r.data
}

const txt = (v: unknown): string => (typeof v === 'string' ? v : '')
const num = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v))
/** Las columnas `date` vuelven como YYYY-MM-DD; las `timestamptz` como ISO. */
const fecha = (v: unknown): string | null => (typeof v === 'string' && v ? v : null)

// ─────────────────────────────────────────────── filas → dominio

function aMiembro(f: Fila): Miembro {
  return {
    id: f.id,
    nombre: txt(f.nombre),
    iniciales: txt(f.iniciales),
    email: txt(f.email),
    color: txt(f.color) || '#6B6B6B',
    rol: f.rol ?? 'socio',
    activo: f.activo !== false,
  }
}

const deMiembro = (m: Omit<Miembro, 'id'>) => ({
  nombre: m.nombre, iniciales: m.iniciales, email: m.email, color: m.color,
  rol: m.rol, activo: m.activo,
})

function aProyecto(f: Fila): Proyecto {
  return {
    id: f.id,
    nombre: txt(f.nombre),
    cliente: txt(f.cliente),
    color: txt(f.color) || '#6B6B6B',
    estado: f.estado ?? 'activo',
    responsableId: f.responsable_id ?? null,
    descripcion: txt(f.descripcion),
    fechaInicio: fecha(f.fecha_inicio),
    fechaFin: fecha(f.fecha_fin),
    horasPresupuestadas: num(f.horas_presupuestadas),
    creadoEl: txt(f.creado_el),
  }
}

const deProyecto = (p: Omit<Proyecto, 'id' | 'creadoEl'>) => ({
  nombre: p.nombre, cliente: p.cliente, color: p.color, estado: p.estado,
  responsable_id: p.responsableId, descripcion: p.descripcion,
  fecha_inicio: p.fechaInicio, fecha_fin: p.fechaFin,
  horas_presupuestadas: p.horasPresupuestadas,
})

function aSemana(f: Fila): Semana {
  return { id: f.id, inicio: txt(f.inicio) }
}

const deSemana = (s: Omit<Semana, 'id'>) => ({ inicio: s.inicio })

function aObjetivo(f: Fila): Objetivo {
  return {
    id: f.id,
    semanaId: f.semana_id ?? '',
    proyectoId: f.proyecto_id ?? null,
    responsableId: f.responsable_id ?? '',
    titulo: txt(f.titulo),
    descripcion: txt(f.descripcion),
    prioridad: f.prioridad ?? 'media',
    estado: f.estado ?? 'pendiente',
    orden: f.orden ?? 0,
    cumplidoEl: fecha(f.cumplido_el),
    creadoEl: txt(f.creado_el),
  }
}

const deObjetivo = (o: Omit<Objetivo, 'id' | 'creadoEl'>) => ({
  semana_id: o.semanaId, proyecto_id: o.proyectoId, responsable_id: o.responsableId,
  titulo: o.titulo, descripcion: o.descripcion, prioridad: o.prioridad, estado: o.estado,
  orden: o.orden, cumplido_el: o.cumplidoEl,
})

function aTarea(f: Fila): Tarea {
  return {
    id: f.id,
    titulo: txt(f.titulo),
    descripcion: txt(f.descripcion),
    proyectoId: f.proyecto_id ?? null,
    objetivoId: f.objetivo_id ?? null,
    asignadoId: f.asignado_id ?? null,
    creadoPorId: f.creado_por_id ?? '',
    estado: f.estado ?? 'pendiente',
    prioridad: f.prioridad ?? 'media',
    inicio: fecha(f.inicio),
    vence: fecha(f.vence),
    padreId: f.padre_id ?? null,
    estimadoH: num(f.estimado_h),
    realH: num(f.real_h),
    orden: f.orden ?? 0,
    ordenTodo: f.orden_todo ?? 0,
    miDia: !!f.mi_dia,
    importante: !!f.importante,
    personal: !!f.personal,
    etiquetas: Array.isArray(f.etiquetas) ? f.etiquetas : [],
    checklist: Array.isArray(f.checklist) ? (f.checklist as ItemChecklist[]) : [],
    creadoEl: txt(f.creado_el),
    completadoEl: fecha(f.completado_el),
  }
}

const deTarea = (t: Omit<Tarea, 'id' | 'creadoEl'>) => ({
  titulo: t.titulo, descripcion: t.descripcion,
  proyecto_id: t.proyectoId, objetivo_id: t.objetivoId,
  asignado_id: t.asignadoId, creado_por_id: t.creadoPorId || null,
  estado: t.estado, prioridad: t.prioridad,
  inicio: t.inicio, vence: t.vence, padre_id: t.padreId,
  estimado_h: t.estimadoH, real_h: t.realH,
  orden: t.orden, orden_todo: t.ordenTodo,
  mi_dia: t.miDia, importante: t.importante, personal: t.personal,
  etiquetas: t.etiquetas ?? [], checklist: t.checklist ?? [],
  completado_el: t.completadoEl,
})

function aVista(f: Fila): Vista {
  return {
    id: f.id,
    nombre: txt(f.nombre),
    tipo: f.tipo ?? 'tablero',
    miembroId: f.miembro_id ?? null,
    filtros: (f.filtros && typeof f.filtros === 'object' ? f.filtros : { ...FILTROS_VACIOS }) as FiltrosVista,
    agrupar: f.agrupar ?? 'ninguno',
    ordenar: f.ordenar ?? 'orden',
    ordenDesc: !!f.orden_desc,
    columnas: Array.isArray(f.columnas) ? (f.columnas as ColumnaLista[]) : [],
    escala: f.escala ?? 'semana',
    esPredeterminada: !!f.es_predeterminada,
    creadoEl: txt(f.creado_el),
  }
}

const deVista = (v: Omit<Vista, 'id' | 'creadoEl'>) => ({
  nombre: v.nombre, tipo: v.tipo, miembro_id: v.miembroId,
  filtros: v.filtros, agrupar: v.agrupar, ordenar: v.ordenar,
  orden_desc: v.ordenDesc, columnas: v.columnas ?? [],
  escala: v.escala, es_predeterminada: v.esPredeterminada,
})

function aActividad(f: Fila): Actividad {
  return {
    id: f.id,
    entidad: f.entidad ?? 'tarea',
    entidadId: f.entidad_id ?? '',
    autorId: f.autor_id ?? '',
    fecha: txt(f.fecha),
    tipo: f.tipo ?? 'comentario',
    texto: txt(f.texto),
  }
}

// ─────────────────────────────────────────────── repositorio

export const repoSupabase: Repositorio = {
  async cargar(): Promise<Instantanea> {
    const [miembros, proyectos, semanas, objetivos, tareas, vistas, actividad] = await Promise.all([
      supabase.from('miembro').select('*').order('nombre'),
      supabase.from('proyecto').select('*').order('creado_el'),
      supabase.from('semana').select('*').order('inicio'),
      supabase.from('objetivo').select('*').order('orden'),
      supabase.from('tarea').select('*').order('orden'),
      supabase.from('vista').select('*').order('creado_el'),
      supabase.from('actividad').select('*').order('fecha'),
    ])
    return {
      miembros: comprobar(miembros, 'cargar miembros').map(aMiembro),
      proyectos: comprobar(proyectos, 'cargar proyectos').map(aProyecto),
      semanas: comprobar(semanas, 'cargar semanas').map(aSemana),
      objetivos: comprobar(objetivos, 'cargar objetivos').map(aObjetivo),
      tareas: comprobar(tareas, 'cargar tareas').map(aTarea),
      vistas: comprobar(vistas, 'cargar vistas').map(aVista),
      actividad: comprobar(actividad, 'cargar actividad').map(aActividad),
    }
  },

  async crearMiembro(m) {
    const r = await supabase.from('miembro').insert(deMiembro(m)).select().single()
    return aMiembro(comprobar(r, 'crearMiembro'))
  },
  async actualizarMiembro(m) {
    const r = await supabase.from('miembro').update(deMiembro(m)).eq('id', m.id).select().single()
    return aMiembro(comprobar(r, 'actualizarMiembro'))
  },

  async crearProyecto(p: Nuevo<Proyecto>) {
    const r = await supabase.from('proyecto').insert(deProyecto(p)).select().single()
    return aProyecto(comprobar(r, 'crearProyecto'))
  },
  async actualizarProyecto(p) {
    const r = await supabase.from('proyecto').update(deProyecto(p)).eq('id', p.id).select().single()
    return aProyecto(comprobar(r, 'actualizarProyecto'))
  },
  async borrarProyecto(id) {
    // Las claves ajenas están en `on delete set null`: tareas y objetivos se quedan sin proyecto.
    const r = await supabase.from('proyecto').delete().eq('id', id)
    if (r.error) throw new Error(`borrarProyecto: ${r.error.message}`)
  },

  async asegurarSemana(inicio) {
    const existente = await supabase.from('semana').select('*').eq('inicio', inicio).maybeSingle()
    if (existente.error) throw new Error(`asegurarSemana: ${existente.error.message}`)
    if (existente.data) return aSemana(existente.data)

    const r = await supabase.from('semana').insert({ inicio }).select().single()
    // Si otra pestaña la creó a la vez, el índice único la rechaza: se relee.
    if (r.error) {
      const otra = await supabase.from('semana').select('*').eq('inicio', inicio).single()
      return aSemana(comprobar(otra, 'asegurarSemana'))
    }
    return aSemana(r.data)
  },
  async actualizarSemana(s) {
    const r = await supabase.from('semana').update(deSemana(s)).eq('id', s.id).select().single()
    return aSemana(comprobar(r, 'actualizarSemana'))
  },

  async crearObjetivo(o) {
    const r = await supabase.from('objetivo').insert(deObjetivo(o)).select().single()
    return aObjetivo(comprobar(r, 'crearObjetivo'))
  },
  async actualizarObjetivo(o) {
    const r = await supabase.from('objetivo').update(deObjetivo(o)).eq('id', o.id).select().single()
    return aObjetivo(comprobar(r, 'actualizarObjetivo'))
  },
  async actualizarObjetivos(os) {
    if (os.length === 0) return os
    // upsert en lote: una sola ida y vuelta para reordenar o cerrar la semana.
    const filas = os.map(o => ({ id: o.id, ...deObjetivo(o) }))
    const r = await supabase.from('objetivo').upsert(filas).select()
    return comprobar(r, 'actualizarObjetivos').map(aObjetivo)
  },
  async borrarObjetivo(id) {
    const r = await supabase.from('objetivo').delete().eq('id', id)
    if (r.error) throw new Error(`borrarObjetivo: ${r.error.message}`)
  },

  async crearTarea(t) {
    const r = await supabase.from('tarea').insert(deTarea(t)).select().single()
    return aTarea(comprobar(r, 'crearTarea'))
  },
  async actualizarTarea(t) {
    const r = await supabase.from('tarea').update(deTarea(t)).eq('id', t.id).select().single()
    return aTarea(comprobar(r, 'actualizarTarea'))
  },
  async actualizarTareas(ts) {
    if (ts.length === 0) return ts
    const filas = ts.map(t => ({ id: t.id, ...deTarea(t) }))
    const r = await supabase.from('tarea').upsert(filas).select()
    return comprobar(r, 'actualizarTareas').map(aTarea)
  },
  async borrarTarea(id) {
    // Las subtareas se van con su padre: lo hace `on delete cascade` en la base.
    const r = await supabase.from('tarea').delete().eq('id', id)
    if (r.error) throw new Error(`borrarTarea: ${r.error.message}`)
  },

  async crearActividad(a) {
    const r = await supabase.from('actividad').insert({
      entidad: a.entidad, entidad_id: a.entidadId, autor_id: a.autorId || null,
      tipo: a.tipo, texto: a.texto,
    }).select().single()
    return aActividad(comprobar(r, 'crearActividad'))
  },

  async crearVista(v: Nuevo<Vista>) {
    const r = await supabase.from('vista').insert(deVista(v)).select().single()
    return aVista(comprobar(r, 'crearVista'))
  },
  async actualizarVista(v) {
    const r = await supabase.from('vista').update(deVista(v)).eq('id', v.id).select().single()
    return aVista(comprobar(r, 'actualizarVista'))
  },
  async borrarVista(id) {
    const r = await supabase.from('vista').delete().eq('id', id)
    if (r.error) throw new Error(`borrarVista: ${r.error.message}`)
  },
}
