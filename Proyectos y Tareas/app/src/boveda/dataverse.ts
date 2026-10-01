/**
 * Repositorio de la Bóveda sobre Dataverse (tablas loc_boveda y loc_secreto de
 * la solución LocodeaObjetivos; el esquema lo crea scripts/boveda-esquema.mjs).
 *
 * Mismas reglas que ../gestion/dataverse.ts: el id es el GUID de la fila y se
 * manda como clave primaria al crear; los catálogos son columnas Choice
 * (valores 4120005xx); las búsquedas se leen de `_loc_x_value` y se escriben
 * con `loc_X@odata.bind`.
 *
 * Aquí no hay nada en claro: loc_datos es el elemento cifrado y la fila de la
 * bóveda solo guarda la sal y la clave envuelta. La referencia (columna
 * principal) es un código sin significado para no filtrar el nombre.
 */
import type { BovedaRepositorio } from './repo'
import type { Boveda, BovedaInstantanea, SecretoCifrado, TipoBoveda } from './types'
import { Loc_bovedasService } from '../generated/services/Loc_bovedasService'
import { Loc_secretosService } from '../generated/services/Loc_secretosService'

// ─────────────────────────────────────────────── choices (mismos valores que scripts/boveda-esquema.mjs)

const TIPO: Record<TipoBoveda, number> = { equipo: 412000500, personal: 412000501 }
const DE_TIPO: Record<number, TipoBoveda> = { 412000500: 'equipo', 412000501: 'personal' }

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

const leerBoveda = (f: Fila): Boveda => ({
  id: f.loc_bovedaid, nombre: txt(f.loc_nombre), tipo: DE_TIPO[f.loc_tipo] ?? 'equipo', propietarioId: f._loc_propietario_value ?? null,
  sal: txt(f.loc_sal), iteraciones: Number(f.loc_iteraciones) || 0, claveEnvuelta: txt(f.loc_claveenvuelta), algoritmo: txt(f.loc_algoritmo),
  creadoEl: txt(f.createdon), actualizadoEl: nulo(f.modifiedon),
})

const escribirBoveda = (b: Boveda) => ({
  loc_nombre: b.nombre.slice(0, 200), loc_tipo: TIPO[b.tipo], loc_sal: b.sal, loc_iteraciones: b.iteraciones,
  loc_claveenvuelta: b.claveEnvuelta, loc_algoritmo: b.algoritmo, 'loc_Propietario@odata.bind': ref('loc_miembros', b.propietarioId),
})

const leerSecreto = (f: Fila): SecretoCifrado => ({
  id: f.loc_secretoid, bovedaId: f._loc_boveda_value ?? '', datos: txt(f.loc_datos), creadoEl: txt(f.createdon), actualizadoEl: nulo(f.modifiedon),
})

const escribirSecreto = (s: SecretoCifrado) => ({
  loc_referencia: `S-${s.id.slice(0, 8)}`, loc_datos: s.datos, 'loc_Boveda@odata.bind': ref('loc_bovedas', s.bovedaId),
})

// ─────────────────────────────────────────────── repositorio

const TOPE = 5000
const conocidas = new Set<string>()
const conocidos = new Set<string>()

export const bovedaRepoDataverse: BovedaRepositorio = {
  disponible: true,

  async cargar(): Promise<BovedaInstantanea> {
    const [b, s] = await Promise.all([
      Loc_bovedasService.getAll({ top: TOPE }).then(r => comprobar(r, 'leer las bóvedas')),
      Loc_secretosService.getAll({ top: TOPE }).then(r => comprobar(r, 'leer los secretos')),
    ])
    const bovedas = lista(b).map(leerBoveda)
    const secretos = lista(s).map(leerSecreto)
    for (const x of bovedas) conocidas.add(x.id)
    for (const x of secretos) conocidos.add(x.id)
    return { bovedas, secretos }
  },

  async guardarBoveda(b) {
    const cuerpo = escribirBoveda(b)
    if (conocidas.has(b.id)) {
      comprobar(await Loc_bovedasService.update(b.id, cuerpo as any), 'actualizar la bóveda')
    } else {
      comprobar(await Loc_bovedasService.create({ ...cuerpo, loc_bovedaid: b.id, statecode: 0 } as any), 'crear la bóveda')
      conocidas.add(b.id)
    }
    return b
  },

  async guardarSecreto(s) {
    const cuerpo = escribirSecreto(s)
    if (conocidos.has(s.id)) {
      comprobar(await Loc_secretosService.update(s.id, cuerpo as any), 'actualizar el secreto')
    } else {
      comprobar(await Loc_secretosService.create({ ...cuerpo, loc_secretoid: s.id, statecode: 0 } as any), 'crear el secreto')
      conocidos.add(s.id)
    }
    return s
  },

  async borrarSecreto(id) {
    await Loc_secretosService.delete(id)
    conocidos.delete(id)
  },
}
