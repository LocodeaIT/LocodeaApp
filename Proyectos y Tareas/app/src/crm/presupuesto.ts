/**
 * Conceptos del presupuesto de ofertas y pedidos de venta: fases del
 * proyecto, forma de pago y condiciones. Lo que la calculadora no sabe y el
 * presupuesto impreso necesita.
 *
 * Se guarda en el mismo JSON que el cálculo de precio (loc_calculoprecio), con
 * la clave «presupuesto»: no hace falta columna nueva en Dataverse.
 */
import type { CalculoGuardado } from '../tarifas/motor'
import type { ColEntidad, FasePresupuesto, HitoPago, Presupuesto } from './types'

/** Título del documento impreso. */
export const tituloPresupuesto = (col: ColEntidad) => (col === 'pedidosVenta' ? 'Pedido' : 'Presupuesto')

export const presupuestoVacio = (): Presupuesto => ({ concepto: '', fases: [], hitos: [], condiciones: '', moneda: 'EUR' })

export const nuevaFase = (n: number): FasePresupuesto => ({ fase: String(n), titulo: '', descripcion: '', semanas: '', importe: 0 })
export const nuevoHito = (): HitoPago => ({ hito: '', vencimiento: '', importe: 0 })

const txt = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v))
const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0 }
const centimos = (n: number) => Math.round(n * 100) / 100

/** Completa lo que falte (JSON antiguo o a medias). */
export function normalizarPresupuesto(p: Partial<Presupuesto> | null | undefined): Presupuesto {
  const v = p ?? {}
  return {
    concepto: txt(v.concepto),
    fases: Array.isArray(v.fases) ? v.fases.map(f => ({ fase: txt(f?.fase), titulo: txt(f?.titulo), descripcion: txt(f?.descripcion), semanas: txt(f?.semanas), importe: num(f?.importe) })) : [],
    hitos: Array.isArray(v.hitos) ? v.hitos.map(h => ({ hito: txt(h?.hito), vencimiento: txt(h?.vencimiento), importe: num(h?.importe) })) : [],
    condiciones: txt(v.condiciones),
    moneda: txt(v.moneda).trim() || 'EUR',
  }
}

export const presupuestoConDatos = (p: Presupuesto | null | undefined): p is Presupuesto =>
  !!p && (!!p.concepto.trim() || p.fases.length > 0 || p.hitos.length > 0 || !!p.condiciones.trim())

/** Lee loc_calculoprecio: el cálculo (si tiene entrada) y el presupuesto (si lo hay). */
export function leerCalculoYPresupuesto(v: unknown): { calculo: CalculoGuardado | null; presupuesto: Presupuesto | null } {
  if (!v) return { calculo: null, presupuesto: null }
  try {
    const o = JSON.parse(String(v)) as Partial<CalculoGuardado> & { presupuesto?: Partial<Presupuesto> }
    const { presupuesto, ...resto } = o ?? {}
    return {
      calculo: resto.entrada ? resto as CalculoGuardado : null,
      presupuesto: presupuesto ? normalizarPresupuesto(presupuesto) : null,
    }
  } catch {
    return { calculo: null, presupuesto: null }
  }
}

/** Texto para loc_calculoprecio, o null si no hay nada que guardar (así no se manda la columna). */
export function escribirCalculoYPresupuesto(calculo: CalculoGuardado | null | undefined, presupuesto: Presupuesto | null | undefined): string | null {
  const conPresupuesto = presupuestoConDatos(presupuesto)
  if (!calculo && !conPresupuesto) return null
  return JSON.stringify({ ...(calculo ?? {}), ...(conPresupuesto ? { presupuesto } : {}) })
}

export const sumaFases = (p: Presupuesto) => centimos(p.fases.reduce((s, f) => s + num(f.importe), 0))
export const sumaHitos = (p: Presupuesto) => centimos(p.hitos.reduce((s, h) => s + num(h.importe), 0))

/**
 * Reparte un total entre unos importes manteniendo sus proporciones (o a
 * partes iguales si todos son 0), en céntimos: lo que sobre del redondeo va
 * al último, así la suma es exacta.
 */
export function cuadrarImportes(importes: number[], total: number): number[] {
  if (!importes.length) return []
  const suma = importes.reduce((s, x) => s + Math.max(0, num(x)), 0)
  const pesos = suma > 0 ? importes.map(x => Math.max(0, num(x)) / suma) : importes.map(() => 1 / importes.length)
  const res = pesos.map(p => centimos(total * p))
  const resto = centimos(total - res.reduce((s, x) => s + x, 0))
  res[res.length - 1] = centimos(res[res.length - 1] + resto)
  return res
}

/** Número de la última semana que aparece en las fases («6 - 10» → 10). */
export function semanasTotales(fases: FasePresupuesto[]): number {
  return fases.reduce((m, f) => Math.max(m, ...(f.semanas.match(/\d+/g) ?? []).map(Number)), 0)
}

/** Condiciones de partida, a retocar. Sin cuota, no se menciona el mantenimiento. */
export function condicionesHabituales(fases: FasePresupuesto[], cuotaMantenimiento: number, eur: (n: number) => string): string {
  const semanas = semanasTotales(fases)
  return [
    semanas > 0 ? `Plazo de ejecución estimado: ${semanas} ${semanas === 1 ? 'semana' : 'semanas'} desde la firma.` : '',
    'No incluye licencias de Microsoft (Power Apps y Power Automate Premium por usuario), que contrata el cliente.',
    cuotaMantenimiento > 0 ? `Soporte y mantenimiento posteriores, opcionales: ${eur(cuotaMantenimiento)} al mes.` : '',
    'Cualquier cambio de alcance acordado durante el proyecto se valorará antes de ejecutarse.',
  ].filter(Boolean).join('\n')
}

/** Hitos de partida: uno por fase, a la firma el primero y al cierre de cada fase el resto. */
export function hitosPorFase(fases: FasePresupuesto[]): HitoPago[] {
  return fases.map((f, i) => ({
    hito: `Fase ${f.fase || i}`,
    vencimiento: i === 0 ? 'A la firma del presupuesto' : i === fases.length - 1 ? 'Al cierre del proyecto' : 'Al cierre y validación de la fase',
    importe: num(f.importe),
  }))
}

export const lineasCondiciones = (p: Presupuesto) => p.condiciones.split(/\r?\n/).map(s => s.replace(/^[\s•\-–]+/, '').trim()).filter(Boolean)
