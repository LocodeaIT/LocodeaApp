/**
 * Clientes potenciales: siguen el recorrido comercial de Locodea, Entrada →
 * Auditoría → Propuesta → Proyecto en marcha. Cuelgan de ellos el seguimiento
 * de la automatización de Outlook, sus reuniones y sus propuestas. Al arrancar
 * el proyecto pasan a cuenta y contacto.
 */
import { Ban, Building2, CalendarPlus, FilePlus2, Pause, Play, Rocket, RotateCcw, Crosshair } from 'lucide-react'
import type { EtapaPotencial, Potencial } from '../types'
import {
  ENTRADA, ESTADO_POTENCIAL, ETAPA, ETAPAS, MOTIVO_DESCARTE, ORIGEN, PUNTUACION, SEGUIMIENTO, SEGUIMIENTO_ACTIVO, opcionesDe,
} from '../catalogos'
import { nombreCompleto } from '../consultas'
import { eur0, fecha, fechaHora } from '../formato'
import { hoy } from '../../domain/fechas'
import { ICONO_COL } from '../iconos'
import { ChipEstado, Enlace } from '../ui'
import { ReunionesDe, EscalaTiempo, ResumenPotencial } from '../screens/Hechos'
import { ModalArrancar, ModalDescartar, ModalReunionCrm, PropuestasPotencial, ReunionesPotencial, TarjetaPotencial } from '../screens/Recorrido'
import { accionVencida, diasEnEtapa, estaParado, propuestasDe, tocaVolverAContactar } from '../recorrido'
import { colNo, colPropietario, esMio, filtroPropietario, opcionesPropietario, ordenTexto } from './comunes'
import type { Entidad } from './tipos'

/** Tramos del filtro de ingresos estimados: [clave, etiqueta, desde (incluido), hasta (excluido)]. */
const TRAMOS_INGRESOS: [string, string, number, number][] = [
  ['sin', 'Sin importe', 0, 0],
  ['hasta5k', 'Hasta 5.000 €', 0.01, 5000],
  ['5k-20k', '5.000 – 20.000 €', 5000, 20000],
  ['20k-50k', '20.000 – 50.000 €', 20000, 50000],
  ['mas50k', 'Más de 50.000 €', 50000, Infinity],
]

const tramoIngresos = (importe: number) =>
  !importe ? 'sin' : TRAMOS_INGRESOS.find(([, , desde, hasta]) => importe >= desde && importe < hasta)?.[0] ?? ''

const enCurso = (l: Potencial) => l.estado === 'abierto'

