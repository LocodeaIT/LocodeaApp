/**
 * Enganche del CRM con el marco de la app: secciones del menú lateral (van
 * detrás de las de la app) y resultados en el buscador global. Usan las
 * mismas clases que la app para que se vean iguales.
 */
import { LayoutDashboard, type LucideIcon } from 'lucide-react'
import { useCrm } from './contexto'
import { COL_DE_PANTALLA, PANTALLA_DE, type PantallaCrm } from './navegacion'
import { ICONO_COL } from './iconos'
import { actividadVencida } from './consultas'
import type { ResultadoCrm } from './busqueda'

const NAV_CRM: { id: PantallaCrm; nombre: string; icono: LucideIcon; seccion?: string }[] = [
  { id: 'crm-inicio', nombre: 'Inicio CRM', icono: LayoutDashboard, seccion: 'CRM' },
  { id: 'crm-cuentas', nombre: 'Cuentas', icono: ICONO_COL.cuentas },
  { id: 'crm-contactos', nombre: 'Contactos', icono: ICONO_COL.contactos },
  { id: 'crm-potenciales', nombre: 'Clientes potenciales', icono: ICONO_COL.potenciales },
  { id: 'crm-oportunidades', nombre: 'Oportunidades', icono: ICONO_COL.oportunidades },
  { id: 'crm-actividades', nombre: 'Actividades', icono: ICONO_COL.actividades },
  { id: 'crm-ofertas', nombre: 'Ofertas', icono: ICONO_COL.ofertas, seccion: 'Ventas' },
  { id: 'crm-pedidos-venta', nombre: 'Pedidos de venta', icono: ICONO_COL.pedidosVenta },
  { id: 'crm-facturas-venta', nombre: 'Facturas de venta', icono: ICONO_COL.facturasVenta },
  { id: 'crm-pedidos-compra', nombre: 'Pedidos de compra', icono: ICONO_COL.pedidosCompra, seccion: 'Compras' },
  { id: 'crm-facturas-compra', nombre: 'Facturas de compra', icono: ICONO_COL.facturasCompra },
  { id: 'crm-productos', nombre: 'Productos', icono: ICONO_COL.productos, seccion: 'Catálogo' },
]

/** Secciones del CRM en el menú lateral. Al pulsar se va a la lista (o al inicio) aunque hubiera una ficha abierta. */
/** Sección y nombre de una pantalla del CRM, para las migas de la barra superior. */
export function migasCrm(id: string): { seccion: string; nombre: string } | null {
  const i = NAV_CRM.findIndex(n => n.id === id)
  if (i < 0) return null
  const seccion = NAV_CRM.slice(0, i + 1).reverse().find(n => n.seccion)?.seccion ?? 'CRM'
  return { seccion, nombre: NAV_CRM[i].nombre }
}

export function NavCrm({ pantallaActiva }: { pantallaActiva: string }) {
  const { datos, irLista, irInicio } = useCrm()
  const vencidas = datos.actividades.filter(actividadVencida).length
  return (
    <div className="crm-nav">
      {NAV_CRM.map(n => {
        const col = COL_DE_PANTALLA[n.id]
        return (
          <div key={n.id}>
            {n.seccion && <div className="nav-seccion">{n.seccion}</div>}
            <button className={`nav-item ${pantallaActiva === n.id ? 'activo' : ''}`} onClick={() => (col ? irLista(col) : irInicio())} title={n.nombre}>
              <n.icono size={18} /><span>{n.nombre}</span>
              {n.id === 'crm-actividades' && vencidas > 0 && <span className="contador gris">{vencidas}</span>}
            </button>
          </div>
        )
      })}
    </div>
  )
}

/** Bloque «CRM» del desplegable del buscador global. */
export function ResultadosCrm({ resultados, onElegido }: { resultados: ResultadoCrm[]; onElegido: (p: PantallaCrm) => void }) {
  const { abrir } = useCrm()
  if (!resultados.length) return null
  return (
    <>
      <div className="cabecera-menu">CRM</div>
      {resultados.map(r => {
        const Ico = ICONO_COL[r.col]
        return (
          <button key={r.col + r.id} className="item" onClick={() => { abrir(r.col, r.id); onElegido(PANTALLA_DE[r.col]) }}>
            <Ico size={14} /><span style={{ flex: 1 }}>{r.titulo}</span><small style={{ color: 'var(--texto-3)' }}>{r.detalle}</small>
          </button>
        )
      })}
    </>
  )
}
