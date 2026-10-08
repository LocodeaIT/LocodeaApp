/**
 * Sección «Gestoría» del menú lateral. Solo la ven los socios y el asesor
 * externo (en modo lectura); a los colaboradores no se les muestra. Los
 * contadores señalan lo que pide atención: plazos abiertos, incidencias de la
 * revisión y registros de Verifactu rechazados.
 */
import {
  BookOpen, CalendarCheck, ClipboardCheck, FileSpreadsheet, FolderArchive, Landmark, LayoutDashboard, ScrollText, ShieldCheck, type LucideIcon,
} from 'lucide-react'
import { useApp } from '../store'
import { useGestoria } from './store'
import type { PantallaGestoria } from './navegacion'

const NAV: { id: PantallaGestoria; nombre: string; icono: LucideIcon; seccion?: string }[] = [
  { id: 'gestoria-panel', nombre: 'Panel y calendario', icono: LayoutDashboard, seccion: 'Gestoría' },
  { id: 'gestoria-revision', nombre: 'Revisión', icono: ClipboardCheck },
  { id: 'gestoria-modelos', nombre: 'Modelos', icono: FileSpreadsheet },
  { id: 'gestoria-libros', nombre: 'Libros registro', icono: BookOpen },
  { id: 'gestoria-contabilidad', nombre: 'Contabilidad', icono: Landmark },
  { id: 'gestoria-cierre', nombre: 'Cierre anual', icono: CalendarCheck },
  { id: 'gestoria-expediente', nombre: 'Expediente', icono: FolderArchive },
  { id: 'gestoria-verifactu', nombre: 'Verifactu', icono: ShieldCheck },
  { id: 'gestoria-perfil', nombre: 'Perfil fiscal', icono: ScrollText },
]

export function migasGestoria(id: string): { seccion: string; nombre: string } | null {
  const n = NAV.find(x => x.id === id)
  return n ? { seccion: 'Gestoría', nombre: n.nombre } : null
}

export function NavGestoria({ pantallaActiva }: { pantallaActiva: string }) {
  const { setPantalla } = useApp()
  const g = useGestoria()
  if (g.acceso === 'ninguno') return null
  const rechazados = g.datos.registros.filter(r => r.estado === 'rechazado').length
  const contador: Partial<Record<PantallaGestoria, number>> = { 'gestoria-verifactu': rechazados }
  return (
    <div className="gestoria-nav">
      {NAV.map(n => (
        <div key={n.id}>
          {n.seccion && <div className="nav-seccion">{n.seccion}{g.acceso === 'lectura' ? ' · lectura' : ''}</div>}
          <button className={`nav-item ${pantallaActiva === n.id ? 'activo' : ''}`} onClick={() => setPantalla(n.id)} title={n.nombre}>
            <n.icono size={18} /><span>{n.nombre}</span>
            {!!contador[n.id] && <span className="contador">{contador[n.id]}</span>}
          </button>
        </div>
      ))}
    </div>
  )
}
