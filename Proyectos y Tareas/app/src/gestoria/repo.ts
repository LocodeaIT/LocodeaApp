/**
 * Contrato de acceso a datos de la Gestoría. Como en ../gestion/repo.ts: el
 * repositorio de demostración (demo.ts) guarda en el navegador y el de
 * Dataverse (dataverse.ts) usa las tablas que crea scripts/gestoria-esquema.mjs.
 */
import type { ColGestoria, GestoriaInstantanea, RegistroGestoriaDe } from './types'

export interface GestoriaRepositorio {
  /** false mientras las tablas no existan en el entorno: las pantallas lo explican en vez de fallar. */
  readonly disponible: boolean
  cargar(): Promise<GestoriaInstantanea>
  /** Crea o actualiza (según exista el id) y devuelve lo guardado. */
  guardar<K extends ColGestoria>(col: K, obj: RegistroGestoriaDe<K>): Promise<RegistroGestoriaDe<K>>
  borrar(col: ColGestoria, id: string): Promise<void>
  /** Solo demostración. */
  restablecer?(): Promise<GestoriaInstantanea>
}
