/**
 * Impuesto sobre Sociedades: tipo de gravamen por ejercicio, liquidación
 * (base imponible, compensación de bases negativas, cuota), ajustes
 * fiscales por gastos no deducibles y pago fraccionado del modelo 202.
 *
 * Fuentes comprobadas (octubre de 2026):
 *  - Tipos 2025 y siguientes (AEAT, manual de Sociedades 2025):
 *    https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-practicos/manual-sociedades-2025/principales-novedades-impuesto-sobre-sociedades-2025/tipos-gravamen.html
 *  - Art. 29.1 LIS (redacción de la Ley 7/2024) y DT 44.ª (escala transitoria):
 *    https://www.boe.es/buscar/act.php?id=BOE-A-2014-12328#a29
 *    https://www.boe.es/buscar/act.php?id=BOE-A-2014-12328#dtcuadragesimacuarta
 *  - Art. 26 LIS (compensación de bases negativas): https://www.boe.es/buscar/act.php?id=BOE-A-2014-12328#a26
 *  - Art. 40 LIS (pago fraccionado): https://www.boe.es/buscar/act.php?id=BOE-A-2014-12328#a40
 *  - Obligación de presentar el 202 sin ingreso (AEAT, manual de Sociedades 2025, cap. 15):
 *    https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-practicos/manual-sociedades-2025/capitulo-15-pago-fraccionado-is-2026/pago-fraccionado-is-2026/modelo-que-se-debe-utilizar-fraccionados.html
 */
import type { GestionInstantanea } from '../../gestion/types'
import type { GestoriaInstantanea, LineaAsiento, PerfilFiscal } from '../types'
import type { Asiento } from './asientos'
import { alDebe, alHaber, esCierre } from './apuntes'
import { anioDe, dia, r2 } from './desglose'

// ─────────────────────────────────────────────── tipo de gravamen

export interface Tramo { hasta: number | null; tipo: number }

const diaNum = (d: string) => Math.round(Date.parse(d + 'T00:00:00Z') / 86400000)

/**
 * Días del periodo impositivo: del día de constitución al 31 de diciembre en
 * el primer ejercicio; 365 en los demás.
 */
export function diasDelPeriodo(perfil: PerfilFiscal | null, ejercicio: number): number {
  const ini = dia(perfil?.fechaConstitucion)
  if (!ini || anioDe(ini) !== ejercicio) return 365
  return Math.min(365, diaNum(`${ejercicio}-12-31`) - diaNum(ini) + 1)
}

/** El ejercicio es el primero con base positiva o el siguiente (15 % de las entidades de nueva creación). */
function esPeriodoNuevaCreacion(ejercicio: number, perfil: PerfilFiscal, baseImponible: number): boolean {
  if (!perfil.nuevaCreacion) return false
  const p = Number(perfil.primerEjercicioPositivo) || 0
  return p ? ejercicio === p || ejercicio === p + 1 : baseImponible > 0
}

/**
 * Tipo de gravamen del ejercicio (art. 29.1 LIS y DT 44.ª):
 *  - Nueva creación: 15 % el primer periodo con base positiva y el siguiente,
 *    salvo que le toque un tipo inferior (ninguna escala baja del 17 %).
 *  - Microempresa (cifra de negocios del periodo anterior < 1 M€): 2025 21/22 %,
 *    2026 19/21 %, 2027 y siguientes 17/20 % (primeros 50.000 € / resto;
 *    los 50.000 € se prorratean por días si el periodo dura menos de un año).
 *    2023 y 2024: 23 % (Ley 31/2022).
 *  - Empresa de reducida dimensión (art. 101, < 10 M€): 2025 24 %, 2026 23 %,
 *    2027 22 %, 2028 21 %, 2029 y siguientes 20 %; antes de 2025, 25 %.
 *  - General: 25 %.
 * Ninguno de los reducidos se aplica a las entidades patrimoniales (art. 5.2).
 */
