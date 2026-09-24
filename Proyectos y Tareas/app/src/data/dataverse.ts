/**
 * Repositorio sobre Dataverse (tablas loc_*).
 *
 * Implementa el mismo contrato que el resto de repositorios, así que la UI no
 * cambia. Lo que traduce esta capa:
 *
 *  - `id` es el GUID de la fila (`loc_tareaid`, `loc_miembroid`…).
 *  - `creadoEl` es `createdon`, que mantiene Dataverse.
 *  - Los enums viajan como columnas Choice (valores 4120000xx).
 *  - Las relaciones son lookups: se leen de `_loc_x_value` y se escriben con
 *    `loc_X@odata.bind`.
 *  - Lo anidado (checklist, etiquetas, filtros y columnas de vista) va como
 *    JSON en columnas de texto: siempre viaja con su registro padre.
 */
import type { Instantanea, Nuevo, Repositorio } from './repo'
import type {
  Actividad, ColumnaLista, EntidadActividad, EstadoObjetivo, EstadoProyecto, EstadoTarea,
  CanalContenido, Contenido, EstadoContenido, EstadoRecursoIA, PlataformaIA, RecursoIA, TipoRecursoIA, EstadoReunion, FiltrosVista, ItemChecklist, Miembro, Objetivo, Prioridad, Proyecto, Rol,
  Reunion, Semana, Tarea, TemaReunion, TipoVista, AgruparPor, OrdenarPor, Vista,
} from '../domain/types'
import { FILTROS_VACIOS } from '../domain/types'

import { Loc_miembrosService } from '../generated/services/Loc_miembrosService'
import { Loc_proyectosService } from '../generated/services/Loc_proyectosService'
import { Loc_semanasService } from '../generated/services/Loc_semanasService'
import { Loc_objetivosService } from '../generated/services/Loc_objetivosService'
import { Loc_tareasService } from '../generated/services/Loc_tareasService'
import { Loc_vistasService } from '../generated/services/Loc_vistasService'
import { Loc_actividadsService } from '../generated/services/Loc_actividadsService'
import { Loc_reunionsService } from '../generated/services/Loc_reunionsService'
import { Loc_contenidosService } from '../generated/services/Loc_contenidosService'
import { Loc_recursoiasService } from '../generated/services/Loc_recursoiasService'

// ─────────────────────────────────────────────── choices

function inverso<T extends string>(m: Record<T, number>): Record<number, T> {
  const r = {} as Record<number, T>
  for (const k of Object.keys(m) as T[]) r[m[k]] = k
  return r
}

const ROL: Record<Rol, number> = { socio: 412000000, colaborador: 412000001 }
const EST_PROYECTO: Record<EstadoProyecto, number> = { activo: 412000010, pausado: 412000011, cerrado: 412000012 }
const EST_OBJETIVO: Record<EstadoObjetivo, number> = { pendiente: 412000030, cumplido: 412000031 }
const EST_TAREA: Record<EstadoTarea, number> = { pendiente: 412000040, en_curso: 412000041, bloqueada: 412000042, revision: 412000043, hecha: 412000044 }
const PRIORIDAD: Record<Prioridad, number> = { alta: 412000050, media: 412000051, baja: 412000052 }
const EST_REUNION: Record<EstadoReunion, number> = { pendiente: 412000060, celebrada: 412000061, cancelada: 412000062 }
const CANAL: Record<CanalContenido, number> = { youtube: 412000070, linkedin: 412000071, instagram: 412000072, tiktok: 412000073, blog: 412000074, newsletter: 412000075, x: 412000076 }
const EST_CONTENIDO: Record<EstadoContenido, number> = { idea: 412000080, guion: 412000081, produccion: 412000082, listo: 412000083, publicado: 412000084 }
// El CRM ocupa del 100 al 222: el tipo va en el hueco del 90 y el resto abre bloque en el 300.
const TIPO_IA: Record<TipoRecursoIA, number> = { skill: 412000090, agente: 412000091, prompt: 412000092, flujo: 412000093 }
const PLATAFORMA_IA: Record<PlataformaIA, number> = { claude: 412000300, copilot_studio: 412000301, copilot_m365: 412000302, chatgpt: 412000303, power_automate: 412000304, otra: 412000305 }
const EST_IA: Record<EstadoRecursoIA, number> = { idea: 412000310, desarrollo: 412000311, uso: 412000312, retirado: 412000313 }

