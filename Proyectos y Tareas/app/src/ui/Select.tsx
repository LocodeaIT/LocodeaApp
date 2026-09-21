/**
 * Desplegable propio (sustituye al <select> nativo): botón + lista flotante
 * con el mismo estilo en toda la app, soporte de teclado, icono/color por
 * opción y variante compacta para celdas y cabeceras.
 */
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown } from 'lucide-react'

export interface Opcion<T extends string = string> {
  valor: T
  etiqueta: string
  /** Texto secundario a la derecha. */
  detalle?: string
  icono?: ReactNode
  /** Punto de color a la izquierda. */
  color?: string
}

interface Props<T extends string> {
  valor: T
  opciones: Opcion<T>[]
  onCambio: (v: T) => void
  placeholder?: string
  /** Sin borde ni fondo hasta pasar el ratón (celdas de tabla, propiedades). */
  sutil?: boolean
  pequeno?: boolean
  ancho?: number | string
  /** Color de texto del botón (p. ej. estado). */
  colorTexto?: string
  deshabilitado?: boolean
  alineacion?: 'izquierda' | 'derecha'
}

export function Select<T extends string>({ valor, opciones, onCambio, placeholder = 'Elegir…', sutil, pequeno, ancho, colorTexto, deshabilitado, alineacion = 'izquierda' }: Props<T>) {
  const [abierto, setAbierto] = useState(false)
  const [activo, setActivo] = useState(0)
  const boton = useRef<HTMLButtonElement>(null)
  const lista = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number; width: number; arriba: boolean }>({ top: 0, left: 0, width: 0, arriba: false })
  const actual = opciones.find(o => o.valor === valor)

  useLayoutEffect(() => {
    if (!abierto || !boton.current) return
    const r = boton.current.getBoundingClientRect()
    const alto = Math.min(320, opciones.length * 34 + 12)
    const arriba = r.bottom + alto > window.innerHeight - 8 && r.top > alto
    const width = Math.max(r.width, 180)
    const left = alineacion === 'derecha' ? Math.max(8, r.right - width) : Math.min(r.left, window.innerWidth - width - 8)
    setPos({ top: arriba ? r.top - 4 : r.bottom + 4, left, width, arriba })
    setActivo(Math.max(0, opciones.findIndex(o => o.valor === valor)))
  }, [abierto, opciones, valor, alineacion])

  useEffect(() => {
    if (!abierto) return
    const cerrar = (e: MouseEvent) => {
      if (lista.current?.contains(e.target as Node) || boton.current?.contains(e.target as Node)) return
      setAbierto(false)
    }
    const scroll = () => setAbierto(false)
    document.addEventListener('mousedown', cerrar)
    window.addEventListener('resize', scroll)
    document.addEventListener('scroll', scroll, true)
    return () => { document.removeEventListener('mousedown', cerrar); window.removeEventListener('resize', scroll); document.removeEventListener('scroll', scroll, true) }
  }, [abierto])

  useEffect(() => {
    if (!abierto) return
    lista.current?.querySelectorAll<HTMLElement>('.select-opcion')[activo]?.scrollIntoView({ block: 'nearest' })
  }, [activo, abierto])

  const elegir = (v: T) => { onCambio(v); setAbierto(false); boton.current?.focus() }
  const teclas = (e: React.KeyboardEvent) => {
    if (deshabilitado) return
    if (!abierto && (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setAbierto(true); return }
    if (!abierto) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActivo(a => Math.min(opciones.length - 1, a + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActivo(a => Math.max(0, a - 1)) }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); elegir(opciones[activo].valor) }
    else if (e.key === 'Escape') { e.preventDefault(); setAbierto(false) }
    else if (e.key === 'Tab') setAbierto(false)
  }

  return (
    <>
      <button ref={boton} type="button" disabled={deshabilitado} className={`select ${sutil ? 'sutil' : ''} ${pequeno ? 'pequeno' : ''} ${abierto ? 'abierto' : ''} ${!actual ? 'vacio' : ''}`}
        style={{ width: ancho, color: colorTexto }} onClick={e => { e.stopPropagation(); setAbierto(a => !a) }} onKeyDown={teclas} aria-haspopup="listbox" aria-expanded={abierto}>
        {actual?.color && <i className="punto-proyecto" style={{ background: actual.color }} />}
        {actual?.icono}
        <span className="select-texto">{actual?.etiqueta ?? placeholder}</span>
        <ChevronDown size={pequeno ? 13 : 15} className="select-flecha" />
      </button>
      {abierto && createPortal(
        <div ref={lista} className={`select-lista ${pos.arriba ? 'arriba' : ''}`} role="listbox" style={{ top: pos.arriba ? undefined : pos.top, bottom: pos.arriba ? window.innerHeight - pos.top : undefined, left: pos.left, width: pos.width }} onMouseDown={e => e.stopPropagation()}>
          {opciones.map((o, i) => (
            <div key={o.valor} role="option" aria-selected={o.valor === valor} className={`select-opcion ${o.valor === valor ? 'elegida' : ''} ${i === activo ? 'activa' : ''}`}
              onMouseEnter={() => setActivo(i)} onClick={() => elegir(o.valor)}>
              {o.color && <i className="punto-proyecto" style={{ background: o.color }} />}
              {o.icono}
              <span className="select-texto">{o.etiqueta}</span>
              {o.detalle && <small>{o.detalle}</small>}
              {o.valor === valor && <Check size={14} className="select-check" />}
            </div>
          ))}
        </div>,
        document.body,
      )}
    </>
  )
}
