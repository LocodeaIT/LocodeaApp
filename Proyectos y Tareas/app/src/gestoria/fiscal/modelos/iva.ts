/**
 * Modelos del IVA: 303 (autoliquidación), 349 (operaciones intracomunitarias),
 * 390 (resumen anual) y 369 (ventanilla única, OSS).
 *
 * Casillas del 303 comprobadas en el diseño de registro vigente para 2026 (DR303e26v101, Orden HAC/27/2026) y en
 * las instrucciones de 2T–4T de 2026:
 *  - Devengado: 150/151/152 tipo 0 %, 01/02/03 4 %, 04/05/06 10 %, 07/08/09 21 %; 10/11 adquisiciones
 *    intracomunitarias de bienes y servicios; 12/13 otras operaciones con inversión del sujeto pasivo;
 *    14/15 modificación de bases y cuotas (sin desglosar por tipo); 27 total cuota devengada.
 *  - Deducible: 28/29 interiores corrientes (incluye las cuotas autorrepercutidas por ISP que no son
 *    adquisiciones intracomunitarias), 30/31 interiores bienes de inversión, 32–35 importaciones,
 *    36/37 adquisiciones intracomunitarias corrientes, 38/39 de bienes de inversión, 45 total a deducir,
 *    46 resultado régimen general (27 − 45).
 *  - Información adicional: 59 entregas intracomunitarias de bienes y servicios, 60 exportaciones,
 *    120 no sujetas por reglas de localización, 122 sujetas con inversión del sujeto pasivo, 123 no sujetas
 *    acogidas a la ventanilla única.
 *  - Resultado: 64 suma de resultados, 65 % atribuible al Estado, 66 atribuible, 110 cuotas a compensar
 *    pendientes de periodos anteriores, 78 aplicadas en este periodo, 87 pendientes para periodos
 *    posteriores (110 − 78), 69 = 66 + 77 − 78 + 68 + 108, 71 = 69 − 70 + 109 − 112. «Sin actividad»: sin
 *    número de casilla.
 *  https://sede.agenciatributaria.gob.es/static_files/Sede/Disenyo_registro/DR_300_399/archivos_26/DR303e26v101.xlsx
 *  https://sede.agenciatributaria.gob.es/Sede/todas-gestiones/impuestos-tasas/iva/modelo-303-iva-autoliquidacion_/instrucciones-2026/instrucciones-02-12-2t-4t-2026.html
 *  https://www.boe.es/buscar/doc.php?id=BOE-A-2026-1761
 *
 * Casillas del 390: diseño de registro del ejercicio 2025 (dr390e2025.xlsx).
 *  https://sede.agenciatributaria.gob.es/static_files/Sede/Disenyo_registro/DR_300_399/archivos_25/dr390e2025.xlsx
 *  Comprobar: el diseño del 390 de 2026 (la Orden HAC/27/2026 lo modifica para los pagos a cuenta del modelo 319).
 *
 * 349: claves E, A, T, S, I, M, H, R, D, C y periodicidad (trimestral salvo que las entregas y servicios superen
 * 50.000 € en el trimestre o en alguno de los cuatro anteriores):
 *  https://sede.agenciatributaria.gob.es/static_files/Sede/Procedimiento_ayuda/GI28/instr_mod_349.pdf
 *  https://sede.agenciatributaria.gob.es/static_files/Sede/Disenyo_registro/DR_300_399/archivos_20/DR_Anexo_349.pdf
 * 369: por Estado miembro de consumo, tipo, base y cuota (diseño DR369e21.xlsx):
 *  https://sede.agenciatributaria.gob.es/static_files/Sede/Disenyo_registro/DR_300_399/archivos_21/DR369e21.xlsx
 */
import { PAISES_UE } from '../../../crm/fiscal'
import type { ApunteFiscal } from '../apuntes'
import { apuntesDelPeriodo, esIntracomunitaria, esRectificativa } from '../apuntes'
import { type Periodo, clavePeriodo, esUltimoDelAnio, etiquetaPeriodo, r2, rangoPeriodo } from '../periodos'
import { Casillas, type ResultadoModelo, euros, lineasDe, unicos } from './comun'

/** Valor de adquisición desde el que un bien es de inversión a efectos del IVA (art. 108.Dos.5.º LIVA: 500.000 pesetas). */
export const UMBRAL_BIEN_INVERSION = 3005.06
/** Umbral de las entregas y servicios intracomunitarios que obliga a presentar el 349 cada mes. */
export const UMBRAL_349_MENSUAL = 50000

