/**
 * Pantalla de la Bóveda dentro de la navegación de la app.
 */
export type PantallaBoveda = 'boveda'

export const PANTALLAS_BOVEDA: PantallaBoveda[] = ['boveda']

export const esPantallaBoveda = (p: string): p is PantallaBoveda => (PANTALLAS_BOVEDA as string[]).includes(p)
