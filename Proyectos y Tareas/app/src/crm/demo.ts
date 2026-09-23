/**
 * Repositorio de DEMOSTRACIÓN del CRM: todo en memoria, persistido en
 * localStorage. Solo se carga con `VITE_DEMO=1` (import diferido en main.tsx),
 * así que no viaja al paquete publicado.
 *
 * Los datos de ejemplo están en semilla.ts y se regeneran solos si se borran.
 */
import type { CrmRepositorio } from './repo'
import type { Coleccion, CrmInstantanea, RegistroBase } from './types'
import { COLECCIONES } from './types'
import { generarSemillaCrm } from './semilla'

const CLAVE = 'locodea.crm.demo.v1'

function leer(): CrmInstantanea {
  try {
    const raw = localStorage.getItem(CLAVE)
    if (raw) {
      const d = JSON.parse(raw) as Partial<CrmInstantanea>
      // colecciones nuevas en versiones posteriores del modelo
      return Object.fromEntries(COLECCIONES.map(c => [c, d[c] ?? []])) as unknown as CrmInstantanea
    }
  } catch { /* datos corruptos: se regeneran */ }
  const semilla = generarSemillaCrm()
  escribir(semilla)
  return semilla
}

function escribir(d: CrmInstantanea): void {
  try { localStorage.setItem(CLAVE, JSON.stringify(d)) } catch { /* sin espacio o modo privado */ }
}

/** Pequeña latencia para que los guardados se vean como serán con red. */
const espera = (ms = 40) => new Promise<void>(r => setTimeout(r, ms))

let datos: CrmInstantanea | null = null
function estado(): CrmInstantanea {
  if (!datos) datos = leer()
  return datos
}

export const crmRepoDemo: CrmRepositorio = {
  disponible: true,

  async cargar() {
    await espera(150)
    return structuredClone(estado())
  },

  async guardar(col, obj) {
    await espera()
    const d = estado()
    const lista = d[col] as RegistroBase[]
    const copia = structuredClone(obj)
    const nueva = lista.some(x => x.id === copia.id) ? lista.map(x => (x.id === copia.id ? copia : x)) : [...lista, copia]
    datos = { ...d, [col]: nueva }
    escribir(datos)
    return copia
  },

  async borrar(col: Coleccion, id: string) {
    await espera()
    const d = estado()
    datos = { ...d, [col]: (d[col] as RegistroBase[]).filter(x => x.id !== id) }
    escribir(datos)
  },

  async reemplazar(d) {
    await espera(150)
    datos = Object.fromEntries(COLECCIONES.map(c => [c, d[c] ?? []])) as unknown as CrmInstantanea
    escribir(datos)
    return structuredClone(datos)
  },

  async restablecer() {
    await espera(150)
    datos = generarSemillaCrm()
    escribir(datos)
    return structuredClone(datos)
  },
}
