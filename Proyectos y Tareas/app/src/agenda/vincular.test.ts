import { describe, expect, it } from 'vitest'
import type { Miembro } from '../domain/types'
import type { ActividadCrm, Contacto, CrmInstantanea, Cuenta, Potencial } from '../crm/types'
import { CRM_VACIO } from '../crm/types'
import type { EventoAgenda } from './tipos'
import { asistentesDe, dominio, dominiosInternos, esCuentaLocodea, miembroDelCalendario, planSincronizacion, propietarioDe, unirEventos, vincular } from './vincular'

const miembro = (id: string, nombre: string, email: string): Miembro => ({ id, nombre, iniciales: nombre.slice(0, 2).toUpperCase(), email, color: '#000', rol: 'socio', activo: true })
const MIEMBROS = [miembro('m', 'Marco', 'marco@locodea.com'), miembro('j', 'Jesús', 'jesus@locodea.com'), miembro('a', 'Alejandro', 'alejandro@locodea.com')]
const INTERNOS = dominiosInternos(MIEMBROS)

const cuenta = (id: string, x: Partial<Cuenta>) => ({ id, nombre: id, web: '', email: '', ...x }) as Cuenta
const contacto = (id: string, x: Partial<Contacto>) => ({ id, nombre: id, email: '', cuentaId: null, ...x }) as Contacto
const potencial = (id: string, x: Partial<Potencial>) => ({ id, nombre: id, email: '', web: '', estado: 'abierto', cuentaId: null, ...x }) as Potencial

const CRM: CrmInstantanea = {
  ...CRM_VACIO,
  cuentas: [cuenta('transnorte', { web: 'https://www.transnorte.es/contacto', email: 'info@transnorte.es' })],
  contactos: [contacto('lucia', { email: 'Lucia.Gil@transnorte.es', cuentaId: 'transnorte' })],
  potenciales: [
    potencial('vega', { email: 'ana@clinicavega.es' }),
    potencial('calificado', { email: 'pepe@ya-cliente.es', estado: 'calificado', cuentaId: 'transnorte' }),
    potencial('gmail', { email: 'autonomo@gmail.com' }),
  ],
}

const evento = (id: string, asistentes: string, x: Partial<EventoAgenda> = {}): EventoAgenda => ({
  id, titulo: 'Reunión ' + id, inicio: '2026-10-20T10:00:00+02:00', fin: '2026-10-20T11:00:00+02:00', todoElDia: false,
  lugar: 'Teams', enlace: '', organizador: 'marco@locodea.com', asistentes: asistentesDe([asistentes], INTERNOS),
  miembrosIds: ['m'], cancelado: false, ...x,
})

describe('dominios y asistentes', () => {
  it('saca el dominio de un correo o de una web', () => {
    expect(dominio('Ana@ClinicaVega.es')).toBe('clinicavega.es')
    expect(dominio('https://www.transnorte.es/contacto')).toBe('transnorte.es')
    expect(dominio('transnorte.es')).toBe('transnorte.es')
    expect(dominio('')).toBe('')
  })

  it('separa los del equipo de los de fuera y no repite', () => {
    const a = asistentesDe(['jesus@locodea.com; Ana@clinicavega.es;', 'ana@clinicavega.es,  '], INTERNOS)
    expect(a).toEqual([{ email: 'jesus@locodea.com', interno: true }, { email: 'ana@clinicavega.es', interno: false }])
  })
})

describe('vincular una reunión con el CRM', () => {
  it('prefiere el contacto por correo exacto, sin mirar mayúsculas', () => {
    expect(vincular(evento('1', 'jesus@locodea.com;lucia.gil@transnorte.es'), CRM)).toMatchObject({ col: 'contactos', id: 'lucia', cuentaId: 'transnorte', por: 'correo' })
  })

  it('casa con el cliente potencial por su correo', () => {
    expect(vincular(evento('2', 'ana@clinicavega.es'), CRM)).toMatchObject({ col: 'potenciales', id: 'vega' })
  })

  it('un potencial ya calificado lleva a su cuenta', () => {
    expect(vincular(evento('3', 'pepe@ya-cliente.es'), CRM)).toMatchObject({ col: 'cuentas', id: 'transnorte' })
  })

  it('por dominio, si la persona no está en el CRM pero su empresa sí', () => {
    expect(vincular(evento('4', 'nuevo@transnorte.es'), CRM)).toMatchObject({ col: 'cuentas', id: 'transnorte', por: 'dominio' })
    expect(vincular(evento('5', 'otra@clinicavega.es'), CRM)).toMatchObject({ col: 'potenciales', id: 'vega', por: 'dominio' })
  })

  it('no casa por dominios de correo gratuito ni reuniones solo del equipo', () => {
    expect(vincular(evento('6', 'otro@gmail.com'), CRM)).toBeNull()
    expect(vincular(evento('7', 'autonomo@gmail.com'), CRM)).toMatchObject({ id: 'gmail', por: 'correo' })
    expect(vincular(evento('8', 'jesus@locodea.com;alejandro@locodea.com'), CRM)).toBeNull()
  })
})

