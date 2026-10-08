/**
 * Datos de ejemplo de la Gestoría para el modo demostración: una sociedad
 * constituida hace unos meses (para que haya trimestres que mirar), con su
 * aportación de capital y Verifactu en modo preparación.
 */
import { hoy, sumarDias } from '../domain/fechas'
import type { GestoriaInstantanea } from './types'
import { perfilInicial, verifactuInicial } from './types'

export function generarSemillaGestoria(): GestoriaInstantanea {
  const constitucion = sumarDias(hoy(), -200)
  const anio = Number(constitucion.slice(0, 4))
  const iso = new Date(Date.parse(constitucion) + 10 * 3600000).toISOString()
  return {
    perfil: [{
      ...perfilInicial(), id: 'pf1', creadoEl: iso, nif: 'B00000000', domicilio: 'Calle de ejemplo 1, 28001 Madrid', fechaConstitucion: constitucion,
      saldoBanco: 18450, saldoBancoFecha: hoy(),
    }],
    presentaciones: [],
    asientos: [{
      id: 'as1', creadoEl: iso, fecha: constitucion, ejercicio: anio, tipo: 'capital', concepto: 'Aportación del capital social en la constitución',
      lineas: [{ cuenta: '572', debe: 3000, haber: 0 }, { cuenta: '100', debe: 0, haber: 3000 }],
    }],
    verifactu: [{ ...verifactuInicial(), id: 'vf1', creadoEl: iso, nifEmisor: 'B00000000' }],
    registros: [],
    envios: [],
  }
}
