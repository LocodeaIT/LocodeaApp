/**
 * Informes contables a partir de los asientos: libro diario, mayor, balance
 * de sumas y saldos, balance y cuenta de pérdidas y ganancias con la
 * estructura de los modelos de pymes (PGC de pymes, tercera parte, II.
 * Modelos de cuentas anuales, en la redacción del RD 602/2016):
 * https://www.boe.es/buscar/act.php?id=BOE-A-2007-19966
 */
import type { LineaAsiento } from '../types'
import type { Asiento } from './asientos'
import { cuadra } from './asientos'
import { esCierre, saldos, sumas } from './apuntes'
import { r2 } from './desglose'
import { nombreCuenta } from './plan'

export interface DetalleCuenta { cuenta: string; nombre: string; importe: number }

/** Regla de clasificación más larga que encaja con la cuenta (7051 → 705 → 70). */
function clasificar(cuenta: string, reglas: Record<string, string>): string | null {
  for (let n = cuenta.length; n >= 1; n--) {
    const x = reglas[cuenta.slice(0, n)]
    if (x) return x
  }
  return null
}

// ─────────────────────────────────────────────── diario

export interface AsientoDiario extends Asiento {
  lineas: (LineaAsiento & { nombre: string })[]
  debe: number
  haber: number
  cuadra: boolean
}

export interface LibroDiario {
  asientos: AsientoDiario[]
  debe: number
  haber: number
  /** Números de los asientos que no cuadran. */
  descuadrados: number[]
}

export function libroDiario(asientos: Asiento[]): LibroDiario {
  const lista = asientos.map(a => ({ ...a, lineas: a.lineas.map(l => ({ ...l, nombre: nombreCuenta(l.cuenta) })), ...sumas(a), cuadra: cuadra(a) }))
  return {
    asientos: lista,
    debe: r2(lista.reduce((s, a) => s + a.debe, 0)),
    haber: r2(lista.reduce((s, a) => s + a.haber, 0)),
    descuadrados: lista.filter(a => !a.cuadra).map(a => a.numero),
  }
}

// ─────────────────────────────────────────────── mayor

export interface MovimientoMayor {
  asientoId: string
  numero: number
  fecha: string
  concepto: string
  cuenta: string
  debe: number
  haber: number
  /** Saldo acumulado (debe − haber) tras el movimiento. */
  saldo: number
}

export interface Mayor { cuenta: string; nombre: string; movimientos: MovimientoMayor[]; debe: number; haber: number; saldo: number }

/** Libro mayor de una cuenta. Una cuenta de 3 dígitos agrupa sus subcuentas (475 → 4750, 4751, 4752). */
export function mayor(asientos: Asiento[], cuenta: string): Mayor {
  const movimientos: MovimientoMayor[] = []
  let saldo = 0, debe = 0, haber = 0
  for (const a of asientos) {
    for (const l of a.lineas) {
      if (!l.cuenta.startsWith(cuenta)) continue
      debe += Number(l.debe) || 0; haber += Number(l.haber) || 0
      saldo = r2(saldo + (Number(l.debe) || 0) - (Number(l.haber) || 0))
      movimientos.push({ asientoId: a.id, numero: a.numero, fecha: a.fecha, concepto: l.concepto || a.concepto, cuenta: l.cuenta, debe: l.debe, haber: l.haber, saldo })
    }
  }
  return { cuenta, nombre: nombreCuenta(cuenta), movimientos, debe: r2(debe), haber: r2(haber), saldo }
}

// ─────────────────────────────────────────────── sumas y saldos

export interface FilaSumasYSaldos { cuenta: string; nombre: string; debe: number; haber: number; saldoDeudor: number; saldoAcreedor: number }

export interface SumasYSaldos {
  filas: FilaSumasYSaldos[]
  totales: { debe: number; haber: number; saldoDeudor: number; saldoAcreedor: number }
}