const DE_ROL = inverso(ROL)
const DE_EST_PROYECTO = inverso(EST_PROYECTO)
const DE_EST_OBJETIVO = inverso(EST_OBJETIVO)
const DE_EST_TAREA = inverso(EST_TAREA)
const DE_PRIORIDAD = inverso(PRIORIDAD)
const DE_EST_REUNION = inverso(EST_REUNION)
const DE_CANAL = inverso(CANAL)
const DE_TIPO_IA = inverso(TIPO_IA)
const DE_PLATAFORMA_IA = inverso(PLATAFORMA_IA)
const DE_EST_IA = inverso(EST_IA)
const DE_EST_CONTENIDO = inverso(EST_CONTENIDO)

// ─────────────────────────────────────────────── utilidades

/** Los servicios generados devuelven { data }. Si falta, la operación no trajo fila. */
function dato<T>(r: { data?: T }, donde: string): T {
  if (r?.data === undefined || r.data === null) throw new Error(`Dataverse no devolvió datos en ${donde}`)
  return r.data
}

function lista<T>(r: { data?: T[] }): T[] {
  return r?.data ?? []
}

/** Referencia para escribir un lookup. `null` limpia el valor. */
function ref(conjunto: string, id: string | null | undefined): string | null {
  return id ? `/${conjunto}(${id})` : null
}

const txt = (v: string | undefined | null): string => v ?? ''
const num = (v: number | undefined | null): number | null => (v === undefined || v === null ? null : v)
const fecha = (v: string | undefined | null): string | null => (v ? v : null)
/** Las columnas DateOnly pueden volver como fecha completa. */
const soloFecha = (v: string | undefined | null): string | null => (v ? v.slice(0, 10) : null)

function leerJson<T>(v: string | undefined | null, porDefecto: T): T {
  if (!v) return porDefecto
  try { return JSON.parse(v) as T } catch { return porDefecto }
}

/** El cliente tipa los payloads con los campos generados; aquí van objetos planos. */
type Payload = Record<string, unknown>
const comoPayload = <T>(p: Payload): T => p as T

// ─────────────────────────────────────────────── conversión de filas

/* eslint-disable @typescript-eslint/no-explicit-any */
type Fila = any

function aMiembro(f: Fila): Miembro {
  return {
    id: f.loc_miembroid,
    nombre: txt(f.loc_nombre),
    iniciales: txt(f.loc_iniciales),
    email: txt(f.loc_email),
    color: txt(f.loc_color) || '#6B6B6B',
    rol: DE_ROL[f.loc_rol] ?? 'socio',
    activo: f.loc_activo !== false,
  }
}

const deMiembro = (m: Omit<Miembro, 'id'>): Payload => ({
  loc_nombre: m.nombre, loc_iniciales: m.iniciales, loc_email: m.email,
  loc_color: m.color, loc_rol: ROL[m.rol], loc_activo: m.activo,
})

function aProyecto(f: Fila): Proyecto {
  return {
    id: f.loc_proyectoid,
    nombre: txt(f.loc_nombre),
    cliente: txt(f.loc_cliente),
    color: txt(f.loc_color) || '#6B6B6B',
    estado: DE_EST_PROYECTO[f.loc_estado] ?? 'activo',
    responsableId: f._loc_responsable_value ?? null,
    descripcion: txt(f.loc_descripcion),
    fechaInicio: soloFecha(f.loc_fechainicio),
    fechaFin: soloFecha(f.loc_fechafin),
    horasPresupuestadas: num(f.loc_horaspresupuestadas),
    creadoEl: txt(f.createdon),
  }
}

const deProyecto = (p: Omit<Proyecto, 'id' | 'creadoEl'>): Payload => ({
  loc_nombre: p.nombre, loc_cliente: p.cliente, loc_color: p.color,
  loc_estado: EST_PROYECTO[p.estado], loc_descripcion: p.descripcion,
  loc_fechainicio: p.fechaInicio, loc_fechafin: p.fechaFin,
  loc_horaspresupuestadas: p.horasPresupuestadas,
  'loc_Responsable@odata.bind': ref('loc_miembros', p.responsableId),
})

