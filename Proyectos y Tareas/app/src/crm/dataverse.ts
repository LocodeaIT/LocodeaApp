/**
 * Repositorio del CRM sobre Dataverse: PENDIENTE.
 *
 * Las tablas del CRM todavía no existen en el entorno, así que esta
 * implementación no inventa servicios: devuelve un CRM vacío y marca
 * `disponible: false` para que las pantallas muestren que falta desplegar el
 * esquema. Cuando existan las tablas (y sus servicios generados con
 * `pa app add data-source`), aquí se hará la traducción, igual que en
 * ../data/dataverse.ts.
 */
import type { CrmRepositorio } from './repo'
import { CRM_VACIO } from './types'

const SIN_TABLAS = 'El CRM aún no tiene tablas en Dataverse'

export const crmRepoDataverse: CrmRepositorio = {
  disponible: false,
  async cargar() {
    return structuredClone(CRM_VACIO)
  },
  async guardar() {
    throw new Error(SIN_TABLAS)
  },
  async borrar() {
    throw new Error(SIN_TABLAS)
  },
}