/** Balance de sumas y saldos por cuenta; con `nivel` (p. ej. 3) agrupa las subcuentas en su cuenta. */
export function sumasYSaldos(asientos: Asiento[], nivel?: number): SumasYSaldos {
  const m = new Map<string, { debe: number; haber: number }>()
  for (const a of asientos) {
    for (const l of a.lineas) {
      const k = nivel ? l.cuenta.slice(0, nivel) : l.cuenta
      const x = m.get(k) ?? { debe: 0, haber: 0 }
      x.debe += Number(l.debe) || 0; x.haber += Number(l.haber) || 0
      m.set(k, x)
    }
  }
  const filas = [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([cuenta, x]) => {
    const s = r2(x.debe - x.haber)
    return { cuenta, nombre: nombreCuenta(cuenta), debe: r2(x.debe), haber: r2(x.haber), saldoDeudor: s > 0 ? s : 0, saldoAcreedor: s < 0 ? -s : 0 }
  })
  const t = (k: keyof Omit<FilaSumasYSaldos, 'cuenta' | 'nombre'>) => r2(filas.reduce((s, f) => s + f[k], 0))
  return { filas, totales: { debe: t('debe'), haber: t('haber'), saldoDeudor: t('saldoDeudor'), saldoAcreedor: t('saldoAcreedor') } }
}

// ─────────────────────────────────────────────── pérdidas y ganancias

export interface PartidaPyG {
  /** '1', '4', '7', 'OR', 'A.1', '17', 'A.4'… */
  clave: string
  titulo: string
  /** (Debe) Haber: ingresos en positivo, gastos en negativo. */
  importe: number
  /** Subtotal (A.1 a A.4) en lugar de partida. */
  total: boolean
  detalle: DetalleCuenta[]
}

export interface PerdidasYGanancias {
  partidas: PartidaPyG[]
  cifraNegocios: number
  resultadoExplotacion: number
  resultadoFinanciero: number
  resultadoAntesImpuestos: number
  impuestos: number
  resultadoEjercicio: number
}

/** Partidas del modelo de pymes con las cuentas que recogen (las que restan van entre paréntesis en el BOE). */
const PARTIDAS_PYG: [string, string, string[]][] = [
  ['1', 'Importe neto de la cifra de negocios', ['70']],
  ['2', 'Variación de existencias de productos terminados y en curso de fabricación', ['6930', '71', '7930']],
  ['3', 'Trabajos realizados por la empresa para su activo', ['73']],
  ['4', 'Aprovisionamientos', ['60', '61', '6931', '6932', '6933', '7931', '7932', '7933']],
  ['5', 'Otros ingresos de explotación', ['74', '75']],
  ['6', 'Gastos de personal', ['64']],
  ['7', 'Otros gastos de explotación', ['62', '63', '65', '694', '695', '794', '7954']],
  ['8', 'Amortización del inmovilizado', ['68']],
  ['9', 'Imputación de subvenciones de inmovilizado no financiero y otras', ['746']],
  ['10', 'Excesos de provisiones', ['7951', '7952', '7955']],
  ['11', 'Deterioro y resultado por enajenaciones del inmovilizado', ['670', '671', '672', '690', '691', '692', '770', '771', '772', '790', '791', '792']],
  // Comprobar: «Otros resultados» (678 y 778) no figura en el modelo de pymes del BOE; se muestra aparte dentro de la explotación,
  // como hacen los modelos de depósito del Registro Mercantil.
  ['OR', 'Otros resultados', ['678', '778']],
  ['12', 'Ingresos financieros', ['760', '761', '762', '769']],
  ['13', 'Gastos financieros', ['660', '661', '662', '664', '665', '669']],
  ['14', 'Variación de valor razonable en instrumentos financieros', ['663', '763']],
  ['15', 'Diferencias de cambio', ['668', '768']],
  ['16', 'Deterioro y resultado por enajenaciones de instrumentos financieros', ['666', '667', '673', '675', '696', '697', '698', '699', '766', '773', '775', '796', '797', '798', '799']],
  ['17', 'Impuestos sobre beneficios', ['630', '633', '638']],
]

const REGLAS_PYG: Record<string, string> = Object.fromEntries(PARTIDAS_PYG.flatMap(([clave, , prefijos]) => prefijos.map(p => [p, clave])))
const EXPLOTACION = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', 'OR']
const FINANCIERO = ['12', '13', '14', '15', '16']

/**
 * Cuenta de pérdidas y ganancias de pymes. Sale de los saldos de los grupos
 * 6 y 7 sin contar la regularización ni el cierre (antes de regularizar es
 * el mismo resultado).
 */
