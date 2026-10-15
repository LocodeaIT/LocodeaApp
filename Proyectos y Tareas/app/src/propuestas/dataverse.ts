/**
 * Repositorio de Propuestas sobre Dataverse (tablas loc_propuesta y
 * loc_adjuntopropuesta de la solución LocodeaObjetivos; el esquema lo crea
 * scripts/propuestas-esquema.mjs).
 *
 * Mismas reglas que ../boveda/dataverse.ts: el id es el GUID de la fila y se
 * manda como clave primaria al crear; los catálogos son columnas Choice
 * (valores 4120006xx); las búsquedas se leen de `_loc_x_value` y se escriben
 * con `loc_X@odata.bind`. Los apuntes van como JSON en loc_apuntes.
 *
 * Los adjuntos guardan el archivo como data URL en loc_datos (hasta 1 MB): la
 * lista se pide sin esa columna y cada archivo se descarga al abrirlo.
 */
import { Loc_propuestasService } from '../generated/services/Loc_propuestasService'
import { Loc_adjuntopropuestasService } from '../generated/services/Loc_adjuntopropuestasService'
import type { PropuestasRepositorio } from './repo'
import type { AdjuntoPropuesta, ApuntePropuesta, EstadoPropuesta, PrioridadPropuesta, Propuesta } from './types'

// ─────────────────────────────────────────────── choices (mismos valores que scripts/propuestas-esquema.mjs)

const ESTADO: Record<EstadoPropuesta, number> = {
  apunte: 412000600, conversacion: 412000601, planificacion: 412000602, enviada: 412000603, aceptado: 412000604, descartado: 412000605,
}
const PRIORIDAD: Record<PrioridadPropuesta, number> = { alta: 412000610, media: 412000611, baja: 412000612 }

const inverso = <K extends string>(m: Record<K, number>) => Object.fromEntries(Object.entries(m).map(([k, v]) => [v, k])) as Record<number, K>
const DE_ESTADO = inverso(ESTADO)
const DE_PRIORIDAD = inverso(PRIORIDAD)

// ─────────────────────────────────────────────── utilidades

/* eslint-disable @typescript-eslint/no-explicit-any */
type Fila = any

interface Resultado { success?: boolean; data?: unknown; error?: unknown }

function comprobar<T extends Resultado>(r: T, donde: string): T {
  if (r && r.success === false) {
    const e = r.error
    throw e instanceof Error ? e : new Error(`Dataverse falló al ${donde}`)
  }
  return r
}

const lista = (r: Resultado): Fila[] => (Array.isArray(r?.data) ? r.data : [])
const ref = (conjunto: string, id: string | null | undefined): string | null => (id ? `/${conjunto}(${id})` : null)
const txt = (v: unknown): string => (v === undefined || v === null ? '' : String(v))
const nulo = (v: unknown): string | null => (v ? String(v) : null)
const numero = (v: unknown): number | null => (v === undefined || v === null || v === '' ? null : Number(v))
const soloFecha = (v: unknown): string | null => (v ? String(v).slice(0, 10) : null)

function leerJson<T>(v: unknown, defecto: T): T {
  if (!v) return defecto
  try { return JSON.parse(String(v)) as T } catch { return defecto }
}

const leer = (f: Fila): Propuesta => ({
  id: f.loc_propuestaid,
  titulo: txt(f.loc_titulo),
  cliente: txt(f.loc_cliente),
  cuentaId: f._loc_cuenta_value ?? null,
  contacto: txt(f.loc_contacto),
  estado: DE_ESTADO[f.loc_estado] ?? 'apunte',
  prioridad: DE_PRIORIDAD[f.loc_prioridad] ?? 'media',
  descripcion: txt(f.loc_descripcion),
  importe: numero(f.loc_importe),
  probabilidad: numero(f.loc_probabilidad),
  fechaPrevista: soloFecha(f.loc_fechaprevista),
  tecnologias: txt(f.loc_tecnologias).split(',').map(s => s.trim()).filter(Boolean),
  responsableId: f._loc_responsable_value ?? null,
  proyectoId: f._loc_proyecto_value ?? null,
  apuntes: leerJson<ApuntePropuesta[]>(f.loc_apuntes, []),
  orden: Number(f.loc_orden) || 0,
  creadoEl: txt(f.createdon),
  actualizadoEl: nulo(f.modifiedon),
})