const esBienInversionIva = (a: ApunteFiscal) => a.bienInversion && Math.abs(a.base) >= UMBRAL_BIEN_INVERSION

/**
 * Casillas de base, tipo y cuota del IVA devengado en régimen general por tipo impositivo.
 * Comprobar: las casillas 153–155 y 165–167 siguen en el diseño de 2026 con el tipo fijado a «00000» (eran de los
 * tipos temporales del 5 % y 2 %); no se usan. Un tipo distinto de 0, 4, 10 o 21 % sale como aviso.
 */
const CASILLAS_TIPO_303: Record<number, [string, string, string]> = { 0: ['150', '151', '152'], 4: ['01', '02', '03'], 10: ['04', '05', '06'], 21: ['07', '08', '09'] }

export const CATALOGO_303: [string, string][] = [
  ['150', 'Régimen general 0 %: base imponible'], ['152', 'Régimen general 0 %: cuota'],
  ['01', 'Régimen general 4 %: base imponible'], ['02', 'Tipo %'], ['03', 'Régimen general 4 %: cuota'],
  ['04', 'Régimen general 10 %: base imponible'], ['05', 'Tipo %'], ['06', 'Régimen general 10 %: cuota'],
  ['07', 'Régimen general 21 %: base imponible'], ['08', 'Tipo %'], ['09', 'Régimen general 21 %: cuota'],
  ['10', 'Adquisiciones intracomunitarias de bienes y servicios: base'], ['11', 'Adquisiciones intracomunitarias de bienes y servicios: cuota'],
  ['12', 'Otras operaciones con inversión del sujeto pasivo: base'], ['13', 'Otras operaciones con inversión del sujeto pasivo: cuota'],
  ['14', 'Modificación de bases y cuotas: base'], ['15', 'Modificación de bases y cuotas: cuota'],
  ['27', 'Total cuota devengada'],
  ['28', 'Operaciones interiores corrientes: base'], ['29', 'Operaciones interiores corrientes: cuota'],
  ['30', 'Operaciones interiores con bienes de inversión: base'], ['31', 'Operaciones interiores con bienes de inversión: cuota'],
  ['32', 'Importaciones de bienes corrientes: base'], ['33', 'Importaciones de bienes corrientes: cuota'],
  ['34', 'Importaciones de bienes de inversión: base'], ['35', 'Importaciones de bienes de inversión: cuota'],
  ['36', 'Adquisiciones intracomunitarias de bienes y servicios corrientes: base'], ['37', 'Adquisiciones intracomunitarias de bienes y servicios corrientes: cuota'],
  ['38', 'Adquisiciones intracomunitarias de bienes de inversión: base'], ['39', 'Adquisiciones intracomunitarias de bienes de inversión: cuota'],
  ['45', 'Total a deducir'], ['46', 'Resultado régimen general'],
  ['59', 'Entregas intracomunitarias de bienes y servicios'], ['60', 'Exportaciones y operaciones asimiladas'],
  ['120', 'Operaciones no sujetas por reglas de localización'], ['122', 'Operaciones sujetas con inversión del sujeto pasivo'],
  ['123', 'Operaciones no sujetas acogidas a la ventanilla única'],
  ['64', 'Suma de resultados'], ['65', '% atribuible a la Administración del Estado'], ['66', 'Atribuible a la Administración del Estado'],
  ['110', 'Cuotas a compensar pendientes de periodos anteriores'], ['78', 'Cuotas a compensar aplicadas en este periodo'],
  ['87', 'Cuotas a compensar pendientes para periodos posteriores'], ['69', 'Resultado de la autoliquidación'], ['71', 'Resultado de la liquidación'],
]

