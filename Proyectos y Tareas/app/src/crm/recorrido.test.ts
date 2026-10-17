/**
 * Reglas del recorrido del cliente potencial: etapas por defecto de los
 * registros anteriores, días en la etapa, parados, propuestas por versión y
 * qué cambia al pasar de etapa.
 */
import { describe, expect, it } from 'vitest'
import type { ActividadCrm, Oferta, Potencial } from './types'
import type { Reunion } from '../domain/types'
import type { Propuesta } from '../propuestas/types'
import {
  accionVencida, citasDe, citasSinReunion, conEtapa, diasEnEtapa, diasEntre, entradaDeOrigen, esPosterior, estaParado, etapaPorDefecto,
  propuestasComercialesDe, propuestasDe,
  siguienteVersion, tocaVolverAContactar,
} from './recorrido'

const HOY = '2026-10-17'

const potencial = (cambio: Partial<Potencial> = {}): Potencial => ({
  id: 'l1', no: 'CP1001', tema: 'Altas de empleados', nombre: 'Nuria', apellidos: 'Ferrer', empresa: 'Clínica Sonrisa', cargo: '', email: 'nuria@sonrisa.es',
  telefono: '', ciudad: '', sector: '', origen: 'web', puntuacion: 'templado', estado: 'abierto', fase: 'calificar', importeEst: 0, propietarioId: null,
  descripcion: '', calificadoEl: null, descalificadoEl: null, motivo: '', direccion: '', cp: '', pais: 'España', web: '', empleados: '', area: '',
  herramientas: '', loQueImporta: '', recomendacion: '', cuentaId: null, contactoId: null, oportunidadId: null, proyectoId: null,
  etapa: 'entrada', etapaDesde: '2026-10-10', entrada: 'inbound', seguimiento: '', primerContacto: '2026-10-10', proximoRecordatorio: '',
  respondioEl: '', conversacionId: '', linkedin: '', procesosRevisar: '', proximaAccion: '', proximaAccionFecha: '', motivoDescarte: '',
  volverContactar: '', creadoEl: '2026-10-10T09:00:00Z', ...cambio,
})

const oferta = (id: string, version: number, cambio: Partial<Oferta> = {}): Oferta => ({
  id, no: `OF-${id}`, cuentaId: null, contactoId: null, fecha: '2026-10-15', propietarioId: null, lineas: [], condicionesPago: '30',
  metodoPago: 'transferencia', referencia: '', notas: '', creadoEl: '', estado: 'borrador', oportunidadId: null, validaHasta: '', pedidoId: null,
  potencialId: 'l1', version, alcance: '', documento: '', enviadaEl: '', motivoRechazo: '', ...cambio,
})

describe('registros anteriores al recorrido', () => {
  it('los convertidos están en proyecto y el resto en entrada', () => {
    expect(etapaPorDefecto('calificado')).toBe('proyecto')
    expect(etapaPorDefecto('abierto')).toBe('entrada')
    expect(etapaPorDefecto('descalificado')).toBe('entrada')
  })
  it('LinkedIn, llamada y correo son outbound; el resto, inbound', () => {
    expect(entradaDeOrigen('correo')).toBe('outbound')
    expect(entradaDeOrigen('linkedin')).toBe('outbound')
    expect(entradaDeOrigen('web')).toBe('inbound')
    expect(entradaDeOrigen('referido')).toBe('inbound')
  })
})

describe('tiempo en la etapa', () => {
  it('cuenta días enteros entre fechas', () => {
    expect(diasEntre('2026-10-10', HOY)).toBe(7)
    expect(diasEntre('', HOY)).toBe(0)
    expect(diasEnEtapa(potencial(), HOY)).toBe(7)
  })
  it('está parado con la acción vencida o 14 días en la misma etapa', () => {
    expect(estaParado(potencial(), HOY)).toBe(false)
    expect(estaParado(potencial({ proximaAccionFecha: '2026-10-16' }), HOY)).toBe(true)
    expect(estaParado(potencial({ etapaDesde: '2026-10-03' }), HOY)).toBe(true)
    expect(estaParado(potencial({ etapaDesde: '2026-10-03', estado: 'descalificado' }), HOY)).toBe(false)
    expect(accionVencida(potencial({ proximaAccionFecha: HOY }), HOY)).toBe(false)
  })
  it('vuelve a contactar a los descartados cuando llega su fecha', () => {
    expect(tocaVolverAContactar(potencial({ estado: 'descalificado', volverContactar: HOY }), HOY)).toBe(true)
    expect(tocaVolverAContactar(potencial({ estado: 'descalificado', volverContactar: '2026-12-01' }), HOY)).toBe(false)
    expect(tocaVolverAContactar(potencial({ volverContactar: HOY }), HOY)).toBe(false)
  })
})

