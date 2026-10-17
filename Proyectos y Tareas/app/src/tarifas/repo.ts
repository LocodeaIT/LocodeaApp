/**
 * Contrato de acceso a las tarifas de la calculadora de precios. El
 * repositorio de demostración (demo.ts) guarda en el navegador y el de
 * Dataverse (dataverse.ts) usa la tabla loc_tarifaprecio: una fila por cada
 * vez que se guardan, y la app usa la última.
 */
import type { Tarifas } from './motor'

export interface VersionTarifas {
  id: string
  tarifas: Tarifas
  autorId: string | null
  /** Instante ISO en que se guardó. */
  creadoEl: string
}

export interface TarifasRepositorio {
  /** La última versión guardada; null si todavía no se ha guardado ninguna. */
  cargar(): Promise<VersionTarifas | null>
  /** Guarda una versión nueva (no sustituye a la anterior). */
  guardar(t: Tarifas, autorId: string | null): Promise<VersionTarifas>
}
