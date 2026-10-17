/**
 * Tarifas de la calculadora sobre Dataverse (tabla loc_tarifaprecio, creada
 * con scripts/tarifas-esquema.mjs). Cada guardado es una fila nueva con las
 * tarifas en JSON (loc_datos) y su autor; se lee la más reciente.
 */
import { Loc_tarifapreciosService } from '../generated/services/Loc_tarifapreciosService'
import { nuevoId } from '../data/repo'
import { normalizarTarifas, type Tarifas } from './motor'
import type { TarifasRepositorio, VersionTarifas } from './repo'

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

function leer(f: Fila): VersionTarifas {
  let datos: Partial<Tarifas> | null = null
  try { datos = f.loc_datos ? JSON.parse(String(f.loc_datos)) : null } catch { /* JSON roto: tarifas de partida */ }
  return { id: f.loc_tarifaprecioid, tarifas: normalizarTarifas(datos), autorId: f._loc_autor_value ?? null, creadoEl: String(f.createdon ?? '') }
}

export const tarifasRepoDataverse: TarifasRepositorio = {
  async cargar() {
    const r = comprobar(await Loc_tarifapreciosService.getAll({ top: 1, orderBy: ['createdon desc'] }), 'leer las tarifas')
    const filas = Array.isArray(r.data) ? r.data : []
    return filas.length ? leer(filas[0]) : null
  },

  async guardar(t, autorId) {
    const id = nuevoId()
    const ahora = new Date().toISOString()
    comprobar(await Loc_tarifapreciosService.create({
      loc_tarifaprecioid: id,
      loc_nombre: `Tarifas ${ahora.slice(0, 16).replace('T', ' ')}`,
      loc_datos: JSON.stringify(t),
      'loc_Autor@odata.bind': autorId ? `/loc_miembros(${autorId})` : null,
      statecode: 0,
    } as any), 'guardar las tarifas')
    return { id, tarifas: t, autorId, creadoEl: ahora }
  },
}
