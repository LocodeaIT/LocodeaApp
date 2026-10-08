/**
 * Retenciones: 111 (trabajo y actividades económicas), 115 (alquileres),
 * 123 (capital mobiliario) y sus resúmenes anuales 190, 180 y 193.
 *
 * Casillas comprobadas:
 *  - 111: 01–03 rendimientos del trabajo dinerarios (perceptores, percepciones, retenciones), 04–06 en especie,
 *    07–09 actividades económicas dinerarias, 10–12 en especie, 13–27 premios, ganancias y derechos de imagen,
 *    28 total, 29 resultado de autoliquidaciones anteriores (complementaria), 30 a ingresar. No se presenta si en el
 *    periodo no se ha satisfecho ninguna renta sujeta a retención.
 *    https://sede.agenciatributaria.gob.es/Sede/todas-gestiones/impuestos-tasas/pagos-cuenta/modelo-111-reten_____moniales-imputaciones-renta-autoliquidacion_/instrucciones.html
 *  - 115: 01 perceptores, 02 base, 03 retenciones, 04 resultado de declaraciones anteriores, 05 a ingresar (03 − 04).
 *    https://sede.agenciatributaria.gob.es/static_files/Sede/Disenyo_registro/DR_100_199/archivos/DR115e15v13.xls
 *  - 123: 01–03 número de rentas, 04–06 bases, 07–09 retenciones, 10–11 periodificación, 12 suma, 13 anteriores, 14 a ingresar.
 *    https://sede.agenciatributaria.gob.es/static_files/Sede/Disenyo_registro/DR_100_199/archivos_24/DR123e24.xls
 *  - 190: claves F (cursos, conferencias y obras: rendimientos del trabajo) y G (actividades profesionales; subclave
 *    01 tipo general, 03 tipo reducido de inicio de actividad); resumen con número de percepciones, percepciones y retenciones.
 *    https://sede.agenciatributaria.gob.es/static_files/Sede/Disenyo_registro/DR_100_199/archivos_25/DISENOS_LOGICOS_190_2025.pdf
 *  - 180: número de perceptores, base y retenciones; cada perceptor con la situación y referencia catastral del inmueble.
 *    https://sede.agenciatributaria.gob.es/static_files/Sede/Disenyo_registro/DR_100_199/archivos_23/DR_Mod_180_2023.pdf
 *
 * Criterio temporal: fecha de devengo del apunte. La obligación de retener nace al pagar (art. 78.1 RIRPF); si una
 * factura con retención se paga en otro trimestre, se avisa.
 *  https://www.boe.es/buscar/act.php?id=BOE-A-2007-6820
 */
import type { ModeloFiscal } from '../../types'
import type { ApunteFiscal } from '../apuntes'
import { apuntesDelPeriodo } from '../apuntes'
import { type Periodo, clavePeriodo, r2, rangoPeriodo } from '../periodos'
import { Casillas, type ResultadoModelo, lineasDe, unicos } from './comun'

const conRetencion = (a: ApunteFiscal) => a.origen !== 'venta' && a.retencion !== 0
const esAlquiler = (a: ApunteFiscal) => a.claveRetencion === 'arrendamiento'
/** Clave del perceptor: NIF, o la cuenta, o el propio documento si no hay ninguno. */
const perceptor = (a: ApunteFiscal) => a.terceroNif || a.terceroId || a.docId
const contar = (aps: ApunteFiscal[]) => new Set(aps.map(perceptor)).size
const sumaDe = (aps: ApunteFiscal[], k: 'base' | 'retencion') => r2(aps.reduce((s, a) => s + a[k], 0))

function avisosPago(aps: ApunteFiscal[]): string[] {
  const sinPagar = aps.filter(a => a.estado === 'registrada' || a.estado === 'pendiente')
  return sinPagar.length
    ? [`${sinPagar.length} documento(s) con retención aún sin pagar (${sinPagar.map(a => a.numero).join(', ')}): la retención se ingresa en el periodo en que se pagan (art. 78.1 RIRPF). Si se pagan en otro trimestre, muévelos a ese 111/115.`]
    : []
}