/** Modelo 303 del trimestre o mes. `cuotasACompensar`: saldo pendiente de periodos anteriores (casilla 110). */
export function modelo303(apuntes: ApunteFiscal[], periodo: Periodo, opciones: { cuotasACompensar?: number } = {}): ResultadoModelo {
  const { desde, hasta } = rangoPeriodo(periodo)
  const del = apuntesDelPeriodo(apuntes, desde, hasta)
  const c = new Casillas(), avisos: string[] = []
  const tiposRaros = new Set<number>()
  let exentas = 0, comprasNegativas = 0

  for (const a of del) {
    const op = a.tipoOperacion
    if (a.origen === 'venta') {
      const servicios = a.base - a.baseBienes
      switch (op) {
        case 'interior': case 'ue-particular':
          if (esRectificativa(a)) { c.sumar('14', a.base); c.sumar('15', a.cuota); break }
          for (const l of a.desglose) {
            const cas = CASILLAS_TIPO_303[l.tipo]
            if (!cas) { tiposRaros.add(l.tipo); continue }
            c.sumar(cas[0], l.base); c.poner(cas[1], l.tipo); c.sumar(cas[2], l.cuota)
          }
          break
        case 'ue-empresa': c.sumar('59', a.base); break
        case 'fuera-ue': c.sumar('60', a.baseBienes); c.sumar('120', servicios); break
        case 'isp-interior': c.sumar('122', a.base); break
        case 'ue-oss': c.sumar('123', a.base); break
        case 'exenta': exentas += a.base; break
      }
      continue
    }
    // compras y gastos
    if (a.base < 0) comprasNegativas++
    const inversion = esBienInversionIva(a)
    const deducir = (corriente: string, deInversion: string) => {
      if (!a.cuotaDeducible) return
      const [b, q] = inversion ? [deInversion, String(Number(deInversion) + 1)] : [corriente, String(Number(corriente) + 1)]
      c.sumar(b, a.base); c.sumar(q, a.cuotaDeducible)
    }
    switch (op) {
      case 'interior': deducir('28', '30'); break
      case 'ue': c.sumar('10', a.base); c.sumar('11', a.cuota); deducir('36', '38'); break
      case 'fuera-ue': case 'isp-interior': c.sumar('12', a.base); c.sumar('13', a.cuota); deducir('28', '30'); break
      case 'importacion': deducir('32', '34'); break
      case 'exenta': break
    }
  }

  // tipos 0/4/10/21: limpia los «tipo %» sin base
  for (const [, [b, t]] of Object.entries(CASILLAS_TIPO_303)) if (!c.get(b)) c.poner(t, 0)
  c.poner('27', c.suma('152', '167', '03', '155', '06', '09', '11', '13', '15', '158', '170', '18', '21', '24', '26'))
  c.poner('45', c.suma('29', '31', '33', '35', '37', '39', '41', '42', '43', '44'))
  c.poner('46', r2(c.get('27') - c.get('45')))
  c.poner('64', c.suma('46', '58', '76'))
  c.poner('65', 100)
  c.poner('66', r2(c.get('64') * c.get('65') / 100))
  const pendiente = r2(Math.max(0, Number(opciones.cuotasACompensar) || 0))
  c.poner('110', pendiente)
  const aplicadas = r2(Math.min(pendiente, Math.max(0, c.get('66') + c.get('77'))))
  c.poner('78', aplicadas)
  c.poner('87', r2(pendiente - aplicadas))
  c.poner('69', r2(c.get('66') + c.get('77') - c.get('78') + c.get('68') + c.get('108')))
  c.poner('71', r2(c.get('69') - c.get('70') + c.get('109') - c.get('112')))

  const casillas = c.aObjeto()
  const resultado = c.get('71')
  const sinActividad = del.length === 0
  if (tiposRaros.size) avisos.push(`Hay ventas a tipos sin casilla en el 303 de 2026 (${[...tiposRaros].join(', ')} %): no se han sumado. Revisa el tipo de IVA de esas facturas.`)
  if (exentas) avisos.push(`Hay ventas exentas (${euros(exentas)}) que no dan derecho a deducir: puede tocar aplicar la prorrata (art. 102 LIVA). No van en ninguna casilla del 303; sí en el 390.`)
  if (comprasNegativas) avisos.push('Hay compras con base negativa: si rectifican deducciones de otro periodo, van en las casillas 40 y 41 en lugar de restar aquí.')
  if (resultado < 0) avisos.push(esUltimoDelAnio(periodo)
    ? 'Resultado negativo en el último periodo del año: se puede pedir la devolución o dejarlo a compensar.'
    : 'Resultado negativo: queda a compensar en los periodos siguientes (la devolución solo se pide en el último periodo del año, salvo inscripción en el REDEME).')
  if (sinActividad) avisos.push('Sin operaciones en el periodo: se presenta igualmente marcando «sin actividad».')

  return {
    modelo: '303', periodo: clavePeriodo(periodo), casillas,
    lineas: lineasDe(casillas, CATALOGO_303, ['27', '45', '46', '71']),
    resultado, sinActividad, incluidos: unicos(del.map(a => a.docId)), avisos,
  }
}

