/**
 * Contrato de acceso a datos del CRM. Como en ../data/repo.ts, la UI solo
 * conoce esta interfaz: el repositorio de demostración (demo.ts) guarda en el
 * navegador y el de Dataverse (dataverse.ts) está pendiente de las tablas.
 *
 * El contrato es genérico a propósito: todas las colecciones se guardan y se
 * borran igual, así que un método por entidad no aportaba nada.
 */
import type { Coleccion, CrmInstantanea, RegistroDe } from './types'

export type { CrmInstantanea } from './types'

export interface CrmRepositorio {
  /** false mientras el esquema del CRM no exista en el entorno: las pantallas lo explican en vez de fallar. */
  readonly disponible: boolean
  /** Carga inicial completa. */
  cargar(): Promise<CrmInstantanea>
  /** Crea o actualiza (según exista el id) y devuelve lo guardado. */
  guardar<K extends Coleccion>(col: K, obj: RegistroDe<K>): Promise<RegistroDe<K>>
  borrar(col: Coleccion, id: string): Promise<void>
  /** Solo demostración: vuelve a los datos de ejemplo. */
  restablecer?(): Promise<CrmInstantanea>
  /** Solo demostración: sustituye todo el CRM (importar copia de seguridad, borrar todo). */
  reemplazar?(d: CrmInstantanea): Promise<CrmInstantanea>
}
