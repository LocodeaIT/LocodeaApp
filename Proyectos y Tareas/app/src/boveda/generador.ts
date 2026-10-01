/**
 * Generador de contraseñas y medidor de fortaleza.
 *
 * El generador usa crypto.getRandomValues con muestreo por rechazo (sin el
 * sesgo de `% n`) y garantiza al menos un carácter de cada grupo elegido.
 * El medidor estima la entropía por longitud y juego de caracteres y la
 * castiga por patrones típicos: contraseñas conocidas, secuencias,
 * repeticiones o solo números.
 */

export interface OpcionesGenerador {
  longitud: number
  mayusculas: boolean
  minusculas: boolean
  numeros: boolean
  simbolos: boolean
  /** Sin I, l, 1, O, 0… para poder dictarla o copiarla a mano. */
  sinAmbiguos: boolean
}

export const OPCIONES_GENERADOR: OpcionesGenerador = { longitud: 20, mayusculas: true, minusculas: true, numeros: true, simbolos: true, sinAmbiguos: true }

const GRUPOS = {
  mayusculas: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  minusculas: 'abcdefghijklmnopqrstuvwxyz',
  numeros: '0123456789',
  simbolos: '!@#$%&*-_=+?.:;,/~^()[]{}',
}
const AMBIGUOS = new Set('Il1O0o|`\'"'.split(''))

/** Entero uniforme en [0, n) sin sesgo. */
function aleatorioHasta(n: number): number {
  const limite = Math.floor(0x1_0000_0000 / n) * n
  const caja = new Uint32Array(1)
  for (;;) {
    crypto.getRandomValues(caja)
    if (caja[0] < limite) return caja[0] % n
  }
}

export function generarContrasena(o: OpcionesGenerador): string {
  const elegidos = (Object.keys(GRUPOS) as (keyof typeof GRUPOS)[])
    .filter(g => o[g])
    .map(g => (o.sinAmbiguos ? [...GRUPOS[g]].filter(c => !AMBIGUOS.has(c)).join('') : GRUPOS[g]))
  const grupos = elegidos.length ? elegidos : [GRUPOS.minusculas]
  const todos = grupos.join('')
  const longitud = Math.max(grupos.length, Math.min(128, Math.round(o.longitud)))
  // uno de cada grupo y el resto de cualquiera; después se baraja (Fisher-Yates)
  const r = grupos.map(g => g[aleatorioHasta(g.length)])
  while (r.length < longitud) r.push(todos[aleatorioHasta(todos.length)])
  for (let i = r.length - 1; i > 0; i--) {
    const j = aleatorioHasta(i + 1)
    ;[r[i], r[j]] = [r[j], r[i]]
  }
  return r.join('')
}

// ─────────────────────────────────────────────── fortaleza

export type NivelFortaleza = 0 | 1 | 2 | 3 | 4

export interface Fortaleza {
  nivel: NivelFortaleza
  etiqueta: string
  /** Entropía estimada, en bits. */
  bits: number
  consejo: string | null
}

const ETIQUETAS: Record<NivelFortaleza, string> = { 0: 'Muy débil', 1: 'Débil', 2: 'Aceptable', 3: 'Fuerte', 4: 'Muy fuerte' }

/** Las más usadas (en general y en español): si la contraseña es una de ellas, da igual su longitud. */
const CONOCIDAS = new Set([
  '123456', '1234567', '12345678', '123456789', '1234567890', '12345', '1234', '111111', '000000', '123123', '654321', '666666', '121212',
  'password', 'password1', 'passw0rd', 'qwerty', 'qwerty123', 'qwertyuiop', 'asdfgh', 'abc123', 'iloveyou', 'admin', 'admin123',
  'administrador', 'welcome', 'letmein', 'monkey', 'dragon', 'football', 'baseball', 'sunshine', 'princess', 'master', 'superman',
  'contraseña', 'contrasena', 'clave', 'clave123', 'hola', 'hola123', 'holahola', 'tequiero', 'teamo', 'barcelona', 'realmadrid',
  'madrid', 'españa', 'espana', 'futbol', 'cariño', 'carino', 'mariposa', 'princesa', 'estrella', 'locodea', 'locodea123', 'microsoft',
  'powerapps', 'changeme', 'cambiame', 'secreto', 'secret', 'test', 'test123', 'prueba', 'prueba123', 'usuario', 'user',
])

