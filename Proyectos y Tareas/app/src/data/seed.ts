/**
 * Datos de ejemplo para arrancar la app sin conexión. Se generan relativos a
 * la fecha de hoy para que siempre haya una «semana actual» con contenido,
 * un par de semanas cerradas con histórico y tareas con vencimientos vivos.
 */
import type { Instantanea } from './repo'
import type { Actividad, Miembro, Objetivo, Proyecto, Semana, Tarea, Vista } from '../domain/types'
import { FILTROS_VACIOS } from '../domain/types'
import { hoy, lunesDe, sumarDias } from '../domain/fechas'

const M = {
  marco: 'm-marco',
  jesus: 'm-jesus',
  alejandro: 'm-alejandro',
  juanangel: 'm-juanangel',
}
const P = {
  ortoalresa: 'p-ortoalresa',
  clinica: 'p-clinica',
  logistica: 'p-logistica',
  interno: 'p-interno',
}

export function generarSeed(): Instantanea {
  const H = hoy()
  const lunes = lunesDe(H)
  const s0 = lunes                    // semana actual
  const s1 = sumarDias(lunes, -7)     // semana pasada (cerrada)
  const s2 = sumarDias(lunes, -14)
  const s3 = sumarDias(lunes, -21)
  const iso = (fecha: string, h = 9) => `${fecha}T${String(h).padStart(2, '0')}:00:00.000Z`

  const miembros: Miembro[] = [
    { id: M.marco, nombre: 'Marco', iniciales: 'MR', email: 'marco@locodea.com', color: '#C239B3', rol: 'socio', activo: true },
    { id: M.jesus, nombre: 'Jesús Alonso', iniciales: 'JA', email: 'jesus@locodea.com', color: '#0F6CBD', rol: 'socio', activo: true },
    { id: M.alejandro, nombre: 'Alejandro', iniciales: 'AL', email: 'alejandro@locodea.com', color: '#0E7C5B', rol: 'socio', activo: true },
    { id: M.juanangel, nombre: 'Juan Ángel', iniciales: 'JU', email: 'juanangel@locodea.com', color: '#B85C00', rol: 'socio', activo: true },
  ]

  const proyectos: Proyecto[] = [
    { id: P.ortoalresa, nombre: 'Portal de pedidos', cliente: 'Ortoalresa', color: '#0F6CBD', estado: 'activo', responsableId: M.jesus, descripcion: 'Power Pages + Dataverse para que los distribuidores hagan pedidos y consulten estado.', fechaInicio: sumarDias(lunes, -42), fechaFin: sumarDias(lunes, 28), horasPresupuestadas: 180, creadoEl: iso(s3) },
    { id: P.clinica, nombre: 'App de citas', cliente: 'Clínica Vega', color: '#C239B3', estado: 'activo', responsableId: M.marco, descripcion: 'Canvas app + Power Automate para gestión de citas y recordatorios por WhatsApp.', fechaInicio: sumarDias(lunes, -21), fechaFin: sumarDias(lunes, 21), horasPresupuestadas: 90, creadoEl: iso(s3) },
    { id: P.logistica, nombre: 'Cuadro de mando logística', cliente: 'TransNorte', color: '#0E7C5B', estado: 'activo', responsableId: M.alejandro, descripcion: 'Power BI sobre SQL de su ERP con alertas de retrasos.', fechaInicio: sumarDias(lunes, -14), fechaFin: sumarDias(lunes, 14), horasPresupuestadas: 60, creadoEl: iso(s2) },
    { id: P.interno, nombre: 'Locodea interno', cliente: 'Locodea', color: '#6B6B6B', estado: 'activo', responsableId: M.jesus, descripcion: 'Web, comercial, administración y esta misma app.', fechaInicio: null, fechaFin: null, horasPresupuestadas: null, creadoEl: iso(s3) },
  ]

  const semanas: Semana[] = [
    { id: `w-${s3}`, inicio: s3 },
    { id: `w-${s2}`, inicio: s2 },
    { id: `w-${s1}`, inicio: s1 },
    { id: `w-${s0}`, inicio: s0 },
  ]

  let orden = 0
  const obj = (semana: string, responsableId: string, proyectoId: string | null, titulo: string, estado: Objetivo['estado'], prioridad: Objetivo['prioridad'] = 'media', extra: Partial<Objetivo> = {}): Objetivo => ({
    id: `o-${semana}-${orden}`,
    semanaId: `w-${semana}`,
    proyectoId,
    responsableId,
    titulo,
    descripcion: '',
    prioridad,
    estado,
    orden: orden++,
    cumplidoEl: estado === 'cumplido' ? iso(sumarDias(semana, 4), 17) : null,
    creadoEl: iso(semana, 8),
    ...extra,
  })

  const objetivos: Objetivo[] = [
    // semana -3
    obj(s3, M.jesus, P.ortoalresa, 'Modelo de datos del portal aprobado por el cliente', 'cumplido', 'alta'),
    obj(s3, M.jesus, P.interno, 'Publicar la web de Locodea', 'pendiente', 'baja'),
    obj(s3, M.marco, P.clinica, 'Prototipo navegable de la app de citas', 'cumplido', 'alta'),
    obj(s3, M.marco, P.clinica, 'Definir flujo de recordatorios', 'cumplido'),
    obj(s3, M.alejandro, P.interno, 'Plantilla de propuesta comercial', 'cumplido'),
    // semana -2
    obj(s2, M.jesus, P.ortoalresa, 'Pantalla de pedido con líneas y validación de stock', 'cumplido', 'alta'),
    obj(s2, M.jesus, P.ortoalresa, 'Seguridad por distribuidor (tablas y roles)', 'pendiente', 'alta'),
    obj(s2, M.marco, P.clinica, 'Formulario de cita y agenda del profesional', 'cumplido', 'alta'),
    obj(s2, M.alejandro, P.logistica, 'Conexión a SQL y modelo en Power BI', 'cumplido', 'alta'),
    obj(s2, M.alejandro, P.logistica, 'Primera página de KPIs de entregas', 'cumplido'),
    // semana -1
    obj(s1, M.jesus, P.ortoalresa, 'Seguridad por distribuidor (tablas y roles)', 'cumplido', 'alta'),
    obj(s1, M.jesus, P.interno, 'Publicar la web de Locodea', 'pendiente', 'baja'),
    obj(s1, M.marco, P.clinica, 'Flujo de recordatorio por WhatsApp funcionando en pruebas', 'cumplido', 'alta'),
    obj(s1, M.marco, P.clinica, 'Sesión de validación con la clínica', 'pendiente', 'media'),
    obj(s1, M.alejandro, P.logistica, 'Alertas de retraso por correo', 'cumplido', 'alta'),
    obj(s1, M.alejandro, P.logistica, 'Página de rutas y conductores', 'cumplido'),
    // semana actual (propuesta enviada, pendiente de revisión)
    obj(s0, M.jesus, P.ortoalresa, 'Consulta de estado de pedido para el distribuidor', 'pendiente', 'alta'),
    obj(s0, M.jesus, P.ortoalresa, 'Carga inicial de artículos desde Business Central', 'pendiente', 'alta'),
    obj(s0, M.jesus, P.interno, 'Cerrar textos y publicar la web', 'pendiente', 'baja'),
    obj(s0, M.marco, P.clinica, 'Sesión de validación con la clínica y lista de cambios', 'pendiente', 'alta'),
    obj(s0, M.marco, P.clinica, 'Panel del recepcionista', 'pendiente', 'media'),
    obj(s0, M.alejandro, P.logistica, 'Entrega de la v1 del cuadro de mando', 'pendiente', 'alta'),
    obj(s0, M.alejandro, P.interno, 'Preparar propuesta para nuevo lead (Bodegas Ferrer)', 'pendiente', 'media'),
  ]
  const o = (i: number) => objetivos[i].id

  let ot = 0
  const tarea = (titulo: string, asignadoId: string | null, proyectoId: string | null, estado: Tarea['estado'], extra: Partial<Tarea> = {}): Tarea => ({
    id: `t-${ot}`,
    titulo,
    descripcion: '',
    proyectoId,
    objetivoId: null,
    asignadoId,
    creadoPorId: asignadoId ?? M.jesus,
    estado,
    prioridad: 'media',
    inicio: null,
    vence: null,
    padreId: null,
    estimadoH: null,
    realH: null,
    orden: ot,
    ordenTodo: ot++,
    miDia: false,
    importante: false,
    personal: false,
    etiquetas: [],
    checklist: [],
    creadoEl: iso(s1, 9),
    completadoEl: estado === 'hecha' ? iso(sumarDias(s0, -2), 16) : null,
    ...extra,
  })
  const conInicio = (t: Tarea): Tarea => t.vence && !t.inicio
    ? { ...t, inicio: sumarDias(t.vence, -Math.max(1, Math.ceil((t.estimadoH ?? 2) / 3))) }
    : t

  const tareas: Tarea[] = [
    // Ortoalresa · Jesús
    tarea('Vista de pedidos del distribuidor en Power Pages', M.jesus, P.ortoalresa, 'en_curso', { objetivoId: o(16), prioridad: 'alta', vence: sumarDias(H, 2), estimadoH: 6, realH: 3, miDia: true, etiquetas: ['Power Pages'], checklist: [{ id: 'c1', texto: 'Lista con filtros', hecho: true }, { id: 'c2', texto: 'Detalle con líneas', hecho: false }, { id: 'c3', texto: 'Permisos de tabla', hecho: false }] }),
    tarea('Estados de pedido: mapeo con Business Central', M.jesus, P.ortoalresa, 'pendiente', { objetivoId: o(16), prioridad: 'alta', vence: sumarDias(H, 3), estimadoH: 3, etiquetas: ['BC', 'Integración'] }),
    tarea('Flujo de sincronización de artículos BC → Dataverse', M.jesus, P.ortoalresa, 'pendiente', { objetivoId: o(17), prioridad: 'alta', vence: sumarDias(H, 4), estimadoH: 8, etiquetas: ['Power Automate', 'BC'] }),
    tarea('Probar carga de 1.500 artículos', M.jesus, P.ortoalresa, 'pendiente', { objetivoId: o(17), estimadoH: 2, vence: sumarDias(H, 4) }),
    tarea('Roles de seguridad por distribuidor', M.jesus, P.ortoalresa, 'hecha', { objetivoId: o(10), prioridad: 'alta', estimadoH: 5, realH: 7, completadoEl: iso(H, 17) }),
    tarea('Documentar modelo de datos del portal', M.jesus, P.ortoalresa, 'revision', { estimadoH: 2, realH: 2, vence: sumarDias(H, 1) }),
    // Interno · Jesús
    tarea('Textos del apartado de servicios de la web', M.jesus, P.interno, 'bloqueada', { objetivoId: o(18), prioridad: 'baja', vence: sumarDias(H, -2), estimadoH: 2, descripcion: 'Esperando la versión revisada de Marco.' }),
    tarea('Publicar web en el dominio', M.jesus, P.interno, 'pendiente', { objetivoId: o(18), prioridad: 'baja', estimadoH: 1 }),
    // Clínica · Marco
    tarea('Preparar demo para la sesión de validación', M.marco, P.clinica, 'en_curso', { objetivoId: o(19), prioridad: 'alta', vence: sumarDias(H, 1), estimadoH: 3, realH: 1, miDia: true, importante: true }),
    tarea('Recoger lista de cambios tras la sesión', M.marco, P.clinica, 'pendiente', { objetivoId: o(19), prioridad: 'alta', vence: sumarDias(H, 2), estimadoH: 1 }),
    tarea('Pantalla de agenda del recepcionista', M.marco, P.clinica, 'pendiente', { objetivoId: o(20), estimadoH: 6, vence: sumarDias(H, 4), etiquetas: ['Canvas'] }),
    tarea('Vista de citas del día con filtros', M.marco, P.clinica, 'pendiente', { objetivoId: o(20), estimadoH: 3 }),
    tarea('Flujo de recordatorio WhatsApp', M.marco, P.clinica, 'hecha', { objetivoId: o(12), prioridad: 'alta', estimadoH: 6, realH: 5, completadoEl: iso(sumarDias(s1, 2), 12), etiquetas: ['Power Automate'] }),
    tarea('Revisar textos de la web de Locodea', M.marco, P.interno, 'en_curso', { prioridad: 'baja', vence: sumarDias(H, 0), estimadoH: 1, miDia: true }),
    // Logística · Alejandro
    tarea('Cerrar página de rutas y pulir formato', M.alejandro, P.logistica, 'en_curso', { objetivoId: o(21), prioridad: 'alta', vence: sumarDias(H, 2), estimadoH: 4, realH: 2, miDia: true, etiquetas: ['Power BI'] }),
    tarea('Publicar en el workspace del cliente y dar permisos', M.alejandro, P.logistica, 'pendiente', { objetivoId: o(21), prioridad: 'alta', vence: sumarDias(H, 3), estimadoH: 1 }),
    tarea('Sesión de entrega con TransNorte', M.alejandro, P.logistica, 'pendiente', { objetivoId: o(21), prioridad: 'alta', vence: sumarDias(H, 4), estimadoH: 2, importante: true }),
    tarea('Alertas de retraso por correo', M.alejandro, P.logistica, 'hecha', { objetivoId: o(14), estimadoH: 4, realH: 4, completadoEl: iso(sumarDias(s1, 1), 18) }),
    tarea('Borrador de propuesta Bodegas Ferrer', M.alejandro, P.interno, 'pendiente', { objetivoId: o(22), estimadoH: 3, vence: sumarDias(H, 4), etiquetas: ['Comercial'] }),
    tarea('Llamar a Bodegas Ferrer para cerrar alcance', M.alejandro, P.interno, 'pendiente', { objetivoId: o(22), estimadoH: 1, vence: sumarDias(H, 1), miDia: true }),
    // Sin asignar
    tarea('Elegir herramienta de facturación para Locodea', null, P.interno, 'pendiente', { prioridad: 'baja', estimadoH: 2 }),
    // Personales
    tarea('Renovar certificado del dominio', M.jesus, null, 'pendiente', { personal: true, vence: sumarDias(H, 5), miDia: false }),
    tarea('Leer novedades release wave 2', M.jesus, null, 'pendiente', { personal: true, importante: true }),
    // Subtareas del flujo de sincronización (t-2)
    tarea('Trigger y paginación de la API de BC', M.jesus, P.ortoalresa, 'hecha', { padreId: 't-2', estimadoH: 2, realH: 2, completadoEl: iso(H, 12) }),
    tarea('Mapeo de campos artículo → loc_producto', M.jesus, P.ortoalresa, 'en_curso', { padreId: 't-2', estimadoH: 3, vence: sumarDias(H, 2) }),
    tarea('Manejo de errores y reintentos', M.jesus, P.ortoalresa, 'pendiente', { padreId: 't-2', estimadoH: 2, vence: sumarDias(H, 4) }),
    // Subtareas de la sesión de entrega (t-16)
    tarea('Preparar guion de la demo', M.alejandro, P.logistica, 'pendiente', { padreId: 't-16', estimadoH: 1, vence: sumarDias(H, 3) }),
    tarea('Enviar convocatoria a TransNorte', M.alejandro, P.logistica, 'hecha', { padreId: 't-16', estimadoH: 0.5, realH: 0.5, completadoEl: iso(sumarDias(H, -1), 10) }),
  ].map(conInicio)

  const vistas: Vista[] = [
    { id: 'v-tablero', nombre: 'Tablero del equipo', tipo: 'tablero', miembroId: null, filtros: { ...FILTROS_VACIOS }, agrupar: 'estado', ordenar: 'orden', ordenDesc: false, columnas: ['proyecto', 'asignado', 'estado', 'prioridad', 'vence'], escala: 'semana', esPredeterminada: true, creadoEl: iso(s3) },
    { id: 'v-lista', nombre: 'Lista por proyecto', tipo: 'lista', miembroId: null, filtros: { ...FILTROS_VACIOS, ocultarHechas: true }, agrupar: 'proyecto', ordenar: 'vence', ordenDesc: false, columnas: ['asignado', 'estado', 'prioridad', 'vence', 'subtareas'], escala: 'semana', esPredeterminada: false, creadoEl: iso(s3) },
    { id: 'v-gantt', nombre: 'Planificación (Gantt)', tipo: 'gantt', miembroId: null, filtros: { ...FILTROS_VACIOS }, agrupar: 'proyecto', ordenar: 'vence', ordenDesc: false, columnas: [], escala: 'dia', esPredeterminada: false, creadoEl: iso(s3) },
    { id: 'v-cal', nombre: 'Calendario de entregas', tipo: 'calendario', miembroId: null, filtros: { ...FILTROS_VACIOS }, agrupar: 'ninguno', ordenar: 'vence', ordenDesc: false, columnas: [], escala: 'mes', esPredeterminada: false, creadoEl: iso(s3) },
  ]

  const actividad: Actividad[] = [
    { id: 'a-1', entidad: 'semana', entidadId: `w-${s0}`, autorId: M.jesus, fecha: iso(s0, 8), tipo: 'cambio', texto: 'Envió la propuesta de objetivos de la semana.' },
    { id: 'a-2', entidad: 'objetivo', entidadId: o(16), autorId: M.jesus, fecha: iso(s0, 9), tipo: 'cambio', texto: 'Aceptó el objetivo.' },
    { id: 'a-3', entidad: 'objetivo', entidadId: o(19), autorId: M.jesus, fecha: iso(s0, 9), tipo: 'cambio', texto: 'Aceptó el objetivo.' },
    { id: 'a-4', entidad: 'objetivo', entidadId: o(21), autorId: M.jesus, fecha: iso(s0, 9), tipo: 'cambio', texto: 'Aceptó el objetivo.' },
    { id: 'a-5', entidad: 'tarea', entidadId: 't-0', autorId: M.marco, fecha: iso(s0, 10), tipo: 'comentario', texto: '¿Metemos también el filtro por fecha de entrega? El cliente lo pidió en la última reunión.' },
    { id: 'a-6', entidad: 'tarea', entidadId: 't-0', autorId: M.jesus, fecha: iso(s0, 10), tipo: 'comentario', texto: 'Sí, lo añado a la lista con filtros.' },
    { id: 'a-7', entidad: 'tarea', entidadId: 't-6', autorId: M.jesus, fecha: iso(s0, 11), tipo: 'cambio', texto: 'Marcó la tarea como bloqueada.' },
  ]

  return { miembros, proyectos, semanas, objetivos, tareas, actividad, vistas, reuniones: [] }
}
