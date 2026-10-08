/**
 * Calendario de obligaciones de la sociedad: qué modelo toca, de qué periodo,
 * entre qué fechas se presenta, hasta cuándo se puede domiciliar y si de
 * verdad aplica a Locodea según su perfil fiscal y sus datos.
 *
 * Plazos comprobados (calendario del contribuyente 2026 y sus páginas por día):
 *  - 303 trimestral: 1–20 de abril, julio y octubre; 4T del 1 al 30 de enero. 303 mensual: del 1 al 30 del
 *    mes siguiente (enero: hasta el último día de febrero; diciembre: 30 de enero).
 *  - 111, 115, 123 trimestrales: 1–20 de abril, julio, octubre y enero (el 4T también el 20 de enero).
 *    Mensuales (gran empresa): del 1 al 20 del mes siguiente, también agosto.
 *  - 349: trimestral 1–20 del mes siguiente, 4T hasta el 30 de enero; mensual 1–20, julio hasta el 20 de
 *    septiembre, diciembre hasta el 30 de enero (instrucciones del 349).
 *  - 390: 1–30 de enero. 190, 180 y 193: 1–31 de enero. 347: febrero. 232: noviembre (ejercicio = año natural).
 *  - 202: 1–20 de abril, octubre y diciembre. 200: 25 días naturales siguientes a los 6 meses del cierre (1–25 jul).
 *  - 369: hasta el último día del mes siguiente al trimestre y NO se prorroga aunque caiga en festivo o fin de semana.
 *  - Si el último día es inhábil, el plazo acaba el primer día hábil siguiente.
 *  - Domiciliación: entre su fin y el fin del plazo debe haber al menos tres días hábiles o cinco naturales. Los
 *    plazos publicados para 2026 coinciden todos con «tres días hábiles antes del fin del plazo» (p. ej. 303 4T 2025:
 *    presentación hasta el 30 de enero, domiciliación hasta el 27; 200: 27 de julio → 22 de julio).
 *  https://sede.agenciatributaria.gob.es/Sede/ayuda/calendario-contribuyente/calendario-contribuyente-2026/plazos-presentacion-autoliquidaciones-domiciliacion-bancaria.html
 *  https://sede.agenciatributaria.gob.es/Sede/ayuda/calendario-contribuyente/calendario-contribuyente-2026/recuerde/vencimientos-dias-inhabiles-sabados-festivos.html
 *  https://sede.agenciatributaria.gob.es/Sede/ayuda/calendario-contribuyente/calendario-contribuyente-2026/calendario-anual/enero/hasta-31-enero.html (369 en sábado)
 *  https://sede.agenciatributaria.gob.es/Sede/ayuda/calendario-contribuyente/calendario-contribuyente-2026/calendario-anual/febrero/hasta-2-febrero.html (190/180/193)
 *  https://sede.agenciatributaria.gob.es/Sede/ayuda/calendario-contribuyente/calendario-contribuyente-2026/calendario-anual/marzo/hasta-2-marzo.html (347)
 *  https://sede.agenciatributaria.gob.es/Sede/ayuda/calendario-contribuyente/calendario-contribuyente-2026/calendario-anual/noviembre/hasta-30-noviembre.html (232)
 *  https://sede.agenciatributaria.gob.es/static_files/Sede/Procedimiento_ayuda/GI28/instr_mod_349.pdf
 *  Plazos mercantiles: arts. 253, 164 y 279 LSC (https://www.boe.es/buscar/act.php?id=BOE-A-2010-10544) y
 *  art. 18 Ley 14/2013 (legalización de libros en cuatro meses, https://www.boe.es/buscar/act.php?id=BOE-A-2013-10074).
 *  Pagos fraccionados: art. 40 LIS (https://www.boe.es/buscar/act.php?id=BOE-A-2014-12328).
 */