// Comprobar: en el primer periodo de una entidad nueva la cifra de negocios es la del propio periodo elevada al año (art. 101.2);
// aquí se usa `perfil.cifraNegocios`.
export function tipoGravamen(ejercicio: number, perfil: PerfilFiscal, baseImponible: number, diasPeriodo = 365): { tramos: Tramo[]; motivo: string } {
  if (esPeriodoNuevaCreacion(ejercicio, perfil, baseImponible)) {
    return { tramos: [{ hasta: null, tipo: 15 }], motivo: 'Entidad de nueva creación: 15 % en el primer periodo con base imponible positiva y en el siguiente (art. 29.1 LIS).' }
  }
  const cifra = Number(perfil.cifraNegocios) || 0
  const tope = r2(50000 * Math.min(1, diasPeriodo / 365))
  if (cifra < 1e6 && ejercicio >= 2025) {
    const [t1, t2] = ejercicio === 2025 ? [21, 22] : ejercicio === 2026 ? [19, 21] : [17, 20]
    const ley = ejercicio <= 2026 ? 'DT 44.ª LIS, Ley 7/2024' : 'art. 29.1 LIS'
    return {
      tramos: [{ hasta: tope, tipo: t1 }, { hasta: null, tipo: t2 }],
      motivo: `Microempresa (cifra de negocios < 1 M€): ${t1} % hasta ${tope.toLocaleString('es-ES')} € y ${t2} % el resto en ${ejercicio} (${ley}).`,
    }
  }
  if (cifra < 1e6 && ejercicio >= 2023) {
    return { tramos: [{ hasta: null, tipo: 23 }], motivo: 'Cifra de negocios < 1 M€: 23 % en 2023 y 2024 (art. 29.1 LIS, Ley 31/2022).' }
  }
  if (cifra < 10e6 && ejercicio >= 2025) {
    const tipo = ({ 2025: 24, 2026: 23, 2027: 22, 2028: 21 } as Record<number, number>)[ejercicio] ?? 20
    const ley = ejercicio <= 2028 ? 'DT 44.ª LIS, Ley 7/2024' : 'art. 29.1 LIS'
    return { tramos: [{ hasta: null, tipo }], motivo: `Empresa de reducida dimensión (cifra de negocios < 10 M€): ${tipo} % en ${ejercicio} (${ley}).` }
  }
  return { tramos: [{ hasta: null, tipo: 25 }], motivo: 'Tipo general del 25 % (art. 29.1 LIS).' }
}

export interface TramoAplicado { desde: number; hasta: number | null; tipo: number; base: number; cuota: number }

/** Reparte la base imponible entre los tramos. */
export function aplicarTramos(tramos: Tramo[], baseImponible: number): TramoAplicado[] {
  const out: TramoAplicado[] = []
  let desde = 0
  for (const t of tramos) {
    if (baseImponible <= desde) break
    const tope = t.hasta == null ? baseImponible : Math.min(baseImponible, t.hasta)
    const base = r2(tope - desde)
    out.push({ desde, hasta: t.hasta, tipo: t.tipo, base, cuota: r2(base * t.tipo / 100) })
    desde = tope
  }
  return out
}

// ─────────────────────────────────────────────── liquidación

export interface EntradaImpuesto {
  ejercicio: number
  perfil: PerfilFiscal
  resultadoContable: number
  ajustesPositivos: number
  ajustesNegativos: number
  /** Bases negativas pendientes por ejercicio de origen: { "2026": 1200 }. */
  basesNegativas: Record<string, number>
  retenciones: number
  pagosFraccionados: number
  deducciones?: number
  /** Días del periodo impositivo; por defecto, los que salen de la fecha de constitución. */
  diasPeriodo?: number
}

export interface ResultadoImpuesto {
  resultadoContable: number
  ajustesPositivos: number
  ajustesNegativos: number
  baseImponiblePrevia: number
  /** Límite de compensación del ejercicio (art. 26 LIS). */
  limiteCompensacion: number
  compensacionBins: number
  /** Detalle de lo compensado por ejercicio de origen, de la más antigua a la más reciente. */
  compensaciones: { ejercicio: string; importe: number }[]
  baseImponible: number
  tramos: TramoAplicado[]
  cuotaIntegra: number
  deducciones: number
  cuotaLiquida: number
  retenciones: number
  pagosFraccionados: number
  /** Positiva a ingresar, negativa a devolver. */
  cuotaDiferencial: number
  basesNegativasGeneradas: number
  /** Bases negativas que quedan para ejercicios siguientes (incluida la generada en este). */
  basesNegativasPendientes: Record<string, number>
  /** Valor de `perfil.primerEjercicioPositivo` después de este ejercicio. */
  primerEjercicioPositivo: number
  tipoAplicado: string
}

