/**
 * Contrato de acceso a datos de Gestión. Como en ../crm/repo.ts: el
 * repositorio de demostración (demo.ts) guarda en el navegador y el de
 * Dataverse (dataverse.ts) usa las tablas loc_gasto y loc_documento.
 */
import type { ColGestion, GestionInstantanea, RegistroGestionDe } from './types'

export interface GestionRepositorio {
  /** false mientras las tablas no existan en el entorno: la pantalla lo explica en vez de fallar. */
  readonly disponible: boolean
  cargar(): Promise<GestionInstantanea>
  /** Crea o actualiza (según exista el id) y devuelve lo guardado. */
  guardar<K extends ColGestion>(col: K, obj: RegistroGestionDe<K>): Promise<RegistroGestionDe<K>>
  borrar(col: ColGestion, id: string): Promise<void>
  /** Solo demostración. */
  restablecer?(): Promise<GestionInstantanea>
}
