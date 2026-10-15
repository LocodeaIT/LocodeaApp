/**
 * Contrato de acceso a datos de Propuestas. Como en ../boveda/repo.ts: el
 * repositorio de demostración (demo.ts) guarda en el navegador y el de
 * Dataverse (dataverse.ts) usa la tabla loc_propuesta.
 */
import type { AdjuntoPropuesta, Propuesta } from './types'

export interface PropuestasRepositorio {
  cargar(): Promise<Propuesta[]>
  /** Crea o actualiza (según exista el id). */
  guardar(p: Propuesta): Promise<Propuesta>
  /** Varias a la vez: reordenar una columna del tablero. */
  guardarVarias(ps: Propuesta[]): Promise<void>
  borrar(id: string): Promise<void>

  /** Adjuntos de todas las propuestas, sin los datos. */
  cargarAdjuntos(): Promise<AdjuntoPropuesta[]>
  /** Data URL del adjunto. */
  leerAdjunto(id: string): Promise<string>
  crearAdjunto(a: AdjuntoPropuesta, datos: string): Promise<AdjuntoPropuesta>
  /** Enlaza los adjuntos al proyecto en el que se convirtió la propuesta. */
  enlazarAdjuntos(ids: string[], proyectoId: string): Promise<void>
  borrarAdjunto(id: string): Promise<void>
}