const escribir = (p: Propuesta) => ({
  loc_titulo: p.titulo.slice(0, 200), loc_cliente: p.cliente.slice(0, 200), loc_contacto: p.contacto.slice(0, 200),
  loc_estado: ESTADO[p.estado], loc_prioridad: PRIORIDAD[p.prioridad], loc_descripcion: p.descripcion,
  loc_apuntes: JSON.stringify(p.apuntes), loc_importe: p.importe, loc_probabilidad: p.probabilidad,
  loc_fechaprevista: p.fechaPrevista, loc_tecnologias: p.tecnologias.join(', ').slice(0, 400), loc_orden: p.orden,
  'loc_Responsable@odata.bind': ref('loc_miembros', p.responsableId),
  'loc_Cuenta@odata.bind': ref('loc_cuentas', p.cuentaId),
  'loc_Proyecto@odata.bind': ref('loc_proyectos', p.proyectoId),
})

const leerAdjunto = (f: Fila): AdjuntoPropuesta => ({
  id: f.loc_adjuntopropuestaid, propuestaId: f._loc_propuesta_value ?? '', proyectoId: f._loc_proyecto_value ?? null,
  nombre: txt(f.loc_nombre), tipo: txt(f.loc_tipo), tamano: Number(f.loc_tamano) || 0, creadoEl: txt(f.createdon),
})

// ─────────────────────────────────────────────── repositorio

const TOPE = 5000
const conocidas = new Set<string>()
/** Columnas de la lista de adjuntos: todas menos loc_datos. */
const COLUMNAS_ADJUNTO = ['loc_adjuntopropuestaid', 'loc_nombre', 'loc_tipo', 'loc_tamano', '_loc_propuesta_value', '_loc_proyecto_value', 'createdon']

export const propuestasRepoDataverse: PropuestasRepositorio = {
  async cargar() {
    const r = comprobar(await Loc_propuestasService.getAll({ top: TOPE }), 'leer las propuestas')
    const propuestas = lista(r).map(leer)
    for (const p of propuestas) conocidas.add(p.id)
    return propuestas
  },

  async guardar(p) {
    const cuerpo = escribir(p)
    if (conocidas.has(p.id)) {
      comprobar(await Loc_propuestasService.update(p.id, cuerpo as any), 'actualizar la propuesta')
    } else {
      comprobar(await Loc_propuestasService.create({ ...cuerpo, loc_propuestaid: p.id, statecode: 0 } as any), 'crear la propuesta')
      conocidas.add(p.id)
    }
    return p
  },

  async guardarVarias(ps) {
    // solo cambia el orden (y quizá el estado): se manda lo justo
    await Promise.all(ps.map(async p => {
      comprobar(await Loc_propuestasService.update(p.id, { loc_orden: p.orden, loc_estado: ESTADO[p.estado] } as any), 'reordenar las propuestas')
    }))
  },

  async borrar(id) {
    await Loc_propuestasService.delete(id)
    conocidas.delete(id)
  },

  async cargarAdjuntos() {
    const r = comprobar(await Loc_adjuntopropuestasService.getAll({ top: TOPE, select: COLUMNAS_ADJUNTO } as any), 'leer los adjuntos')
    return lista(r).map(leerAdjunto)
  },

  async leerAdjunto(id) {
    const r = comprobar(await Loc_adjuntopropuestasService.get(id, { select: ['loc_datos'] }), 'leer el adjunto')
    return txt((r.data as Fila)?.loc_datos)
  },

  async crearAdjunto(a, datos) {
    comprobar(await Loc_adjuntopropuestasService.create({
      loc_adjuntopropuestaid: a.id, loc_nombre: a.nombre.slice(0, 200), loc_tipo: a.tipo.slice(0, 100), loc_tamano: a.tamano, loc_datos: datos,
      'loc_Propuesta@odata.bind': ref('loc_propuestas', a.propuestaId), 'loc_Proyecto@odata.bind': ref('loc_proyectos', a.proyectoId), statecode: 0,
    } as any), 'guardar el adjunto')
    return a
  },

  async enlazarAdjuntos(ids, proyectoId) {
    await Promise.all(ids.map(async id => {
      comprobar(await Loc_adjuntopropuestasService.update(id, { 'loc_Proyecto@odata.bind': ref('loc_proyectos', proyectoId) } as any), 'enlazar el adjunto al proyecto')
    }))
  },

  async borrarAdjunto(id) {
    await Loc_adjuntopropuestasService.delete(id)
  },
}