describe('cambio de etapa', () => {
  it('apunta el día y corta los recordatorios al salir de la entrada', () => {
    const p = conEtapa(potencial({ seguimiento: 'recordatorio1', proximoRecordatorio: '2026-10-20' }), 'auditoria', HOY)
    expect(p.etapa).toBe('auditoria')
    expect(p.etapaDesde).toBe(HOY)
    expect(p.seguimiento).toBe('respondio')
    expect(p.proximoRecordatorio).toBe('')
  })
  it('no toca un seguimiento ya cerrado ni la misma etapa', () => {
    expect(conEtapa(potencial({ seguimiento: 'pausado' }), 'auditoria', HOY).seguimiento).toBe('pausado')
    const p = potencial()
    expect(conEtapa(p, 'entrada', HOY)).toBe(p)
  })
  it('solo avanza hacia delante', () => {
    expect(esPosterior('propuesta', 'auditoria')).toBe(true)
    expect(esPosterior('propuesta', 'propuesta')).toBe(false)
    expect(esPosterior('auditoria', 'propuesta')).toBe(false)
  })
})

describe('propuestas', () => {
  const ofertas = [oferta('a', 1), oferta('b', 2), oferta('c', 1, { potencialId: 'otro' }), oferta('d', 7, { potencialId: null })]
  it('solo las del cliente potencial, la última versión primero', () => {
    expect(propuestasDe(ofertas, 'l1').map(q => q.id)).toEqual(['b', 'a'])
  })
  it('la siguiente versión sigue a la mayor', () => {
    expect(siguienteVersion(ofertas, 'l1')).toBe(3)
    expect(siguienteVersion(ofertas, 'nuevo')).toBe(1)
  })
})

describe('convivencia con Propuestas de clientes y el calendario', () => {
  const propuesta = (id: string, cambio: Partial<Propuesta> = {}): Propuesta => ({
    id, titulo: 'Altas', cliente: 'Clínica Sonrisa', cuentaId: null, contacto: '', estado: 'conversacion', prioridad: 'media', descripcion: '',
    importe: null, probabilidad: null, fechaPrevista: null, tecnologias: [], responsableId: null, proyectoId: null, apuntes: [], orden: 0,
    creadoEl: '', actualizadoEl: null, ...cambio,
  })
  it('casa las propuestas por el nombre de la empresa o por la cuenta', () => {
    const lista = [propuesta('a', { cliente: 'clinica sonrisa ' }), propuesta('b', { cliente: 'Otra' }), propuesta('c', { cliente: 'Otra', cuentaId: 'a1' })]
    expect(propuestasComercialesDe(lista, potencial()).map(x => x.id)).toEqual(['a'])
    expect(propuestasComercialesDe(lista, potencial({ cuentaId: 'a1' })).map(x => x.id)).toEqual(['a', 'c'])
    expect(propuestasComercialesDe(lista, potencial({ empresa: '' }))).toEqual([])
  })
  it('no cuenta dos veces la reunión que vuelve del calendario como cita', () => {
    const inicio = new Date(2026, 9, 20, 10, 0).toISOString()
    const reunion = { id: 'r1', titulo: 'Auditoría', fecha: inicio, duracionMin: 60, lugar: '', estado: 'pendiente', notas: '', temas: [], asistentesIds: [], proyectoId: null, organizaId: null, eventoId: null, potencialId: 'l1', creadoEl: '' } as Reunion
    const cita = (id: string, fecha: string, hora: string): ActividadCrm => ({
      id, asunto: 'Auditoría', tipo: 'cita', fecha, hora, referenteTipo: 'potenciales', referenteId: 'l1', cuentaId: null, propietarioId: null,
      prioridad: 'normal', estado: 'abierta', completadaEl: null, descripcion: '', creadoEl: '', eventoId: `ev-${id}`,
    } as ActividadCrm)
    const citas = citasDe([cita('x', '2026-10-20', '10:00'), cita('y', '2026-10-27', '10:00'), { ...cita('z', '2026-10-28', '10:00'), referenteId: 'otro' }], 'l1')
    expect(citas.map(a => a.id)).toEqual(['x', 'y'])
    expect(citasSinReunion(citas, [reunion]).map(a => a.id)).toEqual(['y'])
  })
})
