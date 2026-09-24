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

// ─────────────────────────────────────────────── contenido de redes

export type CanalContenido = 'youtube' | 'linkedin' | 'instagram' | 'tiktok' | 'blog' | 'newsletter' | 'x'
export type EstadoContenido = 'idea' | 'guion' | 'produccion' | 'listo' | 'publicado'

/** Una pieza de contenido: un vídeo, un post, una newsletter. */
export interface Contenido {
  id: string
  titulo: string
  canal: CanalContenido
  estado: EstadoContenido
  /** Día en que se publica o se quiere publicar. Vacío = todavía sin fecha. */
  fecha: string | null
  /** Guion, ideas, enlaces de referencia. */
  notas: string
  /** URL de la pieza ya publicada. */
  enlace: string
  responsableId: string | null
  proyectoId: string | null
  creadoEl: string
}

export const ETIQUETA_CANAL: Record<CanalContenido, string> = {
  youtube: 'YouTube',
  linkedin: 'LinkedIn',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  blog: 'Blog',
  newsletter: 'Newsletter',
  x: 'X',
}

/** Color de cada canal, dentro de la paleta Bronce. */
export const COLOR_CANAL: Record<CanalContenido, string> = {
  youtube: '#C4302B',
  linkedin: '#0A66C2',
  instagram: '#C13584',
  tiktok: '#1B1816',
  blog: '#9D6743',
  newsletter: '#0E7C5B',
  x: '#4A4340',
}

export const ETIQUETA_ESTADO_CONTENIDO: Record<EstadoContenido, string> = {
  idea: 'Idea',
  guion: 'Guion',
  produccion: 'Producción',
  listo: 'Listo',
  publicado: 'Publicado',
}

/** Orden natural del avance, para recorrerlo con un clic. */
export const ORDEN_ESTADOS_CONTENIDO: EstadoContenido[] = ['idea', 'guion', 'produccion', 'listo', 'publicado']

export const CANALES: CanalContenido[] = ['youtube', 'linkedin', 'instagram', 'tiktok', 'blog', 'newsletter', 'x']

// ─────────────────────────────────────────────── skills y agentes de IA

export type TipoRecursoIA = 'skill' | 'agente' | 'prompt' | 'flujo'
export type PlataformaIA = 'claude' | 'copilot_studio' | 'copilot_m365' | 'chatgpt' | 'power_automate' | 'otra'
export type EstadoRecursoIA = 'idea' | 'desarrollo' | 'uso' | 'retirado'

/**
 * Una skill, un agente, un prompt o un flujo de IA que el equipo ha hecho o
 * usa. El catálogo existe para que nadie rehaga lo que ya existe: qué hace,
 * cómo se invoca, dónde vive y a quién preguntar.
 */
export interface RecursoIA {
  id: string
  nombre: string
  tipo: TipoRecursoIA
  plataforma: PlataformaIA
  estado: EstadoRecursoIA
  /** Qué hace y cuándo conviene usarlo. */
  descripcion: string
  /** Cómo se invoca: comando, disparador, frase de ejemplo. */
  comoUsar: string
  /** Dónde vive: ruta de la skill, URL del agente, repositorio. */
  enlace: string
  responsableId: string | null
  proyectoId: string | null
  creadoEl: string
}

export const ETIQUETA_TIPO_IA: Record<TipoRecursoIA, string> = {
  skill: 'Skill', agente: 'Agente', prompt: 'Prompt', flujo: 'Flujo',
}

export const ETIQUETA_PLATAFORMA_IA: Record<PlataformaIA, string> = {
  claude: 'Claude',
  copilot_studio: 'Copilot Studio',
  copilot_m365: 'Microsoft 365 Copilot',
  chatgpt: 'ChatGPT',
  power_automate: 'Power Automate',
  otra: 'Otra',
}

export const ETIQUETA_ESTADO_IA: Record<EstadoRecursoIA, string> = {
  idea: 'Idea', desarrollo: 'En desarrollo', uso: 'En uso', retirado: 'Retirado',
}

export const TIPOS_IA: TipoRecursoIA[] = ['skill', 'agente', 'prompt', 'flujo']
export const PLATAFORMAS_IA: PlataformaIA[] = ['claude', 'copilot_studio', 'copilot_m365', 'chatgpt', 'power_automate', 'otra']
export const ESTADOS_IA: EstadoRecursoIA[] = ['idea', 'desarrollo', 'uso', 'retirado']
