/**
 * Entrada de las pantallas de la Gestoría (paquete diferido): comprueba el
 * acceso (socios; el asesor externo, en lectura) y que las tablas existan, y
 * enseña la pantalla activa.
 */
import { Landmark, Lock } from 'lucide-react'
import { useApp } from '../../store'
import { Vacio } from '../../ui/basicos'
import { useGestion } from '../../gestion/store'
import { Documentos } from '../../gestion/screens/Documentos'
import { useGestoria } from '../store'
import { Panel } from './Panel'
import { Revision } from './Revision'
import { Modelos } from './Modelos'
import { Libros } from './Libros'
import { Contabilidad } from './Contabilidad'
import { Cierre } from './Cierre'
import { Verifactu } from './Verifactu'
import { Perfil } from './Perfil'

export default function PantallaGestoria() {
  const { pantalla } = useApp()
  const g = useGestoria()
  const gestion = useGestion()

  if (g.acceso === 'ninguno') {
    return (
      <div className="pagina">
        <div className="tarjeta padded">
          <Vacio icono={<Lock size={36} />} titulo="La Gestoría es solo para los socios" texto="Si necesitas algo de aquí, pídeselo a un socio. El asesor externo puede verla en modo lectura." />
        </div>
      </div>
    )
  }
  if (g.cargando || gestion.cargando) return <div className="carga"><div className="spinner" /></div>
  if (g.error) {
    return (
      <div className="pagina">
        <div className="tarjeta padded">
          <Vacio icono={<Landmark size={36} />} titulo="No se pudo cargar la Gestoría" texto={g.error} accion={<button className="btn primario pequeno" onClick={() => void g.recargar()}>Reintentar</button>} />
        </div>
      </div>
    )
  }
  if (!g.disponible) {
    return (
      <div className="pagina">
        <div className="tarjeta padded">
          <Vacio icono={<Landmark size={36} />} titulo="La Gestoría aún no tiene tablas en Dataverse" texto="Hay que crear el esquema (scripts/gestoria-esquema.mjs) y añadir las tablas como fuentes de datos de la app." />
        </div>
      </div>
    )
  }

  switch (pantalla) {
    case 'gestoria-revision': return <Revision />
    case 'gestoria-modelos': return <Modelos />
    case 'gestoria-libros': return <Libros />
    case 'gestoria-contabilidad': return <Contabilidad />
    case 'gestoria-cierre': return <Cierre />
    case 'gestoria-expediente': return <Documentos ambito="expediente" soloLectura={g.acceso !== 'completo'} />
    case 'gestoria-verifactu': return <Verifactu />
    case 'gestoria-perfil': return <Perfil />
    default: return <Panel />
  }
}
