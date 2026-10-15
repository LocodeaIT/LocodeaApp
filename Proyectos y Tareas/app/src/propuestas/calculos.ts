/**
 * Cifras del embudo de propuestas. Funciones puras, con sus pruebas en
 * calculos.test.ts.
 */
import type { EstadoPropuesta, Propuesta } from './types'
import { ESTADOS_ABIERTOS, ESTADOS_PROPUESTA, PROBABILIDAD_ESTADO } from './types'

/** Probabilidad efectiva: la que se haya fijado o la típica de su estado. */
export function probabilidadDe(p: Pick<Propuesta, 'probabilidad' | 'estado'>): number {
  if (p.estado === 'aceptado') return 100
  if (p.estado === 'descartado') return 0
  return p.probabilidad ?? PROBABILIDAD_ESTADO[p.estado]
}

export const estaAbierta = (p: Pick<Propuesta, 'estado'>) => ESTADOS_ABIERTOS.includes(p.estado)

export interface ResumenEmbudo {
  abiertas: number
  /** Suma de importes de las abiertas. */
  enJuego: number
  /** Suma de importe × probabilidad de las abiertas. */
  ponderado: number
  aceptadas: number
  importeAceptado: number
  descartadas: number
  /** Aceptadas / (aceptadas + descartadas), en %; null si aún no se ha cerrado ninguna. */
  tasaExito: number | null
  /** Abiertas cuya fecha prevista ya ha pasado. */
  atrasadas: number
  porEstado: Record<EstadoPropuesta, { cuantas: number; importe: number }>
}

export function resumirEmbudo(propuestas: Propuesta[], hoy: string): ResumenEmbudo {
  const porEstado = Object.fromEntries(ESTADOS_PROPUESTA.map(e => [e, { cuantas: 0, importe: 0 }])) as ResumenEmbudo['porEstado']
  let enJuego = 0, ponderado = 0, atrasadas = 0
  for (const p of propuestas) {
    const importe = p.importe ?? 0
    porEstado[p.estado].cuantas++
    porEstado[p.estado].importe += importe
    if (estaAbierta(p)) {
      enJuego += importe
      ponderado += importe * probabilidadDe(p) / 100
      if (p.fechaPrevista && p.fechaPrevista < hoy) atrasadas++
    }
  }
  const aceptadas = porEstado.aceptado.cuantas
  const descartadas = porEstado.descartado.cuantas
  const cerradas = aceptadas + descartadas
  return {
    abiertas: ESTADOS_ABIERTOS.reduce((s, e) => s + porEstado[e].cuantas, 0),
    enJuego: redondear(enJuego), ponderado: redondear(ponderado),
    aceptadas, importeAceptado: redondear(porEstado.aceptado.importe), descartadas,
    tasaExito: cerradas ? Math.round((aceptadas / cerradas) * 100) : null,
    atrasadas, porEstado,
  }
}

const redondear = (n: number) => Math.round(n * 100) / 100

/** Siguiente orden libre al final de una columna. */
export function ordenAlFinal(propuestas: Propuesta[], estado: EstadoPropuesta): number {
  const enColumna = propuestas.filter(p => p.estado === estado)
  return enColumna.length ? Math.max(...enColumna.map(p => p.orden)) + 1 : 0
}

/** Las propuestas de una columna, en el orden del tablero (y por fecha de alta si empatan). */
export function columna(propuestas: Propuesta[], estado: EstadoPropuesta): Propuesta[] {
  return propuestas.filter(p => p.estado === estado).sort((a, b) => a.orden - b.orden || a.creadoEl.localeCompare(b.creadoEl))
}

const euros = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
const eurosCompactos = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', notation: 'compact', maximumFractionDigits: 1 })

export function formatoEuros(n: number | null | undefined, compacto = false): string {
  if (n === null || n === undefined) return '—'
  return compacto && Math.abs(n) >= 10000 ? eurosCompactos.format(n) : euros.format(n)
}

/** Iniciales para la ficha del cliente: «Talleres Moreno» → «TM». */
export function inicialesCliente(nombre: string): string {
  const palabras = nombre.trim().split(/\s+/).filter(w => w.length > 2 || /^[A-ZÁÉÍÓÚÑ]/.test(w))
  if (!palabras.length) return '?'
  return (palabras.length === 1 ? palabras[0].slice(0, 2) : palabras[0][0] + palabras[1][0]).toUpperCase()
}

/** Color estable por cliente, para que el mismo cliente se reconozca en todas sus tarjetas. */
const TONOS = ['#b07a4a', '#5b7fa6', '#3f7a4f', '#6a4f9a', '#c9773a', '#8e5e34', '#2a78d6', '#a8432f']
export function colorCliente(nombre: string): string {
  let h = 0
  for (const c of nombre.trim().toLowerCase()) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return TONOS[h % TONOS.length]
}