/**
 * Porcentaje de la base previa que se puede compensar: 70 % en general;
 * 50 % con cifra de negocios de 20 a 60 M€ y 25 % desde 60 M€ (DA 15.ª LIS).
 */
// Comprobar: vigencia de los límites del 50 % y el 25 % de la DA 15.ª (STC 11/2024 y Ley 7/2024); no afectan a Locodea.
const porcentajeCompensacion = (cifra: number) => cifra >= 60e6 ? 0.25 : cifra >= 20e6 ? 0.5 : 0.7

/**
 * Límite de compensación de bases negativas (art. 26 LIS): el 70 % de la
 * base previa, y en todo caso hasta 1 M€ (prorrateado si el periodo dura
 * menos de un año), nunca más que la base previa. No es «1 M€ más el 70 %
 * del exceso»: es el mayor de los dos. Las entidades de nueva creación no
 * tienen el límite del 70 % en los 3 primeros periodos con base previa
 * positiva (art. 26.3).
 */
// Comprobar: se toman como esos 3 periodos el primero con base positiva (perfil.primerEjercicioPositivo) y los dos siguientes.
export function limiteCompensacion(e: { ejercicio: number; perfil: PerfilFiscal; baseImponiblePrevia: number; diasPeriodo?: number }): number {
  const previa = e.baseImponiblePrevia
  if (previa <= 0) return 0
  const p = Number(e.perfil.primerEjercicioPositivo) || 0
  if (e.perfil.nuevaCreacion && (!p || e.ejercicio < p + 3)) return r2(previa)
  const dias = e.diasPeriodo ?? diasDelPeriodo(e.perfil, e.ejercicio)
  const millon = 1e6 * Math.min(1, dias / 365)
  return r2(Math.min(previa, Math.max(previa * porcentajeCompensacion(Number(e.perfil.cifraNegocios) || 0), millon)))
}

/** Liquidación del Impuesto sobre Sociedades del ejercicio (modelo 200). */
export function impuestoSociedades(e: EntradaImpuesto): ResultadoImpuesto {
  const dias = e.diasPeriodo ?? diasDelPeriodo(e.perfil, e.ejercicio)
  const previa = r2((Number(e.resultadoContable) || 0) + (Number(e.ajustesPositivos) || 0) - (Number(e.ajustesNegativos) || 0))
  const limite = limiteCompensacion({ ejercicio: e.ejercicio, perfil: e.perfil, baseImponiblePrevia: previa, diasPeriodo: dias })

  // se compensan primero las bases más antiguas (y solo las de ejercicios anteriores)
  const pendientes: Record<string, number> = {}
  const compensaciones: { ejercicio: string; importe: number }[] = []
  let queda = limite
  for (const k of Object.keys(e.basesNegativas ?? {}).sort()) {
    const importe = r2(Number(e.basesNegativas[k]) || 0)
    if (importe <= 0) continue
    const usa = Number(k) < e.ejercicio ? r2(Math.min(importe, queda)) : 0
    if (usa > 0) { compensaciones.push({ ejercicio: k, importe: usa }); queda = r2(queda - usa) }
    if (importe - usa > 0) pendientes[k] = r2(importe - usa)
  }
  const compensacion = r2(compensaciones.reduce((s, c) => s + c.importe, 0))
  const baseImponible = previa > 0 ? r2(previa - compensacion) : previa
  const generadas = previa < 0 ? r2(-previa) : 0
  if (generadas) pendientes[String(e.ejercicio)] = r2((pendientes[String(e.ejercicio)] ?? 0) + generadas)

  const { tramos, motivo } = tipoGravamen(e.ejercicio, e.perfil, baseImponible, dias)
  const aplicados = baseImponible > 0 ? aplicarTramos(tramos, baseImponible) : []
  const cuotaIntegra = r2(aplicados.reduce((s, t) => s + t.cuota, 0))
  const deducciones = r2(Math.min(Math.max(0, Number(e.deducciones) || 0), cuotaIntegra))
  const cuotaLiquida = r2(cuotaIntegra - deducciones)
  const retenciones = r2(Number(e.retenciones) || 0), pagosFraccionados = r2(Number(e.pagosFraccionados) || 0)
  const p = Number(e.perfil.primerEjercicioPositivo) || 0

  return {
    resultadoContable: r2(e.resultadoContable), ajustesPositivos: r2(e.ajustesPositivos), ajustesNegativos: r2(e.ajustesNegativos),
    baseImponiblePrevia: previa, limiteCompensacion: limite, compensacionBins: compensacion, compensaciones, baseImponible,
    tramos: aplicados, cuotaIntegra, deducciones, cuotaLiquida, retenciones, pagosFraccionados,
    cuotaDiferencial: r2(cuotaLiquida - retenciones - pagosFraccionados),
    basesNegativasGeneradas: generadas, basesNegativasPendientes: pendientes,
    primerEjercicioPositivo: !p && baseImponible > 0 ? e.ejercicio : p,
    tipoAplicado: baseImponible > 0 ? motivo : 'Base imponible nula o negativa: no hay cuota.',
  }
}

