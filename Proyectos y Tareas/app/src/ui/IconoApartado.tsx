/** Glifo de cada familia de apartado, siempre sobre el cuadrado bronce suave del sistema. */
import { AppWindow, Building2, ChartNoAxesColumn, FolderOpen, Globe, Handshake, Megaphone, Sparkles, Workflow } from 'lucide-react'
import type { IconoApartado as Icono } from '../domain/types'

const GLIFO: Record<Icono, typeof AppWindow> = {
  app: AppWindow, grafico: ChartNoAxesColumn, flujo: Workflow, erp: Building2,
  ventas: Handshake, web: Globe, ia: Sparkles, contenido: Megaphone, general: FolderOpen,
}

export function IconoApartado({ icono, tam = 18 }: { icono: Icono; tam?: number }) {
  const G = GLIFO[icono] ?? FolderOpen
  return <G size={tam} />
}
