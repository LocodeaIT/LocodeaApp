/**
 * Tipos y utilidades comunes a todos los modelos: el resultado con sus
 * casillas, las líneas para mostrar y la acumulación por casilla.
 */
import type { ModeloFiscal } from '../../types'
import { r2 } from '../periodos'

export interface LineaModelo { casilla: string; descripcion: string; importe: number }

export interface ResultadoModelo {
  modelo: ModeloFiscal
  periodo: string
  /** Casillas con importe (las vacías no aparecen): { "27": 470, "45": 252, … }. */
  casillas: Record<string, number>
  /** Las casillas en el orden del modelo, con su descripción, para mostrar y revisar. */
  lineas: LineaModelo[]
  /** Positivo a ingresar, negativo a compensar o devolver; 0 en las declaraciones informativas. */
  resultado: number
  sinActividad: boolean
  /** Ids de los documentos (facturas y gastos) que entran en el cálculo. */
  incluidos: string[]
  avisos: string[]
}

/** Acumulador de casillas con redondeo a céntimos al final. */
export class Casillas {
  private m = new Map<string, number>()
  sumar(casilla: string, importe: number) { if (importe) this.m.set(casilla, (this.m.get(casilla) ?? 0) + importe) }
  poner(casilla: string, importe: number) { this.m.set(casilla, importe) }
  get(casilla: string) { return r2(this.m.get(casilla) ?? 0) }
  suma(...casillas: string[]) { return r2(casillas.reduce((s, c) => s + this.get(c), 0)) }
  /** Solo las casillas con importe distinto de cero, redondeadas. */
  aObjeto(): Record<string, number> {
    const o: Record<string, number> = {}
    for (const [k, v] of this.m) { const x = r2(v); if (x !== 0) o[k] = x }
    return o
  }
}

/**
 * Líneas en el orden del catálogo. Las de `siempre` salen aunque valgan cero (totales y resultado); el resto,
 * solo si tienen importe.
 */
export function lineasDe(casillas: Record<string, number>, catalogo: [string, string][], siempre: string[] = []): LineaModelo[] {
  return catalogo
    .filter(([c]) => siempre.includes(c) || (casillas[c] ?? 0) !== 0)
    .map(([casilla, descripcion]) => ({ casilla, descripcion, importe: casillas[casilla] ?? 0 }))
}

export const unicos = (ids: string[]) => [...new Set(ids)]

/** Formato español para los avisos: 1.234,56 €. */
export const euros = (n: number) => r2(n).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
