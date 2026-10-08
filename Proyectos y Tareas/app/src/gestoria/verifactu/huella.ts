/**
 * Huella («hash») de los registros de facturación de alta y de anulación.
 *
 * Fuente: «Detalle de las especificaciones técnicas para generación de la
 * huella o hash de los registros de facturación», AEAT, v0.1.2 (27/08/2024):
 * https://www.agenciatributaria.es/static_files/AEAT_Desarrolladores/EEDD/IVA/VERI-FACTU/Veri-Factu_especificaciones_huella_hash_registros.pdf
 *
 *  - Algoritmo SHA-256 (lista L12; TipoHuella 01).
 *  - Cadena «nombreCampo=valor» unida con «&», en este orden:
 *      alta: IDEmisorFactura, NumSerieFactura, FechaExpedicionFactura, TipoFactura,
 *            CuotaTotal, ImporteTotal, Huella (del registro anterior), FechaHoraHusoGenRegistro.
 *      anulación: IDEmisorFacturaAnulada, NumSerieFacturaAnulada,
 *            FechaExpedicionFacturaAnulada, Huella (del anterior), FechaHoraHusoGenRegistro.
 *  - Valores iguales a los del XML, sin espacios al principio ni al final.
 *    Fechas dd-mm-aaaa. En importes da igual uno o dos decimales; aquí siempre dos.
 *  - Campo sin valor (primer registro: no hay huella anterior) → «Huella=».
 *  - Codificación UTF-8; salida hexadecimal en mayúsculas, 64 caracteres.
 */
import type { TipoFactura } from '../../crm/types'
import { ddmmaaaa } from './fechas'
import { importeTexto } from './formato'

export interface DatosHuellaAlta {
  nifEmisor: string
  serieNumero: string
  /** YYYY-MM-DD. */
  fechaExpedicion: string
  tipoFactura: TipoFactura
  cuotaTotal: number
  importeTotal: number
  /** Huella del registro anterior de la cadena; vacía en el primero. */
  huellaAnterior: string
  /** ISO 8601 con desfase: 2024-01-01T19:20:30+01:00. */
  fechaHoraGeneracion: string
}

export type DatosHuellaAnulacion = Pick<DatosHuellaAlta, 'nifEmisor' | 'serieNumero' | 'fechaExpedicion' | 'huellaAnterior' | 'fechaHoraGeneracion'>

const v = (s: string | null | undefined) => String(s ?? '').trim()

const unir = (pares: [string, string][]) => pares.map(([k, x]) => `${k}=${x}`).join('&')

/** Cadena exacta sobre la que se calcula la huella de un registro de alta. */
export function cadenaHuellaAlta(c: DatosHuellaAlta): string {
  return unir([
    ['IDEmisorFactura', v(c.nifEmisor)],
    ['NumSerieFactura', v(c.serieNumero)],
    ['FechaExpedicionFactura', ddmmaaaa(c.fechaExpedicion)],
    ['TipoFactura', v(c.tipoFactura)],
    ['CuotaTotal', importeTexto(c.cuotaTotal)],
    ['ImporteTotal', importeTexto(c.importeTotal)],
    ['Huella', v(c.huellaAnterior)],
    ['FechaHoraHusoGenRegistro', v(c.fechaHoraGeneracion)],
  ])
}

/** Cadena exacta sobre la que se calcula la huella de un registro de anulación. */
export function cadenaHuellaAnulacion(c: DatosHuellaAnulacion): string {
  return unir([
    ['IDEmisorFacturaAnulada', v(c.nifEmisor)],
    ['NumSerieFacturaAnulada', v(c.serieNumero)],
    ['FechaExpedicionFacturaAnulada', ddmmaaaa(c.fechaExpedicion)],
    ['Huella', v(c.huellaAnterior)],
    ['FechaHoraHusoGenRegistro', v(c.fechaHoraGeneracion)],
  ])
}

/** SHA-256 de un texto en UTF-8, en hexadecimal y mayúsculas. */
export async function sha256Hex(texto: string): Promise<string> {
  const datos = new TextEncoder().encode(texto)
  const resumen = await globalThis.crypto.subtle.digest('SHA-256', datos)
  return Array.from(new Uint8Array(resumen), b => b.toString(16).padStart(2, '0')).join('').toUpperCase()
}

export const huellaAlta = (c: DatosHuellaAlta) => sha256Hex(cadenaHuellaAlta(c))
export const huellaAnulacion = (c: DatosHuellaAnulacion) => sha256Hex(cadenaHuellaAnulacion(c))

/** 64 caracteres hexadecimales en mayúsculas, como exige la AEAT. */
export const esHuella = (s: string) => /^[0-9A-F]{64}$/.test(String(s ?? ''))
