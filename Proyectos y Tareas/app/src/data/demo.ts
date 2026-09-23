/**
 * Repositorio de DEMOSTRACIÓN: todo en memoria, persistido en localStorage.
 *
 * Solo se usa cuando no hay configuración de Supabase, para poder desarrollar y
 * revisar el diseño sin base de datos. Nunca llega a los usuarios reales: en
 * cuanto existen VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY, manda `repoSupabase`.
 *
 * Los datos de ejemplo están en seed.ts y se regeneran solos si se borran.
 */
import type { Instantanea, Nuevo, Repositorio } from './repo'
import { nuevoId } from './repo'
import { generarSeed } from './seed'
import type { Actividad, Contenido, Miembro, Objetivo, Proyecto, Reunion, Semana, Tarea, Vista } from '../domain/types'
import { ahoraIso } from '../domain/fechas'

const CLAVE = 'locodea.demo.v1'
const CLAVES_ANTIGUAS = ['locodea.objetivos.v1', 'locodea.objetivos.v2', 'locodea.objetivos.v3']

function leer(): Instantanea {
  try {
    const raw = localStorage.getItem(CLAVE)
    if (raw) return migrar(JSON.parse(raw) as Instantanea)
    for (const k of CLAVES_ANTIGUAS) localStorage.removeItem(k)
  } catch { /* datos corruptos: se regeneran */ }
  const seed = generarSeed()
  guardar(seed)
  return seed
}

/** Rellena campos que no existían en versiones anteriores del modelo. */
function migrar(d: Instantanea): Instantanea {
  return {
    ...d,
    vistas: d.vistas ?? [],
    reuniones: d.reuniones ?? [],
    contenidos: d.contenidos ?? [],
    tareas: d.tareas.map(t => ({ ...t, inicio: t.inicio ?? null, padreId: t.padreId ?? null })),
  }
}

function guardar(d: Instantanea): void {
  try { localStorage.setItem(CLAVE, JSON.stringify(d)) } catch { /* sin espacio */ }
}

/** Pequeña latencia para que las animaciones de guardado se vean como serán con red. */
const espera = (ms = 60) => new Promise<void>(r => setTimeout(r, ms))

let datos: Instantanea | null = null
function estado(): Instantanea {
  if (!datos) datos = leer()
  return datos
}
function persistir(cambio: (d: Instantanea) => Instantanea): void {
  datos = cambio(estado())
  guardar(datos)
}

function reemplazar<T extends { id: string }>(lista: T[], item: T): T[] {
  return lista.map(x => (x.id === item.id ? item : x))
}

