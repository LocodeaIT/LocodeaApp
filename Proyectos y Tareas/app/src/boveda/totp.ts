/**
 * Códigos de verificación en dos pasos (TOTP, RFC 6238) calculados en el
 * navegador con Web Crypto. Admite el secreto en base32 tal como lo da el
 * servicio o la URI completa `otpauth://totp/...` del código QR.
 */

export interface ConfigTotp {
  secreto: Uint8Array<ArrayBuffer>
  digitos: number
  periodo: number
  algoritmo: 'SHA-1' | 'SHA-256' | 'SHA-512'
}

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

function deBase32(texto: string): Uint8Array<ArrayBuffer> | null {
  const limpio = texto.toUpperCase().replace(/[\s-]/g, '').replace(/=+$/, '')
  if (!limpio || /[^A-Z2-7]/.test(limpio)) return null
  const bytes: number[] = []
  let buffer = 0, bits = 0
  for (const c of limpio) {
    buffer = (buffer << 5) | BASE32.indexOf(c)
    bits += 5
    if (bits >= 8) { bits -= 8; bytes.push((buffer >> bits) & 0xff) }
  }
  return bytes.length ? new Uint8Array(bytes) : null
}

/** Interpreta lo que se haya pegado en el campo. null si no es un secreto válido. */
export function leerTotp(texto: string): ConfigTotp | null {
  const t = texto.trim()
  if (!t) return null
  if (/^otpauth:\/\//i.test(t)) {
    try {
      const u = new URL(t)
      if (u.host.toLowerCase() !== 'totp') return null
      const secreto = deBase32(u.searchParams.get('secret') ?? '')
      if (!secreto) return null
      const alg = (u.searchParams.get('algorithm') ?? 'SHA1').toUpperCase().replace('SHA', 'SHA-')
      return {
        secreto,
        digitos: Number(u.searchParams.get('digits')) || 6,
        periodo: Number(u.searchParams.get('period')) || 30,
        algoritmo: alg === 'SHA-256' || alg === 'SHA-512' ? alg : 'SHA-1',
      }
    } catch {
      return null
    }
  }
  const secreto = deBase32(t)
  return secreto ? { secreto, digitos: 6, periodo: 30, algoritmo: 'SHA-1' } : null
}

export async function codigoTotp(c: ConfigTotp, ahora = Date.now()): Promise<string> {
  const contador = Math.floor(ahora / 1000 / c.periodo)
  const mensaje = new Uint8Array(8)
  new DataView(mensaje.buffer).setUint32(4, contador >>> 0)
  new DataView(mensaje.buffer).setUint32(0, Math.floor(contador / 0x1_0000_0000))
  const clave = await crypto.subtle.importKey('raw', c.secreto, { name: 'HMAC', hash: c.algoritmo }, false, ['sign'])
  const h = new Uint8Array(await crypto.subtle.sign('HMAC', clave, mensaje))
  const o = h[h.length - 1] & 0x0f
  const n = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]
  return String(n % 10 ** c.digitos).padStart(c.digitos, '0')
}

/** Segundos que le quedan al código actual. */
export function segundosRestantes(c: ConfigTotp, ahora = Date.now()): number {
  return c.periodo - (Math.floor(ahora / 1000) % c.periodo)
}
