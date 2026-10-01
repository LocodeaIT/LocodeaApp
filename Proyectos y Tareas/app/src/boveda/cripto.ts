/**
 * Criptografía de la Bóveda, toda con Web Crypto (la del navegador, sin
 * librerías):
 *
 *   contraseña maestra ──PBKDF2-SHA256 (600 000 vueltas, sal de 16 bytes)──▶ clave maestra
 *   clave maestra ──AES-256-GCM (envolver)──▶ clave de la bóveda (aleatoria, 256 bits)
 *   clave de la bóveda ──AES-256-GCM──▶ cada elemento (iv aleatorio de 12 bytes)
 *
 * - La contraseña maestra y las claves no salen nunca del navegador; a
 *   Dataverse solo llegan la sal, la clave envuelta y los elementos cifrados.
 * - Las claves se importan como no extraíbles: ni el propio código puede
 *   leerlas una vez abierta la bóveda.
 * - Cada cifrado lleva como dato asociado (AAD) el id de la fila y el de su
 *   bóveda: un elemento copiado a otra fila o a otra bóveda no se descifra.
 * - Cambiar la contraseña maestra solo vuelve a envolver la clave de la
 *   bóveda; los elementos no se tocan.
 * - Una contraseña equivocada hace fallar la etiqueta de autenticación de
 *   AES-GCM al desenvolver: no hace falta guardar ningún «verificador».
 */

export const ALGORITMO = 'PBKDF2-SHA256/AES-256-GCM/v1'
/** Recomendación de OWASP (2023) para PBKDF2-HMAC-SHA256. */
export const ITERACIONES = 600_000
const VERSION_ELEMENTO = 'v1'

const codificar = new TextEncoder()
const decodificar = new TextDecoder()

export class ContrasenaIncorrecta extends Error {
  constructor() { super('La contraseña maestra no es correcta') }
}

// ─────────────────────────────────────────────── base64 y bytes

export function aBase64(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}

export function deBase64(texto: string): Uint8Array<ArrayBuffer> {
  const s = atob(texto)
  const r = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) r[i] = s.charCodeAt(i)
  return r
}

export function aleatorios(n: number): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(n))
}

function unir(a: Uint8Array, b: Uint8Array): Uint8Array<ArrayBuffer> {
  const r = new Uint8Array(a.length + b.length)
  r.set(a, 0)
  r.set(b, a.length)
  return r
}

/** ¿Hay Web Crypto? Solo existe en contextos seguros (https o localhost). */
export function criptoDisponible(): boolean {
  return typeof crypto !== 'undefined' && !!crypto.subtle
}

// ─────────────────────────────────────────────── claves

const aadBoveda = (bovedaId: string) => codificar.encode(`locodea-boveda:${bovedaId}`)
const aadElemento = (id: string, bovedaId: string) => codificar.encode(`locodea-secreto:${id}|${bovedaId}`)

async function claveMaestra(contrasena: string, sal: Uint8Array<ArrayBuffer>, iteraciones: number): Promise<CryptoKey> {
  // NFKC: la misma contraseña escrita en otro teclado (tildes compuestas) da la misma clave
  const material = await crypto.subtle.importKey('raw', codificar.encode(contrasena.normalize('NFKC')), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: sal, iterations: iteraciones },
    material, { name: 'AES-GCM', length: 256 }, false, ['wrapKey', 'unwrapKey'],
  )
}

export interface CabeceraBoveda {
  sal: string
  iteraciones: number
  claveEnvuelta: string
  algoritmo: string
}

async function envolver(claveBoveda: CryptoKey, contrasena: string, bovedaId: string): Promise<CabeceraBoveda> {
  const sal = aleatorios(16)
  const maestra = await claveMaestra(contrasena, sal, ITERACIONES)
  const iv = aleatorios(12)
  const envuelta = new Uint8Array(await crypto.subtle.wrapKey('raw', claveBoveda, maestra, { name: 'AES-GCM', iv, additionalData: aadBoveda(bovedaId) }))
  return { sal: aBase64(sal), iteraciones: ITERACIONES, claveEnvuelta: aBase64(unir(iv, envuelta)), algoritmo: ALGORITMO }
}

async function desenvolver(cabecera: CabeceraBoveda, contrasena: string, bovedaId: string, extraible: boolean): Promise<CryptoKey> {
  if (cabecera.algoritmo !== ALGORITMO) throw new Error(`Bóveda con un cifrado desconocido (${cabecera.algoritmo})`)
  const maestra = await claveMaestra(contrasena, deBase64(cabecera.sal), cabecera.iteraciones)
  const todo = deBase64(cabecera.claveEnvuelta)
  try {
    return await crypto.subtle.unwrapKey(
      'raw', todo.subarray(12), maestra, { name: 'AES-GCM', iv: todo.subarray(0, 12), additionalData: aadBoveda(bovedaId) },
      { name: 'AES-GCM', length: 256 }, extraible, ['encrypt', 'decrypt'],
    )
  } catch {
    throw new ContrasenaIncorrecta()
  }
}

/** Crea la clave de una bóveda nueva y la envuelve con la contraseña maestra. */
export async function crearClaves(contrasena: string, bovedaId: string): Promise<{ cabecera: CabeceraBoveda; clave: CryptoKey }> {
  const temporal = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
  const cabecera = await envolver(temporal, contrasena, bovedaId)
  // se vuelve a abrir como no extraíble: la que queda en memoria no se puede exportar
  const clave = await desenvolver(cabecera, contrasena, bovedaId, false)
  return { cabecera, clave }
}

/** Abre la bóveda. Lanza ContrasenaIncorrecta si la contraseña no es la buena. */
export function abrirClave(cabecera: CabeceraBoveda, contrasena: string, bovedaId: string): Promise<CryptoKey> {
  return desenvolver(cabecera, contrasena, bovedaId, false)
}

/** Nueva cabecera con otra contraseña maestra; la clave de la bóveda (y los elementos) no cambian. */
export async function cambiarContrasenaMaestra(cabecera: CabeceraBoveda, actual: string, nueva: string, bovedaId: string): Promise<CabeceraBoveda> {
  const clave = await desenvolver(cabecera, actual, bovedaId, true)
  return envolver(clave, nueva, bovedaId)
}

// ─────────────────────────────────────────────── elementos

export async function cifrar(clave: CryptoKey, contenido: unknown, id: string, bovedaId: string): Promise<string> {
  const iv = aleatorios(12)
  const cifrado = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: aadElemento(id, bovedaId) }, clave, codificar.encode(JSON.stringify(contenido)),
  ))
  return `${VERSION_ELEMENTO}.${aBase64(iv)}.${aBase64(cifrado)}`
}

export async function descifrar<T>(clave: CryptoKey, datos: string, id: string, bovedaId: string): Promise<T> {
  const [version, iv, cifrado] = datos.split('.')
  if (version !== VERSION_ELEMENTO || !iv || !cifrado) throw new Error('Elemento con un formato desconocido')
  const claro = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: deBase64(iv), additionalData: aadElemento(id, bovedaId) }, clave, deBase64(cifrado))
  return JSON.parse(decodificar.decode(claro)) as T
}
