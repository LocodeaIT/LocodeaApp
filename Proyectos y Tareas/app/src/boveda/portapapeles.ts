/**
 * Copiar secretos al portapapeles y borrarlos solos al cabo de unos segundos,
 * para que una contraseña no se quede ahí esperando a pegarse donde no toca.
 *
 * Dentro de Power Apps la app corre en un iframe y la API del portapapeles
 * puede estar bloqueada: entonces se copia con un textarea temporal.
 */

export const SEGUNDOS_PORTAPAPELES = 30

let temporizador: number | undefined

function copiarConTextarea(texto: string): boolean {
  const t = document.createElement('textarea')
  t.value = texto
  t.setAttribute('readonly', '')
  Object.assign(t.style, { position: 'fixed', top: '-1000px', opacity: '0' })
  document.body.appendChild(t)
  t.select()
  let ok = false
  try { ok = document.execCommand('copy') } catch { ok = false }
  t.remove()
  return ok
}

async function escribir(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto)
    return true
  } catch {
    return copiarConTextarea(texto)
  }
}

async function limpiar(texto: string): Promise<void> {
  try {
    // si ya se ha copiado otra cosa, no se pisa
    if ((await navigator.clipboard.readText()) !== texto) return
  } catch { /* sin permiso para leer: se borra igualmente */ }
  await escribir(' ')
}

/** Copia y programa el borrado. Devuelve false si el navegador no ha dejado copiar. */
export async function copiarSecreto(texto: string, segundos = SEGUNDOS_PORTAPAPELES): Promise<boolean> {
  const ok = await escribir(texto)
  if (ok && segundos > 0) {
    window.clearTimeout(temporizador)
    temporizador = window.setTimeout(() => { void limpiar(texto) }, segundos * 1000)
  }
  return ok
}