export const CATALOGO_111: [string, string][] = [
  ['01', 'Rendimientos del trabajo dinerarios: n.º perceptores'], ['02', 'Rendimientos del trabajo dinerarios: importe'], ['03', 'Rendimientos del trabajo dinerarios: retenciones'],
  ['04', 'Rendimientos del trabajo en especie: n.º perceptores'], ['05', 'Rendimientos del trabajo en especie: valor'], ['06', 'Rendimientos del trabajo en especie: ingresos a cuenta'],
  ['07', 'Actividades económicas dinerarias: n.º perceptores'], ['08', 'Actividades económicas dinerarias: importe'], ['09', 'Actividades económicas dinerarias: retenciones'],
  ['10', 'Actividades económicas en especie: n.º perceptores'], ['11', 'Actividades económicas en especie: valor'], ['12', 'Actividades económicas en especie: ingresos a cuenta'],
  ['28', 'Suma de retenciones e ingresos a cuenta'], ['29', 'A deducir (complementaria)'], ['30', 'Resultado a ingresar'],
]

export function modelo111(apuntes: ApunteFiscal[], periodo: Periodo): ResultadoModelo {
  const { desde, hasta } = rangoPeriodo(periodo)
  const del = apuntesDelPeriodo(apuntes, desde, hasta).filter(a => conRetencion(a) && !esAlquiler(a))
  // Comprobar: la clave «otros» se lleva a rendimientos del trabajo (cursos, conferencias, obras: clave F del 190);
  // si fueran actividades agrícolas o de estimación objetiva, irían en 07–09.
  const trabajo = del.filter(a => a.claveRetencion === 'otros')
  const actividades = del.filter(a => a.claveRetencion !== 'otros')
  const c = new Casillas(), avisos: string[] = []
  if (trabajo.length) { c.poner('01', contar(trabajo)); c.sumar('02', sumaDe(trabajo, 'base')); c.sumar('03', sumaDe(trabajo, 'retencion')) }
  if (actividades.length) { c.poner('07', contar(actividades)); c.sumar('08', sumaDe(actividades, 'base')); c.sumar('09', sumaDe(actividades, 'retencion')) }
  c.poner('28', c.suma('03', '06', '09', '12', '15', '18', '21', '24', '27'))
  c.poner('30', r2(c.get('28') - c.get('29')))
  const sinClave = del.filter(a => a.claveRetencion === 'ninguna')
  if (sinClave.length) avisos.push(`${sinClave.map(a => a.numero).join(', ')}: tienen IRPF pero no clave de retención; se han tratado como profesionales.`)
  if (trabajo.length) avisos.push('Las retenciones con clave «otros» se han declarado como rendimientos del trabajo (cursos, conferencias, obras). Revísalo.')
  avisos.push(...avisosPago(del))
  if (!del.length) avisos.push('Sin rentas sujetas a retención en el periodo: no se presenta el 111.')
  const casillas = c.aObjeto()
  return {
    modelo: '111', periodo: clavePeriodo(periodo), casillas, lineas: lineasDe(casillas, CATALOGO_111, ['28', '30']),
    resultado: c.get('30'), sinActividad: del.length === 0, incluidos: unicos(del.map(a => a.docId)), avisos,
  }
}

export const CATALOGO_115: [string, string][] = [
  ['01', 'N.º de perceptores'], ['02', 'Base de las retenciones'], ['03', 'Retenciones e ingresos a cuenta'],
  ['04', 'Resultado de declaraciones anteriores (complementaria)'], ['05', 'Resultado a ingresar'],
]

export function modelo115(apuntes: ApunteFiscal[], periodo: Periodo): ResultadoModelo {
  const { desde, hasta } = rangoPeriodo(periodo)
  const del = apuntesDelPeriodo(apuntes, desde, hasta).filter(a => conRetencion(a) && esAlquiler(a))
  const c = new Casillas(), avisos = avisosPago(del)
  if (del.length) { c.poner('01', contar(del)); c.sumar('02', sumaDe(del, 'base')); c.sumar('03', sumaDe(del, 'retencion')) }
  c.poner('05', r2(c.get('03') - c.get('04')))
  if (!del.length) avisos.push('Sin alquileres con retención en el periodo: no se presenta el 115.')
  const casillas = c.aObjeto()
  return {
    modelo: '115', periodo: clavePeriodo(periodo), casillas, lineas: lineasDe(casillas, CATALOGO_115, ['03', '05']),
    resultado: c.get('05'), sinActividad: del.length === 0, incluidos: unicos(del.map(a => a.docId)), avisos,
  }
}

/** 123: no hay todavía fuente de datos de dividendos ni de intereses a socios; devuelve cero. */
export function modelo123(_apuntes: ApunteFiscal[], periodo: Periodo): ResultadoModelo {
  return {
    modelo: '123', periodo: clavePeriodo(periodo), casillas: {},
    lineas: [
      { casilla: '09', descripcion: 'Retenciones e ingresos a cuenta: totales', importe: 0 },
      { casilla: '14', descripcion: 'Resultado a ingresar', importe: 0 },
    ],
    resultado: 0, sinActividad: true, incluidos: [],
    avisos: ['Todavía no se registran dividendos ni intereses de préstamos de socios: el 123 sale a cero. Si los hay, calcula la retención (19 %) a mano.'],
  }
}