function aSemana(f: Fila): Semana {
  return { id: f.loc_semanaid, inicio: txt(f.loc_inicio) }
}

const deSemana = (s: Omit<Semana, 'id'>): Payload => ({ loc_inicio: s.inicio })

function aObjetivo(f: Fila): Objetivo {
  return {
    id: f.loc_objetivoid,
    semanaId: f._loc_semana_value ?? '',
    proyectoId: f._loc_proyecto_value ?? null,
    responsableId: f._loc_responsable_value ?? null,
    titulo: txt(f.loc_titulo),
    descripcion: txt(f.loc_descripcion),
    prioridad: DE_PRIORIDAD[f.loc_prioridad] ?? 'media',
    estado: DE_EST_OBJETIVO[f.loc_estado] ?? 'pendiente',
    orden: f.loc_orden ?? 0,
    cumplidoEl: fecha(f.loc_cumplidoel),
    creadoEl: txt(f.createdon),
  }
}

const deObjetivo = (o: Omit<Objetivo, 'id' | 'creadoEl'>): Payload => ({
  loc_titulo: o.titulo, loc_descripcion: o.descripcion,
  loc_prioridad: PRIORIDAD[o.prioridad], loc_estado: EST_OBJETIVO[o.estado],
  loc_orden: o.orden, loc_cumplidoel: o.cumplidoEl,
  'loc_Semana@odata.bind': ref('loc_semanas', o.semanaId),
  'loc_Proyecto@odata.bind': ref('loc_proyectos', o.proyectoId),
  'loc_Responsable@odata.bind': ref('loc_miembros', o.responsableId),
})

function aTarea(f: Fila): Tarea {
  return {
    id: f.loc_tareaid,
    titulo: txt(f.loc_titulo),
    descripcion: txt(f.loc_descripcion),
    proyectoId: f._loc_proyecto_value ?? null,
    objetivoId: f._loc_objetivo_value ?? null,
    asignadoId: f._loc_asignado_value ?? null,
    creadoPorId: f._loc_creadopor_value ?? '',
    estado: DE_EST_TAREA[f.loc_estado] ?? 'pendiente',
    prioridad: DE_PRIORIDAD[f.loc_prioridad] ?? 'media',
    inicio: soloFecha(f.loc_inicio),
    vence: soloFecha(f.loc_vence),
    padreId: f._loc_padre_value ?? null,
    estimadoH: num(f.loc_estimadoh),
    realH: num(f.loc_realh),
    orden: f.loc_orden ?? 0,
    ordenTodo: f.loc_ordentodo ?? 0,
    miDia: !!f.loc_midia,
    importante: !!f.loc_importante,
    personal: !!f.loc_personal,
    etiquetas: leerJson<string[]>(f.loc_etiquetas, []),
    checklist: leerJson<ItemChecklist[]>(f.loc_checklist, []),
    creadoEl: txt(f.createdon),
    completadoEl: fecha(f.loc_completadoel),
  }
}

const deTarea = (t: Omit<Tarea, 'id' | 'creadoEl'>): Payload => ({
  loc_titulo: t.titulo, loc_descripcion: t.descripcion,
  loc_estado: EST_TAREA[t.estado], loc_prioridad: PRIORIDAD[t.prioridad],
  loc_inicio: t.inicio, loc_vence: t.vence,
  loc_estimadoh: t.estimadoH, loc_realh: t.realH,
  loc_orden: t.orden, loc_ordentodo: t.ordenTodo,
  loc_midia: t.miDia, loc_importante: t.importante, loc_personal: t.personal,
  loc_etiquetas: JSON.stringify(t.etiquetas ?? []),
  loc_checklist: JSON.stringify(t.checklist ?? []),
  loc_completadoel: t.completadoEl,
  'loc_Proyecto@odata.bind': ref('loc_proyectos', t.proyectoId),
  'loc_Objetivo@odata.bind': ref('loc_objetivos', t.objetivoId),
  'loc_Asignado@odata.bind': ref('loc_miembros', t.asignadoId),
  'loc_CreadoPor@odata.bind': ref('loc_miembros', t.creadoPorId),
  'loc_Padre@odata.bind': ref('loc_tareas', t.padreId),
})

