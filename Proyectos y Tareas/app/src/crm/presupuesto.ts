/**
 * Conceptos del presupuesto de ofertas y pedidos de venta: fases del
 * proyecto (con semanas, cuándo se paga e importe) o las filas de los
 * otros modos, forma de pago, condiciones y qué apartados se imprimen. Lo que la
 * calculadora no sabe y el presupuesto impreso necesita.
 *
 * Se guarda en el mismo JSON que el cálculo de precio (loc_calculoprecio), con
 * la clave «presupuesto»: no hace falta columna nueva en Dataverse.
 */
import type { CalculoGuardado } from '../tarifas/motor'
import type { ApartadosPresupuesto, ColEntidad, FasePresupuesto, LineaDocumento, ModoPresupuesto, Presupuesto } from './types'
import { importeLinea } from './documentos'

/** Título del documento impreso. */
export const tituloPresupuesto = (col: ColEntidad) => (col === 'pedidosVenta' ? 'Pedido' : 'Presupuesto')

export const MODOS_PRESUPUESTO: { id: ModoPresupuesto; etiqueta: string; detalle: string }[] = [
  { id: 'fases', etiqueta: 'Por fases', detalle: 'Tabla de fases con semanas, pago e importe' },
  { id: 'concepto', etiqueta: 'Solo el concepto', detalle: 'El concepto con su importe, sin fases' },
  { id: 'lineas', etiqueta: 'Líneas', detalle: 'Las líneas de la calculadora, editables' },
]

export const APARTADOS: { id: keyof ApartadosPresupuesto; etiqueta: string; soloFases?: boolean }[] = [
  { id: 'concepto', etiqueta: 'Concepto' },
  { id: 'semanas', etiqueta: 'Columna «Semanas»', soloFases: true },
  { id: 'pago', etiqueta: 'Columna «Pago»', soloFases: true },
  { id: 'formaPago', etiqueta: 'Forma de pago' },
  { id: 'condiciones', etiqueta: 'Condiciones' },
  { id: 'observaciones', etiqueta: 'Observaciones (notas)' },
  { id: 'firmas', etiqueta: 'Firmas' },
]

const todos = (): ApartadosPresupuesto => ({ concepto: true, semanas: true, pago: true, formaPago: true, condiciones: true, observaciones: true, firmas: true })

export const presupuestoVacio = (): Presupuesto => ({
  modo: 'fases', concepto: '', fases: [], conceptos: [], lineas: [], formaPago: '', condiciones: '', incluir: todos(), moneda: 'EUR',
})

export const nuevaFase = (n: number): FasePresupuesto => ({ fase: String(n), titulo: '', descripcion: '', semanas: '', pago: '', importe: 0 })

const txt = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v))
const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0 }
const centimos = (n: number) => Math.round(n * 100) / 100
const MODOS = new Set<ModoPresupuesto>(['fases', 'concepto', 'lineas'])
const filas = (v: unknown): FasePresupuesto[] => (Array.isArray(v)
  ? v.map(f => ({ fase: txt(f?.fase), titulo: txt(f?.titulo), descripcion: txt(f?.descripcion), semanas: txt(f?.semanas), pago: txt(f?.pago), importe: num(f?.importe) }))
  : [])

/** Completa lo que falte (JSON antiguo o a medias). */
export function normalizarPresupuesto(p: Partial<Presupuesto> | null | undefined): Presupuesto {
  const v = p ?? {}
  const base = presupuestoVacio()
  const inc = (v.incluir ?? {}) as Partial<ApartadosPresupuesto>
  return {
    modo: MODOS.has(v.modo as ModoPresupuesto) ? v.modo as ModoPresupuesto : 'fases',
    concepto: txt(v.concepto),
    fases: filas(v.fases),
    conceptos: filas(v.conceptos),
    lineas: filas(v.lineas),
    formaPago: txt(v.formaPago),
    condiciones: txt(v.condiciones),
    incluir: Object.fromEntries(Object.entries(base.incluir).map(([k, def]) => [k, typeof inc[k as keyof ApartadosPresupuesto] === 'boolean' ? inc[k as keyof ApartadosPresupuesto] : def])) as unknown as ApartadosPresupuesto,
    moneda: txt(v.moneda).trim() || 'EUR',
  }
}

/** Si hay algo distinto del presupuesto vacío (si no, no se guarda). */
export function presupuestoConDatos(p: Presupuesto | null | undefined): p is Presupuesto {
  if (!p) return false
  return JSON.stringify(normalizarPresupuesto(p)) !== JSON.stringify(presupuestoVacio())
}

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

/** Filas editables del modo actual del presupuesto. */
export const CLAVE_FILAS: Record<ModoPresupuesto, 'fases' | 'conceptos' | 'lineas'> = { fases: 'fases', concepto: 'conceptos', lineas: 'lineas' }
export const filasDe = (p: Presupuesto) => p[CLAVE_FILAS[p.modo]]
export const sumaFilas = (filas: FasePresupuesto[]) => centimos(filas.reduce((s, f) => s + num(f.importe), 0))
export const sumaFases = (p: Presupuesto) => sumaFilas(p.fases)

/** Filas de partida a partir de las líneas del documento, con su importe neto. */
export function filasDesdeLineas(lineas: LineaDocumento[]): FasePresupuesto[] {
  return lineas.map((l, i) => ({ ...nuevaFase(i), fase: '', titulo: l.descripcion, importe: centimos(importeLinea(l)) }))
}

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

const primeraSemana = (semanas: string) => Number((semanas.match(/\d+/) ?? [])[0]) || 0

/** Número de la última semana que aparece en las fases («6 - 10» → 10). */
export function semanasTotales(fases: FasePresupuesto[]): number {
  return fases.reduce((m, f) => Math.max(m, ...(f.semanas.match(/\d+/g) ?? []).map(Number)), 0)
}

/** Cuándo se paga cada fase: la primera a la firma y cada una de las demás antes de empezar. */
export function pagosPorFase(fases: FasePresupuesto[]): FasePresupuesto[] {
  return fases.map((f, i) => {
    const sem = primeraSemana(f.semanas)
    return { ...f, pago: i === 0 ? 'A la firma' : sem ? `Antes de sem. ${sem}` : 'Antes de empezar la fase' }
  })
}

/** Texto de partida de la forma de pago, según el modo. */
export function formaPagoHabitual(modo: ModoPresupuesto): string {
  return modo === 'fases'
    ? 'Pago por adelantado de cada fase: la fase 0 se abona a la firma del presupuesto y cada una de las siguientes antes de su inicio, según la columna «Pago». Los trabajos de cada fase comienzan una vez recibido su pago.'
    : 'Pago por adelantado a la firma del presupuesto. Los trabajos comienzan una vez recibido el pago.'
}

/** Condiciones de partida, a retocar. */
export function condicionesHabituales(fases: FasePresupuesto[]): string {
  const semanas = semanasTotales(fases)
  return [
    semanas > 0 ? `Plazo de ejecución estimado: ${semanas} ${semanas === 1 ? 'semana' : 'semanas'} desde la firma.` : '',
    'No incluye licencias de Microsoft (Power Apps y Power Automate Premium por usuario), que contrata el cliente.',
    'Locodea AI no está incluido; se presupuestaría por separado.',
    'Cualquier cambio de alcance acordado durante el proyecto se valorará antes de ejecutarse.',
  ].filter(Boolean).join('\n')
}

export const lineasCondiciones = (p: Presupuesto) => p.condiciones.split(/\r?\n/).map(s => s.replace(/^[\s•\-–]+/, '').trim()).filter(Boolean)