// ─────────────────────────────────────────────── resúmenes anuales

export interface Perceptor {
  nif: string
  nombre: string
  codigoPais: string
  /** 190: F (cursos, conferencias, obras) o G (actividades profesionales). 180: A (arrendamiento). 193: tipo de renta. */
  clave: string
  subclave: string
  percepcion: number
  retencion: number
  documentos: string[]
}
export type ResultadoResumen = ResultadoModelo & { perceptores: Perceptor[] }

function resumen(modelo: ModeloFiscal, aps: ApunteFiscal[], anio: number, claveDe: (a: ApunteFiscal) => [string, string]): ResultadoResumen {
  const m = new Map<string, Perceptor>()
  for (const a of aps) {
    const [clave, subclave] = claveDe(a)
    const k = `${perceptor(a)}|${clave}|${subclave}`
    const p = m.get(k) ?? { nif: a.terceroNif, nombre: a.terceroNombre, codigoPais: a.codigoPais, clave, subclave, percepcion: 0, retencion: 0, documentos: [] }
    p.percepcion += a.base; p.retencion += a.retencion; p.documentos.push(a.docId)
    m.set(k, p)
  }
  const perceptores = [...m.values()].map(p => ({ ...p, percepcion: r2(p.percepcion), retencion: r2(p.retencion) }))
    .sort((a, b) => a.clave.localeCompare(b.clave) || a.nombre.localeCompare(b.nombre))
  const percepciones = r2(perceptores.reduce((s, p) => s + p.percepcion, 0)), retenciones = r2(perceptores.reduce((s, p) => s + p.retencion, 0))
  // Comprobar: número de las casillas del resumen en el formulario (los diseños de registro las nombran sin número).
  const casillas: Record<string, number> = perceptores.length ? { '01': perceptores.length, '02': percepciones, '03': retenciones } : {}
  const avisos: string[] = []
  const sinNif = perceptores.filter(p => !p.nif)
  if (sinNif.length) avisos.push(`Perceptores sin NIF: ${sinNif.map(p => p.nombre || '(sin nombre)').join(', ')}.`)
  return {
    modelo, periodo: String(anio), casillas,
    lineas: [
      { casilla: '01', descripcion: modelo === '180' ? 'Número total de perceptores' : 'Número total de percepciones', importe: perceptores.length },
      { casilla: '02', descripcion: 'Importe total de las percepciones (base de retención)', importe: percepciones },
      { casilla: '03', descripcion: 'Importe total de las retenciones e ingresos a cuenta', importe: retenciones },
    ],
    resultado: 0, sinActividad: perceptores.length === 0, incluidos: unicos(aps.map(a => a.docId)), avisos, perceptores,
  }
}

const delAnio = (apuntes: ApunteFiscal[], anio: number) => apuntesDelPeriodo(apuntes, `${anio}-01-01`, `${anio}-12-31`)

export function modelo190(apuntes: ApunteFiscal[], anio: number): ResultadoResumen {
  const aps = delAnio(apuntes, anio).filter(a => conRetencion(a) && !esAlquiler(a))
  const r = resumen('190', aps, anio, a => (a.claveRetencion === 'otros' ? ['F', '01'] : ['G', a.retencionPct > 0 && a.retencionPct < 15 ? '03' : '01']))
  // Comprobar: subclave de la clave F (01 cursos y conferencias / 02 obras) según el tipo de rendimiento.
  if (r.perceptores.some(p => p.clave === 'F')) r.avisos.push('Revisa la subclave de los perceptores con clave F (cursos y conferencias u obras literarias, artísticas o científicas).')
  return r
}

export function modelo180(apuntes: ApunteFiscal[], anio: number): ResultadoResumen {
  const aps = delAnio(apuntes, anio).filter(a => conRetencion(a) && esAlquiler(a))
  const r = resumen('180', aps, anio, () => ['', ''])
  if (aps.length) r.avisos.push('Añade la situación y la referencia catastral de cada inmueble: el 180 las pide y no están en las facturas.')
  return r
}

export function modelo193(_apuntes: ApunteFiscal[], anio: number): ResultadoResumen {
  return {
    modelo: '193', periodo: String(anio), casillas: {}, lineas: [], resultado: 0, sinActividad: true, incluidos: [],
    avisos: ['Todavía no se registran dividendos ni intereses de préstamos de socios: el 193 sale vacío.'], perceptores: [],
  }
}
