/**
 * Salud de la bóveda: contraseñas débiles, repetidas o antiguas y claves API
 * que caducan. Todo se calcula en memoria con la bóveda abierta.
 */
import { fortaleza } from './generador'
import type { Elemento } from './types'

export type Problema = 'debil' | 'repetida' | 'antigua' | 'caduca' | 'caducada'

export const TEXTO_PROBLEMA: Record<Problema, string> = {
  debil: 'Débil', repetida: 'Repetida', antigua: 'Sin cambiar hace más de un año', caduca: 'Caduca pronto', caducada: 'Caducada',
}

const DIA = 86_400_000

export function diasDesde(iso: string | null | undefined, ahora = Date.now()): number | null {
  if (!iso) return null
  const t = Date.parse(iso)
  return Number.isNaN(t) ? null : Math.floor((ahora - t) / DIA)
}

export function diasHasta(dia: string | null | undefined, ahora = Date.now()): number | null {
  if (!dia) return null
  const t = Date.parse(`${dia}T00:00:00`)
  return Number.isNaN(t) ? null : Math.ceil((t - ahora) / DIA)
}

export interface Salud {
  /** Problemas de cada elemento, por id. */
  problemas: Map<string, Problema[]>
  debiles: number
  repetidas: number
  antiguas: number
  caducan: number
  /** 0–100: la parte de elementos con secreto que no tiene ningún problema. */
  puntuacion: number
  conSecreto: number
}

export function calcularSalud(elementos: Elemento[], ahora = Date.now()): Salud {
  const usos = new Map<string, number>()
  for (const e of elementos) if (e.tipo === 'login' && e.contrasena) usos.set(e.contrasena, (usos.get(e.contrasena) ?? 0) + 1)

  const problemas = new Map<string, Problema[]>()
  let debiles = 0, repetidas = 0, antiguas = 0, caducan = 0, conSecreto = 0, sanos = 0
  for (const e of elementos) {
    const p: Problema[] = []
    if (e.tipo === 'login' && e.contrasena) {
      conSecreto++
      if (fortaleza(e.contrasena).nivel < 2) { p.push('debil'); debiles++ }
      if ((usos.get(e.contrasena) ?? 0) > 1) { p.push('repetida'); repetidas++ }
      const edad = diasDesde(e.cambiadaEl ?? e.creadoEl, ahora)
      if (edad !== null && edad > 365) { p.push('antigua'); antiguas++ }
    }
    if (e.tipo === 'api' && e.clave) {
      conSecreto++
      const quedan = diasHasta(e.caduca, ahora)
      if (quedan !== null && quedan < 0) { p.push('caducada'); caducan++ }
      else if (quedan !== null && quedan <= 30) { p.push('caduca'); caducan++ }
    }
    if (p.length) problemas.set(e.id, p)
    else if ((e.tipo === 'login' && e.contrasena) || (e.tipo === 'api' && e.clave)) sanos++
  }
  const puntuacion = conSecreto ? Math.round((sanos / conSecreto) * 100) : 100
  return { problemas, debiles, repetidas, antiguas, caducan, puntuacion, conSecreto }
}

/** Dominio legible de una URL («app.powerbi.com»), o el texto tal cual. */
export function dominio(url: string): string {
  if (!url) return ''
  try {
    return new URL(/^[a-z]+:\/\//i.test(url) ? url : `https://${url}`).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/** Enlace abrible solo si es http(s): nada de javascript: ni similares. */
export function enlaceSeguro(url: string): string | null {
  if (!url) return null
  const conEsquema = /^[a-z]+:\/\//i.test(url) ? url : `https://${url}`
  try {
    const u = new URL(conEsquema)
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null
  } catch {
    return null
  }
}
