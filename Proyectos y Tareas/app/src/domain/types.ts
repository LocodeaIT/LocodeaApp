/**
 * Modelo de dominio de Locodea: objetivos semanales, tareas y To Do.
 *
 * Todo lo que ve la UI pasa por estos tipos. La capa de datos (local o
 * Dataverse) se encarga de traducir a/desde su almacenamiento.
 */

export type Rol = 'socio' | 'colaborador'

export interface Miembro {
  id: string
  nombre: string
  iniciales: string
  email: string
  /** Color de avatar/etiquetas, en hex. */
  color: string
  rol: Rol
  activo: boolean
}

export type EstadoProyecto = 'activo' | 'pausado' | 'cerrado'

export interface Proyecto {
  id: string
  nombre: string
  cliente: string
  color: string
  estado: EstadoProyecto
  responsableId: string | null
  descripcion: string
  fechaInicio: string | null
  fechaFin: string | null
  /** Horas vendidas/presupuestadas. Enlace futuro con el CRM financiero. */
  horasPresupuestadas: number | null
  creadoEl: string
}

/**
 * La semana es solo el contenedor temporal de los objetivos: el lunes que la
 * identifica. No tiene ciclo de aprobación; cada quien añade objetivos y los
 * marca cuando los cumple.
 */
export interface Semana {
  id: string
  /** Lunes de la semana, en formato YYYY-MM-DD. Identifica la semana. */
  inicio: string
}

export type Prioridad = 'alta' | 'media' | 'baja'

export type EstadoObjetivo = 'pendiente' | 'cumplido'

export interface Objetivo {
  id: string
  semanaId: string
  proyectoId: string | null
  /** null = objetivo general del equipo, sin duenno concreto. */
  responsableId: string | null
  titulo: string
  descripcion: string
  prioridad: Prioridad
  estado: EstadoObjetivo
  orden: number
  /** Cuándo se marcó como cumplido. */
  cumplidoEl: string | null
  creadoEl: string
}

export type EstadoTarea = 'pendiente' | 'en_curso' | 'bloqueada' | 'revision' | 'hecha'

export interface ItemChecklist {
  id: string
  texto: string
  hecho: boolean
}

export interface Tarea {
  id: string
  titulo: string
  descripcion: string
  proyectoId: string | null
  objetivoId: string | null
  asignadoId: string | null
  creadoPorId: string
  estado: EstadoTarea
  prioridad: Prioridad
  /** Fecha de inicio prevista YYYY-MM-DD (para Gantt y calendario). */
  inicio: string | null
  /** Fecha de vencimiento YYYY-MM-DD. */
  vence: string | null
  /** Tarea padre: si tiene valor, esta es una subtarea. */
  padreId: string | null
  estimadoH: number | null
  realH: number | null
  /** Posición dentro de su columna del tablero. */
  orden: number
  /** Posición dentro de la lista «Mi día» / To Do del asignado. */
  ordenTodo: number
  miDia: boolean
  importante: boolean
  /** To Do personal: no cuenta para el proyecto ni para el equipo. */
  personal: boolean
  etiquetas: string[]
  checklist: ItemChecklist[]
  creadoEl: string
  completadoEl: string | null
}

// ─────────────────────────────────────────────── reuniones

export type EstadoReunion = 'pendiente' | 'celebrada' | 'cancelada'
export type EstadoTema = 'pendiente' | 'tratado' | 'aplazado'

/** Un punto del orden del día. Viaja siempre con su reunión. */
export interface TemaReunion {
  id: string
  texto: string
  estado: EstadoTema
  /** Qué se decidió. Es lo que queda cuando la reunión termina. */
  notas: string
}

export interface Reunion {
  id: string
  titulo: string
  /** Fecha y hora de inicio, en ISO. */
  fecha: string
  duracionMin: number
  /** Sala, enlace de Teams o lo que sea. */
  lugar: string
  estado: EstadoReunion
  notas: string
  temas: TemaReunion[]
  asistentesIds: string[]
  proyectoId: string | null
  organizaId: string | null
  /** Id del evento en el calendario de Outlook, si está sincronizada. */
  eventoId: string | null
  creadoEl: string
}

