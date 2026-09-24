/**
 * Sección «Gestión» del menú lateral: gastos, caja, trimestre y documentos,
 * con contadores de lo que pide atención (reembolsos, vencidos, caducidades).
 */
import { CalendarClock, FolderLock, Receipt, Wallet, type LucideIcon } from 'lucide-react'
import { useApp } from '../store'
import { useCrm } from '../crm/contexto'
import { estadoFactura } from '../crm/documentos'
import { useGestion } from './store'
import { estadoCaducidad } from './calculos'
import type { PantallaGestion } from './navegacion'

const NAV: { id: PantallaGestion; nombre: string; icono: LucideIcon; seccion?: string }[] = [
  { id: 'gestion-gastos', nombre: 'Gastos', icono: Receipt, seccion: 'Gestión' },
  { id: 'gestion-caja', nombre: 'Caja', icono: Wallet },
  { id: 'gestion-trimestre', nombre: 'Trimestre', icono: CalendarClock },
  { id: 'gestion-documentos', nombre: 'Documentos', icono: FolderLock },
]

export function migasGestion(id: string): { seccion: string; nombre: string } | null {
  const n = NAV.find(x => x.id === id)
  return n ? { seccion: 'Gestión', nombre: n.nombre } : null
}

export function NavGestion({ pantallaActiva }: { pantallaActiva: string }) {
  const { setPantalla } = useApp()
  const { datos } = useGestion()
  const crm = useCrm()
  const reembolsos = datos.gastos.filter(g => g.estado === 'reembolsar').length
  const vencidas = crm.disponible ? crm.datos.facturasVenta.filter(f => estadoFactura(f) === 'vencida').length + crm.datos.facturasCompra.filter(f => estadoFactura(f) === 'vencida').length : 0
  const caducan = datos.documentos.filter(d => { const e = estadoCaducidad(d); return e === 'caducado' || e === 'pronto' }).length
  const contador: Partial<Record<PantallaGestion, number>> = { 'gestion-gastos': reembolsos, 'gestion-caja': vencidas, 'gestion-documentos': caducan }
  return (
    <div className="gestion-nav">
      {NAV.map(n => (
        <div key={n.id}>
          {n.seccion && <div className="nav-seccion">{n.seccion}</div>}
          <button className={`nav-item ${pantallaActiva === n.id ? 'activo' : ''}`} onClick={() => setPantalla(n.id)} title={n.nombre}>
            <n.icono size={18} /><span>{n.nombre}</span>
            {!!contador[n.id] && <span className="contador gris">{contador[n.id]}</span>}
          </button>
        </div>
      ))}
    </div>
  )
}
