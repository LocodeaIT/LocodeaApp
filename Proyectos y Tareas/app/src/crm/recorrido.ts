/**
 * Recorrido comercial del cliente potencial: Entrada → Auditoría → Propuesta →
 * Proyecto en marcha. Reglas puras (sin React ni Dataverse) para la lista, el
 * tablero, la ficha y la carga de registros anteriores al recorrido.
 */
import type { EntradaPotencial, EstadoPotencial, EtapaPotencial, Oferta, OrigenPotencial, Potencial } from './types'
import type { Reunion } from '../domain/types'
import { DIAS_PARADO, ETAPAS } from './catalogos'

/** Registros de antes del recorrido: los convertidos están en proyecto; el resto, en entrada. */
export const etapaPorDefecto = (estado: EstadoPotencial): EtapaPotencial => (estado === 'calificado' ? 'proyecto' : 'entrada')

/** Lo que llega por LinkedIn, llamada o correo lo iniciamos nosotros. */
export const entradaDeOrigen = (origen: OrigenPotencial): EntradaPotencial =>
  origen === 'linkedin' || origen === 'llamada' || origen === 'correo' ? 'outbound' : 'inbound'

/** Días enteros entre dos fechas YYYY-MM-DD (o ISO). */
export function diasEntre(desde: string, hasta: string): number {
  if (!desde || !hasta) return 0
  const a = Date.parse(desde.slice(0, 10)), b = Date.parse(hasta.slice(0, 10))
  return Number.isNaN(a) || Number.isNaN(b) ? 0 : Math.round((b - a) / 86400000)
}

export const diasEnEtapa = (p: Potencial, hoy: string): number => Math.max(0, diasEntre(p.etapaDesde || p.creadoEl, hoy))

/** La próxima acción ya tenía que estar hecha. */
export const accionVencida = (p: Potencial, hoy: string): boolean => !!p.proximaAccionFecha && p.proximaAccionFecha < hoy

/** En curso y sin moverse: próxima acción vencida o demasiados días en la misma etapa. */
export const estaParado = (p: Potencial, hoy: string): boolean =>
  p.estado === 'abierto' && (accionVencida(p, hoy) || diasEnEtapa(p, hoy) >= DIAS_PARADO)

/** Descartado con fecha para volver a contactar que ya ha llegado. */
export const tocaVolverAContactar = (p: Potencial, hoy: string): boolean =>
  p.estado === 'descalificado' && !!p.volverContactar && p.volverContactar <= hoy

/** Solo se avanza: una etapa anterior a la actual no hace retroceder. */
export const esPosterior = (nueva: EtapaPotencial, actual: EtapaPotencial): boolean => ETAPAS.indexOf(nueva) > ETAPAS.indexOf(actual)

/** Propuestas del cliente potencial, la última versión primero. */
export const propuestasDe = (ofertas: Oferta[], potencialId: string): Oferta[] =>
  ofertas.filter(q => q.potencialId === potencialId).sort((a, b) => b.version - a.version || b.fecha.localeCompare(a.fecha))

/** Reuniones del cliente potencial, la más reciente primero. */
export const reunionesDe = (reuniones: Reunion[], potencialId: string): Reunion[] =>
  reuniones.filter(r => r.potencialId === potencialId).sort((a, b) => b.fecha.localeCompare(a.fecha))

/** Siguiente número de versión de la propuesta. */
export const siguienteVersion = (ofertas: Oferta[], potencialId: string): number =>
  propuestasDe(ofertas, potencialId).reduce((m, q) => Math.max(m, q.version || 1), 0) + 1

/** Cambios de un cliente potencial al pasar a otra etapa. */
export function conEtapa(p: Potencial, etapa: EtapaPotencial, hoy: string): Potencial {
  if (p.etapa === etapa) return p
  // al salir de la entrada se acaba la secuencia de recordatorios
  const seguimiento = etapa !== 'entrada' && (p.seguimiento === 'contactado' || p.seguimiento === 'recordatorio1' || p.seguimiento === 'recordatorio2')
    ? 'respondio' as const : p.seguimiento
  return { ...p, etapa, etapaDesde: hoy, seguimiento, proximoRecordatorio: etapa === 'entrada' ? p.proximoRecordatorio : '' }
}
