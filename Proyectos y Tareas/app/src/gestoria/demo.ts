/**
 * Repositorio de DEMOSTRACIÓN de la Gestoría: en memoria y persistido en
 * localStorage. Solo se carga con `VITE_DEMO=1` (import diferido en main.tsx).
 */
import type { GestoriaRepositorio } from './repo'
import type { ColGestoria, GestoriaInstantanea, RegistroGestoria } from './types'
import { COLECCIONES_GESTORIA } from './types'
import { generarSemillaGestoria } from './semilla'

const CLAVE = 'locodea.gestoria.demo.v1'

function leer(): GestoriaInstantanea {
  try {
    const raw = localStorage.getItem(CLAVE)
    if (raw) {
      const d = JSON.parse(raw) as Partial<GestoriaInstantanea>
      return Object.fromEntries(COLECCIONES_GESTORIA.map(c => [c, d[c] ?? []])) as unknown as GestoriaInstantanea
    }
  } catch { /* datos corruptos: se regeneran */ }
  const semilla = generarSemillaGestoria()
  escribir(semilla)
  return semilla
}

function escribir(d: GestoriaInstantanea): void {
  try { localStorage.setItem(CLAVE, JSON.stringify(d)) } catch { /* sin espacio o modo privado */ }
}

const espera = (ms = 40) => new Promise<void>(r => setTimeout(r, ms))

let datos: GestoriaInstantanea | null = null
function estado(): GestoriaInstantanea {
  if (!datos) datos = leer()
  return datos
}

export const gestoriaRepoDemo: GestoriaRepositorio = {
  disponible: true,

  async cargar() {
    await espera(120)
    return structuredClone(estado())
  },

  async guardar(col, obj) {
    await espera()
    const d = estado()
    const lista = d[col] as RegistroGestoria[]
    const copia = structuredClone(obj)
    const nueva = lista.some(x => x.id === copia.id) ? lista.map(x => (x.id === copia.id ? copia : x)) : [...lista, copia]
    datos = { ...d, [col]: nueva }
    escribir(datos)
    return copia
  },

  async borrar(col: ColGestoria, id: string) {
    await espera()
    const d = estado()
    datos = { ...d, [col]: (d[col] as RegistroGestoria[]).filter(x => x.id !== id) }
    escribir(datos)
  },

  async restablecer() {
    await espera(120)
    datos = generarSemillaGestoria()
    escribir(datos)
    return structuredClone(datos)
  },
}