import type { ModeloFiscal, PerfilFiscal } from '../types'
import { hoy } from '../../domain/fechas'
import type { ApunteFiscal } from './apuntes'
import { apuntesDelPeriodo, esIntracomunitaria } from './apuntes'
import {
  type Periodo, clavePeriodo, diaSemana, etiquetaPeriodo, fechaDe, finDeMes, periodosDelAnio, rangoPeriodo, sumarDiasF, sumarMeses,
} from './periodos'
import { modelo347 } from './modelos'

// ─────────────────────────────────────────────── días hábiles

/** Domingo de Pascua (algoritmo anónimo gregoriano de Meeus/Jones/Butcher). */
export function pascua(anio: number): string {
  const a = anio % 19, b = Math.floor(anio / 100), c = anio % 100, d = Math.floor(b / 4), e = b % 4
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451)
  const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1
  return fechaDe(anio, mes, dia)
}

/**
 * Festivos nacionales fijos (los comunes a todo el Estado) y el Viernes Santo.
 * Comprobar: cada año la resolución de días inhábiles de la AGE en el BOE; los festivos autonómicos y locales del
 * domicilio (y, para la domiciliación, los de Madrid, sede del Departamento de Informática de la AEAT) también
 * prorrogan el plazo: pásalos en `festivosExtra`.
 */
export function festivosNacionales(anio: number): string[] {
  const fijos = ['01-01', '01-06', '05-01', '08-15', '10-12', '11-01', '12-06', '12-08', '12-25'].map(md => `${anio}-${md}`)
  return [...fijos, sumarDiasF(pascua(anio), -2)].sort()
}

export function esHabil(dia: string, festivosExtra: string[] = []): boolean {
  const s = diaSemana(dia)
  if (s === 0 || s === 6) return false
  return !festivosNacionales(Number(dia.slice(0, 4))).includes(dia) && !festivosExtra.includes(dia)
}

/** El mismo día si es hábil; si es sábado, domingo o festivo, el siguiente hábil. */
export function diaHabil(dia: string, festivosExtra: string[] = []): string {
  let d = dia
  while (!esHabil(d, festivosExtra)) d = sumarDiasF(d, 1)
  return d
}

/** Último día para domiciliar el pago: el tercer día hábil anterior al fin del plazo (ya prorrogado). */
export function domiciliacionHasta(finPlazo: string, festivosExtra: string[] = []): string {
  let d = finPlazo, n = 0
  while (n < 3) { d = sumarDiasF(d, -1); if (esHabil(d, festivosExtra)) n++ }
  return d
}

// ─────────────────────────────────────────────── obligaciones

export interface Obligacion {
  modelo: ModeloFiscal
  nombre: string
  organismo: 'AEAT' | 'Registro Mercantil'
  periodo: string
  etiquetaPeriodo: string
  desde: string
  hasta: string
  domiciliarHasta: string | null
  aplica: boolean
  motivo: string
}

export const NOMBRE_MODELO: Record<ModeloFiscal, string> = {
  '303': 'IVA. Autoliquidación', '390': 'IVA. Resumen anual', '349': 'Operaciones intracomunitarias',
  '111': 'Retenciones de trabajo y profesionales', '190': 'Retenciones de trabajo y profesionales. Resumen anual',
  '115': 'Retenciones de alquileres', '180': 'Retenciones de alquileres. Resumen anual',
  '123': 'Retenciones de capital mobiliario', '193': 'Retenciones de capital mobiliario. Resumen anual',
  '347': 'Operaciones con terceras personas', '369': 'IVA. Ventanilla única (OSS)', '202': 'Impuesto sobre Sociedades. Pago fraccionado',
  '200': 'Impuesto sobre Sociedades', '232': 'Operaciones vinculadas', '036': 'Declaración censal',
  formulacion: 'Formulación de las cuentas anuales', legalizacion: 'Legalización de los libros',
  junta: 'Aprobación de las cuentas en junta', deposito: 'Depósito de las cuentas anuales',
}