export const potenciales: Entidad<Potencial> = {
  col: 'potenciales', uno: 'Cliente potencial', muchos: 'Clientes potenciales', icono: ICONO_COL.potenciales,
  vistas: [
    { clave: 'abiertos', titulo: 'Clientes potenciales en curso', filtro: enCurso },
    { clave: 'mios', titulo: 'Mis clientes potenciales en curso', filtro: (l, c) => enCurso(l) && esMio(l, c) },
    { clave: 'esperando', titulo: 'En entrada, esperando respuesta', filtro: l => enCurso(l) && l.etapa === 'entrada' && SEGUIMIENTO_ACTIVO.includes(l.seguimiento) },
    { clave: 'auditoria', titulo: 'En auditoría', filtro: l => enCurso(l) && l.etapa === 'auditoria' },
    { clave: 'propuesta', titulo: 'Con propuesta', filtro: l => enCurso(l) && l.etapa === 'propuesta' },
    { clave: 'parados', titulo: 'Parados (acción vencida o 14 días sin moverse)', filtro: l => estaParado(l, hoy()) },
    { clave: 'volver', titulo: 'Para volver a contactar', filtro: l => tocaVolverAContactar(l, hoy()) },
    { clave: 'calificados', titulo: 'Convertidos en cliente', filtro: l => l.estado === 'calificado' },
    { clave: 'descalificados', titulo: 'Descartados', filtro: l => l.estado === 'descalificado' },
    { clave: 'todos', titulo: 'Todos los clientes potenciales', filtro: () => true },
  ],
  buscar: l => [l.no, l.tema, nombreCompleto(l), l.empresa, l.email, l.ciudad, l.pais, l.sector, l.area, l.proximaAccion],
  filtros: [
    { clave: 'etapa', titulo: 'Etapa', opciones: () => opcionesDe(ETAPA) },
    { clave: 'entrada', titulo: 'Entrada', opciones: () => opcionesDe(ENTRADA) },
    { clave: 'origen', titulo: 'Origen', opciones: () => opcionesDe(ORIGEN) },
    { clave: 'puntuacion', titulo: 'Puntuación', opciones: () => opcionesDe(PUNTUACION) },
    {
      clave: 'ingresos', titulo: 'Ingresos',
      opciones: () => TRAMOS_INGRESOS.map(([valor, etiqueta]) => ({ valor, etiqueta })),
      valor: l => tramoIngresos(l.importeEst),
    },
    filtroPropietario(),
  ],
  columnas: [
    colNo(),
    { clave: 'tema', titulo: 'Tema', enlace: true, orden: l => ordenTexto(l.tema), texto: l => l.tema },
    { clave: 'empresa', titulo: 'Empresa', texto: l => l.empresa },
    { clave: 'nombre', titulo: 'Nombre', orden: l => ordenTexto(nombreCompleto(l)), texto: l => nombreCompleto(l) },
    { clave: 'etapa', titulo: 'Etapa', orden: l => ETAPAS.indexOf(l.etapa), texto: l => ETAPA[l.etapa] },
    {
      clave: 'seguimiento', titulo: 'Seguimiento', texto: l => (l.seguimiento ? SEGUIMIENTO[l.seguimiento] : ''),
      celda: l => (l.seguimiento ? <ChipEstado estado={l.seguimiento} etiqueta={SEGUIMIENTO[l.seguimiento]} /> : ''),
    },
    {
      clave: 'proximaAccion', titulo: 'Próxima acción', orden: l => l.proximaAccionFecha || '9999',
      texto: l => [l.proximaAccion, l.proximaAccionFecha && fecha(l.proximaAccionFecha)].filter(Boolean).join(' · '),
      celda: l => (l.proximaAccion || l.proximaAccionFecha
        ? <span className={accionVencida(l, hoy()) && enCurso(l) ? 'crm-tarde' : undefined}>{[l.proximaAccion, l.proximaAccionFecha && fecha(l.proximaAccionFecha)].filter(Boolean).join(' · ')}</span>
        : ''),
    },
    { clave: 'diasEtapa', titulo: 'Días en etapa', num: true, orden: l => diasEnEtapa(l, hoy()), texto: l => (enCurso(l) ? diasEnEtapa(l, hoy()) : '') },
    { clave: 'importeEst', titulo: 'Ingresos est.', num: true, orden: l => l.importeEst, texto: l => l.importeEst ? eur0(l.importeEst) : '' },
    colPropietario(),
    { clave: 'creadoEl', titulo: 'Creado', orden: l => l.creadoEl, texto: l => fecha(l.creadoEl) },
    { clave: 'estado', titulo: 'Estado', texto: l => ESTADO_POTENCIAL[l.estado], celda: l => <ChipEstado estado={l.estado} etiqueta={ESTADO_POTENCIAL[l.estado]} /> },
  ],
  ordenInicial: { clave: 'creadoEl', dir: -1 },
  tablero: {
    porDefecto: true,
    // «Proyecto en marcha» no es columna: al llegar ahí pasan a cuenta y contacto
    columnas: ETAPAS.filter(e => e !== 'proyecto').map(e => ({ clave: e, titulo: ETAPA[e] })),
    columna: l => l.etapa,
    tarjeta: l => <TarjetaPotencial p={l} />,
    mover: (l, etapa, c) => { if (enCurso(l)) void c.cambiarEtapa(l, etapa as EtapaPotencial) },
  },
  nuevo: c => ({
    id: '', no: '', tema: '', nombre: '', apellidos: '', empresa: '', cargo: '', email: '', telefono: '', ciudad: '', sector: '',
    origen: 'web', puntuacion: 'templado', estado: 'abierto', fase: 'calificar', importeEst: 0, propietarioId: c.yoId, descripcion: '',
    calificadoEl: null, descalificadoEl: null, motivo: '', direccion: '', cp: '', pais: 'España', web: '', empleados: '', area: '',
    herramientas: '', loQueImporta: '', recomendacion: '', cuentaId: null, contactoId: null, oportunidadId: null, proyectoId: null, creadoEl: '',
    etapa: 'entrada', etapaDesde: hoy(), entrada: 'inbound', seguimiento: '', primerContacto: hoy(), proximoRecordatorio: '', respondioEl: '',
    conversacionId: '', linkedin: '', procesosRevisar: '', proximaAccion: '', proximaAccionFecha: '', motivoDescarte: '', volverContactar: '',
  }),
  titulo: l => l.tema,
  validar: d => (!d.tema.trim() ? 'Escribe el tema del cliente potencial.' : null),
  proceso: {
    editable: false,
    fin: l => l.estado === 'calificado' ? { texto: 'Convertido en cliente', tono: 'ok' } : l.estado === 'descalificado' ? { texto: 'Descartado', tono: 'apagado' } : null,
    propio: {
      pasos: ETAPAS.map(e => ({ clave: e, etiqueta: ETAPA[e] })),
      actual: l => l.etapa,
      editable: enCurso,
      // «Proyecto en marcha» se alcanza arrancando el proyecto, que crea cuenta, contacto y proyecto
      alPulsar: (l, clave, c, ui) => {
        if (clave === 'proyecto') ui.mostrar(cerrar => <ModalArrancar p={l} onCerrar={cerrar} />)
        else void c.cambiarEtapa(l, clave as EtapaPotencial)
      },
    },
  },
  etiquetas: l => (l.seguimiento && l.etapa === 'entrada' ? <ChipEstado estado={l.seguimiento} etiqueta={SEGUIMIENTO[l.seguimiento]} /> : null),
  pestanas: [
    {
      clave: 'general', titulo: 'General', campos: [
        { clave: 'no', titulo: 'Nº', soloLectura: true },
        { clave: 'tema', titulo: 'Tema', req: true },
        { clave: 'empresa', titulo: 'Empresa' },
        { clave: 'estado', titulo: 'Estado', mostrar: d => <ChipEstado estado={d.estado} etiqueta={ESTADO_POTENCIAL[d.estado]} />, resumen: d => ESTADO_POTENCIAL[d.estado] },
        { clave: 'etapa', titulo: 'Etapa', mostrar: d => `${ETAPA[d.etapa]} · desde el ${fecha(d.etapaDesde)}`, resumen: d => ETAPA[d.etapa] },
        { clave: 'proximaAccion', titulo: 'Próxima acción' },
        { clave: 'proximaAccionFecha', titulo: 'Fecha de la próxima acción', tipo: 'fecha' },
        { clave: 'entrada', titulo: 'Entrada', tipo: 'opciones', opciones: opcionesDe(ENTRADA) },
        { clave: 'origen', titulo: 'Origen', tipo: 'opciones', opciones: opcionesDe(ORIGEN) },
        { clave: 'puntuacion', titulo: 'Puntuación', tipo: 'opciones', opciones: opcionesDe(PUNTUACION) },
        { clave: 'importeEst', titulo: 'Ingresos estimados (€)', tipo: 'numero', paso: 100, min: 0 },
        { clave: 'propietarioId', titulo: 'Propietario', tipo: 'opciones', opciones: (_, c) => opcionesPropietario(c) },
        { clave: 'creadoEl', titulo: 'Creado', mostrar: d => fechaHora(d.creadoEl || null) },
      ],
    },
    {
      // lo rellena la automatización de Power Automate; se puede corregir a mano
      clave: 'seguimiento', titulo: 'Seguimiento de la entrada', abierta: false, campos: [
        { clave: 'seguimiento', titulo: 'Seguimiento', tipo: 'opciones', opciones: opcionesDe(SEGUIMIENTO) },
        { clave: 'primerContacto', titulo: 'Primer contacto', tipo: 'fecha' },
        { clave: 'proximoRecordatorio', titulo: 'Próximo recordatorio', tipo: 'fecha' },
        { clave: 'respondioEl', titulo: 'Respondió el', tipo: 'fecha' },
        { clave: 'conversacionId', titulo: 'Id. de conversación de Outlook' },
      ],
    },
    {
      clave: 'contacto', titulo: 'Contacto', campos: [
        { clave: 'nombre', titulo: 'Nombre' },
        { clave: 'apellidos', titulo: 'Apellidos' },
        { clave: 'cargo', titulo: 'Cargo' },
        { clave: 'email', titulo: 'Correo electrónico', tipo: 'email' },
        { clave: 'telefono', titulo: 'Teléfono' },
        { clave: 'linkedin', titulo: 'LinkedIn' },
        { clave: 'area', titulo: 'Área o departamento' },
      ],
    },
    {
      clave: 'empresa', titulo: 'Empresa', abierta: false, campos: [
        { clave: 'sector', titulo: 'Sector' },
        { clave: 'empleados', titulo: 'Personas en la empresa' },
        { clave: 'web', titulo: 'Sitio web' },
        { clave: 'direccion', titulo: 'Dirección' },
        { clave: 'cp', titulo: 'Código postal' },
        { clave: 'ciudad', titulo: 'Ciudad' },
        { clave: 'pais', titulo: 'País' },
      ],
    },
    {
      clave: 'necesidad', titulo: 'Necesidad y auditoría', campos: [
        { clave: 'procesosRevisar', titulo: 'Procesos a revisar (lo que cuenta en la auditoría)', tipo: 'area', completo: true },
        { clave: 'herramientas', titulo: 'Herramientas actuales' },
        { clave: 'loQueImporta', titulo: 'Lo que más importa' },
        { clave: 'recomendacion', titulo: 'Recomendación de la web' },
      ],
    },
    { clave: 'reuniones', titulo: 'Reuniones', contenido: d => <ReunionesPotencial p={d} /> },
    {
      clave: 'propuestas', titulo: 'Propuestas',
      contenido: d => <PropuestasPotencial p={d} />,
      resumenContenido: (d, c) => {
        const n = propuestasDe(c.datos.ofertas, d.id).length
        return n ? `${n} ${n === 1 ? 'propuesta' : 'propuestas'}` : 'Sin propuestas'
      },
    },
    {
      clave: 'descripcion', titulo: 'Descripción y cierre', abierta: false, campos: [
        { clave: 'descripcion', titulo: 'Descripción', tipo: 'area', completo: true },
        { clave: 'motivoDescarte', titulo: 'Motivo de descarte', mostrar: d => (d.motivoDescarte ? MOTIVO_DESCARTE[d.motivoDescarte] : '—') },
        { clave: 'motivo', titulo: 'Detalle del descarte', soloLectura: true },
        { clave: 'volverContactar', titulo: 'Volver a contactar el', tipo: 'fecha' },
        { clave: 'cuentaId', titulo: 'Cuenta', mostrar: d => <Enlace col="cuentas" id={d.cuentaId} /> },
        { clave: 'contactoId', titulo: 'Contacto', mostrar: d => <Enlace col="contactos" id={d.contactoId} /> },
        { clave: 'oportunidadId', titulo: 'Oportunidad (anterior al recorrido)', mostrar: d => <Enlace col="oportunidades" id={d.oportunidadId} /> },
      ],
    },
  ],
  comandos: (l, c, ui) => {
    if (l.estado === 'calificado') {
      return [
        !!l.cuentaId && { texto: 'Ver cuenta', icono: Building2, accion: () => c.abrir('cuentas', l.cuentaId!) },
        !!l.oportunidadId && { texto: 'Ver oportunidad', icono: Crosshair, accion: () => c.abrir('oportunidades', l.oportunidadId!) },
      ]
    }
    if (l.estado === 'descalificado') return [{ texto: 'Reactivar', icono: RotateCcw, accion: () => c.reactivarPotencial(l) }]
    const hayPropuesta = propuestasDe(c.datos.ofertas, l.id).length > 0
    return [
      l.etapa === 'entrada' && { texto: 'Programar auditoría', icono: CalendarPlus, tono: 'acento', accion: () => ui.mostrar(cerrar => <ModalReunionCrm p={l} tipo="auditoria" onCerrar={cerrar} />) },
      l.etapa === 'auditoria' && { texto: 'Nueva propuesta', icono: FilePlus2, tono: 'acento', accion: () => c.nuevaPropuesta(l) },
      l.etapa === 'propuesta' && { texto: 'Arrancar proyecto', icono: Rocket, tono: 'acento', accion: () => ui.mostrar(cerrar => <ModalArrancar p={l} onCerrar={cerrar} />) },
      l.etapa === 'propuesta' && { texto: hayPropuesta ? 'Nueva versión' : 'Nueva propuesta', icono: FilePlus2, accion: () => c.nuevaPropuesta(l) },
      l.etapa !== 'entrada' && { texto: 'Nueva reunión', icono: CalendarPlus, accion: () => ui.mostrar(cerrar => <ModalReunionCrm p={l} tipo={l.etapa === 'propuesta' ? 'propuesta' : 'seguimiento'} onCerrar={cerrar} />) },
      SEGUIMIENTO_ACTIVO.includes(l.seguimiento) && { texto: 'Pausar seguimiento', icono: Pause, accion: () => c.cambiarSeguimiento(l, 'pausado') },
      l.seguimiento === 'pausado' && l.etapa === 'entrada' && { texto: 'Reanudar seguimiento', icono: Play, accion: () => c.cambiarSeguimiento(l, 'contactado') },
      { texto: 'Descartar', icono: Ban, accion: () => ui.mostrar(cerrar => <ModalDescartar p={l} onCerrar={cerrar} />) },
    ]
  },
  hechos: l => <>
    <ResumenPotencial p={l} />
    <ReunionesDe col="potenciales" id={l.id} />
    <EscalaTiempo col="potenciales" id={l.id} />
  </>,
}