export const repoDemo: Repositorio = {
  async cargar() {
    await espera(250)
    return structuredClone(estado())
  },

  async crearMiembro(m) {
    await espera()
    const nuevo: Miembro = { ...m, id: nuevoId() }
    persistir(d => ({ ...d, miembros: [...d.miembros, nuevo] }))
    return nuevo
  },
  async actualizarMiembro(m) {
    await espera()
    persistir(d => ({ ...d, miembros: reemplazar(d.miembros, m) }))
    return m
  },

  async crearProyecto(p: Nuevo<Proyecto>) {
    await espera()
    const nuevo: Proyecto = { ...p, id: nuevoId(), creadoEl: ahoraIso() }
    persistir(d => ({ ...d, proyectos: [...d.proyectos, nuevo] }))
    return nuevo
  },
  async actualizarProyecto(p) {
    await espera()
    persistir(d => ({ ...d, proyectos: reemplazar(d.proyectos, p) }))
    return p
  },
  async borrarProyecto(id) {
    await espera()
    persistir(d => ({
      ...d,
      proyectos: d.proyectos.filter(p => p.id !== id),
      tareas: d.tareas.map(t => (t.proyectoId === id ? { ...t, proyectoId: null } : t)),
      objetivos: d.objetivos.map(o => (o.proyectoId === id ? { ...o, proyectoId: null } : o)),
    }))
  },

  async asegurarSemana(inicio) {
    await espera()
    const existente = estado().semanas.find(s => s.inicio === inicio)
    if (existente) return existente
    const nueva: Semana = { id: nuevoId(), inicio }
    persistir(d => ({ ...d, semanas: [...d.semanas, nueva] }))
    return nueva
  },
  async actualizarSemana(s) {
    await espera()
    persistir(d => ({ ...d, semanas: reemplazar(d.semanas, s) }))
    return s
  },

  async crearObjetivo(o) {
    await espera()
    const nuevo: Objetivo = { ...o, id: nuevoId(), creadoEl: ahoraIso() }
    persistir(d => ({ ...d, objetivos: [...d.objetivos, nuevo] }))
    return nuevo
  },
  async actualizarObjetivo(o) {
    await espera()
    persistir(d => ({ ...d, objetivos: reemplazar(d.objetivos, o) }))
    return o
  },
  async actualizarObjetivos(os) {
    await espera()
    persistir(d => ({ ...d, objetivos: os.reduce((l, o) => reemplazar(l, o), d.objetivos) }))
    return os
  },
  async borrarObjetivo(id) {
    await espera()
    persistir(d => ({
      ...d,
      objetivos: d.objetivos.filter(o => o.id !== id),
      tareas: d.tareas.map(t => (t.objetivoId === id ? { ...t, objetivoId: null } : t)),
    }))
  },

  async crearTarea(t) {
    await espera()
    const nueva: Tarea = { ...t, id: nuevoId(), creadoEl: ahoraIso() }
    persistir(d => ({ ...d, tareas: [...d.tareas, nueva] }))
    return nueva
  },
  async actualizarTarea(t) {
    await espera()
    persistir(d => ({ ...d, tareas: reemplazar(d.tareas, t) }))
    return t
  },
  async actualizarTareas(ts) {
    await espera()
    persistir(d => ({ ...d, tareas: ts.reduce((l, t) => reemplazar(l, t), d.tareas) }))
    return ts
  },
  async borrarTarea(id) {
    await espera()
    // Las subtareas se van con su padre.
    persistir(d => ({ ...d, tareas: d.tareas.filter(t => t.id !== id && t.padreId !== id) }))
  },

  async crearActividad(a) {
    const nueva: Actividad = { ...a, id: nuevoId(), fecha: ahoraIso() }
    persistir(d => ({ ...d, actividad: [...d.actividad, nueva] }))
    return nueva
  },

  async crearReunion(r) {
    await espera()
    const nueva: Reunion = { ...r, id: nuevoId(), creadoEl: ahoraIso() }
    persistir(d => ({ ...d, reuniones: [...d.reuniones, nueva] }))
    return nueva
  },
  async actualizarReunion(r) {
    await espera()
    persistir(d => ({ ...d, reuniones: reemplazar(d.reuniones, r) }))
    return r
  },
  async borrarReunion(id) {
    await espera()
    persistir(d => ({ ...d, reuniones: d.reuniones.filter(x => x.id !== id) }))
  },

  async crearContenido(c) {
    await espera()
    const nuevo: Contenido = { ...c, id: nuevoId(), creadoEl: ahoraIso() }
    persistir(d => ({ ...d, contenidos: [...d.contenidos, nuevo] }))
    return nuevo
  },
  async actualizarContenido(c) {
    await espera()
    persistir(d => ({ ...d, contenidos: reemplazar(d.contenidos, c) }))
    return c
  },
  async borrarContenido(id) {
    await espera()
    persistir(d => ({ ...d, contenidos: d.contenidos.filter(x => x.id !== id) }))
  },

  async crearVista(v: Nuevo<Vista>) {
    await espera()
    const nueva: Vista = { ...v, id: nuevoId(), creadoEl: ahoraIso() }
    persistir(d => ({ ...d, vistas: [...d.vistas, nueva] }))
    return nueva
  },
  async actualizarVista(v) {
    await espera()
    persistir(d => ({ ...d, vistas: reemplazar(d.vistas, v) }))
    return v
  },
  async borrarVista(id) {
    await espera()
    persistir(d => ({ ...d, vistas: d.vistas.filter(v => v.id !== id) }))
  },
}

/** Borra los datos de demostración y vuelve a los de ejemplo. */
export function reiniciarDemo(): void {
  localStorage.removeItem(CLAVE)
  datos = null
}
