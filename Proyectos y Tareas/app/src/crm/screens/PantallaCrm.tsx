/**
 * Entrada de las pantallas del CRM (paquete diferido): según la pantalla
 * activa enseña el inicio, la ficha abierta o la lista de la entidad.
 */
import { useEffect } from 'react'
import { Database } from 'lucide-react'
import { useApp } from '../../store'
import { Vacio } from '../../ui/basicos'
import { useCrm } from '../contexto'
import { COL_DE_PANTALLA, type PantallaCrm as IdPantalla } from '../navegacion'
import { InicioCrm } from './InicioCrm'
import { ListaCrm } from './ListaCrm'
import { FichaCrm } from './FichaCrm'

export default function PantallaCrm() {
  const { pantalla } = useApp()
  const c = useCrm()

  // «/» lleva al buscador global, solo mientras se está en el CRM: el resto de la app sigue igual
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return
      const t = e.target as HTMLElement | null
      if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return
      if (document.querySelector('.velo')) return
      const buscador = document.querySelector<HTMLInputElement>('.buscador input')
      if (buscador) { e.preventDefault(); buscador.focus() }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  if (c.cargando) return <div className="carga"><div className="spinner" /></div>
  if (c.error) {
    return (
      <div className="pagina crm">
        <div className="tarjeta padded">
          <Vacio icono={<Database size={36} />} titulo="No se pudo cargar el CRM" texto={c.error} accion={<button className="btn primario pequeno" onClick={() => void c.recargar()}>Reintentar</button>} />
        </div>
      </div>
    )
  }
  if (!c.disponible) {
    return (
      <div className="pagina crm">
        <div className="tarjeta padded">
          <Vacio icono={<Database size={36} />} titulo="El CRM aún no tiene tablas en Dataverse — pendiente de desplegar el esquema"
            texto="Cuentas, contactos, oportunidades y documentos llegarán en cuanto existan sus tablas en el entorno. Mientras tanto, el módulo se puede probar en local con datos de ejemplo (VITE_DEMO=1 npm run dev)." />
        </div>
      </div>
    )
  }

  const col = COL_DE_PANTALLA[pantalla as IdPantalla]
  if (!col) return <InicioCrm />
  if (c.ficha?.col === col) return <FichaCrm key={`${col}/${c.ficha.id}`} col={col} id={c.ficha.id} prefill={c.ficha.prefill} />
  return <ListaCrm col={col} />
}
