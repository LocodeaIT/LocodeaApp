/** Cuota de mantenimiento que da la calculadora para un documento (0 si no tiene cálculo). */
import { useMemo } from 'react'
import { calcular, normalizarCalculo, type CalculoGuardado } from '../tarifas/motor'
import { useTarifas } from '../tarifas/store'

export function useCuotaCalculadora(calculo: CalculoGuardado | null | undefined): number {
  const { tarifas } = useTarifas()
  return useMemo(() => (calculo?.entrada ? calcular(tarifas, normalizarCalculo(calculo.entrada, tarifas)).mantenimiento.cuota : 0), [calculo, tarifas])
}