export function perdidasYGanancias(asientos: Asiento[]): PerdidasYGanancias {
  const detalle = new Map<string, DetalleCuenta[]>()
  for (const [cuenta, s] of saldos(asientos.filter(a => !esCierre(a)))) {
    if (!s || (cuenta[0] !== '6' && cuenta[0] !== '7')) continue
    const clave = clasificar(cuenta, REGLAS_PYG) ?? (cuenta[0] === '6' ? '7' : '5')
    const lista = detalle.get(clave) ?? []
    lista.push({ cuenta, nombre: nombreCuenta(cuenta), importe: r2(-s) })
    detalle.set(clave, lista)
  }
  const importe = (clave: string) => r2((detalle.get(clave) ?? []).reduce((t, d) => t + d.importe, 0))
  const suma = (claves: string[]) => r2(claves.reduce((t, k) => t + importe(k), 0))
  const explotacion = suma(EXPLOTACION), financiero = suma(FINANCIERO)
  const antes = r2(explotacion + financiero), impuestos = importe('17'), resultado = r2(antes + impuestos)

  const partida = ([clave, titulo]: [string, string, string[]]): PartidaPyG => ({
    clave, titulo, importe: importe(clave), total: false, detalle: (detalle.get(clave) ?? []).sort((a, b) => a.cuenta.localeCompare(b.cuenta)),
  })
  const total = (clave: string, titulo: string, valor: number): PartidaPyG => ({ clave, titulo, importe: valor, total: true, detalle: [] })
  const por = (claves: string[]) => PARTIDAS_PYG.filter(p => claves.includes(p[0])).map(partida)
  return {
    partidas: [
      ...por(EXPLOTACION),
      total('A.1', 'Resultado de explotación', explotacion),
      ...por(FINANCIERO),
      total('A.2', 'Resultado financiero', financiero),
      total('A.3', 'Resultado antes de impuestos', antes),
      ...por(['17']),
      total('A.4', 'Resultado del ejercicio', resultado),
    ],
    cifraNegocios: importe('1'),
    resultadoExplotacion: explotacion,
    resultadoFinanciero: financiero,
    resultadoAntesImpuestos: antes,
    impuestos,
    resultadoEjercicio: resultado,
  }
}

// ─────────────────────────────────────────────── balance

export interface PartidaBalance { clave: string; titulo: string; importe: number; detalle: DetalleCuenta[] }
export interface MasaBalance { clave: string; titulo: string; importe: number; partidas: PartidaBalance[] }

export interface Balance {
  activo: { noCorriente: MasaBalance; corriente: MasaBalance; total: number }
  patrimonioNetoYPasivo: { patrimonioNeto: MasaBalance; pasivoNoCorriente: MasaBalance; pasivoCorriente: MasaBalance; total: number }
  resultadoEjercicio: number
  cuadra: boolean
  /** Activo − (patrimonio neto + pasivo): cero si los asientos cuadran. */
  diferencia: number
}

const MASAS: [string, string, [string, string][]][] = [
  ['ANC', 'A) Activo no corriente', [
    ['ANC.I', 'I. Inmovilizado intangible'],
    ['ANC.II', 'II. Inmovilizado material'],
    ['ANC.III', 'III. Inversiones inmobiliarias'],
    ['ANC.IV', 'IV. Inversiones en empresas del grupo y asociadas a largo plazo'],
    ['ANC.V', 'V. Inversiones financieras a largo plazo'],
    ['ANC.VI', 'VI. Activos por impuesto diferido'],
  ]],
  ['AC', 'B) Activo corriente', [
    ['AC.I', 'I. Existencias'],
    ['AC.II.1', 'II.1. Clientes por ventas y prestaciones de servicios'],
    ['AC.II.2', 'II.2. Accionistas (socios) por desembolsos exigidos'],
    ['AC.II.3', 'II.3. Otros deudores'],
    ['AC.III', 'III. Inversiones en empresas del grupo y asociadas a corto plazo'],
    ['AC.IV', 'IV. Inversiones financieras a corto plazo'],
    ['AC.V', 'V. Periodificaciones a corto plazo'],
    ['AC.VI', 'VI. Efectivo y otros activos líquidos equivalentes'],
  ]],
  ['PN', 'A) Patrimonio neto', [
    ['PN.I', 'A-1.I. Capital'],
    ['PN.II', 'A-1.II. Prima de emisión'],
    ['PN.III', 'A-1.III. Reservas'],
    ['PN.IV', 'A-1.IV. (Acciones y participaciones en patrimonio propias)'],
    ['PN.V', 'A-1.V. Resultados de ejercicios anteriores'],
    ['PN.VI', 'A-1.VI. Otras aportaciones de socios'],
    ['PN.VII', 'A-1.VII. Resultado del ejercicio'],
    ['PN.VIII', 'A-1.VIII. (Dividendo a cuenta)'],
    ['PN.A2', 'A-2. Subvenciones, donaciones y legados recibidos'],
  ]],
  ['PNC', 'B) Pasivo no corriente', [
    ['PNC.I', 'I. Provisiones a largo plazo'],
    ['PNC.II.1', 'II.1. Deudas con entidades de crédito'],
    ['PNC.II.2', 'II.2. Acreedores por arrendamiento financiero'],
    ['PNC.II.3', 'II.3. Otras deudas a largo plazo'],
    ['PNC.III', 'III. Deudas con empresas del grupo y asociadas a largo plazo'],
    ['PNC.IV', 'IV. Pasivos por impuesto diferido'],
    ['PNC.V', 'V. Periodificaciones a largo plazo'],
  ]],
  ['PC', 'C) Pasivo corriente', [
    ['PC.I', 'I. Provisiones a corto plazo'],
    ['PC.II.1', 'II.1. Deudas con entidades de crédito'],
    ['PC.II.2', 'II.2. Acreedores por arrendamiento financiero'],
    ['PC.II.3', 'II.3. Otras deudas a corto plazo'],
    ['PC.III', 'III. Deudas con empresas del grupo y asociadas a corto plazo'],
    ['PC.IV.1', 'IV.1. Proveedores'],
    ['PC.IV.2', 'IV.2. Otros acreedores'],
    ['PC.V', 'V. Periodificaciones a corto plazo'],
  ]],
]

