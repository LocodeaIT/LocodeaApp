/**
 * Formato de los datos de Verifactu: redondeo a céntimos, importes con punto
 * decimal y escapado de XML.
 *
 * Fuentes:
 *  - Descripción del servicio web, apdos. 6.8 (valores numéricos) y 6.9 (escapado):
 *    https://www.agenciatributaria.es/static_files/AEAT_Desarrolladores/EEDD/IVA/VERI-FACTU/Veri-Factu_Descripcion_SWeb.pdf
 *  - SuministroInformacion.xsd (ImporteSgn12.2Type, Tipo2.2Type):
 *    https://prewww2.aeat.es/static_files/common/internet/dep/aplicaciones/es/aeat/tikeV1.0/cont/ws/SuministroInformacion.xsd
 */

/** Redondea a céntimos sin los errores de coma flotante habituales (1.005 → 1.01). */
export function redondear2(n: number): number {
  const v = Number(n) || 0
  const r = Math.round(Math.abs(v) * 100 + 1e-7) / 100
  return v < 0 && r !== 0 ? -r : r
}

/**
 * Importe como lo pide el XML (y la huella): punto decimal, dos decimales, sin
 * separador de miles ni ceros a la izquierda. «-0» sale como «0.00».
 */
export const importeTexto = (n: number) => redondear2(n).toFixed(2)

/** Tipo impositivo en % con dos decimales (patrón \d{1,3}(\.\d{0,2})?). */
export const porcentajeTexto = (n: number) => redondear2(n).toFixed(2)

/** Escapa los caracteres reservados de XML. */
export function escaparXml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/** Deshace el escapado de XML (entidades predefinidas y numéricas). */
export function desescaparXml(s: string): string {
  return String(s ?? '')
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
}
