/**
 * Código QR tributario de la factura: URL del servicio de cotejo de la AEAT,
 * imagen del QR y textos que lo acompañan.
 *
 * Fuentes:
 *  - «Detalle de las especificaciones técnicas del código QR de la factura y de
 *    la URL del servicio de cotejo…», AEAT, v0.5.0 (10/12/2025):
 *    https://www.agenciatributaria.es/static_files/AEAT_Desarrolladores/EEDD/IVA/VERI-FACTU/DetalleEspecificacTecnCodigoQRfactura.pdf
 *    · URL de pruebas: https://prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQR
 *    · URL de producción: https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQR
 *    · Solo cuatro parámetros: nif, numserie, fecha (DD-MM-AAAA) e importe (punto
 *      decimal, hasta 2 decimales), con «URL encoding» en UTF-8 (12345678&G33 → 12345678%26G33).
 *      El parámetro «formato» nunca puede ir en la URL del QR.
 *    · Encima del QR, el texto «QR tributario:»; debajo, «VERI*FACTU» o «Factura
 *      verificable en la sede electrónica de la AEAT». Margen en blanco de al
 *      menos 2 mm (se recomiendan 6 mm). Va al principio de la factura, en la primera página.
 *  - Orden HAC/1177/2024, arts. 20 y 21 (tamaño entre 30x30 y 40x40 mm, ISO/IEC
 *    18004:2015, nivel M de corrección de errores):
 *    https://www.boe.es/diario_boe/txt.php?id=BOE-A-2024-22138
 */
import QRCode from 'qrcode'
import type { EntornoVerifactu } from '../types'
import { ddmmaaaa } from './fechas'
import { importeTexto } from './formato'

export const URL_COTEJO_PRUEBAS = 'https://prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQR'
export const URL_COTEJO_PRODUCCION = 'https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQR'

/** Leyenda que va justo debajo del QR en las facturas VERI*FACTU. */
export const LEYENDA_VERIFACTU = 'VERI*FACTU'
/** Frase alternativa que admite el art. 20.1.b) de la Orden. */
export const LEYENDA_VERIFACTU_LARGA = 'Factura verificable en la sede electrónica de la AEAT'
/** Texto que siempre precede al QR, encima de él. */
export const TITULO_QR = 'QR tributario:'

/** Tamaño impreso del QR en milímetros (art. 21.1). */
export const QR_TAMANO_MM = { minimo: 30, maximo: 40 }
/** Margen en blanco alrededor del QR en milímetros: mínimo y recomendado. */
export const QR_MARGEN_MM = { minimo: 2, recomendado: 6 }

/** URL de cotejo de la factura. Preparación y pruebas usan la URL de pruebas de la AEAT. */
export function urlCotejo(e: { nif: string; serieNumero: string; fechaExpedicion: string; importeTotal: number; entorno: EntornoVerifactu }): string {
  const base = e.entorno === 'produccion' ? URL_COTEJO_PRODUCCION : URL_COTEJO_PRUEBAS
  const parametros: [string, string][] = [
    ['nif', String(e.nif ?? '').trim()],
    ['numserie', String(e.serieNumero ?? '').trim()],
    ['fecha', ddmmaaaa(e.fechaExpedicion)],
    ['importe', importeTexto(e.importeTotal)],
  ]
  return `${base}?${parametros.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')}`
}

/**
 * Imagen PNG del QR como data URL, con nivel M de corrección y 4 módulos de
 * zona en blanco. 472 px son 40 mm a 300 ppp: se imprime entre 30 y 40 mm.
 */
export function qrDataUrl(url: string, anchoPx = 472): Promise<string> {
  return QRCode.toDataURL(url, { errorCorrectionLevel: 'M', margin: 4, width: anchoPx, color: { dark: '#000000', light: '#ffffff' } })
}