const SECUENCIAS = ['abcdefghijklmnopqrstuvwxyz', '0123456789', 'qwertyuiop', 'asdfghjklñ', 'zxcvbnm']

function tamanoJuego(p: string): number {
  let n = 0
  if (/[a-z]/.test(p)) n += 26
  if (/[A-Z]/.test(p)) n += 26
  if (/[0-9]/.test(p)) n += 10
  if (/[^a-zA-Z0-9]/.test(p)) n += 33
  return n || 1
}

export function fortaleza(p: string): Fortaleza {
  if (!p) return { nivel: 0, etiqueta: 'Vacía', bits: 0, consejo: null }
  const minus = p.toLowerCase()
  const sinNumerosFinales = minus.replace(/[0-9!.]+$/, '')
  if (CONOCIDAS.has(minus) || CONOCIDAS.has(sinNumerosFinales)) {
    return { nivel: 0, etiqueta: ETIQUETAS[0], bits: 0, consejo: 'Es de las contraseñas más usadas: se adivina en segundos.' }
  }

  let bits = p.length * Math.log2(tamanoJuego(p))
  let consejo: string | null = null

  // caracteres repetidos seguidos (aaaa, 1111)
  const repetidos = (p.match(/(.)\1{2,}/g) ?? []).reduce((s, m) => s + m.length - 1, 0)
  if (repetidos) { bits -= repetidos * 3; consejo = 'Evita repetir el mismo carácter.' }

  // secuencias de teclado o alfabeto de 4 o más (abcd, 1234, qwer)
  let enSecuencia = 0
  for (const s of SECUENCIAS) {
    for (let largo = Math.min(8, minus.length); largo >= 4; largo--) {
      for (let i = 0; i + largo <= s.length; i++) {
        const trozo = s.slice(i, i + largo)
        if (minus.includes(trozo) || minus.includes([...trozo].reverse().join(''))) { enSecuencia = Math.max(enSecuencia, largo); break }
      }
    }
  }
  if (enSecuencia) { bits -= enSecuencia * 3; consejo = consejo ?? 'Tiene una secuencia fácil (abcd, 1234, qwer…).' }

  // palabra conocida dentro (Locodea2026!)
  for (const c of CONOCIDAS) {
    if (c.length >= 5 && minus.includes(c)) { bits -= c.length * 3; consejo = consejo ?? `Contiene «${c}», que está en todos los diccionarios.`; break }
  }
  if (/^[0-9]+$/.test(p)) { bits *= 0.7; consejo = consejo ?? 'Solo tiene números.' }

  // palabra + año o + 1–4 números (verano2024, Marta123!): lo primero que prueba cualquier ataque
  if (/^[a-záéíóúüñ]+[._-]?[0-9]{1,4}[!.?*#$@]{0,2}$/i.test(p)) { bits = Math.min(bits, 34); consejo = consejo ?? 'Palabra seguida de un año o unos números: es lo primero que se prueba.' }

  bits = Math.max(0, Math.round(bits))
  const nivel: NivelFortaleza = bits < 28 ? 0 : bits < 40 ? 1 : bits < 60 ? 2 : bits < 80 ? 3 : 4
  if (!consejo && nivel < 3) consejo = p.length < 12 ? 'Usa al menos 12 caracteres.' : 'Mezcla mayúsculas, números y símbolos.'
  return { nivel, etiqueta: ETIQUETAS[nivel], bits, consejo }
}

/** La maestra protege todo lo demás: se pide «fuerte» y 12 caracteres como mínimo. */
export function maestraValida(p: string): string | null {
  if (p.length < 12) return 'La contraseña maestra necesita al menos 12 caracteres.'
  const f = fortaleza(p)
  if (f.nivel < 3) return f.consejo ?? 'La contraseña maestra es demasiado débil.'
  return null
}
