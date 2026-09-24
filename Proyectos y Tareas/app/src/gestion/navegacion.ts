/**
 * Pantallas del módulo Gestión dentro de la navegación de la app.
 */
export type PantallaGestion = 'gestion-gastos' | 'gestion-caja' | 'gestion-trimestre' | 'gestion-documentos'

export const PANTALLAS_GESTION: PantallaGestion[] = ['gestion-gastos', 'gestion-caja', 'gestion-trimestre', 'gestion-documentos']

export const esPantallaGestion = (p: string): p is PantallaGestion => (PANTALLAS_GESTION as string[]).includes(p)
