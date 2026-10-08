/**
 * Cálculo de los modelos de la AEAT a partir de los apuntes fiscales y
 * despachador por modelo y periodo. El 200 y el 202 los calcula el módulo del
 * Impuesto sobre Sociedades (aquí devuelven null), igual que las obligaciones
 * del Registro Mercantil.
 */
import type { ModeloFiscal, Presentacion } from '../../types'
import type { ApunteFiscal } from '../apuntes'
import { type Periodo, periodoDeClave, r2, rangoPeriodo } from '../periodos'
import type { ResultadoModelo } from './comun'
import { euros } from './comun'
import { modelo303, modelo349, modelo369, modelo390 } from './iva'
import { modelo111, modelo115, modelo123, modelo180, modelo190, modelo193 } from './retenciones'
import { modelo347 } from './terceros'

export * from './comun'
export * from './iva'
export * from './retenciones'
export * from './terceros'

/** Estados en los que una presentación cuenta como hecha. */
export const PRESENTADA: Presentacion['estado'][] = ['presentada', 'pagada', 'domiciliada']
export const estaPresentada = (p: Presentacion) => PRESENTADA.includes(p.estado)

/** Fin del periodo de una presentación (para ordenarlas); vacío si la clave no se reconoce. */
const finDe = (p: Presentacion) => { const x = periodoDeClave(p.periodo); return x ? rangoPeriodo(x).hasta : '' }

/**
 * Cuotas a compensar que arrastra el 303 del periodo: las del último 303 presentado anterior a él. Si salió
 * negativo, su resultado más lo que tenía pendiente (casilla 87); si salió positivo, solo su 87.
 */
export function cuotasACompensar(periodo: Periodo, presentaciones: Presentacion[]): { importe: number; origen: Presentacion | null } {
  const desde = rangoPeriodo(periodo).desde
  const previas = presentaciones
    .filter(p => p.modelo === '303' && estaPresentada(p) && !p.complementariaDe && finDe(p) && finDe(p) < desde)
    .sort((a, b) => finDe(b).localeCompare(finDe(a)))
  // si hay complementarias de esa misma presentación, manda la última
  const ultima = previas[0]
  if (!ultima) return { importe: 0, origen: null }
  const sustituta = presentaciones
    .filter(p => p.modelo === '303' && estaPresentada(p) && p.complementariaDe === ultima.id)
    .sort((a, b) => String(b.presentadaEl ?? '').localeCompare(String(a.presentadaEl ?? '')))[0]
  const p = sustituta ?? ultima
  const pendiente = Number(p.casillas?.['87']) || 0
  const importe = r2((p.importe < 0 ? -p.importe : 0) + pendiente)
  return { importe, origen: p }
}

/**
 * Calcula un modelo para la clave de periodo dada ('2026-3T', '2026-09', '2026'). Devuelve null si el modelo
 * no se calcula aquí (200, 202, 232, 036 y Registro Mercantil) o si la clave no vale para el modelo.
 */
export function calcularModelo(modelo: ModeloFiscal, periodo: string, e: { apuntes: ApunteFiscal[]; presentaciones: Presentacion[] }): ResultadoModelo | null {
  const p = periodoDeClave(periodo)
  if (!p) return null
  const { apuntes, presentaciones } = e
  const trimestralOMensual = p.tipo === 'T' || p.tipo === 'M'
  switch (modelo) {
    case '303': {
      if (!trimestralOMensual) return null
      const { importe, origen } = cuotasACompensar(p, presentaciones)
      const r = modelo303(apuntes, p, { cuotasACompensar: importe })
      if (importe && origen) {
        r.avisos.push(`Cuotas a compensar de ${euros(importe)} tomadas del 303 de ${origen.periodo}.`)
        const o = periodoDeClave(origen.periodo)
        if (o && ((o.tipo === 'T' && o.n === 4) || (o.tipo === 'M' && o.n === 12)) && origen.importe < 0) {
          r.avisos.push(`El 303 de ${origen.periodo} salió negativo: si se pidió la devolución, no hay nada que compensar (pon 0 en la casilla 110).`)
        }
      }
      return r
    }
    case '349': return trimestralOMensual ? modelo349(apuntes, p) : null
    case '369': return p.tipo === 'T' ? modelo369(apuntes, p) : null
    case '111': return trimestralOMensual ? modelo111(apuntes, p) : null
    case '115': return trimestralOMensual ? modelo115(apuntes, p) : null
    case '123': return trimestralOMensual ? modelo123(apuntes, p) : null
    case '390': {
      if (p.tipo !== 'A') return null
      const r = modelo390(apuntes, p.anio)
      completar390(r, p.anio, presentaciones)
      return r
    }
    case '347': return p.tipo === 'A' ? modelo347(apuntes, p.anio) : null
    case '190': {
      if (p.tipo !== 'A') return null
      const r = modelo190(apuntes, p.anio)
      const declarado = r2(presentaciones.filter(x => x.modelo === '111' && estaPresentada(x) && x.periodo.startsWith(`${p.anio}-`)).reduce((s, x) => s + (Number(x.casillas?.['28']) || 0), 0))
      const calculado = r.casillas['03'] ?? 0
      if (declarado && Math.abs(declarado - calculado) > 0.01) r.avisos.push(`Las retenciones del 190 (${euros(calculado)}) no cuadran con las de los 111 presentados (${euros(declarado)}).`)
      return r
    }
    case '180': return p.tipo === 'A' ? modelo180(apuntes, p.anio) : null
    case '193': return p.tipo === 'A' ? modelo193(apuntes, p.anio) : null
    default: return null
  }
}

/** Completa el 390 con los resultados de los 303 presentados del año (casillas 85, 95, 97 y 98). */
function completar390(r: ResultadoModelo, anio: number, presentaciones: Presentacion[]) {
  const del = presentaciones.filter(x => x.modelo === '303' && estaPresentada(x) && x.periodo.startsWith(`${anio}-`) && !x.complementariaDe)
  if (!del.length) { r.avisos.push('No hay 303 presentados del año: las casillas 95, 97 y 98 quedan vacías.'); return }
  const c = r.casillas
  const ingresar = r2(del.filter(x => x.importe > 0).reduce((s, x) => s + x.importe, 0))
  if (ingresar) c['95'] = ingresar
  const aplicadas = r2(del.reduce((s, x) => s + (Number(x.casillas?.['78']) || 0), 0))
  // Comprobar: la casilla 85 recoge las cuotas de ejercicios anteriores compensadas en el año (suma de las 78).
  if (aplicadas) { c['85'] = aplicadas; c['86'] = r2((c['84'] ?? 0) - aplicadas) }
  const ultimo = del.sort((a, b) => finDe(b).localeCompare(finDe(a)))[0]
  if (ultimo && ultimo.importe < 0) c['97'] = r2(-ultimo.importe)
  r.avisos.push('Si en el último periodo se pidió la devolución, pasa el importe de la casilla 97 a la 98.')
  r.lineas = r.lineas.filter(l => !['85', '86', '95', '97'].includes(l.casilla))
  for (const [casilla, descripcion] of [['85', 'Compensación de cuotas del ejercicio anterior'], ['86', 'Resultado de la liquidación'], ['95', 'Total resultados a ingresar en las autoliquidaciones del ejercicio'], ['97', 'Resultado del último periodo: a compensar']] as const) {
    if (c[casilla] !== undefined) r.lineas.push({ casilla, descripcion, importe: c[casilla] })
  }
}