function aVista(f: Fila): Vista {
  return {
    id: f.loc_vistaid,
    nombre: txt(f.loc_nombre),
    tipo: (txt(f.loc_tipo) || 'tablero') as TipoVista,
    miembroId: f._loc_miembro_value ?? null,
    filtros: leerJson<FiltrosVista>(f.loc_filtros, { ...FILTROS_VACIOS }),
    agrupar: (txt(f.loc_agrupar) || 'ninguno') as AgruparPor,
    ordenar: (txt(f.loc_ordenar) || 'orden') as OrdenarPor,
    ordenDesc: !!f.loc_ordendesc,
    columnas: leerJson<ColumnaLista[]>(f.loc_columnas, []),
    escala: (txt(f.loc_escala) || 'semana') as Vista['escala'],
    esPredeterminada: !!f.loc_espredeterminada,
    creadoEl: txt(f.createdon),
  }
}

const deVista = (v: Omit<Vista, 'id' | 'creadoEl'>): Payload => ({
  loc_nombre: v.nombre, loc_tipo: v.tipo,
  loc_filtros: JSON.stringify(v.filtros), loc_agrupar: v.agrupar,
  loc_ordenar: v.ordenar, loc_ordendesc: v.ordenDesc,
  loc_columnas: JSON.stringify(v.columnas ?? []), loc_escala: v.escala,
  loc_espredeterminada: v.esPredeterminada,
  'loc_Miembro@odata.bind': ref('loc_miembros', v.miembroId),
})

function aActividad(f: Fila): Actividad {
  return {
    id: f.loc_actividadid,
    entidad: (txt(f.loc_entidad) || 'tarea') as EntidadActividad,
    entidadId: txt(f.loc_entidadid),
    autorId: f._loc_autor_value ?? '',
    fecha: txt(f.loc_fecha) || txt(f.createdon),
    tipo: (txt(f.loc_tipo) || 'comentario') as Actividad['tipo'],
    texto: txt(f.loc_texto),
  }
}

function aReunion(f: Fila): Reunion {
  return {
    id: f.loc_reunionid,
    titulo: txt(f.loc_titulo),
    fecha: txt(f.loc_fecha),
    duracionMin: f.loc_duracionmin ?? 60,
    lugar: txt(f.loc_lugar),
    estado: DE_EST_REUNION[f.loc_estado] ?? 'pendiente',
    notas: txt(f.loc_notas),
    temas: leerJson<TemaReunion[]>(f.loc_temas, []),
    asistentesIds: leerJson<string[]>(f.loc_asistentes, []),
    proyectoId: f._loc_proyecto_value ?? null,
    organizaId: f._loc_organiza_value ?? null,
    eventoId: txt(f.loc_eventoid) || null,
    creadoEl: txt(f.createdon),
  }
}

function aContenido(f: Fila): Contenido {
  return {
    id: f.loc_contenidoid,
    titulo: txt(f.loc_titulo),
    canal: DE_CANAL[f.loc_canal] ?? 'linkedin',
    estado: DE_EST_CONTENIDO[f.loc_estado] ?? 'idea',
    fecha: soloFecha(f.loc_fechapublicacion),
    notas: txt(f.loc_notas),
    enlace: txt(f.loc_enlace),
    responsableId: f._loc_responsable_value ?? null,
    proyectoId: f._loc_proyecto_value ?? null,
    creadoEl: txt(f.createdon),
  }
}

function aRecursoIA(f: Fila): RecursoIA {
  return {
    id: f.loc_recursoiaid,
    nombre: txt(f.loc_nombre),
    tipo: DE_TIPO_IA[f.loc_tipo] ?? 'skill',
    plataforma: DE_PLATAFORMA_IA[f.loc_plataforma] ?? 'otra',
    estado: DE_EST_IA[f.loc_estado] ?? 'idea',
    descripcion: txt(f.loc_descripcion),
    comoUsar: txt(f.loc_comousar),
    enlace: txt(f.loc_enlace),
    responsableId: f._loc_responsable_value ?? null,
    proyectoId: f._loc_proyecto_value ?? null,
    creadoEl: txt(f.createdon),
  }
}

