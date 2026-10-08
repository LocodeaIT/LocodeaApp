/**
 * Cierre del ejercicio: lista de comprobación (amortizaciones, IVA del 4T,
 * banco, cuadre, impuesto) y obligaciones mercantiles y fiscales posteriores
 * (formulación, legalización, junta, depósito y modelo 200), más el asiento
 * de regularización.
 */
import type { CrmInstantanea } from '../../crm/types'
import { hoy as hoyReal } from '../../domain/fechas'
import type { GestionInstantanea } from '../../gestion/types'
import type { GestoriaInstantanea, ModeloFiscal, PerfilFiscal, Presentacion } from '../types'
import { cuadroAmortizacion } from './amortizaciones'
import { regularizacion, saldos } from './apuntes'
import type { Asiento } from './asientos'
import { cuadra, finDePlazo } from './asientos'
import { anioDe, dia, r2 } from './desglose'
import { ajustesFiscales, impuestoSociedades, pagosFraccionadosDelEjercicio } from './impuesto'
import { perdidasYGanancias } from './informes'

export interface PasoCierre {
  clave: string
  titulo: string
  estado: 'hecho' | 'pendiente' | 'aviso' | 'no-aplica'
  detalle: string
  modelo?: ModeloFiscal
  /** Último día para hacerlo, si tiene plazo legal. */
  plazo?: string
}

/** Asiento de regularización: salda los grupos 6 y 7 del ejercicio contra 129. */
export function asientoRegularizacion(asientos: Asiento[], ejercicio: number): Asiento {
  return regularizacion(asientos, ejercicio)
}