// ─────────────────────────────────────────────── 349

export type Clave349 = 'E' | 'A' | 'T' | 'S' | 'I' | 'M' | 'H' | 'R' | 'D' | 'C'

export interface Operador349 { nif: string; nombre: string; codigoPais: string; clave: Clave349; base: number }
export type Resultado349 = ResultadoModelo & { operadores: Operador349[] }

/** Prefijo del NIF-IVA: Grecia usa EL aunque su código ISO sea GR. */
export const prefijoIva = (codigoPais: string) => (String(codigoPais).toUpperCase() === 'GR' ? 'EL' : String(codigoPais).toUpperCase())

/** NIF-IVA sin el prefijo del país (el 349 los pide por separado). */
export function nifSinPrefijo(nif: string, codigoPais: string): string {
  const v = String(nif ?? '').toUpperCase().replace(/[\s.-]/g, ''), p = prefijoIva(codigoPais)
  return v.startsWith(p) ? v.slice(p.length) : v
}

export function modelo349(apuntes: ApunteFiscal[], periodo: Periodo): Resultado349 {
  const { desde, hasta } = rangoPeriodo(periodo)
  const del = apuntesDelPeriodo(apuntes, desde, hasta).filter(esIntracomunitaria)
  const m = new Map<string, Operador349>(), avisos: string[] = []
  const sumar = (a: ApunteFiscal, clave: Clave349, base: number) => {
    if (!base) return
    const nif = nifSinPrefijo(a.terceroNif, a.codigoPais), codigoPais = prefijoIva(a.codigoPais)
    const k = `${clave}|${codigoPais}|${nif || a.terceroId}`
    const o = m.get(k) ?? { nif, nombre: a.terceroNombre, codigoPais, clave, base: 0 }
    o.base += base
    m.set(k, o)
  }
  for (const a of del) {
    // Rectificativa de una operación de otro periodo: va al bloque de rectificaciones, no suma aquí.
    if (esRectificativa(a) && a.rectificadaId) {
      const orig = apuntes.find(x => x.origen === 'venta' && x.docId === a.rectificadaId)
      if (orig && (orig.fechaDevengo < desde || orig.fechaDevengo > hasta)) {
        avisos.push(`La rectificativa ${a.numero} corrige una factura de otro periodo (${orig.numero}): va en el apartado de rectificaciones del 349, con el periodo de la original.`)
        continue
      }
    }
    if (!a.terceroNif) avisos.push(`${a.numero}: el operador ${a.terceroNombre || '(sin nombre)'} no tiene NIF-IVA.`)
    const servicios = r2(a.base - a.baseBienes)
    if (a.origen === 'venta') { sumar(a, 'E', a.baseBienes); sumar(a, 'S', servicios) } else { sumar(a, 'A', a.baseBienes); sumar(a, 'I', servicios) }
  }
  const operadores = [...m.values()].map(o => ({ ...o, base: r2(o.base) })).filter(o => o.base !== 0)
    .sort((a, b) => a.clave.localeCompare(b.clave) || a.nombre.localeCompare(b.nombre))
  const entregas = r2(operadores.filter(o => o.clave === 'E' || o.clave === 'S').reduce((s, o) => s + o.base, 0))
  if (periodo.tipo === 'T' && entregas > UMBRAL_349_MENSUAL) {
    avisos.push(`Las entregas y servicios intracomunitarios del trimestre (${euros(entregas)}) superan 50.000 €: el 349 pasa a ser mensual desde el mes en que se superó.`)
  }
  // Comprobar: numeración de las casillas del resumen del formulario (el diseño de registro las nombra sin número).
  const casillas: Record<string, number> = {}
  const total = r2(operadores.reduce((s, o) => s + o.base, 0))
  if (operadores.length) { casillas['01'] = operadores.length; casillas['02'] = total }
  return {
    modelo: '349', periodo: clavePeriodo(periodo), casillas,
    lineas: [
      { casilla: '01', descripcion: 'Número total de operadores intracomunitarios', importe: operadores.length },
      { casilla: '02', descripcion: 'Importe de las operaciones intracomunitarias', importe: total },
    ],
    resultado: 0, sinActividad: operadores.length === 0, incluidos: unicos(del.map(a => a.docId)), avisos: unicos(avisos), operadores,
  }
}