const deRecursoIA = (r: Omit<RecursoIA, 'id' | 'creadoEl'>): Payload => ({
  loc_nombre: r.nombre, loc_tipo: TIPO_IA[r.tipo], loc_plataforma: PLATAFORMA_IA[r.plataforma],
  loc_estado: EST_IA[r.estado], loc_descripcion: r.descripcion, loc_comousar: r.comoUsar, loc_enlace: r.enlace,
  'loc_Responsable@odata.bind': ref('loc_miembros', r.responsableId),
  'loc_Proyecto@odata.bind': ref('loc_proyectos', r.proyectoId),
})

const deContenido = (c: Omit<Contenido, 'id' | 'creadoEl'>): Payload => ({
  loc_titulo: c.titulo, loc_canal: CANAL[c.canal], loc_estado: EST_CONTENIDO[c.estado],
  loc_fechapublicacion: c.fecha, loc_notas: c.notas, loc_enlace: c.enlace,
  'loc_Responsable@odata.bind': ref('loc_miembros', c.responsableId),
  'loc_Proyecto@odata.bind': ref('loc_proyectos', c.proyectoId),
})

const deReunion = (r: Omit<Reunion, 'id' | 'creadoEl'>): Payload => ({
  loc_titulo: r.titulo, loc_fecha: r.fecha, loc_duracionmin: r.duracionMin,
  loc_lugar: r.lugar, loc_estado: EST_REUNION[r.estado], loc_notas: r.notas,
  loc_temas: JSON.stringify(r.temas ?? []),
  loc_asistentes: JSON.stringify(r.asistentesIds ?? []),
  loc_eventoid: r.eventoId,
  'loc_Proyecto@odata.bind': ref('loc_proyectos', r.proyectoId),
  'loc_Organiza@odata.bind': ref('loc_miembros', r.organizaId),
})

// ─────────────────────────────────────────────── repositorio

const TOPE = 5000

