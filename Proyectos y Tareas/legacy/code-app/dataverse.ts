/**
 * Repositorio sobre Dataverse (tablas loc_*).
 *
 * Implementa el mismo contrato que `repoLocal`, así que la UI no cambia. Las
 * diferencias con el modelo de dominio se resuelven aquí:
 *
 *  - `id`      es el GUID de la fila (`loc_tareaid`, `loc_miembroid`…).
 *  - `creadoEl` es `createdon`, que mantiene Dataverse.
 *  - Los enums viajan como columnas Choice (valores 4120000xx).
 *  - Las relaciones son lookups: se leen de `_loc_x_value` y se escriben con
 *    `loc_X@odata.bind`.
 *  - Lo anidado (checklist, etiquetas, filtros y columnas de vista) va como
 *    JSON en columnas de texto: siempre viaja con su registro padre.
 */
import type { Instantanea, Nuevo, Repositorio } from './repo'
import type {
  Actividad, ColumnaLista, EntidadActividad, EstadoObjetivo, EstadoProyecto, EstadoSemana,
  EstadoTarea, FiltrosVista, ItemChecklist, Miembro, Objetivo, Prioridad, Proyecto, Rol,
  Semana, Tarea, TipoVista, AgruparPor, OrdenarPor, Vista,
} from '../domain/types'
import { FILTROS_VACIOS } from '../domain/types'

import { Loc_miembrosService } from '../generated/services/Loc_miembrosService'
import { Loc_proyectosService } from '../generated/services/Loc_proyectosService'
import { Loc_semanasService } from '../generated/services/Loc_semanasService'
import { Loc_objetivosService } from '../generated/services/Loc_objetivosService'
import { Loc_tareasService } from '../generated/services/Loc_tareasService'
import { Loc_vistasService } from '../generated/services/Loc_vistasService'
import { Loc_actividadsService } from '../generated/services/Loc_actividadsService'

// ─────────────────────────────────────────────── choices

function inverso<T extends string>(m: Record<T, number>): Record<number, T> {
  const r = {} as Record<number, T>
  for (const k of Object.keys(m) as T[]) r[m[k]] = k
  return r
}

const ROL: Record<Rol, number> = { socio: 412000000, colaborador: 412000001 }
const EST_PROYECTO: Record<EstadoProyecto, number> = { activo: 412000010, pausado: 412000011, cerrado: 412000012 }
const EST_SEMANA: Record<EstadoSemana, number> = { planificacion: 412000020, propuesta: 412000021, aceptada: 412000022, cerrada: 412000023 }
const EST_OBJETIVO: Record<EstadoObjetivo, number> = { propuesto: 412000030, aceptado: 412000031, rechazado: 412000032, cumplido: 412000033, no_cumplido: 412000034 }
const EST_TAREA: Record<EstadoTarea, number> = { pendiente: 412000040, en_curso: 412000041, bloqueada: 412000042, revision: 412000043, hecha: 412000044 }
const PRIORIDAD: Record<Prioridad, number> = { alta: 412000050, media: 412000051, baja: 412000052 }

const DE_ROL = inverso(ROL)
const DE_EST_PROYECTO = inverso(EST_PROYECTO)
const DE_EST_SEMANA = inverso(EST_SEMANA)
const DE_EST_OBJETIVO = inverso(EST_OBJETIVO)
const DE_EST_TAREA = inverso(EST_TAREA)
const DE_PRIORIDAD = inverso(PRIORIDAD)

// ─────────────────────────────────────────────── utilidades

/** Los servicios generados devuelven { data }. Si falta, es que la operación no trajo fila. */
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

function txt(v: string | undefined | null): string {
  return v ?? ''
}

function num(v: number | undefined | null): number | null {
  return v === undefined || v === null ? null : v
}

function fecha(v: string | undefined | null): string | null {
  return v ? v : null
}

/** Las columnas DateOnly pueden volver como fecha completa; nos quedamos con YYYY-MM-DD. */
function soloFecha(v: string | undefined | null): string | null {
  return v ? v.slice(0, 10) : null
}

function leerJson<T>(v: string | undefined | null, porDefecto: T): T {
  if (!v) return porDefecto
  try { return JSON.parse(v) as T } catch { return porDefecto }
}

/** El cliente tipa los payloads con los campos generados; aquí construimos objetos planos. */
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
    esRevisor: !!f.loc_esrevisor,
    activo: f.loc_activo !== false,
  }
}

function deMiembro(m: Omit<Miembro, 'id'>): Payload {
  return {
    loc_nombre: m.nombre, loc_iniciales: m.iniciales, loc_email: m.email,
    loc_color: m.color, loc_rol: ROL[m.rol], loc_esrevisor: m.esRevisor, loc_activo: m.activo,
  }
}

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

