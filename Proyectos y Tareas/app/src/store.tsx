/**
 * Estado global de la app: datos cargados, quién soy, pantalla activa y todas
 * las acciones de negocio. Las pantallas solo hablan con este contexto.
 */
import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode,
} from 'react'
import type { Instantanea, Nuevo, Repositorio } from './data/repo'
import type {
  Actividad, EntidadActividad, Miembro, Objetivo, Proyecto, Reunion, Semana, Tarea, Vista,
} from './domain/types'
import { ETIQUETA_ESTADO_TAREA } from './domain/types'
import { crearEvento, actualizarEvento, borrarEvento } from './data/calendario'
import { ahoraIso, hoy, lunesDe } from './domain/fechas'

export type Pantalla = 'inicio' | 'objetivos' | 'tareas' | 'midia' | 'reuniones' | 'proyectos' | 'analisis' | 'informes' | 'equipo'

export interface Aviso {
  id: number
  texto: string
  tono: 'ok' | 'error' | 'info'
}

const VACIO: Instantanea = { miembros: [], proyectos: [], semanas: [], objetivos: [], tareas: [], actividad: [], vistas: [], reuniones: [] }

const PANTALLAS: Pantalla[] = ['inicio', 'objetivos', 'tareas', 'reuniones', 'proyectos', 'analisis', 'informes', 'equipo']

const CLAVE_YO = 'locodea.yo'
const CLAVE_PANTALLA = 'locodea.pantalla'

interface Ctx {
  datos: Instantanea
  cargando: boolean
  error: string | null

  yo: Miembro | null
  entrarComo: (id: string) => void
  /** Vuelve a la pantalla de entrada sin recargar la pagina. */
  salir: () => void
  pantalla: Pantalla
  setPantalla: (p: Pantalla) => void
  /** Lunes de la semana seleccionada en Objetivos. */
  semanaSel: string
  setSemanaSel: (lunes: string) => void
  avisos: Aviso[]
  avisar: (texto: string, tono?: Aviso['tono']) => void

  // catálogos resueltos
  miembro: (id: string | null | undefined) => Miembro | undefined
  proyecto: (id: string | null | undefined) => Proyecto | undefined
  objetivo: (id: string | null | undefined) => Objetivo | undefined
  semanaDe: (lunes: string) => Semana | undefined
  actividadDe: (entidad: EntidadActividad, id: string) => Actividad[]

  // miembros
  guardarMiembro: (m: Miembro | Omit<Miembro, 'id'>) => Promise<void>

  // proyectos
  guardarProyecto: (p: Proyecto | Nuevo<Proyecto>) => Promise<Proyecto>
  borrarProyecto: (id: string) => Promise<void>

  // semanas y objetivos
  asegurarSemana: (lunes: string) => Promise<Semana>
  guardarObjetivo: (o: Objetivo | Nuevo<Objetivo>) => Promise<Objetivo>
  alternarObjetivo: (id: string) => Promise<void>
  reordenarObjetivos: (ids: string[], responsableId?: string) => Promise<void>
  borrarObjetivo: (id: string) => Promise<void>

  // tareas
  guardarTarea: (t: Tarea | Nuevo<Tarea>) => Promise<Tarea>
  /** Aplica `cambio` a la tarea (p. ej. otro estado o asignado) y fija el orden de toda la columna destino. */
  moverTarea: (id: string, cambio: Partial<Tarea>, idsColumna: string[]) => Promise<void>
  reordenarTodo: (ids: string[]) => Promise<void>
  alternarHecha: (id: string) => Promise<void>
  borrarTarea: (id: string) => Promise<void>

  /** Tarea nueva con valores por defecto, para completar solo lo que cambia. */
  tareaBase: (parcial?: Partial<Tarea>) => Nuevo<Tarea>
  subtareasDe: (id: string) => Tarea[]

  guardarReunion: (r: Reunion | Nuevo<Reunion>) => Promise<Reunion>
  borrarReunion: (id: string) => Promise<void>
  reunionBase: (parcial: Partial<Reunion>) => Nuevo<Reunion>

