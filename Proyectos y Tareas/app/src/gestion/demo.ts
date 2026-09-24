/**
 * Repositorio de DEMOSTRACIÓN de Gestión: en memoria y persistido en
 * localStorage. Solo se carga con `VITE_DEMO=1` (import diferido en main.tsx).
 */
import type { GestionRepositorio } from './repo'
import type { ColGestion, GestionInstantanea, RegistroGestion } from './types'
import { COLECCIONES_GESTION } from './types'
import { generarSemillaGestion } from './semilla'

const CLAVE = 'locodea.gestion.demo.v1'

function leer(): GestionInstantanea {
  try {
    const raw = localStorage.getItem(CLAVE)
    if (raw) {
      const d = JSON.parse(raw) as Partial<GestionInstantanea>
      return Object.fromEntries(COLECCIONES_GESTION.map(c => [c, d[c] ?? []])) as unknown as GestionInstantanea
    }
  } catch { /* datos corruptos: se regeneran */ }
  const semilla = generarSemillaGestion()
  escribir(semilla)
  return semilla
}

function escribir(d: GestionInstantanea): void {
  try { localStorage.setItem(CLAVE, JSON.stringify(d)) } catch { /* sin espacio o modo privado */ }
}

const espera = (ms = 40) => new Promise<void>(r => setTimeout(r, ms))

let datos: GestionInstantanea | null = null
function estado(): GestionInstantanea {
  if (!datos) datos = leer()
  return datos
}

export const gestionRepoDemo: GestionRepositorio = {
  disponible: true,

  async cargar() {
    await espera(120)
    return structuredClone(estado())
  },

  async guardar(col, obj) {
    await espera()
    const d = estado()
    const lista = d[col] as RegistroGestion[]
    const copia = structuredClone(obj)
    const nueva = lista.some(x => x.id === copia.id) ? lista.map(x => (x.id === copia.id ? copia : x)) : [...lista, copia]
    datos = { ...d, [col]: nueva }
    escribir(datos)
    return copia
  },

  async borrar(col: ColGestion, id: string) {
    await espera()
    const d = estado()
    datos = { ...d, [col]: (d[col] as RegistroGestion[]).filter(x => x.id !== id) }
    escribir(datos)
  },

  async restablecer() {
    await espera(120)
    datos = generarSemillaGestion()
    escribir(datos)
    return structuredClone(datos)
  },
}