function deProyecto(p: Omit<Proyecto, 'id' | 'creadoEl'>): Payload {
  return {
    loc_nombre: p.nombre, loc_cliente: p.cliente, loc_color: p.color,
    loc_estado: EST_PROYECTO[p.estado], loc_descripcion: p.descripcion,
    loc_fechainicio: p.fechaInicio, loc_fechafin: p.fechaFin,
    loc_horaspresupuestadas: p.horasPresupuestadas,
    'loc_Responsable@odata.bind': ref('loc_miembros', p.responsableId),
  }
}

function aSemana(f: Fila): Semana {
  return {
    id: f.loc_semanaid,
    inicio: txt(f.loc_inicio),
    estado: DE_EST_SEMANA[f.loc_estado] ?? 'planificacion',
    propuestaPorId: f._loc_propuestapor_value ?? null,
    propuestaEl: fecha(f.loc_propuestael),
    aceptadaPorId: f._loc_aceptadapor_value ?? null,
    aceptadaEl: fecha(f.loc_aceptadael),
    cerradaPorId: f._loc_cerradapor_value ?? null,
    cerradaEl: fecha(f.loc_cerradael),
    notaCierre: txt(f.loc_notacierre),
  }
}

function deSemana(s: Omit<Semana, 'id'>): Payload {
  return {
    loc_inicio: s.inicio, loc_estado: EST_SEMANA[s.estado],
    loc_propuestael: s.propuestaEl, loc_aceptadael: s.aceptadaEl, loc_cerradael: s.cerradaEl,
    loc_notacierre: s.notaCierre,
    'loc_PropuestaPor@odata.bind': ref('loc_miembros', s.propuestaPorId),
    'loc_AceptadaPor@odata.bind': ref('loc_miembros', s.aceptadaPorId),
    'loc_CerradaPor@odata.bind': ref('loc_miembros', s.cerradaPorId),
  }
}

function aObjetivo(f: Fila): Objetivo {
  return {
    id: f.loc_objetivoid,
    semanaId: f._loc_semana_value ?? '',
    proyectoId: f._loc_proyecto_value ?? null,
    responsableId: f._loc_responsable_value ?? '',
    titulo: txt(f.loc_titulo),
    descripcion: txt(f.loc_descripcion),
    prioridad: DE_PRIORIDAD[f.loc_prioridad] ?? 'media',
    estado: DE_EST_OBJETIVO[f.loc_estado] ?? 'propuesto',
    orden: f.loc_orden ?? 0,
    revisadoPorId: f._loc_revisadopor_value ?? null,
    revisadoEl: fecha(f.loc_revisadoel),
    comentarioRevision: txt(f.loc_comentariorevision),
    resultado: txt(f.loc_resultado),
    creadoEl: txt(f.createdon),
  }
}

function deObjetivo(o: Omit<Objetivo, 'id' | 'creadoEl'>): Payload {
  return {
    loc_titulo: o.titulo, loc_descripcion: o.descripcion,
    loc_prioridad: PRIORIDAD[o.prioridad], loc_estado: EST_OBJETIVO[o.estado],
    loc_orden: o.orden, loc_revisadoel: o.revisadoEl,
    loc_comentariorevision: o.comentarioRevision, loc_resultado: o.resultado,
    'loc_Semana@odata.bind': ref('loc_semanas', o.semanaId),
    'loc_Proyecto@odata.bind': ref('loc_proyectos', o.proyectoId),
    'loc_Responsable@odata.bind': ref('loc_miembros', o.responsableId),
    'loc_RevisadoPor@odata.bind': ref('loc_miembros', o.revisadoPorId),
  }
}

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

function deTarea(t: Omit<Tarea, 'id' | 'creadoEl'>): Payload {
  return {
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
  }
}

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

function deVista(v: Omit<Vista, 'id' | 'creadoEl'>): Payload {
  return {
    loc_nombre: v.nombre, loc_tipo: v.tipo,
    loc_filtros: JSON.stringify(v.filtros), loc_agrupar: v.agrupar,
    loc_ordenar: v.ordenar, loc_ordendesc: v.ordenDesc,
    loc_columnas: JSON.stringify(v.columnas ?? []), loc_escala: v.escala,
    loc_espredeterminada: v.esPredeterminada,
    'loc_Miembro@odata.bind': ref('loc_miembros', v.miembroId),
  }
}

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

// ─────────────────────────────────────────────── repositorio