  guardarVista: (v: Vista | Nuevo<Vista>) => Promise<Vista>
  borrarVista: (id: string) => Promise<void>

  comentar: (entidad: EntidadActividad, entidadId: string, texto: string) => Promise<void>
  recargar: () => Promise<void>
}

const Contexto = createContext<Ctx | null>(null)

export function Proveedor({ repo, children }: { repo: Repositorio; children: ReactNode }) {
  const [datos, setDatos] = useState<Instantanea>(VACIO)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [yoId, setYoId] = useState<string | null>(() => localStorage.getItem(CLAVE_YO))
  const [pantalla, setPantallaEstado] = useState<Pantalla>(() => {
    // lo guardado puede venir de una versión anterior: se valida antes de usarlo
    const p = localStorage.getItem(CLAVE_PANTALLA)
    return PANTALLAS.includes(p as Pantalla) ? (p as Pantalla) : 'inicio'
  })
  const [semanaSel, setSemanaSel] = useState<string>(() => lunesDe(hoy()))
  const [avisos, setAvisos] = useState<Aviso[]>([])
  const contadorAviso = useRef(0)

  const recargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      setDatos(await repo.cargar())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar los datos')
    } finally {
      setCargando(false)
    }
  }, [repo])

  useEffect(() => { void recargar() }, [recargar])

  const avisar = useCallback((texto: string, tono: Aviso['tono'] = 'ok') => {
    const id = ++contadorAviso.current
    setAvisos(a => [...a, { id, texto, tono }])
    setTimeout(() => setAvisos(a => a.filter(x => x.id !== id)), 3200)
  }, [])

  const setPantalla = useCallback((p: Pantalla) => {
    setPantallaEstado(p)
    localStorage.setItem(CLAVE_PANTALLA, p)
  }, [])

  const entrarComo = useCallback((id: string) => {
    setYoId(id)
    localStorage.setItem(CLAVE_YO, id)
  }, [])

  const salir = useCallback(() => {
    setYoId(null)
    localStorage.removeItem(CLAVE_YO)
    // la pantalla queda como estaba: al volver a entrar se retoma donde se dejo
  }, [])

  const yo = useMemo(() => datos.miembros.find(m => m.id === yoId) ?? null, [datos.miembros, yoId])

  /** Envuelve una escritura: aplica el cambio, avisa si falla. */
  const ejecutar = useCallback(async <T,>(fn: () => Promise<T>, aplicar: (d: Instantanea, r: T) => Instantanea, mensajeError: string): Promise<T> => {
    try {
      const r = await fn()
      setDatos(d => aplicar(d, r))
      return r
    } catch (e) {
      console.error(e)
      avisar(mensajeError, 'error')
      throw e
    }
  }, [avisar])

  const registrar = useCallback(async (entidad: EntidadActividad, entidadId: string, texto: string, tipo: Actividad['tipo'] = 'cambio') => {
    if (!yo) return
    const a = await repo.crearActividad({ entidad, entidadId, autorId: yo.id, tipo, texto })
    setDatos(d => ({ ...d, actividad: [...d.actividad, a] }))
  }, [repo, yo])

  // ─────────────────────────────────────────────── búsquedas
  const miembro = useCallback((id: string | null | undefined) => datos.miembros.find(m => m.id === id), [datos.miembros])
  const proyecto = useCallback((id: string | null | undefined) => datos.proyectos.find(p => p.id === id), [datos.proyectos])
  const objetivo = useCallback((id: string | null | undefined) => datos.objetivos.find(o => o.id === id), [datos.objetivos])
  const semanaDe = useCallback((lunes: string) => datos.semanas.find(s => s.inicio === lunes), [datos.semanas])
  const actividadDe = useCallback((entidad: EntidadActividad, id: string) =>
    datos.actividad.filter(a => a.entidad === entidad && a.entidadId === id).sort((a, b) => a.fecha.localeCompare(b.fecha)),
  [datos.actividad])

  // ─────────────────────────────────────────────── miembros
  const guardarMiembro = useCallback(async (m: Miembro | Omit<Miembro, 'id'>) => {
    if ('id' in m) {
      await ejecutar(() => repo.actualizarMiembro(m), (d, r) => ({ ...d, miembros: d.miembros.map(x => (x.id === r.id ? r : x)) }), 'No se pudo guardar el miembro')
    } else {
      await ejecutar(() => repo.crearMiembro(m), (d, r) => ({ ...d, miembros: [...d.miembros, r] }), 'No se pudo crear el miembro')
    }
    avisar('Miembro guardado')
  }, [ejecutar, repo, avisar])

  // ─────────────────────────────────────────────── proyectos
  const guardarProyecto = useCallback(async (p: Proyecto | Nuevo<Proyecto>) => {
    let r: Proyecto
    if ('id' in p) {
      r = await ejecutar(() => repo.actualizarProyecto(p), (d, x) => ({ ...d, proyectos: d.proyectos.map(y => (y.id === x.id ? x : y)) }), 'No se pudo guardar el proyecto')
    } else {
      r = await ejecutar(() => repo.crearProyecto(p), (d, x) => ({ ...d, proyectos: [...d.proyectos, x] }), 'No se pudo crear el proyecto')
      await registrar('proyecto', r.id, 'Creó el proyecto.')
    }
    avisar('Proyecto guardado')
    return r
  }, [ejecutar, repo, avisar, registrar])

  const borrarProyecto = useCallback(async (id: string) => {
    await ejecutar(() => repo.borrarProyecto(id), d => ({
      ...d,
      proyectos: d.proyectos.filter(p => p.id !== id),
      tareas: d.tareas.map(t => (t.proyectoId === id ? { ...t, proyectoId: null } : t)),
      objetivos: d.objetivos.map(o => (o.proyectoId === id ? { ...o, proyectoId: null } : o)),
    }), 'No se pudo borrar el proyecto')
    avisar('Proyecto borrado', 'info')
  }, [ejecutar, repo, avisar])

  // ─────────────────────────────────────────────── semanas
  const asegurarSemana = useCallback(async (lunes: string) => {
    const existente = datos.semanas.find(s => s.inicio === lunes)
    if (existente) return existente
    return ejecutar(() => repo.asegurarSemana(lunes), (d, s) => (d.semanas.some(x => x.id === s.id) ? d : { ...d, semanas: [...d.semanas, s] }), 'No se pudo crear la semana')
  }, [datos.semanas, ejecutar, repo])

  // ─────────────────────────────────────────────── objetivos
  const guardarObjetivo = useCallback(async (o: Objetivo | Nuevo<Objetivo>) => {
    let r: Objetivo
    if ('id' in o) {
      r = await ejecutar(() => repo.actualizarObjetivo(o), (d, x) => ({ ...d, objetivos: d.objetivos.map(y => (y.id === x.id ? x : y)) }), 'No se pudo guardar el objetivo')
    } else {
      r = await ejecutar(() => repo.crearObjetivo(o), (d, x) => ({ ...d, objetivos: [...d.objetivos, x] }), 'No se pudo crear el objetivo')
      await registrar('objetivo', r.id, 'Añadió el objetivo.')
    }
    avisar('Objetivo guardado')
    return r
  }, [ejecutar, repo, avisar, registrar])

  /** Marca o desmarca un objetivo como cumplido. Lo puede hacer cualquiera. */
  const alternarObjetivo = useCallback(async (id: string) => {
    const o = datos.objetivos.find(x => x.id === id)
    if (!o) return
    const cumplido = o.estado !== 'cumplido'
    const r: Objetivo = { ...o, estado: cumplido ? 'cumplido' : 'pendiente', cumplidoEl: cumplido ? ahoraIso() : null }
    await ejecutar(() => repo.actualizarObjetivo(r), (d, x) => ({ ...d, objetivos: d.objetivos.map(y => (y.id === x.id ? x : y)) }), 'No se pudo actualizar el objetivo')
    await registrar('objetivo', id, cumplido ? 'Marcó el objetivo como cumplido.' : 'Reabrió el objetivo.')
  }, [datos.objetivos, ejecutar, repo, registrar])

  const reordenarObjetivos = useCallback(async (ids: string[], responsableId?: string) => {
    const cambiados = ids.map((id, i) => {
      const o = datos.objetivos.find(x => x.id === id)!
      return { ...o, orden: i, responsableId: responsableId ?? o.responsableId }
    }).filter(o => { const ant = datos.objetivos.find(x => x.id === o.id)!; return ant.orden !== o.orden || ant.responsableId !== o.responsableId })
    if (!cambiados.length) return
    // optimista: se aplica antes de esperar
    setDatos(d => ({ ...d, objetivos: cambiados.reduce((l, o) => l.map(x => (x.id === o.id ? o : x)), d.objetivos) }))
    try { await repo.actualizarObjetivos(cambiados) } catch { avisar('No se pudo guardar el orden', 'error') }
  }, [datos.objetivos, repo, avisar])

  const borrarObjetivo = useCallback(async (id: string) => {
    await ejecutar(() => repo.borrarObjetivo(id), d => ({
      ...d,
      objetivos: d.objetivos.filter(o => o.id !== id),
      tareas: d.tareas.map(t => (t.objetivoId === id ? { ...t, objetivoId: null } : t)),
    }), 'No se pudo borrar el objetivo')
    avisar('Objetivo borrado', 'info')
  }, [ejecutar, repo, avisar])

  // ─────────────────────────────────────────────── tareas
  const guardarTarea = useCallback(async (t: Tarea | Nuevo<Tarea>) => {
    let r: Tarea
    if ('id' in t) {
      const anterior = datos.tareas.find(x => x.id === t.id)
      const conFecha = t.estado === 'hecha' && anterior?.estado !== 'hecha' ? { ...t, completadoEl: ahoraIso() } : t.estado !== 'hecha' ? { ...t, completadoEl: null } : t
      r = await ejecutar(() => repo.actualizarTarea(conFecha), (d, x) => ({ ...d, tareas: d.tareas.map(y => (y.id === x.id ? x : y)) }), 'No se pudo guardar la tarea')
      if (anterior && anterior.estado !== r.estado) await registrar('tarea', r.id, `Cambió el estado a «${ETIQUETA_ESTADO_TAREA[r.estado]}».`)
      if (anterior && anterior.asignadoId !== r.asignadoId) await registrar('tarea', r.id, r.asignadoId ? `Asignó la tarea a ${datos.miembros.find(m => m.id === r.asignadoId)?.nombre ?? ''}.` : 'Quitó la asignación.')
    } else {
      r = await ejecutar(() => repo.crearTarea(t), (d, x) => ({ ...d, tareas: [...d.tareas, x] }), 'No se pudo crear la tarea')
      await registrar('tarea', r.id, 'Creó la tarea.')
    }
    return r
  }, [datos.tareas, datos.miembros, ejecutar, repo, registrar])

  /** Mueve una tarea a una columna y fija el orden de toda la columna (drag & drop). */
  const moverTarea = useCallback(async (id: string, cambio: Partial<Tarea>, idsColumna: string[]) => {
    const t = datos.tareas.find(x => x.id === id)
    if (!t) return
    const estado = cambio.estado ?? t.estado
    const cambioEstado = t.estado !== estado
    const cambiados: Tarea[] = idsColumna.map((tid, i) => {
      const x = datos.tareas.find(y => y.id === tid)
      if (!x) return null
      const base = tid === id ? { ...x, ...cambio, completadoEl: estado === 'hecha' ? (x.completadoEl ?? ahoraIso()) : null } : x
      return { ...base, orden: i }
    }).filter((x): x is Tarea => !!x)
      .filter(x => { const ant = datos.tareas.find(y => y.id === x.id)!; return ant.orden !== x.orden || x.id === id })
    if (!cambiados.length) return
    setDatos(d => ({ ...d, tareas: cambiados.reduce((l, x) => l.map(y => (y.id === x.id ? x : y)), d.tareas) }))
    try {
      await repo.actualizarTareas(cambiados)
      if (cambioEstado) await registrar('tarea', id, `Movió la tarea a «${ETIQUETA_ESTADO_TAREA[estado]}».`)
      else if (cambio.asignadoId !== undefined && cambio.asignadoId !== t.asignadoId) await registrar('tarea', id, cambio.asignadoId ? `Asignó la tarea a ${datos.miembros.find(m => m.id === cambio.asignadoId)?.nombre ?? ''}.` : 'Quitó la asignación.')
    } catch { avisar('No se pudo mover la tarea', 'error') }
  }, [datos.tareas, datos.miembros, repo, registrar, avisar])

  const reordenarTodo = useCallback(async (ids: string[]) => {
    const cambiados = ids.map((id, i) => ({ ...datos.tareas.find(x => x.id === id)!, ordenTodo: i }))
      .filter(x => datos.tareas.find(y => y.id === x.id)!.ordenTodo !== x.ordenTodo)
    if (!cambiados.length) return
    setDatos(d => ({ ...d, tareas: cambiados.reduce((l, x) => l.map(y => (y.id === x.id ? x : y)), d.tareas) }))
    try { await repo.actualizarTareas(cambiados) } catch { avisar('No se pudo guardar el orden', 'error') }
  }, [datos.tareas, repo, avisar])

  const alternarHecha = useCallback(async (id: string) => {
    const t = datos.tareas.find(x => x.id === id)
    if (!t) return
    await guardarTarea({ ...t, estado: t.estado === 'hecha' ? 'pendiente' : 'hecha' })
  }, [datos.tareas, guardarTarea])

  const borrarTarea = useCallback(async (id: string) => {
    await ejecutar(() => repo.borrarTarea(id), d => ({ ...d, tareas: d.tareas.filter(t => t.id !== id && t.padreId !== id) }), 'No se pudo borrar la tarea')
    avisar('Tarea borrada', 'info')
  }, [ejecutar, repo, avisar])

  const comentar = useCallback((entidad: EntidadActividad, entidadId: string, texto: string) => registrar(entidad, entidadId, texto, 'comentario'), [registrar])

  const tareaBase = useCallback((parcial: Partial<Tarea> = {}): Nuevo<Tarea> => ({
    titulo: '', descripcion: '', proyectoId: null, objetivoId: null, asignadoId: yo?.id ?? null, creadoPorId: yo?.id ?? '',
    estado: 'pendiente', prioridad: 'media', inicio: null, vence: null, padreId: null, estimadoH: null, realH: null,
    orden: datos.tareas.length, ordenTodo: datos.tareas.length, miDia: false, importante: false, personal: false,
    etiquetas: [], checklist: [], completadoEl: null, ...parcial,
  }), [yo, datos.tareas.length])

  const subtareasDe = useCallback((id: string) => datos.tareas.filter(t => t.padreId === id).sort((a, b) => a.orden - b.orden), [datos.tareas])

  /**
   * Guarda la reunión y refleja el cambio en el calendario de Outlook. Si el
   * calendario falla, la reunión se guarda igual: no perdemos el dato por un
   * problema de conector.
   */
  const guardarReunion = useCallback(async (r: Reunion | Nuevo<Reunion>) => {
    let guardada: Reunion
    if ('id' in r) {
      const eventoId = await actualizarEvento(r, datos.miembros)
      guardada = await ejecutar(() => repo.actualizarReunion({ ...r, eventoId }),
        (d, x) => ({ ...d, reuniones: d.reuniones.map(y => (y.id === x.id ? x : y)) }), 'No se pudo guardar la reunión')
    } else {
      guardada = await ejecutar(() => repo.crearReunion(r),
        (d, x) => ({ ...d, reuniones: [...d.reuniones, x] }), 'No se pudo crear la reunión')
      // El evento necesita el id de la reunión ya creada para quedar enlazado.
      const eventoId = await crearEvento(guardada, datos.miembros)
      if (eventoId) {
        guardada = await ejecutar(() => repo.actualizarReunion({ ...guardada, eventoId }),
          (d, x) => ({ ...d, reuniones: d.reuniones.map(y => (y.id === x.id ? x : y)) }), 'No se pudo enlazar con el calendario')
      }
    }
    avisar(guardada.eventoId ? 'Reunión guardada y enviada al calendario' : 'Reunión guardada (sin calendario)')
    return guardada
  }, [ejecutar, repo, avisar, datos.miembros])

  const borrarReunion = useCallback(async (id: string) => {
    const r = datos.reuniones.find(x => x.id === id)
    await borrarEvento(r?.eventoId ?? null)
    await ejecutar(() => repo.borrarReunion(id), d => ({ ...d, reuniones: d.reuniones.filter(x => x.id !== id) }), 'No se pudo borrar la reunión')
    avisar('Reunión borrada')
  }, [datos.reuniones, ejecutar, repo, avisar])

  const reunionBase = useCallback((parcial: Partial<Reunion>): Nuevo<Reunion> => ({
    titulo: '', fecha: new Date().toISOString(), duracionMin: 60, lugar: '',
    estado: 'pendiente', notas: '', temas: [], asistentesIds: datos.miembros.filter(m => m.activo).map(m => m.id),
    proyectoId: null, organizaId: yo?.id ?? null, eventoId: null,
    ...parcial,
  }), [datos.miembros, yo])

  const guardarVista = useCallback(async (v: Vista | Nuevo<Vista>) => {
    let r: Vista
    if ('id' in v) {
      r = await ejecutar(() => repo.actualizarVista(v), (d, x) => ({ ...d, vistas: d.vistas.map(y => (y.id === x.id ? x : y)) }), 'No se pudo guardar la vista')
    } else {
      r = await ejecutar(() => repo.crearVista(v), (d, x) => ({ ...d, vistas: [...d.vistas, x] }), 'No se pudo crear la vista')
    }
    avisar('Vista guardada')
    return r
  }, [ejecutar, repo, avisar])

  const borrarVista = useCallback(async (id: string) => {
    await ejecutar(() => repo.borrarVista(id), d => ({ ...d, vistas: d.vistas.filter(v => v.id !== id) }), 'No se pudo borrar la vista')
    avisar('Vista borrada', 'info')
  }, [ejecutar, repo, avisar])

  // Memorizado a proposito: sin esto el objeto se recrea en cada render y
  // obliga a re-renderizar todos los consumidores de useApp() a la vez.
  const valor: Ctx = useMemo(() => ({
    datos, cargando, error, yo, entrarComo, salir, pantalla, setPantalla, semanaSel, setSemanaSel, avisos, avisar,
    miembro, proyecto, objetivo, semanaDe, actividadDe,
    guardarMiembro, guardarProyecto, borrarProyecto,
    asegurarSemana, guardarObjetivo, alternarObjetivo, reordenarObjetivos, borrarObjetivo,
    guardarTarea, moverTarea, reordenarTodo, alternarHecha, borrarTarea,
    tareaBase, subtareasDe, guardarVista, borrarVista,
    guardarReunion, borrarReunion, reunionBase,
    comentar, recargar,
  }), [
    datos, cargando, error, yo, entrarComo, salir, pantalla, semanaSel, avisos, avisar,
    miembro, proyecto, objetivo, semanaDe, actividadDe,
    guardarMiembro, guardarProyecto, borrarProyecto,
    asegurarSemana, guardarObjetivo, alternarObjetivo, reordenarObjetivos, borrarObjetivo,
    guardarTarea, moverTarea, reordenarTodo, alternarHecha, borrarTarea,
    tareaBase, subtareasDe, guardarVista, borrarVista,
    guardarReunion, borrarReunion, reunionBase,
    comentar, recargar,
  ])

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>
}

export function useApp(): Ctx {
  const c = useContext(Contexto)
  if (!c) throw new Error('useApp fuera del Proveedor')
  return c
}