/** Cuentas de cada partida del balance de pymes (la regla más larga manda). */
const REGLAS_BALANCE: Record<string, string> = {
  '20': 'ANC.I', '280': 'ANC.I', '290': 'ANC.I',
  '21': 'ANC.II', '23': 'ANC.II', '281': 'ANC.II', '291': 'ANC.II',
  '22': 'ANC.III', '282': 'ANC.III', '292': 'ANC.III',
  '24': 'ANC.IV',
  '25': 'ANC.V', '26': 'ANC.V', '29': 'ANC.V',
  '474': 'ANC.VI',
  '3': 'AC.I', '407': 'AC.I',
  '43': 'AC.II.1', '490': 'AC.II.1', '493': 'AC.II.1',
  '5580': 'AC.II.2',
  '44': 'AC.II.3', '460': 'AC.II.3', '470': 'AC.II.3', '471': 'AC.II.3', '472': 'AC.II.3', '544': 'AC.II.3',
  // Comprobar: 473 no figura en el modelo de pymes; debería quedar a cero tras el asiento del impuesto. Si queda saldo, va a otros deudores.
  '473': 'AC.II.3',
  '53': 'AC.IV', '54': 'AC.IV', '565': 'AC.IV', '566': 'AC.IV', '59': 'AC.IV',
  '480': 'AC.V', '567': 'AC.V',
  '57': 'AC.VI',
  '100': 'PN.I', '101': 'PN.I', '102': 'PN.I', '103': 'PN.I', '104': 'PN.I',
  '110': 'PN.II',
  '11': 'PN.III',
  '108': 'PN.IV', '109': 'PN.IV',
  '12': 'PN.V',
  '118': 'PN.VI',
  '557': 'PN.VIII',
  '13': 'PN.A2',
  '14': 'PNC.I',
  '170': 'PNC.II.1', '1605': 'PNC.II.1',
  '174': 'PNC.II.2', '1625': 'PNC.II.2',
  '15': 'PNC.II.3', '16': 'PNC.II.3', '17': 'PNC.II.3', '18': 'PNC.II.3',
  '479': 'PNC.IV',
  '181': 'PNC.V',
  '499': 'PC.I', '529': 'PC.I',
  '520': 'PC.II.1', '527': 'PC.II.1', '5105': 'PC.II.1',
  '524': 'PC.II.2',
  '19': 'PC.II.3', '50': 'PC.II.3', '51': 'PC.II.3', '52': 'PC.II.3', '555': 'PC.II.3', '556': 'PC.II.3', '56': 'PC.II.3',
  '40': 'PC.IV.1',
  '41': 'PC.IV.2', '438': 'PC.IV.2', '465': 'PC.IV.2', '466': 'PC.IV.2', '475': 'PC.IV.2', '476': 'PC.IV.2', '477': 'PC.IV.2',
  '485': 'PC.V', '568': 'PC.V',
}