// ─────────────────────────────────────────────── 369

export interface Pais369 { codigoPais: string; tipo: number; base: number; cuota: number }
export type Resultado369 = ResultadoModelo & { porPais: Pais369[] }

/** Ventanilla única, régimen de la Unión: servicios a particulares de otros Estados miembros (trimestral). */
export function modelo369(apuntes: ApunteFiscal[], periodo: Periodo): Resultado369 {
  const { desde, hasta } = rangoPeriodo(periodo)
  const del = apuntesDelPeriodo(apuntes, desde, hasta).filter(a => a.origen === 'venta' && a.tipoOperacion === 'ue-oss')
  const m = new Map<string, Pais369>(), avisos: string[] = []
  for (const a of del) {
    if (!PAISES_UE.includes(a.codigoPais) || a.codigoPais === 'ES') avisos.push(`${a.numero}: la ventanilla única es para clientes de otros Estados miembros (país ${a.codigoPais}).`)
    for (const l of a.desglose) {
      const k = `${a.codigoPais}|${l.tipo}`
      const x = m.get(k) ?? { codigoPais: a.codigoPais, tipo: l.tipo, base: 0, cuota: 0 }
      x.base += l.base; x.cuota += l.cuota
      m.set(k, x)
    }
  }
  const porPais = [...m.values()].map(x => ({ ...x, base: r2(x.base), cuota: r2(x.cuota) })).sort((a, b) => a.codigoPais.localeCompare(b.codigoPais) || b.tipo - a.tipo)
  const base = r2(porPais.reduce((s, x) => s + x.base, 0)), cuota = r2(porPais.reduce((s, x) => s + x.cuota, 0))
  // Comprobar: el 369 no numera casillas; cada fila lleva Estado de consumo, tipo (con marca R reducido / S estándar), base y cuota.
  avisos.push('Indica en cada fila si el tipo es estándar (S) o reducido (R) del país de consumo.')
  if (periodo.tipo !== 'T') avisos.push('El régimen de la Unión se declara por trimestres.')
  return {
    modelo: '369', periodo: clavePeriodo(periodo), casillas: base || cuota ? { base, cuota } : {},
    lineas: porPais.map(x => ({ casilla: `${x.codigoPais} ${x.tipo} %`, descripcion: `Cuota de ${x.codigoPais} al ${x.tipo} % sobre ${euros(x.base)}`, importe: x.cuota })),
    resultado: cuota, sinActividad: del.length === 0, incluidos: unicos(del.map(a => a.docId)),
    avisos: del.length ? avisos : ['Sin operaciones en la ventanilla única: se presenta igualmente la declaración sin actividad.'], porPais,
  }
}

// ─────────────────────────────────────────────── 390

/** Casillas del 390 por tipo (0, 4, 10, 21 %): [base, cuota]. */
const T390: Record<string, Record<number, [string, string]>> = {
  devengado: { 0: ['700', '701'], 4: ['01', '02'], 10: ['03', '04'], 21: ['05', '06'] },
  aib: { 0: ['716', '717'], 4: ['21', '22'], 10: ['23', '24'], 21: ['25', '26'] },
  ais: { 0: ['720', '721'], 4: ['545', '546'], 10: ['547', '548'], 21: ['551', '552'] },
  intCorr: { 4: ['190', '191'], 10: ['603', '604'], 21: ['605', '606'] },
  intInv: { 4: ['196', '197'], 10: ['611', '612'], 21: ['613', '614'] },
  impCorr: { 4: ['202', '203'], 10: ['619', '620'], 21: ['621', '622'] },
  impInv: { 4: ['208', '209'], 10: ['623', '624'], 21: ['625', '626'] },
  aibCorr: { 4: ['214', '215'], 10: ['627', '628'], 21: ['629', '630'] },
  aibInv: { 4: ['220', '221'], 10: ['631', '632'], 21: ['633', '634'] },
  aisDed: { 4: ['587', '588'], 10: ['635', '636'], 21: ['637', '638'] },
}
/** Totales de cada bloque de deducciones: [base, cuota]. */
const TOT390: Record<string, [string, string]> = {
  intCorr: ['48', '49'], intInv: ['50', '51'], impCorr: ['52', '53'], impInv: ['54', '55'], aibCorr: ['56', '57'], aibInv: ['58', '59'], aisDed: ['597', '598'],
}

