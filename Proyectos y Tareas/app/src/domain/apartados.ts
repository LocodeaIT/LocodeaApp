/**
 * Apartados de proyecto: plantillas de partida y deducción del icono.
 *
 * Un apartado agrupa las tareas de un proyecto por tecnología, fase o
 * entregable. Las plantillas evitan crearlos a mano uno a uno al empezar.
 */
import type { ApartadoProyecto, IconoApartado } from './types'
import { nuevoId } from '../data/repo'

export type PlantillaApartados = 'ninguna' | 'tecnologia' | 'fases'

export const ETIQUETA_PLANTILLA: Record<PlantillaApartados, string> = {
  ninguna: 'Sin apartados',
  tecnologia: 'Por tecnología',
  fases: 'Por fases',
}

const PLANTILLAS: Record<Exclude<PlantillaApartados, 'ninguna'>, [string, IconoApartado][]> = {
  // Las tecnologías con las que trabaja Locodea, en el orden del catálogo.
  tecnologia: [
    ['Code Apps', 'app'], ['Power BI', 'grafico'], ['Power Automate', 'flujo'],
    ['Business Central', 'erp'], ['Dynamics 365 Sales', 'ventas'], ['Power Pages', 'web'],
    ['Locodea IA', 'ia'],
  ],
  fases: [
    ['Análisis', 'general'], ['Diseño', 'general'], ['Desarrollo', 'app'],
    ['Pruebas', 'general'], ['Puesta en marcha', 'general'],
  ],
}

export function apartadosDePlantilla(p: PlantillaApartados): ApartadoProyecto[] {
  if (p === 'ninguna') return []
  return PLANTILLAS[p].map(([nombre, icono]) => ({ id: nuevoId(), nombre, descripcion: '', icono }))
}

/** Icono que corresponde a un nombre de apartado, para no tener que elegirlo. */
export function iconoPorNombre(nombre: string): IconoApartado {
  const n = nombre.toLowerCase()
  if (/code ?app|canvas|app\b|aplicaci/.test(n)) return 'app'
  if (/power ?bi|panel|informe|cuadro de mando|dashboard/.test(n)) return 'grafico'
  if (/automate|flujo|automatiz/.test(n)) return 'flujo'
  if (/business central|\bbc\b|erp|sii|deca/.test(n)) return 'erp'
  if (/sales|dynamics|crm|venta/.test(n)) return 'ventas'
  if (/pages|portal|web/.test(n)) return 'web'
  if (/\bia\b|claude|copilot|agente|inteligencia|mcp/.test(n)) return 'ia'
  if (/contenido|v[ií]deo|post|redes|linkedin/.test(n)) return 'contenido'
  return 'general'
}

export const ETIQUETA_ICONO: Record<IconoApartado, string> = {
  app: 'Aplicaciones', grafico: 'Informes y paneles', flujo: 'Automatización', erp: 'ERP',
  ventas: 'Ventas y CRM', web: 'Portales web', ia: 'Inteligencia artificial', contenido: 'Contenido', general: 'General',
}