/**
 * Apuntes del asiento del impuesto (para guardarlo como asiento manual de
 * tipo 'impuesto' a 31 de diciembre): 6300 al debe por la cuota líquida, 473
 * al haber por las retenciones y pagos a cuenta aplicados y la diferencia a
 * 4752 (a pagar) o 4709 (a devolver).
 */
export function lineasAsientoImpuesto(r: ResultadoImpuesto): LineaAsiento[] {
  const aCuenta = r2(r.retenciones + r.pagosFraccionados)
  return [
    alDebe('6300', r.cuotaLiquida, 'Impuesto corriente'),
    alHaber('473', aCuenta, 'Retenciones y pagos a cuenta aplicados'),
    r.cuotaDiferencial > 0 ? alHaber('4752', r.cuotaDiferencial, 'Cuota a ingresar') : alDebe('4709', -r.cuotaDiferencial, 'Cuota a devolver'),
  ].filter((l): l is LineaAsiento => !!l)
}

/** Pagos fraccionados (modelo 202) pagados o domiciliados a cuenta del ejercicio. */
export function pagosFraccionadosDelEjercicio(gestoria: GestoriaInstantanea, ejercicio: number): number {
  return r2(gestoria.presentaciones
    .filter(p => p.modelo === '202' && p.periodo.startsWith(`${ejercicio}-`) && (p.estado === 'pagada' || p.estado === 'domiciliada') && p.importe > 0)
    .reduce((s, p) => s + p.importe, 0))
}

// ─────────────────────────────────────────────── ajustes fiscales

export interface AjusteFiscal {
  tipo: 'positivo' | 'negativo'
  concepto: string
  importe: number
  cuenta?: string
  origen?: { col: string; id: string }
}

export interface AjustesFiscales { positivos: number; negativos: number; detalle: AjusteFiscal[] }

/**
 * Ajustes al resultado contable por gastos no deducibles (art. 15 LIS):
 * gastos con ticket marcados como no deducibles en el IS, multas y
 * sanciones (678) y el propio gasto por el Impuesto sobre Sociedades (6300).
 */
// Comprobar: se toma todo 678 como sanciones; un gasto excepcional que no sea sanción sí sería deducible.
export function ajustesFiscales(e: { gestion: GestionInstantanea; asientos: Asiento[]; ejercicio: number }): AjustesFiscales {
  const detalle: AjusteFiscal[] = []
  const delEjercicio = e.asientos.filter(a => anioDe(a.fecha) === e.ejercicio && !esCierre(a))
  const yaContados = new Set<string>()
  const gastoDe = (a: Asiento, pref: (c: string) => boolean) => r2(a.lineas.filter(l => pref(l.cuenta)).reduce((s, l) => s + l.debe - l.haber, 0))

  for (const g of e.gestion.gastos) {
    if (g.facturaCompraId || g.deducibleIs !== false) continue
    const a = delEjercicio.find(x => x.id === `g:${g.id}`)
    if (!a) continue
    const importe = gastoDe(a, c => c[0] === '6')
    if (!importe) continue
    yaContados.add(a.id)
    detalle.push({ tipo: 'positivo', concepto: `Gasto no deducible: ${g.concepto}`, importe, cuenta: a.lineas.find(l => l.cuenta[0] === '6')?.cuenta, origen: { col: 'gastos', id: g.id } })
  }
  for (const a of delEjercicio) {
    if (yaContados.has(a.id)) continue
    const sanciones = gastoDe(a, c => c.startsWith('678'))
    if (sanciones > 0) detalle.push({ tipo: 'positivo', concepto: `Multas y sanciones: ${a.concepto}`, importe: sanciones, cuenta: '678' })
  }
  const impuesto = r2(delEjercicio.reduce((s, a) => s + gastoDe(a, c => c.startsWith('630')), 0))
  if (impuesto > 0) detalle.push({ tipo: 'positivo', concepto: 'Gasto por Impuesto sobre Sociedades', importe: impuesto, cuenta: '6300' })
  if (impuesto < 0) detalle.push({ tipo: 'negativo', concepto: 'Ingreso por Impuesto sobre Sociedades', importe: -impuesto, cuenta: '6300' })

  const suma = (t: AjusteFiscal['tipo']) => r2(detalle.filter(d => d.tipo === t).reduce((s, d) => s + d.importe, 0))
  return { positivos: suma('positivo'), negativos: suma('negativo'), detalle }
}

