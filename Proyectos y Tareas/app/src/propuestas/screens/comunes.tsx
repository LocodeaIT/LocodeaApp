/**
 * Piezas pequeñas de Propuestas que se repiten en el tablero, la lista y la
 * ficha: la insignia del cliente, el chip de estado y la barra de probabilidad.
 */
import type { EstadoPropuesta } from '../types'
import { ETIQUETA_ESTADO_PROPUESTA } from '../types'
import { colorCliente, inicialesCliente } from '../calculos'

export function InsigniaCliente({ nombre, tam = 30 }: { nombre: string; tam?: number }) {
  const color = colorCliente(nombre || '?')
  return (
    <span className="prop-insignia" style={{ width: tam, height: tam, fontSize: tam * .38, color, background: `color-mix(in srgb, ${color} 14%, transparent)` }} aria-hidden>
      {inicialesCliente(nombre)}
    </span>
  )
}

export function ChipEstado({ estado, pequeno }: { estado: EstadoPropuesta; pequeno?: boolean }) {
  return <span className={`prop-chip-estado ${pequeno ? 'pequeno' : ''}`} data-estado={estado}><i />{ETIQUETA_ESTADO_PROPUESTA[estado]}</span>
}

export function BarraProbabilidad({ pct }: { pct: number }) {
  return (
    <span className="prop-prob" title={`${pct} % de probabilidad`}>
      <span className="prop-prob-barra"><i style={{ width: `${pct}%` }} /></span>
      <b>{pct}%</b>
    </span>
  )
}
