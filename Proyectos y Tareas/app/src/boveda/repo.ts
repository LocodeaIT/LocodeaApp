/**
 * Contrato de acceso a datos de la Bóveda. Como en ../gestion/repo.ts: el
 * repositorio de demostración (demo.ts) guarda en el navegador y el de
 * Dataverse (dataverse.ts) usa las tablas loc_boveda y loc_secreto.
 *
 * El repositorio no sabe nada de cifrado: recibe y devuelve texto ya cifrado.
 */
import type { Boveda, BovedaInstantanea, SecretoCifrado } from './types'

export interface BovedaRepositorio {
  /** false mientras las tablas no existan en el entorno: la pantalla lo explica en vez de fallar. */
  readonly disponible: boolean
  cargar(): Promise<BovedaInstantanea>
  /** Crea o actualiza (según exista el id). */
  guardarBoveda(b: Boveda): Promise<Boveda>
  guardarSecreto(s: SecretoCifrado): Promise<SecretoCifrado>
  borrarSecreto(id: string): Promise<void>
}
