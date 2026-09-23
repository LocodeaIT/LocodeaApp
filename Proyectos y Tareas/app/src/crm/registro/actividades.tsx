/**
 * Actividades del CRM: tareas, llamadas, correos y citas «referentes a» otro
 * registro. Distintas de las tareas del módulo de Proyectos y Tareas.
 */
import { Ban, Check, RotateCcw } from 'lucide-react'
import type { ActividadCrm, ColReferente } from '../types'
import { ESTADO_ACTIVIDAD, NOMBRE_REGISTRO, PRIORIDAD, REFERENTES, TIPO_ACTIVIDAD, opcionesDe } from '../catalogos'
import { actividadVencida, cuentaDeReferente, nombreRegistro, registroDe } from '../consultas'
import { fecha } from '../formato'
import { hoy } from '../../domain/fechas'
import { ICONO_ACTIVIDAD, ICONO_COL } from '../iconos'
import { ChipEstado, Enlace } from '../ui'
import { ReferenteA } from '../screens/Hechos'
import { colPropietario, esMio, filtroPropietario, opcionesPropietario, opcionesReferente, ordenTexto } from './comunes'
import type { Entidad } from './tipos'

const referente = (a: ActividadCrm, d: Parameters<typeof registroDe>[0]) =>
  a.referenteTipo ? nombreRegistro(d, a.referenteTipo, registroDe(d, a.referenteTipo, a.referenteId)) : ''