describe('solo calendarios de Locodea', () => {
  it('reconoce las cuentas @locodea.com y nada más', () => {
    expect(esCuentaLocodea('Jesus@Locodea.com')).toBe(true)
    expect(esCuentaLocodea('jesus.alonso@ortoalresa.com')).toBe(false)
    expect(esCuentaLocodea('alguien@locodea.com.otra.es')).toBe(false)
    expect(esCuentaLocodea('')).toBe(false)
  })

  it('el calendario de Ortoalresa no es de nadie del equipo, aunque el miembro tenga ese correo', () => {
    expect(miembroDelCalendario('jesus@locodea.com', MIEMBROS)).toBe('j')
    expect(miembroDelCalendario('jesus.alonso@ortoalresa.com', MIEMBROS)).toBeNull()
    const conOrtoalresa = [...MIEMBROS, miembro('o', 'Jesús (Ortoalresa)', 'admin@ortoalresa.com')]
    expect(miembroDelCalendario('admin@ortoalresa.com', conOrtoalresa)).toBeNull()
    expect(miembroDelCalendario('admin@locodea.com', MIEMBROS)).toBeNull()
  })
})

describe('unir calendarios', () => {
  it('la misma reunión en dos calendarios es una, con las dos personas', () => {
    const e = evento('x', 'ana@clinicavega.es')
    const r = unirEventos([{ miembroId: 'm', eventos: [e] }, { miembroId: 'j', eventos: [e] }, { miembroId: 'a', eventos: [] }])
    expect(r).toHaveLength(1)
    expect(r[0].miembrosIds).toEqual(['m', 'j'])
  })

  it('quien la organiza manda sobre el propietario de la cita', () => {
    expect(propietarioDe(evento('x', '', { organizador: 'Jesus@locodea.com', miembrosIds: ['m', 'j'] }), MIEMBROS)).toBe('j')
    expect(propietarioDe(evento('x', '', { organizador: 'ana@clinicavega.es', miembrosIds: ['a'] }), MIEMBROS)).toBe('a')
  })
})

describe('plan de sincronización', () => {
  let n = 0
  const opciones = (x: Partial<{ ahora: string; completo: boolean }> = {}) => ({
    ahora: '2026-10-17T08:00:00.000Z', desde: '2026-08-01T00:00:00.000Z', hasta: '2027-02-01T00:00:00.000Z', completo: true, nuevoId: () => 'n' + ++n, ...x,
  })

  it('crea una cita abierta referente al cliente, y deja aparte la gente que no está en el CRM', () => {
    const p = planSincronizacion([evento('e1', 'ana@clinicavega.es'), evento('e2', 'desconocido@empresa.com'), evento('e3', 'jesus@locodea.com')], CRM, MIEMBROS, opciones())
    expect(p.crear).toHaveLength(1)
    expect(p.crear[0]).toMatchObject({ tipo: 'cita', eventoId: 'e1', referenteTipo: 'potenciales', referenteId: 'vega', propietarioId: 'm', estado: 'abierta', fecha: '2026-10-20' })
    expect(p.sinVincular.map(e => e.id)).toEqual(['e2'])
  })

  it('una reunión que ya pasó entra como completada', () => {
    const p = planSincronizacion([evento('e1', 'ana@clinicavega.es')], CRM, MIEMBROS, opciones({ ahora: '2026-10-21T00:00:00.000Z' }))
    expect(p.crear[0]).toMatchObject({ estado: 'completada' })
  })

  const cita = (x: Partial<ActividadCrm>): ActividadCrm => {
    const [c] = planSincronizacion([evento('e1', 'ana@clinicavega.es')], CRM, MIEMBROS, opciones()).crear
    return { ...c, ...x }
  }

  it('no duplica ni reescribe si nada cambió', () => {
    const d = { ...CRM, actividades: [cita({})] }
    const p = planSincronizacion([evento('e1', 'ana@clinicavega.es')], d, MIEMBROS, opciones())
    expect(p.crear).toHaveLength(0)
    expect(p.actualizar).toHaveLength(0)
  })

  it('sigue a la reunión si cambia de hora, y respeta el registro elegido a mano', () => {
    const d = { ...CRM, actividades: [cita({ referenteTipo: 'cuentas', referenteId: 'transnorte', cuentaId: 'transnorte' })] }
    const p = planSincronizacion([evento('e1', 'ana@clinicavega.es', { inicio: '2026-10-22T16:30:00+02:00', fin: '2026-10-22T17:00:00+02:00' })], d, MIEMBROS, opciones())
    expect(p.actualizar).toHaveLength(1)
    expect(p.actualizar[0]).toMatchObject({ fecha: '2026-10-22', referenteId: 'transnorte' })
  })

  it('cancela la cita si la reunión se cancela o desaparece, pero no si falló algún calendario', () => {
    const d = { ...CRM, actividades: [cita({})] }
    expect(planSincronizacion([evento('e1', 'ana@clinicavega.es', { cancelado: true })], d, MIEMBROS, opciones()).actualizar[0]).toMatchObject({ estado: 'cancelada' })
    expect(planSincronizacion([], d, MIEMBROS, opciones()).actualizar[0]).toMatchObject({ estado: 'cancelada' })
    expect(planSincronizacion([], d, MIEMBROS, opciones({ completo: false })).actualizar).toHaveLength(0)
  })

  it('no crea citas de reuniones canceladas', () => {
    expect(planSincronizacion([evento('e1', 'ana@clinicavega.es', { cancelado: true })], CRM, MIEMBROS, opciones()).crear).toHaveLength(0)
  })
})