/** Volumen de operaciones a partir del cual la sociedad es gran empresa y declara IVA y retenciones cada mes. */
export const UMBRAL_GRAN_EMPRESA = 6010121.04
const DOMICILIABLES: ModeloFiscal[] = ['303', '111', '115', '123', '202', '200']

/** Fin del plazo de presentación de un modelo AEAT para su periodo, sin prorrogar. */
function finPlazo(modelo: ModeloFiscal, p: Periodo, mesCierre: number): { desde: string; hasta: string } {
  const sig = (mes: number, dia: number) => ({ desde: fechaDe(p.anio, mes, 1), hasta: fechaDe(p.anio, mes, dia) })
  const enero = (dia: number) => ({ desde: fechaDe(p.anio + 1, 1, 1), hasta: fechaDe(p.anio + 1, 1, dia) })
  const finMes = p.tipo === 'T' ? p.n * 3 : p.n
  switch (modelo) {
    case '303':
      if (p.tipo === 'M') {
        if (p.n === 12) return enero(30)
        const ultimo = Number(finDeMes(p.anio, p.n + 1).slice(8, 10))
        return sig(p.n + 1, Math.min(30, ultimo))
      }
      return p.n === 4 ? enero(30) : sig(finMes + 1, 20)
    case '349':
      if (p.tipo === 'M' && p.n === 7) return { desde: fechaDe(p.anio, 8, 1), hasta: fechaDe(p.anio, 9, 20) }
      return finMes === 12 ? enero(30) : sig(finMes + 1, 20)
    case '111': case '115': case '123':
      return finMes === 12 ? enero(20) : sig(finMes + 1, 20)
    case '369':
      return { desde: fechaDe(p.anio, finMes + 1, 1), hasta: finDeMes(p.anio, finMes + 1) }
    case '390': return enero(30)
    case '190': case '180': case '193': return enero(31)
    case '347': return { desde: fechaDe(p.anio + 1, 2, 1), hasta: finDeMes(p.anio + 1, 2) }
    case '202': { const mes = { 1: 4, 2: 10, 3: 12 }[p.n] ?? 4; return sig(mes, 20) }
    case '200': {
      // 25 días naturales siguientes a los seis meses posteriores a la conclusión del periodo impositivo
      const fin6 = finDeMes(p.anio, mesCierre + 6)
      return { desde: sumarDiasF(fin6, 1), hasta: sumarDiasF(fin6, 25) }
    }
    case '232': {
      // mes siguiente a los diez meses posteriores a la conclusión del periodo impositivo
      const mes = mesCierre + 11
      return { desde: fechaDe(p.anio, mes, 1), hasta: finDeMes(p.anio, mes) }
    }
    default: return { desde: fechaDe(p.anio, 1, 1), hasta: fechaDe(p.anio, 1, 1) }
  }
}

interface Entrada {
  perfil: PerfilFiscal
  desde: string
  hasta: string
  apuntes: ApunteFiscal[]
  /** Cuota íntegra del último Impuesto sobre Sociedades declarado (base del 202, art. 40.2 LIS). */
  cuotaUltimoIS?: number | null
}

/**
 * Obligaciones cuyo plazo termina entre `desde` y `hasta`, solo de periodos posteriores a la constitución
 * (si no hay fecha de constitución, desde hoy), con `aplica` y `motivo` según el perfil y los datos.
 */