const euros = (n: number) => `${n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
const fecha = (d: string) => d.split('-').reverse().join('/')

/** El mismo día del mes siguiente (o el último de ese mes). */
function unMesDespues(d: string): string {
  const [a, m, x] = d.split('-').map(Number)
  const ultimo = new Date(Date.UTC(a, m + 1, 0)).getUTCDate()
  const nm = m === 12 ? 1 : m + 1, na = m === 12 ? a + 1 : a
  return `${na}-${String(nm).padStart(2, '0')}-${String(Math.min(x, ultimo)).padStart(2, '0')}`
}

const HECHA = ['presentada', 'pagada', 'domiciliada']

export interface EntradaCierre {
  ejercicio: number
  asientos: Asiento[]
  gestoria: GestoriaInstantanea
  crm: CrmInstantanea
  perfil: PerfilFiscal | null
  /** Para estimar el impuesto con los gastos no deducibles en el IS. */
  gestion?: GestionInstantanea
  /** Fecha de referencia para los plazos (por defecto, hoy). */
  hoy?: string
}

export function pasosCierre(e: EntradaCierre): PasoCierre[] {
  const N = e.ejercicio, hoy = e.hoy ?? hoyReal(), fin = `${N}-12-31`
  const delEjercicio = e.asientos.filter(a => anioDe(a.fecha) === N)
  const pasos: PasoCierre[] = []

  /** La presentación más reciente de un modelo y periodo. */
  const presentacion = (modelo: ModeloFiscal, periodo: string): Presentacion | undefined =>
    e.gestoria.presentaciones.filter(p => p.modelo === modelo && p.periodo === periodo)
      .sort((a, b) => (b.actualizadoEl || b.creadoEl || '').localeCompare(a.actualizadoEl || a.creadoEl || ''))[0]

  /** Paso que depende de una presentación con plazo. */
  const conPresentacion = (clave: string, titulo: string, modelo: ModeloFiscal, periodo: string, plazo: string, explicacion: string): PasoCierre => {
    const p = presentacion(modelo, periodo)
    const base = { clave, titulo, modelo, plazo }
    if (p && HECHA.includes(p.estado)) return { ...base, estado: 'hecho', detalle: p.presentadaEl ? `Hecho el ${fecha(dia(p.presentadaEl))}.` : 'Hecho.' }
    if (p?.estado === 'no-procede') return { ...base, estado: 'no-aplica', detalle: 'Marcado como no procede.' }
    return hoy > plazo
      ? { ...base, estado: 'aviso', detalle: `Fuera de plazo: vencía el ${fecha(plazo)}. ${explicacion}` }
      : { ...base, estado: 'pendiente', detalle: `Hasta el ${fecha(plazo)}. ${explicacion}` }
  }

  // ── amortizaciones
  const filas = cuadroAmortizacion(e.crm, N).filter(f => f.cuotaEjercicio > 0)
  if (!filas.length) {
    pasos.push({ clave: 'amortizaciones', titulo: 'Amortizaciones del ejercicio', estado: 'no-aplica', detalle: 'No hay bienes de inversión que amortizar este ejercicio.' })
  } else {
    const faltan = filas.filter(f => !delEjercicio.some(a => a.id === `amort:${N}:${f.facturaId}:${f.cuenta}`))
    const total = r2(filas.reduce((s, f) => s + f.cuotaEjercicio, 0))
    pasos.push(faltan.length
      ? { clave: 'amortizaciones', titulo: 'Amortizaciones del ejercicio', estado: 'pendiente', detalle: `Faltan los asientos de ${faltan.map(f => f.descripcion).join(', ')}.` }
      : { clave: 'amortizaciones', titulo: 'Amortizaciones del ejercicio', estado: 'hecho', detalle: `${filas.length} bien(es), dotación de ${euros(total)}.` })
  }

  // ── IVA del último periodo
  const mensual = e.perfil?.periodicidadIva === 'mensual'
  const periodoIva = mensual ? `${N}-12` : `${N}-4T`
  const liq = delEjercicio.find(a => a.id === `iva:${periodoIva}`)
  const movIva = delEjercicio.some(a => a.fecha > `${N}-${mensual ? '11-30' : '09-30'}` && a.lineas.some(l => l.cuenta === '472' || l.cuenta === '477'))
  const pasoIva = conPresentacion('iva-4t', `IVA del ${mensual ? 'mes de diciembre' : '4T'} liquidado y presentado`, '303', periodoIva, finDePlazo('303', periodoIva), '')
  if (movIva && !liq) {
    pasos.push({ ...pasoIva, estado: 'aviso', detalle: 'Hay IVA del periodo sin liquidar.' })
  } else {
    const aIngresar = r2(liq?.lineas.filter(l => l.cuenta === '4750').reduce((s, l) => s + l.haber - l.debe, 0) ?? 0)
    const aCompensar = r2(liq?.lineas.filter(l => l.cuenta === '4700').reduce((s, l) => s + l.debe - l.haber, 0) ?? 0)
    const resumen = !liq ? 'Sin IVA en el periodo (el 303 se presenta igualmente).' : aCompensar > 0 ? `Resultado a compensar: ${euros(aCompensar)}.` : `Resultado a ingresar: ${euros(aIngresar)}.`
    pasos.push({ ...pasoIva, detalle: `${resumen} ${pasoIva.detalle}`.trim() })
  }

  // ── conciliación bancaria
  if (!e.perfil || !dia(e.perfil.saldoBancoFecha)) {
    pasos.push({ clave: 'conciliacion-banco', titulo: 'Conciliación bancaria', estado: 'pendiente', detalle: 'Indica el saldo del banco y su fecha en el perfil fiscal.' })
  } else if (dia(e.perfil.saldoBancoFecha) < `${N}-01-01`) {
    pasos.push({ clave: 'conciliacion-banco', titulo: 'Conciliación bancaria', estado: 'pendiente', detalle: `El saldo del banco es del ${fecha(dia(e.perfil.saldoBancoFecha))}, anterior al ejercicio.` })
  } else {
    const corte = dia(e.perfil.saldoBancoFecha) < fin ? dia(e.perfil.saldoBancoFecha) : fin
    const contable = r2(saldos(e.asientos.filter(a => a.fecha <= corte && a.tipo !== 'cierre')).get('572') ?? 0)
    const dif = r2((Number(e.perfil.saldoBanco) || 0) - contable)
    pasos.push(Math.abs(dif) < 0.01
      ? { clave: 'conciliacion-banco', titulo: 'Conciliación bancaria', estado: 'hecho', detalle: `La cuenta 572 coincide con el banco a ${fecha(corte)}: ${euros(contable)}.` }
      : {
        clave: 'conciliacion-banco', titulo: 'Conciliación bancaria', estado: 'aviso',
        detalle: `Diferencia de ${euros(dif)} a ${fecha(corte)}: banco ${euros(Number(e.perfil.saldoBanco) || 0)}, cuenta 572 ${euros(contable)}.`,
      })
  }

  // ── asientos cuadrados
  const descuadrados = delEjercicio.filter(a => !cuadra(a))
  pasos.push(descuadrados.length
    ? { clave: 'asientos-cuadrados', titulo: 'Asientos cuadrados', estado: 'aviso', detalle: `No cuadran los asientos ${descuadrados.map(a => a.numero).join(', ')}.` }
    : { clave: 'asientos-cuadrados', titulo: 'Asientos cuadrados', estado: 'hecho', detalle: `Los ${delEjercicio.length} asientos cuadran.` })

  // ── Impuesto sobre Sociedades
  const gastoIS = r2(delEjercicio.reduce((s, a) => s + a.lineas.filter(l => l.cuenta.startsWith('630')).reduce((t, l) => t + l.debe - l.haber, 0), 0))
  const contabilizado = delEjercicio.some(a => a.lineas.some(l => l.cuenta.startsWith('630')))
  if (contabilizado) {
    pasos.push({ clave: 'impuesto', titulo: 'Impuesto sobre Sociedades calculado y contabilizado', estado: 'hecho', detalle: `Gasto por impuesto contabilizado: ${euros(gastoIS)}.`, modelo: '200' })
  } else if (!e.perfil) {
    pasos.push({ clave: 'impuesto', titulo: 'Impuesto sobre Sociedades calculado y contabilizado', estado: 'pendiente', detalle: 'Falta el perfil fiscal para calcular el impuesto.', modelo: '200' })
  } else {
    const pyg = perdidasYGanancias(delEjercicio)
    const ajustes = ajustesFiscales({ gestion: e.gestion ?? { gastos: [], documentos: [] }, asientos: delEjercicio, ejercicio: N })
    const pagos = pagosFraccionadosDelEjercicio(e.gestoria, N)
    const s473 = r2(saldos(e.asientos.filter(a => a.fecha <= fin)).get('473') ?? 0)
    const r = impuestoSociedades({
      ejercicio: N, perfil: e.perfil, resultadoContable: pyg.resultadoEjercicio, ajustesPositivos: ajustes.positivos, ajustesNegativos: ajustes.negativos,
      basesNegativas: e.perfil.basesNegativas ?? {}, retenciones: Math.max(0, r2(s473 - pagos)), pagosFraccionados: pagos,
    })
    const nada = r.cuotaLiquida === 0 && r.retenciones === 0 && r.pagosFraccionados === 0
    pasos.push({
      clave: 'impuesto', titulo: 'Impuesto sobre Sociedades calculado y contabilizado', modelo: '200',
      estado: nada ? 'no-aplica' : 'pendiente',
      detalle: nada
        ? `Base imponible ${euros(r.baseImponible)}: no hay gasto por impuesto que contabilizar.`
        : `Estimado: base imponible ${euros(r.baseImponible)}, cuota líquida ${euros(r.cuotaLiquida)}, a ${r.cuotaDiferencial >= 0 ? 'ingresar' : 'devolver'} ${euros(Math.abs(r.cuotaDiferencial))}. ${r.tipoAplicado} Falta el asiento (6300 / 473 / 4752).`,
    })
  }

  // ── obligaciones posteriores al cierre
  pasos.push(conPresentacion('formulacion', 'Formulación de las cuentas anuales', 'formulacion', String(N), `${N + 1}-03-31`,
    'Los administradores las formulan en los 3 meses siguientes al cierre (art. 253 LSC).'))
  pasos.push(conPresentacion('legalizacion', 'Legalización de libros', 'legalizacion', String(N), `${N + 1}-04-30`,
    'Diario, inventarios y cuentas anuales, actas y registro de socios, telemáticamente en el Registro Mercantil en los 4 meses siguientes al cierre (art. 18 Ley 14/2013).'))
  pasos.push(conPresentacion('junta', 'Aprobación de las cuentas por la junta', 'junta', String(N), `${N + 1}-06-30`,
    'La junta ordinaria aprueba las cuentas y la aplicación del resultado en los 6 meses siguientes al cierre (art. 164 LSC).'))
  const junta = presentacion('junta', String(N))
  const aprobadas = junta && HECHA.includes(junta.estado) && dia(junta.presentadaEl)
  pasos.push(conPresentacion('deposito', 'Depósito de las cuentas en el Registro Mercantil', 'deposito', String(N), aprobadas ? unMesDespues(dia(junta.presentadaEl)) : `${N + 1}-07-30`,
    'En el mes siguiente a la aprobación por la junta (art. 279 LSC).'))
  pasos.push(conPresentacion('modelo-200', 'Impuesto sobre Sociedades (modelo 200)', '200', String(N), finDePlazo('200', String(N)),
    'En los 25 días naturales siguientes a los 6 meses posteriores al cierre (art. 124 LIS).'))
  return pasos
}
