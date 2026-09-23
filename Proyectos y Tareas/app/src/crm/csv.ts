/**
 * Exportación a CSV para Excel: separador «;», BOM para que Excel respete las
 * tildes y comillas solo donde hacen falta.
 */

const celda = (v: unknown) => {
  const s = String(v ?? '')
  return /[;"\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
}

export function aCsv(filas: unknown[][]): string {
  return filas.map(f => f.map(celda).join(';')).join('\r\n')
}

/**
 * Descarga un archivo generado en el navegador. Dentro del iframe de Power Apps
 * puede estar bloqueada; por eso el diálogo ofrece también copiar el texto.
 */
export function descargar(nombre: string, contenido: string, tipo = 'text/csv;charset=utf-8'): void {
  const a = document.createElement('a')
  // el BOM solo hace falta para que Excel lea bien las tildes del CSV
  const bom = tipo.startsWith('text/csv') ? '﻿' : ''
  a.href = URL.createObjectURL(new Blob([bom + contenido], { type: tipo }))
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove() }, 500)
}