export const actividades: Entidad<ActividadCrm> = {
  col: 'actividades', uno: 'Actividad', muchos: 'Actividades', fem: true, icono: ICONO_COL.actividades,
  vistas: [
    { clave: 'mias', titulo: 'Mis actividades abiertas', filtro: (a, c) => a.estado === 'abierta' && esMio(a, c) },
    { clave: 'abiertas', titulo: 'Todas las actividades abiertas', filtro: a => a.estado === 'abierta' },
    { clave: 'vencidas', titulo: 'Vencidas', filtro: actividadVencida },
    { clave: 'hoy', titulo: 'Para hoy', filtro: a => a.estado === 'abierta' && a.fecha === hoy() },
    { clave: 'completadas', titulo: 'Completadas', filtro: a => a.estado === 'completada' },
    { clave: 'todas', titulo: 'Todas las actividades', filtro: () => true },
  ],
  buscar: (a, c) => [a.asunto, c.nombreMiembro(a.propietarioId), referente(a, c.datos)],
  filtros: [
    { clave: 'tipo', titulo: 'Tipo', opciones: () => opcionesDe(TIPO_ACTIVIDAD) },
    { clave: 'prioridad', titulo: 'Prioridad', opciones: () => opcionesDe(PRIORIDAD) },
    filtroPropietario(),
  ],
  columnas: [
    {
      clave: 'hecha', titulo: '', sinOrden: true, sinExportar: true, ancho: 44,
      celda: (a, c) => (
        <button type="button" className={`check crm-check ${a.estado === 'completada' ? 'hecho' : ''}`} aria-label={a.estado === 'completada' ? 'Reabrir' : 'Completar'}
          onClick={e => { e.stopPropagation(); void c.alternarActividad(a) }}><Check size={11} strokeWidth={3} /></button>
      ),
    },
    { clave: 'asunto', titulo: 'Asunto', enlace: true, orden: a => ordenTexto(a.asunto), texto: a => a.asunto },
    {
      clave: 'tipo', titulo: 'Tipo', texto: a => TIPO_ACTIVIDAD[a.tipo],
      celda: a => { const Ico = ICONO_ACTIVIDAD[a.tipo]; return <span className="crm-persona"><Ico size={15} className="crm-apagado" />{TIPO_ACTIVIDAD[a.tipo]}</span> },
    },
    { clave: 'referente', titulo: 'Referente a', orden: (a, c) => ordenTexto(referente(a, c.datos)), texto: (a, c) => referente(a, c.datos), celda: a => a.referenteTipo ? <Enlace col={a.referenteTipo} id={a.referenteId} /> : null },
    {
      clave: 'fecha', titulo: 'Vencimiento', orden: a => `${a.fecha ?? '9'}T${a.hora}`, texto: a => a.fecha ? `${fecha(a.fecha)}${a.hora ? ' ' + a.hora : ''}` : '',
      celda: a => a.fecha ? <span className={actividadVencida(a) ? 'crm-tarde' : undefined}>{fecha(a.fecha)}{a.hora && ` ${a.hora}`}</span> : null,
    },
    { clave: 'prioridad', titulo: 'Prioridad', texto: a => PRIORIDAD[a.prioridad], celda: a => <ChipEstado estado={a.prioridad} etiqueta={PRIORIDAD[a.prioridad]} /> },
    colPropietario(),
    { clave: 'estado', titulo: 'Estado', texto: a => ESTADO_ACTIVIDAD[a.estado], celda: a => <ChipEstado estado={a.estado} etiqueta={ESTADO_ACTIVIDAD[a.estado]} /> },
  ],
  ordenInicial: { clave: 'fecha', dir: 1 },
  nuevo: c => ({
    id: '', asunto: '', tipo: 'tarea', fecha: hoy(), hora: '10:00', referenteTipo: null, referenteId: null, cuentaId: null,
    propietarioId: c.yoId, prioridad: 'normal', estado: 'abierta', completadaEl: null, descripcion: '', creadoEl: '',
  }),
  titulo: a => a.asunto,
  validar: d => (!d.asunto.trim() ? 'Escribe el asunto.' : null),
  antesDeGuardar: (a, c) => ({ ...a, cuentaId: cuentaDeReferente(c.datos, a.referenteTipo, a.referenteId) }),
  etiquetas: a => actividadVencida(a) ? <span className="chip pequeno error">Vencida</span> : null,
  pestanas: [
    {
      clave: 'general', titulo: 'General', campos: [
        { clave: 'asunto', titulo: 'Asunto', req: true, completo: true },
        { clave: 'tipo', titulo: 'Tipo', tipo: 'opciones', opciones: opcionesDe(TIPO_ACTIVIDAD) },
        { clave: 'prioridad', titulo: 'Prioridad', tipo: 'opciones', opciones: opcionesDe(PRIORIDAD) },
        {
          clave: 'referenteTipo', titulo: 'Referente a (tipo)', tipo: 'opciones',
          opciones: [{ valor: '', etiqueta: '—' }, ...REFERENTES.map(r => ({ valor: r, etiqueta: NOMBRE_REGISTRO[r] }))],
          alCambiar: d => ({ ...d, referenteTipo: (d.referenteTipo || null) as ColReferente | null, referenteId: null }),
        },
        { clave: 'referenteId', titulo: 'Referente a', tipo: 'opciones', opciones: (d, c) => opcionesReferente(c, d.referenteTipo) },
        { clave: 'fecha', titulo: 'Fecha de vencimiento', tipo: 'fecha' },
        { clave: 'hora', titulo: 'Hora', tipo: 'hora' },
        { clave: 'propietarioId', titulo: 'Propietario', tipo: 'opciones', opciones: (_, c) => opcionesPropietario(c) },
        { clave: 'estado', titulo: 'Estado', mostrar: d => <ChipEstado estado={d.estado} etiqueta={ESTADO_ACTIVIDAD[d.estado]} />, resumen: d => ESTADO_ACTIVIDAD[d.estado] },
      ],
    },
    { clave: 'descripcion', titulo: 'Descripción', campos: [{ clave: 'descripcion', titulo: 'Descripción', tipo: 'area', completo: true }] },
  ],
  comandos: (a, c) => a.estado === 'abierta'
    ? [
        { texto: 'Marcar como completada', icono: Check, tono: 'acento', accion: () => c.alternarActividad(a) },
        { texto: 'Cancelar actividad', icono: Ban, accion: () => c.cancelarActividad(a) },
      ]
    : [{ texto: 'Reabrir', icono: RotateCcw, accion: () => c.alternarActividad(a.estado === 'cancelada' ? { ...a, estado: 'completada' } : a) }],
  hechos: a => <ReferenteA a={a} />,
}