/** Cuentas que van al activo o al pasivo según su saldo (socios, partidas pendientes, bancos en descubierto). */
function partidaSegunSaldo(cuenta: string, saldo: number): string | null {
  const deudor = saldo > 0
  if (/^55[1-3]|^5525/.test(cuenta)) return deudor ? 'AC.IV' : 'PC.II.3'
  if (cuenta.startsWith('555')) return deudor ? 'AC.IV' : 'PC.II.3'
  // Comprobar: un banco con saldo acreedor (descubierto) se presenta como deuda con entidades de crédito.
  if (cuenta.startsWith('57')) return deudor ? 'AC.VI' : 'PC.II.1'
  return null
}

function partidaBalance(cuenta: string, saldo: number): string {
  const x = partidaSegunSaldo(cuenta, saldo) ?? clasificar(cuenta, REGLAS_BALANCE)
  if (x) return x
  const deudor = saldo > 0
  switch (cuenta[0]) {
    case '1': return deudor ? 'PN.III' : 'PNC.II.3'
    case '2': return 'ANC.II'
    case '3': return 'AC.I'
    case '4': return deudor ? 'AC.II.3' : 'PC.IV.2'
    default: return deudor ? 'AC.IV' : 'PC.II.3'
  }
}

/**
 * Balance de pymes. El resultado del ejercicio son los saldos de los grupos
 * 6 y 7 más lo regularizado a 129 en el ejercicio; el resto de 129 (el
 * resultado del ejercicio anterior pendiente de aplicar) va a resultados de
 * ejercicios anteriores. Un asiento de cierre no se tiene en cuenta.
 */
export function balance(asientos: Asiento[]): Balance {
  const validos = asientos.filter(a => a.tipo !== 'cierre')
  const det = new Map<string, DetalleCuenta[]>()
  const anadir = (clave: string, d: DetalleCuenta) => { const l = det.get(clave) ?? []; l.push(d); det.set(clave, l) }
  const activo = (clave: string) => clave.startsWith('A')

  let resultado = 0
  for (const [cuenta, s] of saldos(validos.filter(a => a.tipo !== 'regularizacion'))) {
    if (!s) continue
    if (cuenta[0] === '6' || cuenta[0] === '7') { resultado += -s; continue }
    const clave = cuenta.startsWith('129') ? 'PN.V' : partidaBalance(cuenta, s)
    anadir(clave, { cuenta, nombre: nombreCuenta(cuenta), importe: activo(clave) ? s : r2(-s) })
  }
  // lo regularizado en el ejercicio es parte del resultado del ejercicio, no de los anteriores
  for (const [cuenta, s] of saldos(validos.filter(a => a.tipo === 'regularizacion'))) {
    if (cuenta.startsWith('129')) resultado += -s
    else if (cuenta[0] === '6' || cuenta[0] === '7') resultado += -s
  }
  resultado = r2(resultado)
  if (resultado) anadir('PN.VII', { cuenta: '129', nombre: 'Resultado del ejercicio (grupos 6 y 7)', importe: resultado })

  const masa = ([clave, titulo, partidas]: [string, string, [string, string][]]): MasaBalance => {
    const ps = partidas.map(([k, t]) => {
      const detalle = (det.get(k) ?? []).sort((a, b) => a.cuenta.localeCompare(b.cuenta))
      return { clave: k, titulo: t, importe: r2(detalle.reduce((s, d) => s + d.importe, 0)), detalle }
    })
    return { clave, titulo, importe: r2(ps.reduce((s, p) => s + p.importe, 0)), partidas: ps }
  }
  const [anc, ac, pn, pnc, pc] = MASAS.map(masa)
  const totalActivo = r2(anc.importe + ac.importe), totalPasivo = r2(pn.importe + pnc.importe + pc.importe)
  const diferencia = r2(totalActivo - totalPasivo)
  return {
    activo: { noCorriente: anc, corriente: ac, total: totalActivo },
    patrimonioNetoYPasivo: { patrimonioNeto: pn, pasivoNoCorriente: pnc, pasivoCorriente: pc, total: totalPasivo },
    resultadoEjercicio: resultado,
    cuadra: Math.abs(diferencia) < 0.005,
    diferencia,
  }
}
