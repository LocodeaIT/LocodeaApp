/**
 * Entrada de las pantallas de Gestión (paquete diferido): según la pantalla
 * activa enseña gastos, caja, trimestre o documentos.
 */
import { Wallet } from 'lucide-react'
import { useApp } from '../../store'
import { Vacio } from '../../ui/basicos'
import { useGestion } from '../store'
import { Gastos } from './Gastos'
import { Caja } from './Caja'
import { Trimestre } from './Trimestre'
import { Documentos } from './Documentos'

export default function PantallaGestion() {
  const { pantalla } = useApp()
  const g = useGestion()

  if (g.cargando) return <div className="carga"><div className="spinner" /></div>
  if (g.error) {
    return (
      <div className="pagina">
        <div className="tarjeta padded">
          <Vacio icono={<Wallet size={36} />} titulo="No se pudo cargar Gestión" texto={g.error} accion={<button className="btn primario pequeno" onClick={() => void g.recargar()}>Reintentar</button>} />
        </div>
      </div>
    )
  }
  if (!g.disponible) {
    return (
      <div className="pagina">
        <div className="tarjeta padded">
          <Vacio icono={<Wallet size={36} />} titulo="Gestión aún no tiene tablas en Dataverse" texto="Gastos y documentos llegarán en cuanto existan sus tablas en el entorno (scripts/gestion-esquema.mjs)." />
        </div>
      </div>
    )
  }

  switch (pantalla) {
    case 'gestion-caja': return <Caja />
    case 'gestion-trimestre': return <Trimestre />
    case 'gestion-documentos': return <Documentos />
    default: return <Gastos />
  }
}
