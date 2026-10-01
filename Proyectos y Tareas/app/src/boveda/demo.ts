/**
 * Repositorio de DEMOSTRACIÓN de la Bóveda: en memoria y persistido en
 * localStorage. Solo se carga con `VITE_DEMO=1` (import diferido en main.tsx).
 * Arranca vacío: la bóveda se crea desde la pantalla, como en el entorno real.
 * Lo que se guarda aquí también va cifrado.
 */
import type { BovedaRepositorio } from './repo'
import type { Boveda, BovedaInstantanea, SecretoCifrado } from './types'
import { BOVEDA_VACIA } from './types'

const CLAVE = 'locodea.boveda.demo.v1'

function leer(): BovedaInstantanea {
  try {
    const raw = localStorage.getItem(CLAVE)
    if (raw) {
      const d = JSON.parse(raw) as Partial<BovedaInstantanea>
      return { bovedas: d.bovedas ?? [], secretos: d.secretos ?? [] }
    }
  } catch { /* datos corruptos: se empieza de cero */ }
  return structuredClone(BOVEDA_VACIA)
}

function escribir(d: BovedaInstantanea): void {
  try { localStorage.setItem(CLAVE, JSON.stringify(d)) } catch { /* sin espacio o modo privado */ }
}

const espera = (ms = 40) => new Promise<void>(r => setTimeout(r, ms))

let datos: BovedaInstantanea | null = null
function estado(): BovedaInstantanea {
  if (!datos) datos = leer()
  return datos
}

function sustituir<T extends { id: string }>(lista: T[], o: T): T[] {
  return lista.some(x => x.id === o.id) ? lista.map(x => (x.id === o.id ? o : x)) : [...lista, o]
}

export const bovedaRepoDemo: BovedaRepositorio = {
  disponible: true,

  async cargar() {
    await espera(120)
    return structuredClone(estado())
  },

  async guardarBoveda(b: Boveda) {
    await espera()
    datos = { ...estado(), bovedas: sustituir(estado().bovedas, structuredClone(b)) }
    escribir(datos)
    return b
  },

  async guardarSecreto(s: SecretoCifrado) {
    await espera()
    datos = { ...estado(), secretos: sustituir(estado().secretos, structuredClone(s)) }
    escribir(datos)
    return s
  },

  async borrarSecreto(id: string) {
    await espera()
    datos = { ...estado(), secretos: estado().secretos.filter(s => s.id !== id) }
    escribir(datos)
  },
}
