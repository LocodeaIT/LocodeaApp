/** Clientes potenciales: al calificarlos se convierten en cuenta, contacto y oportunidad. */
import { Ban, Check, Crosshair, RotateCcw } from 'lucide-react'
import type { Potencial } from '../types'
import { ESTADO_POTENCIAL, ORIGEN, PUNTUACION, opcionesDe } from '../catalogos'
import { nombreCompleto } from '../consultas'
import { eur0, fecha, fechaHora } from '../formato'
import { ICONO_COL } from '../iconos'
import { ChipEstado, Enlace } from '../ui'
import { EscalaTiempo, ResumenPotencial } from '../screens/Hechos'
import { colNo, colPropietario, esMio, filtroPropietario, opcionesPropietario, ordenTexto } from './comunes'
import type { Entidad } from './tipos'

export const potenciales: Entidad<Potencial> = {
  col: 'potenciales', uno: 'Cliente potencial', muchos: 'Clientes potenciales', icono: ICONO_COL.potenciales,
  vistas: [
    { clave: 'abiertos', titulo: 'Clientes potenciales abiertos', filtro: l => l.estado === 'abierto' },
    { clave: 'mios', titulo: 'Mis clientes potenciales abiertos', filtro: (l, c) => l.estado === 'abierto' && esMio(l, c) },
    { clave: 'calificados', titulo: 'Calificados', filtro: l => l.estado === 'calificado' },
    { clave: 'descalificados', titulo: 'Descalificados', filtro: l => l.estado === 'descalificado' },
    { clave: 'todos', titulo: 'Todos los clientes potenciales', filtro: () => true },
  ],
  buscar: l => [l.no, l.tema, nombreCompleto(l), l.empresa, l.email, l.ciudad, l.sector],
  filtros: [
    { clave: 'origen', titulo: 'Origen', opciones: () => opcionesDe(ORIGEN) },
    { clave: 'puntuacion', titulo: 'Puntuación', opciones: () => opcionesDe(PUNTUACION) },
    filtroPropietario(),
  ],
  columnas: [
    colNo(),
    { clave: 'tema', titulo: 'Tema', enlace: true, orden: l => ordenTexto(l.tema), texto: l => l.tema },
    { clave: 'nombre', titulo: 'Nombre', orden: l => ordenTexto(nombreCompleto(l)), texto: l => nombreCompleto(l) },
    { clave: 'empresa', titulo: 'Empresa', texto: l => l.empresa },
    { clave: 'origen', titulo: 'Origen', texto: l => ORIGEN[l.origen] },
    { clave: 'puntuacion', titulo: 'Puntuación', texto: l => PUNTUACION[l.puntuacion], celda: l => <ChipEstado estado={l.puntuacion} etiqueta={PUNTUACION[l.puntuacion]} /> },
    { clave: 'importeEst', titulo: 'Ingresos est.', num: true, orden: l => l.importeEst, texto: l => l.importeEst ? eur0(l.importeEst) : '' },
    colPropietario(),
    { clave: 'creadoEl', titulo: 'Creado', orden: l => l.creadoEl, texto: l => fecha(l.creadoEl) },
    { clave: 'estado', titulo: 'Estado', texto: l => ESTADO_POTENCIAL[l.estado], celda: l => <ChipEstado estado={l.estado} etiqueta={ESTADO_POTENCIAL[l.estado]} /> },
  ],
  ordenInicial: { clave: 'creadoEl', dir: -1 },
  nuevo: c => ({
    id: '', no: '', tema: '', nombre: '', apellidos: '', empresa: '', cargo: '', email: '', telefono: '', ciudad: '', sector: '',
    origen: 'web', puntuacion: 'templado', estado: 'abierto', fase: 'calificar', importeEst: 0, propietarioId: c.yoId, descripcion: '',
    calificadoEl: null, descalificadoEl: null, motivo: '', cuentaId: null, contactoId: null, oportunidadId: null, creadoEl: '',
  }),
  titulo: l => l.tema,
  validar: d => (!d.tema.trim() ? 'Escribe el tema del cliente potencial.' : null),
  proceso: {
    editable: false,
    fin: l => l.estado === 'calificado' ? { texto: 'Calificado', tono: 'ok' } : l.estado === 'descalificado' ? { texto: 'Descalificado', tono: 'apagado' } : null,
  },
  pestanas: [
    {
      clave: 'general', titulo: 'General', campos: [
        { clave: 'no', titulo: 'Nº', soloLectura: true },
        { clave: 'tema', titulo: 'Tema', req: true },
        { clave: 'estado', titulo: 'Estado', mostrar: d => <ChipEstado estado={d.estado} etiqueta={ESTADO_POTENCIAL[d.estado]} />, resumen: d => ESTADO_POTENCIAL[d.estado] },
        { clave: 'puntuacion', titulo: 'Puntuación', tipo: 'opciones', opciones: opcionesDe(PUNTUACION) },
        { clave: 'origen', titulo: 'Origen', tipo: 'opciones', opciones: opcionesDe(ORIGEN) },
        { clave: 'importeEst', titulo: 'Ingresos estimados (€)', tipo: 'numero', paso: 100, min: 0 },
        { clave: 'propietarioId', titulo: 'Propietario', tipo: 'opciones', opciones: (_, c) => opcionesPropietario(c) },
        { clave: 'creadoEl', titulo: 'Creado', mostrar: d => fechaHora(d.creadoEl || null) },
      ],
    },
    {
      clave: 'contacto', titulo: 'Contacto', campos: [
        { clave: 'nombre', titulo: 'Nombre' },
        { clave: 'apellidos', titulo: 'Apellidos' },
        { clave: 'empresa', titulo: 'Empresa' },
        { clave: 'cargo', titulo: 'Cargo' },
        { clave: 'email', titulo: 'Correo electrónico', tipo: 'email' },
        { clave: 'telefono', titulo: 'Teléfono' },
        { clave: 'ciudad', titulo: 'Ciudad' },
        { clave: 'sector', titulo: 'Sector' },
      ],
    },
    {
      clave: 'descripcion', titulo: 'Descripción', abierta: false, campos: [
        { clave: 'descripcion', titulo: 'Descripción', tipo: 'area', completo: true },
        { clave: 'motivo', titulo: 'Motivo de descalificación', soloLectura: true },
        { clave: 'oportunidadId', titulo: 'Oportunidad', mostrar: d => <Enlace col="oportunidades" id={d.oportunidadId} /> },
      ],
    },
  ],
  comandos: (l, c, ui) => l.estado === 'abierto'
    ? [
        { texto: 'Calificar', icono: Check, tono: 'acento', accion: () => c.calificarPotencial(l) },
        { texto: 'Descalificar', icono: Ban, accion: () => ui.pedirTexto('Descalificar cliente potencial', l.tema, 'Motivo', 'Descalificar', m => { void c.descalificarPotencial(l, m) }) },
      ]
    : l.estado === 'calificado'
      ? [!!l.oportunidadId && { texto: 'Ver oportunidad', icono: Crosshair, accion: () => c.abrir('oportunidades', l.oportunidadId!) }]
      : [{ texto: 'Reactivar', icono: RotateCcw, accion: () => c.reactivarPotencial(l) }],
  hechos: l => <>
    <ResumenPotencial p={l} />
    <EscalaTiempo col="potenciales" id={l.id} />
  </>,
}
