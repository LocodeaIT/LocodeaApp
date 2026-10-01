/**
 * Modelo de la Bóveda: contraseñas, claves API y notas seguras cifradas en el
 * navegador. A Dataverse solo llega texto cifrado.
 *
 * Hay dos niveles:
 *   - Boveda: la «caja fuerte». Guarda la sal, las iteraciones y la clave de la
 *     bóveda envuelta (cifrada) con la clave que sale de la contraseña maestra.
 *     Una del equipo, compartida, y una personal por miembro.
 *   - SecretoCifrado: cada elemento, tal cual viaja a Dataverse (un único campo
 *     con iv + texto cifrado). Al abrir la bóveda se descifra en un Elemento,
 *     que solo vive en memoria mientras la bóveda está abierta.
 */

export type TipoBoveda = 'equipo' | 'personal'

export interface Boveda {
  id: string
  nombre: string
  tipo: TipoBoveda
  /** Miembro dueño de una bóveda personal; null en la del equipo. */
  propietarioId: string | null
  /** Sal de PBKDF2, en base64. */
  sal: string
  iteraciones: number
  /** iv + clave de la bóveda envuelta con AES-GCM, en base64. */
  claveEnvuelta: string
  /** Versión del esquema criptográfico, por si un día cambia. */
  algoritmo: string
  creadoEl: string
  actualizadoEl?: string | null
}

export interface SecretoCifrado {
  id: string
  bovedaId: string
  /** «v1.<iv>.<cifrado>» en base64: el Elemento entero, cifrado. */
  datos: string
  creadoEl: string
  actualizadoEl?: string | null
}

export type TipoElemento = 'login' | 'api' | 'nota'
export type EntornoApi = '' | 'produccion' | 'pruebas' | 'desarrollo'

export interface CampoExtra {
  id: string
  nombre: string
  valor: string
  /** Se enseña con puntos y se copia sin mostrarlo, como una contraseña. */
  oculto: boolean
}

export interface ContrasenaAnterior {
  valor: string
  /** Hasta cuándo estuvo en uso (ISO). */
  hasta: string
}

/** Un elemento ya descifrado. Nunca se guarda así: se cifra entero. */
export interface Elemento {
  id: string
  bovedaId: string
  creadoEl: string
  actualizadoEl?: string | null
  tipo: TipoElemento
  titulo: string
  /** Contraseña: usuario o correo. */
  usuario: string
  contrasena: string
  url: string
  /** Secreto de la verificación en dos pasos (base32 u otpauth://). */
  totp: string
  /** Clave API: la clave y, si la hay, el secreto que la acompaña. */
  clave: string
  secreto: string
  entorno: EntornoApi
  /** Fecha de caducidad de la clave (YYYY-MM-DD). */
  caduca: string | null
  notas: string
  campos: CampoExtra[]
  etiquetas: string[]
  favorito: boolean
  /** Cuándo se puso la contraseña (o la clave) actual (ISO). */
  cambiadaEl: string | null
  /** Últimas contraseñas o claves, para poder volver atrás. */
  historial: ContrasenaAnterior[]
}

/** Lo que se cifra: el Elemento sin los datos que ya van en la fila. */
export type ContenidoElemento = Omit<Elemento, 'id' | 'bovedaId' | 'creadoEl' | 'actualizadoEl'>

export interface BovedaInstantanea {
  bovedas: Boveda[]
  secretos: SecretoCifrado[]
}

export const BOVEDA_VACIA: BovedaInstantanea = { bovedas: [], secretos: [] }

export const TIPO_ELEMENTO: Record<TipoElemento, string> = { login: 'Contraseña', api: 'Clave API', nota: 'Nota segura' }
export const ENTORNO_API: Record<Exclude<EntornoApi, ''>, string> = { produccion: 'Producción', pruebas: 'Pruebas', desarrollo: 'Desarrollo' }

/** Cuántas contraseñas anteriores se conservan por elemento. */
export const MAX_HISTORIAL = 5

export function elementoVacio(tipo: TipoElemento = 'login'): ContenidoElemento {
  return {
    tipo, titulo: '', usuario: '', contrasena: '', url: '', totp: '', clave: '', secreto: '', entorno: '', caduca: null,
    notas: '', campos: [], etiquetas: [], favorito: false, cambiadaEl: null, historial: [],
  }
}
