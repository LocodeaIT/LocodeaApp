/**
 * Verificación de la cadena de registros: recalcula cada huella, comprueba que
 * cada huella anterior es la del registro previo, que el orden no tiene huecos
 * y que el XML guardado lleva las mismas huellas.
 *
 * Fuentes:
 *  - Especificaciones de la huella v0.1.2:
 *    https://www.agenciatributaria.es/static_files/AEAT_Desarrolladores/EEDD/IVA/VERI-FACTU/Veri-Factu_especificaciones_huella_hash_registros.pdf
 *  - Orden HAC/1177/2024, art. 7.i (encadenamiento correcto y fecha de
 *    generación no anterior en más de un minuto a la del registro previo):
 *    https://www.boe.es/diario_boe/txt.php?id=BOE-A-2024-22138
 */
import type { RegistroFacturacion } from '../types'
import { huellaAlta, huellaAnulacion } from './huella'
import { bloquesXml, valorXml, valoresXml } from './xml'

export interface ErrorCadena { orden: number; motivo: string }

const MARGEN_RELOJ_MS = 60_000

/** Huella que le corresponde al registro según sus datos. */
export function recalcularHuella(r: RegistroFacturacion): Promise<string> {
  const comun = {
    nifEmisor: r.nifEmisor, serieNumero: r.serieNumero, fechaExpedicion: r.fechaExpedicion,
    huellaAnterior: r.huellaAnterior, fechaHoraGeneracion: r.fechaHoraGeneracion,
  }
  return r.tipo === 'anulacion'
    ? huellaAnulacion(comun)
    : huellaAlta({ ...comun, tipoFactura: r.tipoFactura, cuotaTotal: r.cuotaTotal, importeTotal: r.importeTotal })
}

/** Verifica una cadena (o varias: se separan por emisor y entorno). */
export async function verificarCadena(registros: RegistroFacturacion[]): Promise<{ ok: boolean; errores: ErrorCadena[] }> {
  const errores: ErrorCadena[] = []
  const cadenas = new Map<string, RegistroFacturacion[]>()
  for (const r of registros) {
    const k = `${r.nifEmisor}|${r.entorno}`
    cadenas.set(k, [...(cadenas.get(k) ?? []), r])
  }
  for (const cadena of cadenas.values()) {
    const ordenados = [...cadena].sort((a, b) => a.orden - b.orden)
    let previo: RegistroFacturacion | null = null
    for (const r of ordenados) {
      const mal = (motivo: string) => errores.push({ orden: r.orden, motivo })
      const esperado = previo ? previo.orden + 1 : 1
      if (r.orden !== esperado) {
        mal(r.orden === previo?.orden ? `Orden repetido (${r.orden})` : `Falta el registro ${esperado} antes del ${r.orden}`)
      }
      if (!previo && r.huellaAnterior) mal('El primer registro no debería llevar huella anterior')
      if (previo && r.huellaAnterior !== previo.huella) mal(`La huella anterior no coincide con la del registro ${previo.orden}`)
      const calculada = await recalcularHuella(r)
      if (calculada !== r.huella) mal('La huella no corresponde a los datos del registro (¿se ha modificado?)')

      if (r.xml) {
        const huellas = valoresXml(r.xml, 'Huella')
        const enlazada = bloquesXml(r.xml, 'RegistroAnterior').length ? valorXml(bloquesXml(r.xml, 'RegistroAnterior')[0], 'Huella') : ''
        if (huellas[huellas.length - 1] !== r.huella) mal('La huella del XML no coincide con la del registro')
        if ((enlazada ?? '') !== r.huellaAnterior) mal('La huella anterior del XML no coincide con la del registro')
      }
      if (previo) {
        const t0 = Date.parse(previo.fechaHoraGeneracion), t1 = Date.parse(r.fechaHoraGeneracion)
        if (Number.isFinite(t0) && Number.isFinite(t1) && t0 - t1 > MARGEN_RELOJ_MS) {
          mal(`Se generó más de un minuto antes que el registro ${previo.orden}`)
        }
      }
      previo = r
    }
  }
  errores.sort((a, b) => a.orden - b.orden)
  return { ok: errores.length === 0, errores }
}
