/** Oportunidades: pipeline de venta con flujo Calificar → Desarrollar → Proponer → Cerrar. */
import { Check, FileText, RotateCcw, X } from 'lucide-react'
import type { Oportunidad } from '../types'
import { ESTADO_OPORTUNIDAD, FASE, opcionesDe } from '../catalogos'
import { nombreContacto, nombreCuenta } from '../consultas'
import { eur0, fechaHora, pasada, pct } from '../formato'
import { hoy, sumarDias } from '../../domain/fechas'
import { ICONO_COL } from '../iconos'
import { ChipEstado, Enlace, Fecha } from '../ui'
import { EscalaTiempo, ResumenOportunidad } from '../screens/Hechos'
import {
  colNo, colPropietario, cuentasFiltro, esMio, filtroPropietario, opcionesContactos, opcionesCuentas, opcionesPropietario, ordenTexto,
} from './comunes'
import type { Entidad } from './tipos'

export const oportunidades: Entidad<Oportunidad> = {
  col: 'oportunidades', uno: 'Oportunidad', muchos: 'Oportunidades', fem: true, icono: ICONO_COL.oportunidades,
  vistas: [
    { clave: 'abiertas', titulo: 'Oportunidades abiertas', filtro: o => o.estado === 'abierta' },
    { clave: 'mias', titulo: 'Mis oportunidades abiertas', filtro: (o, c) => o.estado === 'abierta' && esMio(o, c) },
    { clave: 'mes', titulo: 'Cierran este mes', filtro: o => o.estado === 'abierta' && !!o.cierrePrevisto && o.cierrePrevisto.slice(0, 7) === hoy().slice(0, 7) },
    { clave: 'ganadas', titulo: 'Ganadas', filtro: o => o.estado === 'ganada' },
    { clave: 'perdidas', titulo: 'Perdidas', filtro: o => o.estado === 'perdida' },
    { clave: 'todas', titulo: 'Todas las oportunidades', filtro: () => true },
  ],
  buscar: (o, c) => [o.no, o.titulo, nombreCuenta(c.datos, o.cuentaId), nombreContacto(c.datos, o.contactoId)],
  filtros: [
    { clave: 'fase', titulo: 'Fase', opciones: () => opcionesDe(FASE) },
    { clave: 'cuentaId', titulo: 'Cuenta', opciones: c => cuentasFiltro(c) },
    filtroPropietario(),
  ],
  columnas: [
    colNo(),
    { clave: 'titulo', titulo: 'Tema', enlace: true, orden: o => ordenTexto(o.titulo), texto: o => o.titulo },
    { clave: 'cuentaId', titulo: 'Cuenta', orden: (o, c) => ordenTexto(nombreCuenta(c.datos, o.cuentaId)), texto: (o, c) => nombreCuenta(c.datos, o.cuentaId), celda: o => <Enlace col="cuentas" id={o.cuentaId} /> },
    { clave: 'contactoId', titulo: 'Contacto', texto: (o, c) => nombreContacto(c.datos, o.contactoId), celda: o => <Enlace col="contactos" id={o.contactoId} /> },
    { clave: 'importe', titulo: 'Ingresos est.', num: true, orden: o => o.importe, texto: o => eur0(o.importe) },
    { clave: 'fase', titulo: 'Fase', texto: o => FASE[o.fase] },
    { clave: 'probabilidad', titulo: 'Prob.', num: true, orden: o => o.probabilidad, texto: o => pct(o.probabilidad) },
    { clave: 'cierrePrevisto', titulo: 'Cierre est.', orden: o => o.cierrePrevisto, texto: o => o.cierrePrevisto, celda: o => <Fecha dia={o.cierrePrevisto} avisar={o.estado === 'abierta'} /> },
    colPropietario(),
    { clave: 'estado', titulo: 'Estado', texto: o => ESTADO_OPORTUNIDAD[o.estado], celda: o => <ChipEstado estado={o.estado} etiqueta={ESTADO_OPORTUNIDAD[o.estado]} /> },
  ],
  ordenInicial: { clave: 'cierrePrevisto', dir: 1 },
  nuevo: c => ({
    id: '', no: '', titulo: '', cuentaId: null, contactoId: null, importe: 0, fase: 'calificar', estado: 'abierta', probabilidad: 10,
    cierrePrevisto: sumarDias(hoy(), 30), propietarioId: c.yoId, notas: '', cerradaEl: null, motivoPerdida: '', potencialId: null, creadoEl: '',
  }),
  titulo: o => o.titulo,
  validar: d => (!d.titulo.trim() ? 'Escribe el tema de la oportunidad.' : !d.cuentaId ? 'Elige la cuenta.' : null),
  etiquetas: o => o.estado === 'abierta' && pasada(o.cierrePrevisto) ? <span className="chip pequeno error">Cierre vencido</span> : null,
  proceso: {
    editable: true,
    fin: o => o.estado === 'ganada' ? { texto: 'Ganada', tono: 'ok' } : o.estado === 'perdida' ? { texto: 'Perdida', tono: 'error' } : null,
  },
  pestanas: [
    {
      clave: 'general', titulo: 'General', campos: [
        { clave: 'no', titulo: 'Nº', soloLectura: true },
        { clave: 'titulo', titulo: 'Tema', req: true },
        {
          clave: 'cuentaId', titulo: 'Cuenta', tipo: 'opciones', req: true, opciones: (_, c) => opcionesCuentas(c, 'cliente'),
          // si el contacto no es de la nueva cuenta, se quita
          alCambiar: (d, c) => (d.contactoId && c.datos.contactos.find(x => x.id === d.contactoId)?.cuentaId !== d.cuentaId ? { ...d, contactoId: null } : d),
        },
        { clave: 'contactoId', titulo: 'Contacto', tipo: 'opciones', opciones: (d, c) => opcionesContactos(c, d.cuentaId) },
        { clave: 'importe', titulo: 'Ingresos estimados (€)', tipo: 'numero', paso: 100, min: 0 },
        { clave: 'cierrePrevisto', titulo: 'Fecha de cierre estimada', tipo: 'fecha' },
        { clave: 'probabilidad', titulo: 'Probabilidad (%)', tipo: 'numero', paso: 5, min: 0 },
        { clave: 'fase', titulo: 'Fase', mostrar: d => FASE[d.fase], resumen: d => FASE[d.fase] },
        { clave: 'estado', titulo: 'Estado', mostrar: d => <ChipEstado estado={d.estado} etiqueta={ESTADO_OPORTUNIDAD[d.estado]} />, resumen: d => ESTADO_OPORTUNIDAD[d.estado] },
        { clave: 'propietarioId', titulo: 'Propietario', tipo: 'opciones', opciones: (_, c) => opcionesPropietario(c) },
      ],
    },
    {
      clave: 'cierre', titulo: 'Cierre', abierta: false, campos: [
        { clave: 'cerradaEl', titulo: 'Fecha de cierre real', mostrar: d => fechaHora(d.cerradaEl) },
        { clave: 'motivoPerdida', titulo: 'Motivo de pérdida', soloLectura: true },
        { clave: 'potencialId', titulo: 'Origen', mostrar: d => <Enlace col="potenciales" id={d.potencialId} /> },
      ],
    },
    { clave: 'notas', titulo: 'Notas', abierta: false, campos: [{ clave: 'notas', titulo: 'Notas', tipo: 'area', completo: true }] },
  ],
  comandos: (o, c, ui) => o.estado === 'abierta'
    ? [
        { texto: 'Cerrar como ganada', icono: Check, tono: 'acento', accion: () => c.ganarOportunidad(o) },
        { texto: 'Cerrar como perdida', icono: X, accion: () => ui.pedirTexto('Cerrar como perdida', o.titulo, 'Motivo', 'Cerrar como perdida', m => { void c.perderOportunidad(o, m) }) },
        { texto: 'Crear oferta', icono: FileText, accion: () => c.abrir('ofertas', 'nuevo', { cuentaId: o.cuentaId, contactoId: o.contactoId, oportunidadId: o.id }) },
      ]
    : [{ texto: 'Reabrir', icono: RotateCcw, accion: () => c.reabrirOportunidad(o) }],
  hechos: o => <>
    <ResumenOportunidad o={o} />
    <EscalaTiempo col="oportunidades" id={o.id} />
  </>,
}
