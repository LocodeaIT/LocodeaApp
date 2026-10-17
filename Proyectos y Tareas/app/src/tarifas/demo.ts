/**
 * Repositorio de DEMOSTRACIÓN de las tarifas: en localStorage. Solo se carga
 * con `VITE_DEMO=1` (import diferido en main.tsx). Arranca sin versiones
 * guardadas, así que la calculadora usa las tarifas de partida.
 */
import type { TarifasRepositorio, VersionTarifas } from './repo'
import { normalizarTarifas } from './motor'

const CLAVE = 'locodea.tarifas.demo.v1'

export const tarifasRepoDemo: TarifasRepositorio = {
  async cargar() {
    try {
      const raw = localStorage.getItem(CLAVE)
      if (!raw) return null
      const v = JSON.parse(raw) as VersionTarifas
      return { ...v, tarifas: normalizarTarifas(v.tarifas) }
    } catch {
      return null
    }
  },

  async guardar(tarifas, autorId) {
    const v: VersionTarifas = { id: `demo-tarifas-${Date.now()}`, tarifas, autorId, creadoEl: new Date().toISOString() }
    try { localStorage.setItem(CLAVE, JSON.stringify(v)) } catch { /* sin espacio o modo privado */ }
    return v
  },
}
