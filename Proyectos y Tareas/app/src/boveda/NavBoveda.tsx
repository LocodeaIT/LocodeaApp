/**
 * Sección «Seguridad» del menú lateral con la Bóveda. El candado cambia según
 * esté abierta o cerrada, para que se vea de un vistazo.
 */
import { LockKeyhole, LockKeyholeOpen } from 'lucide-react'
import { useApp } from '../store'
import { useBoveda } from './store'

export function migasBoveda(id: string): { seccion: string; nombre: string } | null {
  return id === 'boveda' ? { seccion: 'Seguridad', nombre: 'Bóveda' } : null
}

export function NavBoveda({ pantallaActiva }: { pantallaActiva: string }) {
  const { setPantalla } = useApp()
  const { abierta } = useBoveda()
  const Icono = abierta ? LockKeyholeOpen : LockKeyhole
  return (
    <div className="boveda-nav">
      <div className="nav-seccion">Seguridad</div>
      <button className={`nav-item ${pantallaActiva === 'boveda' ? 'activo' : ''}`} onClick={() => setPantalla('boveda')} title={abierta ? 'Bóveda (abierta)' : 'Bóveda'}>
        <Icono size={18} /><span>Bóveda</span>
        {abierta && <span className="bov-nav-abierta" aria-label="abierta" />}
      </button>
    </div>
  )
}
