/**
 * Calendarios del equipo leídos con el conector de Office 365 Outlook de la
 * app, es decir, con la cuenta con la que se entra (admin@locodea.com).
 *
 * Esa cuenta solo ve su calendario y los que otros le han compartido; de ellos
 * solo se usan los de cuentas @locodea.com (esCuentaLocodea). Por eso cada persona del equipo comparte el suyo una vez con ella («puede ver todos
 * los detalles») y la cuenta acepta la invitación: a partir de ahí aparece en
 * «Obtener calendarios (V2)» con su dueño, y así sabemos de quién es.
 */
import { Office365OutlookService } from '../generated/services/Office365OutlookService'
import type { CalendarioVisible, EventoAgenda, FuenteAgenda } from './tipos'
import { asistentesDe, miembroDelCalendario } from './vincular'

/* eslint-disable @typescript-eslint/no-explicit-any */
type Cualquiera = any

const POR_PAGINA = 250
/** Tope por calendario y sincronización, para no colgar la app con un calendario enorme. */
const MAXIMO = 2000

function comprobar<T>(r: Cualquiera, que: string): T {
  if (r?.success === false || r?.error) throw new Error(`${que}: ${r?.error?.message ?? 'el conector no respondió'}`)
  return r?.data as T
}

/** '2026-10-20T08:00:00.0000000' (UTC sin zona) o con zona → ISO con zona. */
function instante(conZona: string | undefined, utc: string | undefined): string {
  if (conZona) return new Date(conZona).toISOString()
  if (!utc) return ''
  return new Date(/[zZ]|[+-]\d\d:\d\d$/.test(utc) ? utc : utc.replace(/\.\d+$/, '') + 'Z').toISOString()
}

const CANCELADO = /^(cancelad[oa]|canceled|cancelled)\s*:/i

export const fuenteOutlook: FuenteAgenda = {
  async calendarios(miembros) {
    const r = comprobar<{ value?: Cualquiera[] }>(await Office365OutlookService.CalendarGetTables_V2(), 'No se pudieron leer los calendarios')
    return (r?.value ?? []).map((c): CalendarioVisible => ({
      id: String(c.id ?? ''),
      nombre: String(c.name ?? ''),
      propietario: String(c.owner?.address ?? ''),
      // solo calendarios de cuentas @locodea.com: los de Ortoalresa u otros clientes no entran
      miembroId: miembroDelCalendario(c.owner?.address, miembros),
    })).filter(c => c.id)
  },

  async eventos(cal, desde, hasta, internos) {
    const lista: Omit<EventoAgenda, 'miembrosIds'>[] = []
    for (let salto = 0; salto < MAXIMO; salto += POR_PAGINA) {
      const r = comprobar<{ value?: Cualquiera[] }>(
        await Office365OutlookService.GetEventsCalendarViewV3(cal.id, desde, hasta, undefined, undefined, POR_PAGINA, salto),
        `No se pudo leer el calendario ${cal.nombre}`,
      )
      const pagina = r?.value ?? []
      for (const e of pagina) {
        const titulo = String(e.subject ?? '')
        lista.push({
          id: String(e.iCalUId || e.id),
          titulo: titulo.replace(CANCELADO, '').trim() || '(sin asunto)',
          inicio: instante(e.startWithTimeZone, e.start),
          fin: instante(e.endWithTimeZone, e.end),
          todoElDia: !!e.isAllDay,
          lugar: String(e.location ?? ''),
          enlace: String(e.webLink ?? ''),
          organizador: String(e.organizer ?? '').toLowerCase(),
          asistentes: asistentesDe([e.organizer, e.requiredAttendees, e.optionalAttendees], internos),
          cancelado: CANCELADO.test(titulo),
        })
      }
      if (pagina.length < POR_PAGINA) break
    }
    return lista.filter(e => e.inicio && e.fin)
  },
}
