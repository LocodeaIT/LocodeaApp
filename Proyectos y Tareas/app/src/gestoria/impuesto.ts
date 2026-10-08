/**
 * Impuesto sobre Sociedades a partir de la contabilidad: resultado del
 * ejercicio, ajustes por gastos no deducibles, compensación de bases
 * negativas y tipo de gravamen (./contabilidad/impuesto.ts). También la base
 * del pago fraccionado (202) que sale del último 200 presentado.
 */
import type { CrmInstantanea } from '../crm/types'
import type { GestionInstantanea } from '../gestion/types'
import type { GestoriaInstantanea, PerfilFiscal } from './types'
import {
  ajustesFiscales, asientosDelEjercicio, ejercicioBase202, impuestoSociedades, pagoFraccionado202, pagosFraccionadosDelEjercicio, perdidasYGanancias,
  type AjustesFiscales, type PagoFraccionado, type PerdidasYGanancias, type ResultadoImpuesto,
} from './contabilidad'

export interface CalculoIS {
  resultado: ResultadoImpuesto
  ajustes: AjustesFiscales
  pyg: PerdidasYGanancias
  /** Base del 202 del año siguiente (art. 40.2 LIS): cuota líquida menos retenciones e ingresos a cuenta, nunca negativa. */
  base202: number
}

export function calcularIS(e: { crm: CrmInstantanea; gestion: GestionInstantanea; gestoria: GestoriaInstantanea; perfil: PerfilFiscal; ejercicio: number }): CalculoIS {
  const asientos = asientosDelEjercicio({ crm: e.crm, gestion: e.gestion, gestoria: e.gestoria, ejercicio: e.ejercicio, perfil: e.perfil })
  const pyg = perdidasYGanancias(asientos)
  const ajustes = ajustesFiscales({ gestion: e.gestion, asientos, ejercicio: e.ejercicio })
  const resultado = impuestoSociedades({
    ejercicio: e.ejercicio, perfil: e.perfil,
    // los ajustes ya suman el gasto por el impuesto (6300) si está contabilizado: se parte del resultado después de impuestos
    resultadoContable: pyg.resultadoEjercicio, ajustesPositivos: ajustes.positivos, ajustesNegativos: ajustes.negativos,
    basesNegativas: e.perfil.basesNegativas ?? {},
    // Locodea no sufre retenciones en sus ventas (las sociedades no las llevan); si un día hay intereses con retención, irán a la 473
    retenciones: 0,
    pagosFraccionados: pagosFraccionadosDelEjercicio(e.gestoria, e.ejercicio),
  })
  return { resultado, ajustes, pyg, base202: Math.max(0, Math.round((resultado.cuotaLiquida - resultado.retenciones) * 100) / 100) }
}

/** Base del 202 que deja el 200 presentado del ejercicio que toca (null si aún no hay 200 presentado). */
export function cuotaUltimoIS(gestoria: GestoriaInstantanea, anio: number, periodo: 1 | 2 | 3 = 2): number | null {
  const base = ejercicioBase202(anio, periodo)
  const p = gestoria.presentaciones.find(x => x.modelo === '200' && x.periodo === String(base) && ['presentada', 'pagada', 'domiciliada'].includes(x.estado))
  if (!p) return null
  return typeof p.casillas.base202 === 'number' ? p.casillas.base202 : Math.max(0, p.importe)
}

/** Pago fraccionado de un periodo del 202 (1.º abril, 2.º octubre, 3.º diciembre). */
export function calcular202(gestoria: GestoriaInstantanea, perfil: PerfilFiscal, anio: number, periodo: 1 | 2 | 3): PagoFraccionado {
  const constitucion = Number((perfil.fechaConstitucion || '').slice(0, 4)) || anio
  return pagoFraccionado202({
    ejercicio: anio, periodo, cuotaUltimoIS: cuotaUltimoIS(gestoria, anio, periodo) ?? 0, cifraNegocios: perfil.cifraNegocios,
    primerEjercicio: anio <= constitucion,
  })
}
