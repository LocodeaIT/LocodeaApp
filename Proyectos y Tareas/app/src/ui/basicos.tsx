/**
 * Componentes de UI reutilizables: avatar, chips, modal, panel lateral,
 * avisos, progreso, campos… Sin lógica de negocio.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Info, Minus, X, User } from 'lucide-react'
import type { Miembro, Prioridad, Proyecto } from '../domain/types'
import { ETIQUETA_PRIORIDAD } from '../domain/types'
import { useApp } from '../store'
import { Select, type Opcion } from './Select'

export function Avatar({ miembro, tamano, titulo }: { miembro: Miembro | null | undefined; tamano?: 'pequeno' | 'grande'; titulo?: string }) {
  // Sin persona asignada se muestra una silueta tenue: un interrogante sobre
  // un circulo punteado parecia un error de carga.
  if (!miembro) return <span className={`avatar vacio ${tamano ?? ''}`} title={titulo ?? 'Sin asignar'}><User size={13} /></span>
  return <span className={`avatar ${tamano ?? ''}`} style={{ background: miembro.color }} title={titulo ?? miembro.nombre}>{miembro.iniciales}</span>
}

export function ChipProyecto({ proyecto }: { proyecto: Proyecto | null | undefined }) {
  if (!proyecto) return <span className="chip contorno pequeno">Sin proyecto</span>
  return <span className="chip contorno pequeno"><i className="punto-proyecto" style={{ background: proyecto.color }} />{proyecto.nombre}</span>
}

export function IconoPrioridad({ prioridad, conTexto }: { prioridad: Prioridad; conTexto?: boolean }) {
  const Ico = prioridad === 'alta' ? ChevronUp : prioridad === 'baja' ? ChevronDown : Minus
  return <span className={`prioridad ${prioridad}`} title={`Prioridad ${ETIQUETA_PRIORIDAD[prioridad].toLowerCase()}`}><Ico size={14} strokeWidth={2.5} />{conTexto && ETIQUETA_PRIORIDAD[prioridad]}</span>
}

export function Progreso({ pct, tono, grueso }: { pct: number; tono?: 'ok' | 'aviso' | 'error'; grueso?: boolean }) {
  return <div className={`progreso ${tono ?? ''} ${grueso ? 'grueso' : ''}`}><i style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} /></div>
}

export function Anillo({ pct, tamano = 56, color }: { pct: number | null; tamano?: number; color?: string }) {
  const r = (tamano - 8) / 2
  const c = 2 * Math.PI * r
  const [dibujado, setDibujado] = useState(0)
  useEffect(() => { const t = setTimeout(() => setDibujado(pct ?? 0), 30); return () => clearTimeout(t) }, [pct])
  return (
    <div className="anillo" style={{ width: tamano, height: tamano }}>
      <svg width={tamano} height={tamano}>
        <circle className="fondo" cx={tamano / 2} cy={tamano / 2} r={r} />
        <circle className="valor" cx={tamano / 2} cy={tamano / 2} r={r} strokeDasharray={c} strokeDashoffset={c - (c * dibujado) / 100} style={color ? { stroke: color } : undefined} />
      </svg>
      <span className="texto" style={{ fontSize: tamano < 50 ? 11 : 14 }}>{pct === null ? '–' : `${pct}%`}</span>
    </div>
  )
}

/** Los diálogos se montan en <body> para que ningún ancestro (scroll, animaciones) les afecte. */
export function Modal({ titulo, onCerrar, children, pie, ancho }: { titulo: string; onCerrar: () => void; children: ReactNode; pie?: ReactNode; ancho?: boolean }) {
  useEscape(onCerrar)
  useBloqueoScroll()
  return createPortal(
    <div className="velo" onMouseDown={e => { if (e.target === e.currentTarget) onCerrar() }}>
      <div className={`modal ${ancho ? 'ancho' : ''}`} role="dialog" aria-modal>
        <div className="modal-cabecera">
          <h2>{titulo}</h2>
          <button className="btn sutil icono" onClick={onCerrar} aria-label="Cerrar"><X size={18} /></button>
        </div>
        <div className="modal-cuerpo">{children}</div>
        {pie && <div className="modal-pie">{pie}</div>}
      </div>
    </div>,
    document.body,
  )
}

export function Panel({ onCerrar, children, cabecera }: { onCerrar: () => void; children: ReactNode; cabecera: ReactNode }) {
  useEscape(onCerrar)
  useBloqueoScroll()
  return createPortal(
    <div className="velo lateral" onMouseDown={e => { if (e.target === e.currentTarget) onCerrar() }}>
      <div className="panel" role="dialog" aria-modal>
        <div className="panel-cabecera">
          <div style={{ flex: 1, minWidth: 0 }}>{cabecera}</div>
          <button className="btn sutil icono" onClick={onCerrar} aria-label="Cerrar"><X size={18} /></button>
        </div>
        <div className="panel-cuerpo">{children}</div>
      </div>
    </div>,
    document.body,
  )
}

