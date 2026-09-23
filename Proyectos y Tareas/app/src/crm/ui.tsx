/**
 * Piezas pequeñas del CRM que se repiten en listas, fichas y paneles: chip de
 * estado, enlace a un registro, propietario, fechas y avatar de iniciales.
 */
import type { ReactNode } from 'react'
import { useApp } from '../store'
import { Avatar } from '../ui/basicos'
import { useCrm } from './contexto'
import { tonoDe } from './catalogos'
import { nombreRegistro, registroDe } from './consultas'
import { fecha, iniciales, pasada } from './formato'
import type { ColEntidad } from './types'

export function ChipEstado({ estado, etiqueta, solido }: { estado: string; etiqueta?: string; solido?: boolean }) {
  const tono = tonoDe(estado)
  const clase = tono === 'apagado' ? 'contorno' : tono
  return <span className={`chip pequeno ${solido ? '' : 'punto'} ${clase}`}>{etiqueta ?? estado}</span>
}

/** Enlace a la ficha de otro registro. Sin registro, un guion. */
export function Enlace({ col, id, texto }: { col: ColEntidad; id: string | null | undefined; texto?: ReactNode }) {
  const { datos, abrir } = useCrm()
  const o = registroDe(datos, col, id)
  if (!o || !id) return <span className="crm-apagado">—</span>
  return (
    <button type="button" className="crm-enlace" onClick={e => { e.stopPropagation(); abrir(col, id) }}>
      {texto ?? nombreRegistro(datos, col, o)}
    </button>
  )
}

export function Propietario({ id, corto }: { id: string | null | undefined; corto?: boolean }) {
  const { miembro } = useApp()
  const m = miembro(id)
  if (!m) return <span className="crm-apagado">—</span>
  return <span className="crm-persona"><Avatar miembro={m} tamano="pequeno" />{corto ? m.nombre.split(' ')[0] : m.nombre}</span>
}

/** Fecha de día; en rojo si ya pasó y `avisar` lo pide (vencimientos). */
export function Fecha({ dia, avisar, texto }: { dia: string | null | undefined; avisar?: boolean; texto?: string }) {
  if (!dia) return <span className="crm-apagado">—</span>
  return <span className={avisar && pasada(dia) ? 'crm-tarde' : undefined}>{texto ?? fecha(dia)}</span>
}

/** Avatar de iniciales en arena (cuentas y contactos). */
export function Iniciales({ nombre, cuadrado, grande }: { nombre: string; cuadrado?: boolean; grande?: boolean }) {
  return <span className={`crm-iniciales ${cuadrado ? 'cuadrado' : ''} ${grande ? 'grande' : ''}`} aria-hidden>{iniciales(nombre)}</span>
}

/** Nombre con avatar y subtítulo (primera columna de cuentas y contactos). */
export function Quien({ nombre, sub, cuadrado }: { nombre: string; sub?: string; cuadrado?: boolean }) {
  return (
    <span className="crm-quien">
      <Iniciales nombre={nombre} cuadrado={cuadrado} />
      <span><b>{nombre}</b>{sub && <small>{sub}</small>}</span>
    </span>
  )
}