export const repoDataverse: Repositorio = {
  async cargar(): Promise<Instantanea> {
    const [miembros, proyectos, semanas, objetivos, tareas, vistas, actividad, reuniones, contenidos, recursosIA] = await Promise.all([
      Loc_miembrosService.getAll({ top: TOPE }),
      Loc_proyectosService.getAll({ top: TOPE }),
      Loc_semanasService.getAll({ top: TOPE }),
      Loc_objetivosService.getAll({ top: TOPE }),
      Loc_tareasService.getAll({ top: TOPE }),
      Loc_vistasService.getAll({ top: TOPE }),
      Loc_actividadsService.getAll({ top: TOPE }),
      Loc_reunionsService.getAll({ top: TOPE }),
      Loc_contenidosService.getAll({ top: TOPE }),
      Loc_recursoiasService.getAll({ top: TOPE }),
    ])
    return {
      miembros: lista(miembros).map(aMiembro),
      proyectos: lista(proyectos).map(aProyecto),
      semanas: lista(semanas).map(aSemana),
      objetivos: lista(objetivos).map(aObjetivo),
      tareas: lista(tareas).map(aTarea),
      vistas: lista(vistas).map(aVista),
      actividad: lista(actividad).map(aActividad),
      reuniones: lista(reuniones).map(aReunion),
      contenidos: lista(contenidos).map(aContenido),
      recursosIA: lista(recursosIA).map(aRecursoIA),
    }
  },

  async crearMiembro(m) {
    const r = await Loc_miembrosService.create(comoPayload({ ...deMiembro(m), statecode: 0 }))
    return aMiembro(dato(r, 'crearMiembro'))
  },
  async actualizarMiembro(m) {
    await Loc_miembrosService.update(m.id, comoPayload(deMiembro(m)))
    return m
  },

  async crearProyecto(p: Nuevo<Proyecto>) {
    const r = await Loc_proyectosService.create(comoPayload({ ...deProyecto(p), statecode: 0 }))
    return aProyecto(dato(r, 'crearProyecto'))
  },
  async actualizarProyecto(p) {
    await Loc_proyectosService.update(p.id, comoPayload(deProyecto(p)))
    return p
  },
  async borrarProyecto(id) {
    // Los lookups quedan en RemoveLink: Dataverse deja a null tareas y objetivos.
    await Loc_proyectosService.delete(id)
  },

  async asegurarSemana(inicio) {
    const existentes = await Loc_semanasService.getAll({ filter: `loc_inicio eq '${inicio}'`, top: 1 })
    const ya = lista(existentes)[0]
    if (ya) return aSemana(ya)
    const r = await Loc_semanasService.create(comoPayload({ ...deSemana({ inicio }), statecode: 0 }))
    return aSemana(dato(r, 'asegurarSemana'))
  },
  async actualizarSemana(s) {
    await Loc_semanasService.update(s.id, comoPayload(deSemana(s)))
    return s
  },

  async crearObjetivo(o) {
    const r = await Loc_objetivosService.create(comoPayload({ ...deObjetivo(o), statecode: 0 }))
    return aObjetivo(dato(r, 'crearObjetivo'))
  },
  async actualizarObjetivo(o) {
    await Loc_objetivosService.update(o.id, comoPayload(deObjetivo(o)))
    return o
  },
  async actualizarObjetivos(os) {
    await Promise.all(os.map(o => Loc_objetivosService.update(o.id, comoPayload(deObjetivo(o)))))
    return os
  },
  async borrarObjetivo(id) {
    await Loc_objetivosService.delete(id)
  },

  async crearTarea(t) {
    const r = await Loc_tareasService.create(comoPayload({ ...deTarea(t), statecode: 0 }))
    return aTarea(dato(r, 'crearTarea'))
  },
  async actualizarTarea(t) {
    await Loc_tareasService.update(t.id, comoPayload(deTarea(t)))
    return t
  },
  async actualizarTareas(ts) {
    await Promise.all(ts.map(t => Loc_tareasService.update(t.id, comoPayload(deTarea(t)))))
    return ts
  },
  async borrarTarea(id) {
    // Las subtareas se van con su padre; el lookup autorreferenciado no cascadea.
    const hijas = await Loc_tareasService.getAll({ filter: `_loc_padre_value eq ${id}`, top: TOPE })
    await Promise.all(lista(hijas).map(h => Loc_tareasService.delete(h.loc_tareaid)))
    await Loc_tareasService.delete(id)
  },

  async crearActividad(a) {
    const r = await Loc_actividadsService.create(comoPayload({
      loc_texto: a.texto.slice(0, 500), loc_entidad: a.entidad, loc_entidadid: a.entidadId,
      loc_tipo: a.tipo, loc_fecha: new Date().toISOString(),
      'loc_Autor@odata.bind': ref('loc_miembros', a.autorId),
      statecode: 0,
    }))
    return aActividad(dato(r, 'crearActividad'))
  },

  async crearReunion(r) {
    const x = await Loc_reunionsService.create(comoPayload({ ...deReunion(r), statecode: 0 }))
    return aReunion(dato(x, 'crearReunion'))
  },
  async actualizarReunion(r) {
    await Loc_reunionsService.update(r.id, comoPayload(deReunion(r)))
    return r
  },
  async borrarReunion(id) {
    await Loc_reunionsService.delete(id)
  },

  async crearContenido(c) {
    const x = await Loc_contenidosService.create(comoPayload({ ...deContenido(c), statecode: 0 }))
    return aContenido(dato(x, 'crearContenido'))
  },
  async actualizarContenido(c) {
    await Loc_contenidosService.update(c.id, comoPayload(deContenido(c)))
    return c
  },
  async borrarContenido(id) {
    await Loc_contenidosService.delete(id)
  },

  async crearRecursoIA(r) {
    const x = await Loc_recursoiasService.create(comoPayload({ ...deRecursoIA(r), statecode: 0 }))
    return aRecursoIA(dato(x, 'crearRecursoIA'))
  },
  async actualizarRecursoIA(r) {
    await Loc_recursoiasService.update(r.id, comoPayload(deRecursoIA(r)))
    return r
  },
  async borrarRecursoIA(id) {
    await Loc_recursoiasService.delete(id)
  },

  async crearVista(v: Nuevo<Vista>) {
    const r = await Loc_vistasService.create(comoPayload({ ...deVista(v), statecode: 0 }))
    return aVista(dato(r, 'crearVista'))
  },
  async actualizarVista(v) {
    await Loc_vistasService.update(v.id, comoPayload(deVista(v)))
    return v
  },
  async borrarVista(id) {
    await Loc_vistasService.delete(id)
  },
}
