/**
 * Pantallas de la Gestoría dentro de la navegación de la app.
 */
export type PantallaGestoria =
  | 'gestoria-panel' | 'gestoria-revision' | 'gestoria-modelos' | 'gestoria-libros' | 'gestoria-contabilidad'
  | 'gestoria-cierre' | 'gestoria-expediente' | 'gestoria-verifactu' | 'gestoria-perfil'

export const PANTALLAS_GESTORIA: PantallaGestoria[] = [
  'gestoria-panel', 'gestoria-revision', 'gestoria-modelos', 'gestoria-libros', 'gestoria-contabilidad',
  'gestoria-cierre', 'gestoria-expediente', 'gestoria-verifactu', 'gestoria-perfil',
]

export const esPantallaGestoria = (p: string): p is PantallaGestoria => (PANTALLAS_GESTORIA as string[]).includes(p)