export const CATALOGO_390: [string, string][] = [
  ['700', 'Régimen ordinario 0 %: base'], ['01', 'Régimen ordinario 4 %: base'], ['02', 'Régimen ordinario 4 %: cuota'],
  ['03', 'Régimen ordinario 10 %: base'], ['04', 'Régimen ordinario 10 %: cuota'], ['05', 'Régimen ordinario 21 %: base'], ['06', 'Régimen ordinario 21 %: cuota'],
  ['21', 'Adq. intracomunitarias de bienes 4 %: base'], ['22', 'cuota'], ['23', 'Adq. intracomunitarias de bienes 10 %: base'], ['24', 'cuota'],
  ['25', 'Adq. intracomunitarias de bienes 21 %: base'], ['26', 'cuota'],
  ['545', 'Adq. intracomunitarias de servicios 4 %: base'], ['546', 'cuota'], ['547', 'Adq. intracomunitarias de servicios 10 %: base'], ['548', 'cuota'],
  ['551', 'Adq. intracomunitarias de servicios 21 %: base'], ['552', 'cuota'],
  ['27', 'IVA devengado por inversión del sujeto pasivo: base'], ['28', 'cuota'], ['29', 'Modificación de bases y cuotas: base'], ['30', 'cuota'],
  ['33', 'Total bases IVA'], ['34', 'Total cuotas IVA'], ['47', 'Total cuotas IVA y recargo de equivalencia'],
  ['190', 'Interiores corrientes 4 %: base'], ['191', 'cuota'], ['603', 'Interiores corrientes 10 %: base'], ['604', 'cuota'],
  ['605', 'Interiores corrientes 21 %: base'], ['606', 'cuota'], ['48', 'Total interiores corrientes: base'], ['49', 'Total interiores corrientes: cuota'],
  ['196', 'Interiores bienes de inversión 4 %: base'], ['197', 'cuota'], ['611', 'Interiores bienes de inversión 10 %: base'], ['612', 'cuota'],
  ['613', 'Interiores bienes de inversión 21 %: base'], ['614', 'cuota'], ['50', 'Total interiores bienes de inversión: base'], ['51', 'cuota'],
  ['52', 'Total importaciones bienes corrientes: base'], ['53', 'cuota'], ['54', 'Total importaciones bienes de inversión: base'], ['55', 'cuota'],
  ['56', 'Total adq. intracomunitarias bienes corrientes: base'], ['57', 'cuota'], ['58', 'Total adq. intracomunitarias bienes de inversión: base'], ['59', 'cuota'],
  ['597', 'Total adq. intracomunitarias de servicios: base'], ['598', 'cuota'],
  ['64', 'Suma de deducciones'], ['65', 'Resultado régimen general'], ['84', 'Suma de resultados'],
  ['85', 'Compensación de cuotas del ejercicio anterior'], ['86', 'Resultado de la liquidación'],
  ['95', 'Total resultados a ingresar en las autoliquidaciones del ejercicio'], ['97', 'Resultado del último periodo: a compensar'],
  ['98', 'Resultado del último periodo: a devolver'],
  ['99', 'Volumen: operaciones en régimen general'], ['103', 'Volumen: entregas intracomunitarias de bienes y servicios'],
  ['104', 'Volumen: exportaciones y otras exentas con derecho a deducción'], ['105', 'Volumen: exentas sin derecho a deducción'],
  ['110', 'Volumen: no sujetas por reglas de localización'], ['125', 'Volumen: sujetas con inversión del sujeto pasivo'],
  ['126', 'Volumen: no sujetas acogidas a la ventanilla única'], ['108', 'Total volumen de operaciones'],
  ['230', 'Adquisiciones interiores exentas'], ['232', 'Bases imponibles del IVA soportado no deducible'],
]

