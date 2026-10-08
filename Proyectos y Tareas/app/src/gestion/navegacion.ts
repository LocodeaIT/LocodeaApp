/**
 * Pantallas del módulo Gestión dentro de la navegación de la app. Desde que
 * existe la Gestoría son la parte operativa del CRM (sección «Finanzas»):
 * gastos, caja y documentos de clientes y proveedores. El antiguo «Trimestre»
 * es ahora la pantalla Modelos de la Gestoría.
 */
export type PantallaGestion = 'gestion-gastos' | 'gestion-caja' | 'gestion-documentos'

export const PANTALLAS_GESTION: PantallaGestion[] = ['gestion-gastos', 'gestion-caja', 'gestion-documentos']

export const esPantallaGestion = (p: string): p is PantallaGestion => (PANTALLAS_GESTION as string[]).includes(p)