export function obligaciones(e: Entrada): Obligacion[] {
  const { perfil, apuntes } = e
  const ref = (perfil.fechaConstitucion || hoy()).slice(0, 10)
  const anioConst = Number(ref.slice(0, 4))
  const mesCierre = Number(perfil.mesCierre) || 12
  const granEmpresa = (Number(perfil.cifraNegocios) || 0) > UMBRAL_GRAN_EMPRESA
  const ivaTipo: 'T' | 'M' = perfil.periodicidadIva === 'mensual' ? 'M' : 'T'
  const retTipo: 'T' | 'M' = granEmpresa ? 'M' : 'T'
  const out: Obligacion[] = []

  const del = (p: Periodo) => { const r = rangoPeriodo(p); return apuntesDelPeriodo(apuntes, r.desde, r.hasta) }
  const conRetencion = (a: ApunteFiscal, alquiler: boolean) => a.origen !== 'venta' && a.retencion !== 0 && (a.claveRetencion === 'arrendamiento') === alquiler
  const hayRet111 = (p: Periodo) => del(p).some(a => conRetencion(a, false))
  const hayRet115 = (p: Periodo) => del(p).some(a => conRetencion(a, true))

  const add = (modelo: ModeloFiscal, p: Periodo, aplica: boolean, motivo: string) => {
    const plazo = finPlazo(modelo, p, mesCierre)
    const hasta = modelo === '369' ? plazo.hasta : diaHabil(plazo.hasta)
    out.push({
      modelo, nombre: NOMBRE_MODELO[modelo], organismo: 'AEAT', periodo: clavePeriodo(p), etiquetaPeriodo: etiquetaPeriodo(p),
      desde: plazo.desde, hasta, domiciliarHasta: DOMICILIABLES.includes(modelo) ? domiciliacionHasta(hasta) : null, aplica, motivo,
    })
  }

  for (let anio = Number(e.desde.slice(0, 4)) - 2; anio <= Number(e.hasta.slice(0, 4)); anio++) {
    const posterior = (p: Periodo) => rangoPeriodo(p).hasta >= ref
    const primerEjercicio = anio <= anioConst

    // IVA
    for (const p of periodosDelAnio(anio, ivaTipo).filter(posterior)) {
      const n = del(p).length
      add('303', p, true, n ? `${n} documentos con fecha de devengo en el periodo.` : 'Sin actividad: se presenta igualmente marcando «sin actividad».')
    }
    for (const p of periodosDelAnio(anio, 'T').filter(posterior)) {
      const ue = del(p).filter(esIntracomunitaria)
      const entregas = ue.filter(a => a.origen === 'venta').reduce((s, a) => s + a.base, 0)
      add('349', p, ue.length > 0, ue.length
        ? `${ue.length} operaciones intracomunitarias en el periodo.` + (perfil.roi ? '' : ' Falta el alta en el ROI.')
          + (entregas > 50000 ? ' Las entregas superan 50.000 €: pasa a declaración mensual.' : '')
        : 'Sin operaciones intracomunitarias en el periodo.')
      add('369', p, !!perfil.oss, perfil.oss ? 'Acogida a la ventanilla única (OSS).' : 'No está acogida a la ventanilla única.')
    }
    const anual: Periodo = { anio, tipo: 'A', n: 0 }
    if (posterior(anual)) {
      add('390', anual, true, 'Resumen anual del IVA: obligatorio para quien presenta el 303 (no está en ninguno de los supuestos de exoneración).')
      const t347 = modelo347(apuntes, anio).terceros.length
      add('347', anual, t347 > 0, t347 ? `${t347} terceros superan 3.005,06 € en el año.` : 'Ningún tercero supera 3.005,06 € en el año.')
    }

    // Retenciones
    for (const p of periodosDelAnio(anio, retTipo).filter(posterior)) {
      const ret = hayRet111(p)
      add('111', p, ret || perfil.administradoresRetribuidos || perfil.empleados,
        ret ? 'Hay retenciones de profesionales u otras en el periodo.'
          : perfil.administradoresRetribuidos ? 'Administradores retribuidos: hay que retener.'
            : perfil.empleados ? 'Hay empleados: hay que retener.' : 'Sin retenciones en el periodo: no se presenta.')
      const alq = hayRet115(p)
      add('115', p, alq || perfil.alquilerLocal, alq ? 'Hay retenciones de alquiler en el periodo.' : perfil.alquilerLocal ? 'Alquiler de local: hay que retener.' : 'Sin alquileres con retención.')
      add('123', p, !!perfil.dividendosOPrestamosSocios, perfil.dividendosOPrestamosSocios ? 'Dividendos o intereses a socios: hay que retener.' : 'Sin dividendos ni préstamos de socios.')
    }
    if (posterior(anual)) {
      const r = rangoPeriodo(anual), delAnio = apuntesDelPeriodo(apuntes, r.desde, r.hasta)
      const ret111 = delAnio.some(a => conRetencion(a, false)) || perfil.administradoresRetribuidos || perfil.empleados
      add('190', anual, ret111, ret111 ? 'Hubo algún 111 en el año.' : 'Sin retenciones de trabajo ni profesionales en el año.')
      const ret115 = delAnio.some(a => conRetencion(a, true)) || perfil.alquilerLocal
      add('180', anual, ret115, ret115 ? 'Hubo algún 115 en el año.' : 'Sin retenciones de alquileres en el año.')
      add('193', anual, !!perfil.dividendosOPrestamosSocios, perfil.dividendosOPrestamosSocios ? 'Hubo algún 123 en el año.' : 'Sin dividendos ni préstamos de socios.')
    }

    // Impuesto sobre Sociedades
    for (const p of periodosDelAnio(anio, 'P').filter(posterior)) {
      const cuota = Number(e.cuotaUltimoIS) || 0
      let aplica = false, motivo: string
      if (primerEjercicio) motivo = 'Primer ejercicio: no hay cuota de un periodo anterior.'
      else if (p.n === 1 && anio === anioConst + 1) motivo = 'Aún no ha vencido el plazo del primer Impuesto sobre Sociedades (julio): no hay base para el pago.'
      else if (cuota > 0) { aplica = true; motivo = 'El último Impuesto sobre Sociedades tuvo cuota positiva.' }
      else motivo = 'El último Impuesto sobre Sociedades no tuvo cuota a pagar.'
      add('202', p, aplica, motivo)
    }
    // ejercicio que cierra este año (mes de cierre del perfil)
    const cierre = finDeMes(anio, mesCierre)
    if (cierre >= ref) {
      const ej: Periodo = { anio, tipo: 'A', n: 0 }
      add('200', ej, true, 'Declaración anual del Impuesto sobre Sociedades: siempre, aunque no haya actividad.')
      add('232', ej, !!perfil.operacionesVinculadas, perfil.operacionesVinculadas ? 'Operaciones vinculadas por encima de los umbrales.' : 'Sin operaciones vinculadas que declarar.')
      // Registro Mercantil: plazos civiles, no se prorrogan por días inhábiles (art. 5.2 del Código Civil).
      // Comprobar: si el último día de la legalización o del depósito es inhábil, la práctica de cada Registro.
      const formulacion = finDeMes(anio, mesCierre + 3), legalizacion = finDeMes(anio, mesCierre + 4)
      const junta = finDeMes(anio, mesCierre + 6), deposito = sumarMeses(junta, 1)
      const desde = sumarDiasF(cierre, 1)
      const rm = (modelo: ModeloFiscal, hasta: string, motivo: string) => out.push({
        modelo, nombre: NOMBRE_MODELO[modelo], organismo: 'Registro Mercantil', periodo: clavePeriodo(ej), etiquetaPeriodo: etiquetaPeriodo(ej),
        desde, hasta, domiciliarHasta: null, aplica: true, motivo,
      })
      rm('formulacion', formulacion, 'Los administradores formulan las cuentas en los tres meses siguientes al cierre (art. 253 LSC).')
      rm('legalizacion', legalizacion, 'Libros de actas, socios y contables en los cuatro meses siguientes al cierre (art. 18 Ley 14/2013).')
      rm('junta', junta, 'La junta aprueba las cuentas en los seis meses siguientes al cierre (art. 164 LSC).')
      rm('deposito', deposito, 'Depósito en el mes siguiente a la aprobación (art. 279 LSC).')
    }
  }

  return out
    .filter(o => o.hasta >= e.desde && o.hasta <= e.hasta)
    .sort((a, b) => a.hasta.localeCompare(b.hasta) || a.organismo.localeCompare(b.organismo) || a.modelo.localeCompare(b.modelo))
}
