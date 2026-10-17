/**
 * Calendario de reuniones: los eventos de los calendarios de Outlook del equipo
 * (Marco, Jesús, Alejandro…), vistos desde la cuenta con la que se entra en la
 * app. Cada persona comparte su calendario con esa cuenta una vez y la app lo
 * lee con el conector de Office 365 Outlook. Solo calendarios de cuentas
 * @locodea.com: las cuentas del equipo en clientes (Ortoalresa) no entran.
 *
 * Los eventos no se guardan: se leen al momento. Lo que sí se guarda son las
 * reuniones con clientes, como citas del CRM «referentes a» la cuenta, el
 * contacto o el cliente potencial (ver vincular.ts y contexto.tsx), para que salgan en su
 * ficha.
 */
import type { Miembro } from '../domain/types'
import type { ColReferente } from '../crm/types'

/** Un calendario que la cuenta de la app puede leer, y de quién del equipo es. */
export interface CalendarioVisible {
  id: string
  nombre: string
  /** Correo del dueño, si Outlook lo dice. */
  propietario: string
  miembroId: string | null
}

export interface Asistente {
  email: string
  /** Del equipo (mismo dominio que los miembros). */
  interno: boolean
}

/** Un evento de calendario, ya unido entre calendarios (el mismo evento en el de Marco y en el de Jesús es uno). */
export interface EventoAgenda {
  /** iCalUId: es el mismo en el calendario de cada asistente. */
  id: string
  titulo: string
  /** Instantes ISO con zona. */
  inicio: string
  fin: string
  todoElDia: boolean
  lugar: string
  /** Enlace para abrirlo en Outlook. */
  enlace: string
  organizador: string
  asistentes: Asistente[]
  /** Miembros del equipo en cuyo calendario está. */
  miembrosIds: string[]
  cancelado: boolean
}

/** El registro del CRM con el que se ha casado un evento. */
export interface Vinculo {
  col: Extract<ColReferente, 'contactos' | 'potenciales' | 'cuentas'>
  id: string
  cuentaId: string | null
  /** Cómo se encontró: por el correo exacto o por el dominio de la empresa. */
  por: 'correo' | 'dominio'
  email: string
}

/** De dónde salen los calendarios: Outlook de verdad o los de ejemplo. */
export interface FuenteAgenda {
  calendarios(miembros: Miembro[]): Promise<CalendarioVisible[]>
  /** Eventos crudos de un calendario entre dos instantes (ISO). */
  eventos(cal: CalendarioVisible, desde: string, hasta: string, internos: Set<string>): Promise<Omit<EventoAgenda, 'miembrosIds'>[]>
}