// ─────────────────────────────────────────────── pago fraccionado (202)

export interface EntradaPagoFraccionado {
  ejercicio: number
  periodo: 1 | 2 | 3
  /**
   * Base del art. 40.2: cuota íntegra del último IS con plazo de declaración
   * vencido, ya minorada en deducciones, bonificaciones, retenciones e
   * ingresos a cuenta (ver `ejercicioBase202`).
   */
  cuotaUltimoIS: number
  /** Cifra de negocios de los 12 meses anteriores al inicio del periodo impositivo. */
  cifraNegocios: number
  primerEjercicio: boolean
  /** Solo para la modalidad del art. 40.3: base imponible de los 3, 9 u 11 primeros meses. */
  baseImponiblePeriodo?: number
  tipoGravamen?: number
  /** Retenciones del periodo y pagos fraccionados anteriores del mismo ejercicio (art. 40.3). */
  retencionesPeriodo?: number
  pagosAnteriores?: number
}

export interface PagoFraccionado { importe: number; modalidad: 'art40.2' | 'art40.3'; obligado: boolean; motivo: string }

/**
 * Ejercicio cuyo IS sirve de base al pago fraccionado: en abril (1P) aún no
 * ha vencido el 200 del año anterior, así que es el de hace dos años; en
 * octubre (2P) y diciembre (3P), el del año anterior.
 */
export const ejercicioBase202 = (ejercicio: number, periodo: 1 | 2 | 3) => periodo === 1 ? ejercicio - 2 : ejercicio - 1

/**
 * Pago fraccionado del modelo 202 (art. 40 LIS). Modalidad del art. 40.2:
 * 18 % de la cuota del último IS declarado. Obligatoria la del art. 40.3
 * (5/7 del tipo, redondeado por defecto, sobre la base del periodo) si la
 * cifra de negocios supera 6 M€. Si sale cero no hay que presentar el 202,
 * salvo con cifra de negocios > 6 M€.
 */
// Comprobar: con cifra de negocios ≥ 10 M€ el porcentaje del art. 40.3 es el 24 % y hay un pago mínimo (DA 14.ª LIS); no se calcula.
export function pagoFraccionado202(e: EntradaPagoFraccionado): PagoFraccionado {
  if ((Number(e.cifraNegocios) || 0) > 6e6) {
    const pct = Math.floor((e.tipoGravamen ?? 25) * 5 / 7)
    const base = Number(e.baseImponiblePeriodo) || 0
    const importe = Math.max(0, r2(base * pct / 100 - (Number(e.retencionesPeriodo) || 0) - (Number(e.pagosAnteriores) || 0)))
    return {
      importe, modalidad: 'art40.3', obligado: true,
      motivo: `Cifra de negocios superior a 6 M€: modalidad obligatoria sobre la base del periodo al ${pct} % (art. 40.3 LIS); hay que presentar el 202 aunque salga a cero.`,
    }
  }
  if (e.primerEjercicio) {
    return {
      importe: 0, modalidad: 'art40.2', obligado: false,
      motivo: 'Primer ejercicio: no hay cuota de un periodo anterior declarado, el pago sale a cero y no hay que presentar el 202.',
    }
  }
  const importe = Math.max(0, r2((Number(e.cuotaUltimoIS) || 0) * 0.18))
  return importe > 0
    ? { importe, modalidad: 'art40.2', obligado: true, motivo: `18 % de la cuota del IS de ${ejercicioBase202(e.ejercicio, e.periodo)} (art. 40.2 LIS).` }
    : { importe: 0, modalidad: 'art40.2', obligado: false, motivo: `La cuota del IS de ${ejercicioBase202(e.ejercicio, e.periodo)} minorada es cero: no hay pago ni obligación de presentar el 202.` }
}
