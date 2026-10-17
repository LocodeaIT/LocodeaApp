/**
 * Recorrido comercial del cliente potencial: Entrada → Auditoría → Propuesta →
 * Proyecto en marcha. Reglas puras (sin React ni Dataverse) para la lista, el
 * tablero, la ficha y la carga de registros anteriores al recorrido.
 */
import type { EntradaPotencial, EstadoPotencial, EtapaPotencial, Oferta, OrigenPotencial, Potencial } from './types'
import type { Reunion } from '../domain/types'
import type { EstadoPropuesta, Propuesta } from '../propuestas/types'
import type { ActividadCrm } from './types'
import { DIAS_PARADO, ETAPAS } from './catalogos'
import { normalizar } from './formato'

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

// ─────────────────────────────────────────────── convivencia con Propuestas de clientes y el calendario de reuniones

/**
 * Propuestas comerciales (módulo Propuestas de clientes, `loc_propuesta`) que
 * son de este cliente potencial: las de su cuenta, si ya la tiene, o las que
 * llevan como cliente el nombre de su empresa. No se toca su tabla: se casan
 * por esos dos datos.
 */
export function propuestasComercialesDe(propuestas: Propuesta[], p: Potencial): Propuesta[] {
  const empresa = normalizar(p.empresa)
  return propuestas.filter(x => (!!p.cuentaId && x.cuentaId === p.cuentaId) || (!!empresa && normalizar(x.cliente) === empresa))
}

/** Estado con el que nace en Propuestas de clientes una propuesta creada desde el cliente potencial. */
export const ESTADO_PROPUESTA_DE_ETAPA: Record<EtapaPotencial, EstadoPropuesta> = {
  entrada: 'conversacion', auditoria: 'planificacion', propuesta: 'enviada', proyecto: 'aceptado',
}

/** Citas que la sincronización del calendario de Outlook deja en el cliente potencial. */
export const citasDe = (actividades: ActividadCrm[], potencialId: string): ActividadCrm[] =>
  actividades.filter(a => a.tipo === 'cita' && !!a.eventoId && a.referenteTipo === 'potenciales' && a.referenteId === potencialId && a.estado !== 'cancelada')

/** Día (YYYY-MM-DD) y hora (HH:mm) locales de un instante ISO, como los guarda la cita. */
function diaYHora(iso: string): [string, string] {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return [`${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`, `${p(d.getHours())}:${p(d.getMinutes())}`]
}

/**
 * La cita de Outlook es la misma reunión que una de las nuestras: al crear la
 * reunión con el cliente invitado, el calendario la trae de vuelta como cita.
 * Se reconocen por el día y la hora de inicio.
 */
export function esLaMismaReunion(cita: ActividadCrm, r: Reunion): boolean {
  const [dia, hora] = diaYHora(r.fecha)
  return cita.fecha === dia && (!cita.hora || cita.hora === hora)
}

/** Citas de Outlook que no son ya una de nuestras reuniones (para no contarlas dos veces). */
export const citasSinReunion = (citas: ActividadCrm[], reuniones: Reunion[]): ActividadCrm[] =>
  citas.filter(a => !reuniones.some(r => esLaMismaReunion(a, r)))
