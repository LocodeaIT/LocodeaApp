/**
 * Archivos de las propuestas: cada uno se guarda como data URL en una columna
 * de texto de 1 MB, igual que las fotos de los gastos. Las imágenes se
 * comprimen en el navegador hasta caber; el resto de archivos tiene que caber
 * tal cual (unos 700 KB). Para algo más grande, mejor un enlace en un apunte.
 */

/** Máximo de texto que se guarda por adjunto, con margen sobre el 1 MB de la columna. */
export const MAX_DATOS = 950_000
/** Lo que pesa como mucho un archivo que no es imagen (el base64 ocupa un 37 % más). */
export const MAX_ARCHIVO = Math.floor((MAX_DATOS - 200) * 3 / 4)
/** Lado mayor de las imágenes guardadas. */
const LADO_MAX = 1600

export class ErrorAdjunto extends Error {}

export interface ArchivoPreparado { nombre: string; tipo: string; tamano: number; datos: string }

export function formatoTamano(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toLocaleString('es-ES', { maximumFractionDigits: 1 })} MB`
}

/** Bytes reales de un data URL en base64. */
export function bytesDeDataUrl(url: string): number {
  const coma = url.indexOf(',')
  const b64 = coma >= 0 ? url.slice(coma + 1) : url
  return Math.floor(b64.length * 3 / 4) - (b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0)
}

/** Las fotos y capturas se comprimen; los GIF y SVG se dejan como están. */
const comprimible = (tipo: string) => /^image\/(jpeg|png|webp|bmp|heic|heif)$/.test(tipo)

export async function prepararArchivo(archivo: File): Promise<ArchivoPreparado> {
  const tipo = archivo.type || 'application/octet-stream'
  if (comprimible(tipo)) {
    try {
      const datos = await comprimirImagen(archivo)
      const nombre = archivo.name.replace(/\.[^.]+$/, '') + '.jpg'
      return { nombre: nombre || 'imagen.jpg', tipo: 'image/jpeg', tamano: bytesDeDataUrl(datos), datos }
    } catch {
      // formato que el navegador no sabe dibujar (p. ej. HEIC en Windows): se intenta tal cual
    }
  }
  if (archivo.size > MAX_ARCHIVO) {
    throw new ErrorAdjunto(`«${archivo.name}» pesa ${formatoTamano(archivo.size)} y el máximo es ${formatoTamano(MAX_ARCHIVO)}. Para archivos grandes, deja el enlace de SharePoint en un apunte.`)
  }
  const datos = await leerComoDataUrl(archivo)
  return { nombre: archivo.name || 'archivo', tipo, tamano: archivo.size, datos }
}

function leerComoDataUrl(archivo: Blob): Promise<string> {
  return new Promise((resolver, rechazar) => {
    const lector = new FileReader()
    lector.onload = () => resolver(String(lector.result))
    lector.onerror = () => rechazar(new ErrorAdjunto('No se pudo leer el archivo'))
    lector.readAsDataURL(archivo)
  })
}

/** Reduce la imagen a ≤1600 px de lado y JPEG; baja la calidad hasta que quepa. */
async function comprimirImagen(archivo: File): Promise<string> {
  const bitmap = await createImageBitmap(archivo)
  let ancho = bitmap.width, alto = bitmap.height
  const escala = Math.min(1, LADO_MAX / Math.max(ancho, alto))
  ancho = Math.round(ancho * escala); alto = Math.round(alto * escala)
  try {
    for (let intento = 0; intento < 4; intento++) {
      const lienzo = document.createElement('canvas')
      lienzo.width = ancho; lienzo.height = alto
      const ctx = lienzo.getContext('2d')!
      ctx.fillStyle = '#fff'  // las PNG con transparencia no quedan en negro
      ctx.fillRect(0, 0, ancho, alto)
      ctx.drawImage(bitmap, 0, 0, ancho, alto)
      for (const calidad of [0.85, 0.75, 0.65, 0.5]) {
        const url = lienzo.toDataURL('image/jpeg', calidad)
        if (url.length <= MAX_DATOS) return url
      }
      ancho = Math.round(ancho * .7); alto = Math.round(alto * .7)
    }
    throw new ErrorAdjunto('La imagen es demasiado grande incluso comprimida')
  } finally {
    bitmap.close()
  }
}

/** Descarga el adjunto con su nombre. */
export function descargar(nombre: string, datos: string): void {
  const a = document.createElement('a')
  a.href = datos
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  a.remove()
}

/** Etiqueta corta del tipo de archivo para la ficha: PDF, XLSX, DOCX… */
export function extension(nombre: string, tipo: string): string {
  const ext = nombre.includes('.') ? nombre.split('.').pop()! : tipo.split('/').pop() ?? ''
  return ext.slice(0, 4).toUpperCase() || 'ARCH'
}
