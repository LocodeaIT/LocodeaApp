/**
 * Soporte y mantenimiento de un documento según su calculadora: si se ofrece
 * en el presupuesto («Incluir» marcado), la cuota mensual y la permanencia.
 */
import { useMemo } from 'react'
import { calcular, normalizarCalculo, type CalculoGuardado } from '../tarifas/motor'
import { useTarifas } from '../tarifas/store'

export interface MantenimientoDoc { incluido: boolean; cuota: number; meses: number }

export function useMantenimientoCalculadora(calculo: CalculoGuardado | null | undefined): MantenimientoDoc {
  const { tarifas } = useTarifas()
  return useMemo(() => {
    if (!calculo?.entrada) return { incluido: false, cuota: 0, meses: 12 }
    const entrada = normalizarCalculo(calculo.entrada, tarifas)
    const m = calcular(tarifas, entrada).mantenimiento
    return { incluido: !!entrada.mantenimiento.incluido && m.cuota > 0, cuota: m.cuota, meses: m.meses }
  }, [calculo, tarifas])
}
