/**
 * Preferencias del CRM que se recuerdan en este navegador: qué pestañas de
 * cada ficha están abiertas o plegadas. Si localStorage no está disponible
 * (modo privado, iframe sin permisos) se usa lo predeterminado sin avisar.
 */
import type { ColEntidad } from './types'

const CLAVE = 'locodea.crm.pestanas.v1'

type Pestanas = Partial<Record<ColEntidad, Record<string, boolean>>>

function leerTodo(): Pestanas {
  try { return JSON.parse(localStorage.getItem(CLAVE) ?? '{}') as Pestanas } catch { return {} }
}

export function pestanasGuardadas(col: ColEntidad): Record<string, boolean> {
  return leerTodo()[col] ?? {}
}

export function guardarPestanas(col: ColEntidad, estado: Record<string, boolean>): void {
  try { localStorage.setItem(CLAVE, JSON.stringify({ ...leerTodo(), [col]: estado })) } catch { /* sin almacenamiento: no se recuerda */ }
}