function useEscape(fn: () => void) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') fn() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [fn])
}

function useBloqueoScroll() {
  useEffect(() => {
    document.body.classList.add('con-dialogo')
    return () => { if (document.querySelectorAll('.velo').length <= 1) document.body.classList.remove('con-dialogo') }
  }, [])
}

export function Avisos() {
  const { avisos } = useApp()
  return (
    <div className="toasts">
      {avisos.map(a => (
        <div key={a.id} className={`toast ${a.tono}`}>
          {a.tono === 'ok' ? <CheckCircle2 size={18} /> : a.tono === 'error' ? <AlertCircle size={18} /> : <Info size={18} />}
          {a.texto}
        </div>
      ))}
    </div>
  )
}

export function Campo({ label, children }: { label: string; children: ReactNode }) {
  return <div className="campo"><label>{label}</label>{children}</div>
}

export function Vacio({ icono, titulo, texto, accion }: { icono: ReactNode; titulo: string; texto?: string; accion?: ReactNode }) {
  return <div className="vacio">{icono}<b>{titulo}</b>{texto && <span>{texto}</span>}{accion}</div>
}

/** Selector de miembro (avatares clicables, con «todos»). */
export function FiltroPersonas({ valor, onCambio }: { valor: string | null; onCambio: (id: string | null) => void }) {
  const { datos } = useApp()
  return (
    <div className="filtro-personas">
      <span className={`avatar ${valor === null ? 'activo' : ''}`} style={{ background: '#616161' }} onClick={() => onCambio(null)} title="Todos">∗</span>
      {datos.miembros.filter(m => m.activo).map(m => (
        <span key={m.id} className={`avatar ${valor === m.id ? 'activo' : ''}`} style={{ background: m.color }} onClick={() => onCambio(valor === m.id ? null : m.id)} title={m.nombre}>{m.iniciales}</span>
      ))}
    </div>
  )
}

/** Menú desplegable simple que se cierra al hacer clic fuera. */
export function Desplegable({ boton, children, abierto, setAbierto }: { boton: ReactNode; children: ReactNode; abierto: boolean; setAbierto: (v: boolean) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!abierto) return
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [abierto, setAbierto])
  return <div className="menu-usuario" ref={ref}>{boton}{abierto && <div className="menu-flotante">{children}</div>}</div>
}

// ─────────────────────────────────────────────── selects de catálogo

export function SelectMiembro({ valor, onCambio, conNadie = true, sutil, pequeno, ancho }: { valor: string | null; onCambio: (id: string | null) => void; conNadie?: boolean; sutil?: boolean; pequeno?: boolean; ancho?: number | string }) {
  const { datos } = useApp()
  const opciones: Opcion<string>[] = [
    ...(conNadie ? [{ valor: '', etiqueta: 'Sin asignar', icono: <span className="avatar vacio pequeno">?</span> }] : []),
    ...datos.miembros.filter(m => m.activo || m.id === valor).map(m => ({ valor: m.id, etiqueta: m.nombre, icono: <span className="avatar pequeno" style={{ background: m.color }}>{m.iniciales}</span> })),
  ]
  return <Select valor={valor ?? ''} opciones={opciones} onCambio={v => onCambio(v || null)} sutil={sutil} pequeno={pequeno} ancho={ancho} />
}

export function SelectProyecto({ valor, onCambio, textoNinguno = 'Sin proyecto', sutil, pequeno, ancho }: { valor: string | null; onCambio: (id: string | null) => void; textoNinguno?: string; sutil?: boolean; pequeno?: boolean; ancho?: number | string }) {
  const { datos } = useApp()
  const opciones: Opcion<string>[] = [
    { valor: '', etiqueta: textoNinguno, color: '#c8c8c8' },
    ...datos.proyectos.filter(p => p.estado !== 'cerrado' || p.id === valor).map(p => ({ valor: p.id, etiqueta: p.nombre, detalle: p.cliente, color: p.color })),
  ]
  return <Select valor={valor ?? ''} opciones={opciones} onCambio={v => onCambio(v || null)} sutil={sutil} pequeno={pequeno} ancho={ancho} />
}

export const COLORES = ['#0F6CBD', '#C239B3', '#0E7C5B', '#D13438', '#CA5010', '#5B5FC7', '#038387', '#8764B8', '#6B6B6B', '#986F0B']