/** Resumen anual del IVA a partir de los apuntes del año. Lo que depende de las autoliquidaciones presentadas (85, 95, 97, 98) lo completa `calcularModelo`. */
export function modelo390(apuntes: ApunteFiscal[], anio: number): ResultadoModelo {
  const p: Periodo = { anio, tipo: 'A', n: 0 }
  const { desde, hasta } = rangoPeriodo(p)
  const del = apuntesDelPeriodo(apuntes, desde, hasta)
  const c = new Casillas(), avisos: string[] = [], raros = new Set<number>()
  const porTipo = (bloque: string, tipo: number, base: number, cuota: number) => {
    if (!base && !cuota) return true
    const cas = T390[bloque][tipo]
    if (!cas) { raros.add(tipo); return false }
    c.sumar(cas[0], base); c.sumar(cas[1], cuota)
    const tot = TOT390[bloque]
    if (tot) { c.sumar(tot[0], base); c.sumar(tot[1], cuota) }
    return true
  }
  for (const a of del) {
    const op = a.tipoOperacion
    if (a.origen === 'venta') {
      switch (op) {
        case 'interior': case 'ue-particular':
          if (esRectificativa(a)) { c.sumar('29', a.base); c.sumar('30', a.cuota) } else for (const l of a.desglose) porTipo('devengado', l.tipo, l.base, l.cuota)
          c.sumar('99', a.base); break
        case 'ue-empresa': c.sumar('103', a.base); break
        case 'fuera-ue': c.sumar('104', a.baseBienes); c.sumar('110', a.base - a.baseBienes); break
        case 'isp-interior': c.sumar('125', a.base); break
        case 'ue-oss': c.sumar('126', a.base); break
        case 'exenta': c.sumar('105', a.base); break
      }
      continue
    }
    const inversion = esBienInversionIva(a)
    const proporcion = a.cuota ? a.cuotaDeducible / a.cuota : 0
    const deducir = (bloque: string) => { if (a.cuotaDeducible) for (const l of a.desglose) porTipo(bloque, l.tipo, l.base, r2(l.cuota * proporcion)) }
    if (a.cuota && !a.cuotaDeducible) c.sumar('232', a.base)
    switch (op) {
      case 'interior': deducir(inversion ? 'intInv' : 'intCorr'); break
      case 'ue': {
        const fb = a.base ? a.baseBienes / a.base : 0
        for (const l of a.desglose) { porTipo('aib', l.tipo, r2(l.base * fb), r2(l.cuota * fb)); porTipo('ais', l.tipo, r2(l.base * (1 - fb)), r2(l.cuota * (1 - fb))) }
        if (a.cuotaDeducible) for (const l of a.desglose) {
          porTipo(inversion ? 'aibInv' : 'aibCorr', l.tipo, r2(l.base * fb), r2(l.cuota * fb * proporcion))
          porTipo('aisDed', l.tipo, r2(l.base * (1 - fb)), r2(l.cuota * (1 - fb) * proporcion))
        }
        break
      }
      case 'fuera-ue': case 'isp-interior': c.sumar('27', a.base); c.sumar('28', a.cuota); deducir(inversion ? 'intInv' : 'intCorr'); break
      case 'importacion': deducir(inversion ? 'impInv' : 'impCorr'); break
      case 'exenta': c.sumar('230', a.base); break
    }
  }
  const bases = ['700', '01', '03', '05', '716', '21', '23', '25', '720', '545', '547', '551', '27', '29']
  const cuotas = ['701', '02', '04', '06', '717', '22', '24', '26', '721', '546', '548', '552', '28', '30']
  c.poner('33', c.suma(...bases)); c.poner('34', c.suma(...cuotas)); c.poner('47', c.get('34'))
  c.poner('64', c.suma('49', '51', '53', '55', '57', '59', '598', '62', '63', '522'))
  c.poner('65', r2(c.get('47') - c.get('64')))
  c.poner('84', c.get('65'))
  c.poner('86', r2(c.get('84') - c.get('85')))
  // Comprobar: fórmula de la casilla 108 (las entregas de inmuebles y de bienes de inversión, 106 y 107, se restan, art. 121 LIVA).
  c.poner('108', r2(c.suma('99', '653', '103', '104', '105', '110', '125', '126', '127') - c.get('106') - c.get('107')))
  if (raros.size) avisos.push(`Hay importes a tipos sin casilla en el 390 (${[...raros].join(', ')} %): no se han sumado.`)
  if (c.get('105')) avisos.push('Hay operaciones exentas sin derecho a deducción: revisa la prorrata (casillas 114 a 118).')
  const casillas = c.aObjeto()
  return {
    modelo: '390', periodo: clavePeriodo(p), casillas, lineas: lineasDe(casillas, CATALOGO_390, ['47', '64', '65', '86', '108']),
    resultado: 0, sinActividad: del.length === 0, incluidos: unicos(del.map(a => a.docId)),
    avisos: [...avisos, `Comprueba que el 390 cuadra con los cuatro 303 de ${etiquetaPeriodo(p).toLowerCase()}.`],
  }
}