export const ETIQUETA_ESTADO_REUNION: Record<EstadoReunion, string> = {
  pendiente: 'Pendiente',
  celebrada: 'Celebrada',
  cancelada: 'Cancelada',
}

export const ETIQUETA_ESTADO_TEMA: Record<EstadoTema, string> = {
  pendiente: 'Sin tratar',
  tratado: 'Tratado',
  aplazado: 'Aplazado',
}

// ─────────────────────────────────────────────── vistas guardadas

export type TipoVista = 'tablero' | 'lista' | 'calendario' | 'gantt'
export type AgruparPor = 'ninguno' | 'estado' | 'proyecto' | 'asignado' | 'prioridad' | 'objetivo'
export type OrdenarPor = 'orden' | 'vence' | 'prioridad' | 'titulo' | 'creadoEl'
export type ColumnaLista = 'proyecto' | 'asignado' | 'estado' | 'prioridad' | 'inicio' | 'vence' | 'objetivo' | 'etiquetas' | 'subtareas' | 'creadoEl'

export interface FiltrosVista {
  texto: string
  proyectoId: string | null
  asignadoId: string | null
  estados: EstadoTarea[]
  prioridades: Prioridad[]
  ocultarHechas: boolean
  soloMias: boolean
  mostrarSubtareas: boolean
}

export interface Vista {
  id: string
  nombre: string
  tipo: TipoVista
  /** null = vista compartida por todo el equipo. */
  miembroId: string | null
  filtros: FiltrosVista
  agrupar: AgruparPor
  ordenar: OrdenarPor
  ordenDesc: boolean
  columnas: ColumnaLista[]
  /** Escala del Gantt / calendario. */
  escala: 'dia' | 'semana' | 'mes'
  esPredeterminada: boolean
  creadoEl: string
}

export const FILTROS_VACIOS: FiltrosVista = {
  texto: '', proyectoId: null, asignadoId: null, estados: [], prioridades: [], ocultarHechas: false, soloMias: false, mostrarSubtareas: false,
}

export const COLUMNAS_LISTA: { id: ColumnaLista; nombre: string }[] = [
  { id: 'proyecto', nombre: 'Proyecto' }, { id: 'asignado', nombre: 'Asignada a' }, { id: 'estado', nombre: 'Estado' },
  { id: 'prioridad', nombre: 'Prioridad' }, { id: 'inicio', nombre: 'Inicio' }, { id: 'vence', nombre: 'Vence' },
  { id: 'objetivo', nombre: 'Objetivo' },
  { id: 'etiquetas', nombre: 'Etiquetas' }, { id: 'subtareas', nombre: 'Subtareas' }, { id: 'creadoEl', nombre: 'Creada' },
]

export type EntidadActividad = 'objetivo' | 'tarea' | 'semana' | 'proyecto'

export interface Actividad {
  id: string
  entidad: EntidadActividad
  entidadId: string
  autorId: string
  fecha: string
  tipo: 'comentario' | 'cambio'
  texto: string
}

// ─────────────────────────────────────────────── etiquetas y catálogos

export const ETIQUETA_ESTADO_TAREA: Record<EstadoTarea, string> = {
  pendiente: 'Por hacer',
  en_curso: 'En curso',
  bloqueada: 'Bloqueada',
  revision: 'En revisión',
  hecha: 'Hecha',
}

export const ORDEN_ESTADOS_TAREA: EstadoTarea[] = ['pendiente', 'en_curso', 'bloqueada', 'revision', 'hecha']

export const ETIQUETA_ESTADO_OBJETIVO: Record<EstadoObjetivo, string> = {
  pendiente: 'Pendiente',
  cumplido: 'Cumplido',
}

export const ETIQUETA_PRIORIDAD: Record<Prioridad, string> = {
  alta: 'Alta',
  media: 'Media',
  baja: 'Baja',
}

export const ETIQUETA_ESTADO_PROYECTO: Record<EstadoProyecto, string> = {
  activo: 'Activo',
  pausado: 'En pausa',
  cerrado: 'Cerrado',
}