/** Columnas a traer de cada tabla: evita pedir toda la fila en cada carga. */
const SEL = {
  miembro: ['loc_miembroid', 'loc_nombre', 'loc_iniciales', 'loc_email', 'loc_color', 'loc_rol', 'loc_esrevisor', 'loc_activo'],
  proyecto: ['loc_proyectoid', 'loc_nombre', 'loc_cliente', 'loc_color', 'loc_estado', 'loc_descripcion', 'loc_fechainicio', 'loc_fechafin', 'loc_horaspresupuestadas', 'createdon'],
  semana: ['loc_semanaid', 'loc_inicio', 'loc_estado', 'loc_propuestael', 'loc_aceptadael', 'loc_cerradael', 'loc_notacierre'],
  objetivo: ['loc_objetivoid', 'loc_titulo', 'loc_descripcion', 'loc_prioridad', 'loc_estado', 'loc_orden', 'loc_revisadoel', 'loc_comentariorevision', 'loc_resultado', 'createdon'],
  tarea: ['loc_tareaid', 'loc_titulo', 'loc_descripcion', 'loc_estado', 'loc_prioridad', 'loc_inicio', 'loc_vence', 'loc_estimadoh', 'loc_realh', 'loc_orden', 'loc_ordentodo', 'loc_midia', 'loc_importante', 'loc_personal', 'loc_etiquetas', 'loc_checklist', 'loc_completadoel', 'createdon'],
  vista: ['loc_vistaid', 'loc_nombre', 'loc_tipo', 'loc_filtros', 'loc_agrupar', 'loc_ordenar', 'loc_ordendesc', 'loc_columnas', 'loc_escala', 'loc_espredeterminada', 'createdon'],
  actividad: ['loc_actividadid', 'loc_texto', 'loc_entidad', 'loc_entidadid', 'loc_tipo', 'loc_fecha', 'createdon'],
}

const TOPE = 5000

export const repoDataverse: Repositorio = {
  async cargar(): Promise<Instantanea> {
    const [miembros, proyectos, semanas, objetivos, tareas, vistas, actividad] = await Promise.all([
      Loc_miembrosService.getAll({ select: SEL.miembro, top: TOPE }),
      Loc_proyectosService.getAll({ select: SEL.proyecto, top: TOPE }),
      Loc_semanasService.getAll({ select: SEL.semana, top: TOPE }),
      Loc_objetivosService.getAll({ select: SEL.objetivo, top: TOPE }),
      Loc_tareasService.getAll({ select: SEL.tarea, top: TOPE }),
      Loc_vistasService.getAll({ select: SEL.vista, top: TOPE }),
      Loc_actividadsService.getAll({ select: SEL.actividad, top: TOPE }),
    ])
    return {
      miembros: lista(miembros).map(aMiembro),
      proyectos: lista(proyectos).map(aProyecto),
      semanas: lista(semanas).map(aSemana),
      objetivos: lista(objetivos).map(aObjetivo),
      tareas: lista(tareas).map(aTarea),
      vistas: lista(vistas).map(aVista),
      actividad: lista(actividad).map(aActividad),
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
    // Los lookups quedan en RemoveLink: Dataverse deja a null las tareas y objetivos.
    await Loc_proyectosService.delete(id)
  },

  async asegurarSemana(inicio) {
    const existentes = await Loc_semanasService.getAll({
      select: SEL.semana, filter: `loc_inicio eq '${inicio}'`, top: 1,
    })
    const ya = lista(existentes)[0]
    if (ya) return aSemana(ya)
    const nueva: Omit<Semana, 'id'> = {
      inicio, estado: 'planificacion',
      propuestaPorId: null, propuestaEl: null, aceptadaPorId: null, aceptadaEl: null,
      cerradaPorId: null, cerradaEl: null, notaCierre: '',
    }
    const r = await Loc_semanasService.create(comoPayload({ ...deSemana(nueva), statecode: 0 }))
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
    const hijas = await Loc_tareasService.getAll({
      select: ['loc_tareaid'], filter: `_loc_padre_value eq ${id}`, top: TOPE,
    })
    await Promise.all(lista(hijas).map(h => Loc_tareasService.delete(h.loc_tareaid)))
    await Loc_tareasService.delete(id)
  },

  async crearActividad(a) {
    const fechaIso = new Date().toISOString()
    const r = await Loc_actividadsService.create(comoPayload({
      loc_texto: a.texto.slice(0, 500), loc_entidad: a.entidad, loc_entidadid: a.entidadId,
      loc_tipo: a.tipo, loc_fecha: fechaIso,
      'loc_Autor@odata.bind': ref('loc_miembros', a.autorId),
      statecode: 0,
    }))
    return aActividad(dato(r, 'crearActividad'))
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
