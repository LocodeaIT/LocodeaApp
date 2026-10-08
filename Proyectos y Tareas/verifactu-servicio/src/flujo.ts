/**
 * Control de flujo de la Orden HAC/1177/2024, art. 16.2: tras cada envío hay
 * que esperar los segundos que indique la AEAT (TiempoEsperaEnvio, 60 al
 * principio) o a tener acumulados 1.000 registros, lo que ocurra antes.
 * Fuente: https://www.boe.es/diario_boe/txt.php?id=BOE-A-2024-22138
 *
 * El estado vive en memoria de la instancia. Basta con una sola instancia
 * (límite de escalado 1 en la Function App, ver README); con varias habría que
 * guardarlo fuera (Table Storage o Dataverse).
 */
import { MAX_REGISTROS_POR_ENVIO } from './aeat/xml'

export const ESPERA_INICIAL_SEGUNDOS = 60

const proximoEnvio = new Map<string, number>()

/** Segundos que faltan para poder enviar a esa cadena (0 = ya se puede). Un lote de 1.000 no espera. */
export function esperaPendiente(clave: string, registros: number, ahora = Date.now()): number {
  if (registros >= MAX_REGISTROS_POR_ENVIO) return 0
  const desde = proximoEnvio.get(clave) ?? 0
  return desde > ahora ? Math.ceil((desde - ahora) / 1000) : 0
}

/** Anota el envío hecho y la espera que pide la AEAT para el siguiente. */
export function anotarEnvio(clave: string, esperaSegundos: number, ahora = Date.now()) {
  proximoEnvio.set(clave, ahora + Math.max(0, esperaSegundos) * 1000)
}
