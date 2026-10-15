/**
 * Propuestas: los apuntes y posibles proyectos de clientes que van saliendo,
 * desde la primera idea hasta que el cliente dice que sí (y nace un proyecto)
 * o que no. Es el paso previo a la cartera de Proyectos.
 *
 * Cada propuesta lleva un hilo de apuntes del equipo: notas sueltas con fecha
 * y autor, más los cambios de estado, que se apuntan solos.
 */

export type EstadoPropuesta = 'apunte' | 'conversacion' | 'planificacion' | 'enviada' | 'aceptado' | 'descartado'
export type PrioridadPropuesta = 'alta' | 'media' | 'baja'

export interface ApuntePropuesta {
  id: string
  /** ISO con hora. */
  fecha: string
  autorId: string | null
  texto: string
  /** Si el apunte es un cambio de estado, el estado al que pasó. */
  estado?: EstadoPropuesta
}

export interface Propuesta {
  id: string
  titulo: string
  /** Nombre del cliente tal cual (puede no estar todavía en el CRM). */
  cliente: string
  /** Cuenta del CRM, si ya existe. */
  cuentaId: string | null
  contacto: string
  estado: EstadoPropuesta
  prioridad: PrioridadPropuesta
  descripcion: string
  /** Importe estimado en euros. */
  importe: number | null
  /** Probabilidad de que salga, 0–100. */
  probabilidad: number | null
  /** Cuándo esperamos la decisión del cliente (YYYY-MM-DD). */
  fechaPrevista: string | null
  tecnologias: string[]
  responsableId: string | null
  /** El proyecto que nació de la propuesta al aceptarse. */
  proyectoId: string | null
  apuntes: ApuntePropuesta[]
  /** Posición dentro de su columna del tablero. */
  orden: number
  creadoEl: string
  actualizadoEl: string | null
}

export type NuevaPropuesta = Omit<Propuesta, 'id' | 'creadoEl' | 'actualizadoEl'>

/** El orden es el del embudo: de izquierda a derecha en el tablero. */
export const ESTADOS_PROPUESTA: EstadoPropuesta[] = ['apunte', 'conversacion', 'planificacion', 'enviada', 'aceptado', 'descartado']

/** Estados en los que la propuesta sigue viva (ni ganada ni perdida). */
export const ESTADOS_ABIERTOS: EstadoPropuesta[] = ['apunte', 'conversacion', 'planificacion', 'enviada']

export const ETIQUETA_ESTADO_PROPUESTA: Record<EstadoPropuesta, string> = {
  apunte: 'Apunte', conversacion: 'En conversación', planificacion: 'Planificación',
  enviada: 'Propuesta enviada', aceptado: 'Aceptado', descartado: 'Descartado',
}

export const AYUDA_ESTADO_PROPUESTA: Record<EstadoPropuesta, string> = {
  apunte: 'Una idea o algo que comentó el cliente',
  conversacion: 'Hablando con el cliente para entender qué necesita',
  planificacion: 'Preparando alcance, plazos y presupuesto',
  enviada: 'La propuesta está en manos del cliente',
  aceptado: 'El cliente ha dicho que sí',
  descartado: 'No sale, por ahora',
}

/** Probabilidad que se propone al pasar a cada estado si no se ha fijado otra. */
export const PROBABILIDAD_ESTADO: Record<EstadoPropuesta, number> = {
  apunte: 10, conversacion: 25, planificacion: 50, enviada: 70, aceptado: 100, descartado: 0,
}

export const ETIQUETA_PRIORIDAD_PROPUESTA: Record<PrioridadPropuesta, string> = { alta: 'Alta', media: 'Media', baja: 'Baja' }

/** Tecnologías que se sugieren al escribir; se puede poner cualquier otra. */
export const TECNOLOGIAS_SUGERIDAS = [
  'Power Apps', 'Power Automate', 'Power BI', 'Power Pages', 'Copilot Studio', 'Dataverse',
  'Business Central', 'Dynamics 365 Sales', 'SharePoint', 'Azure', 'IA', 'Web',
]

export function propuestaVacia(parcial: Partial<NuevaPropuesta> = {}): NuevaPropuesta {
  return {
    titulo: '', cliente: '', cuentaId: null, contacto: '', estado: 'apunte', prioridad: 'media', descripcion: '',
    importe: null, probabilidad: null, fechaPrevista: null, tecnologias: [], responsableId: null, proyectoId: null,
    apuntes: [], orden: 0, ...parcial,
  }
}

/**
 * Archivo o imagen de una propuesta. Los datos (data URL) no viajan con la
 * lista: se piden al abrirlo, para que el tablero cargue rápido.
 */
export interface AdjuntoPropuesta {
  id: string
  propuestaId: string
  /** El proyecto al que pasó con la propuesta, si se convirtió. */
  proyectoId: string | null
  nombre: string
  /** Tipo MIME: image/jpeg, application/pdf… */
  tipo: string
  /** Bytes del archivo guardado (tras comprimir, si es imagen). */
  tamano: number
  creadoEl: string
}

export const esImagen = (a: Pick<AdjuntoPropuesta, 'tipo'>) => a.tipo.startsWith('image/')
