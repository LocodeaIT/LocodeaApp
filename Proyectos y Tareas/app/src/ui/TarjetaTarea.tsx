/**
 * Tarjeta de tarea del tablero (también se usa en Proyectos). Solo presenta:
 * el arrastre y el clic los pone quien la envuelve.
 */
import { Calendar, Check, CheckSquare, GitBranch, MessageSquare, Star, Target } from 'lucide-react'
import { useApp } from '../store'
import { Avatar, IconoPrioridad } from './basicos'
import type { Tarea } from '../domain/types'
import { relativoVencimiento } from '../domain/fechas'

export function TarjetaTarea({ tarea: t, arrastrando, overlay, onAlternar }: { tarea: Tarea; arrastrando?: boolean; overlay?: boolean; onAlternar?: () => void }) {
  const { miembro, proyecto, objetivo, actividadDe, subtareasDe } = useApp()
  const p = proyecto(t.proyectoId)
  const o = objetivo(t.objetivoId)
  const v = t.vence && t.estado !== 'hecha' ? relativoVencimiento(t.vence) : null
  const hechos = t.checklist.filter(c => c.hecho).length
  const subs = subtareasDe(t.id)
  const subsHechas = subs.filter(s => s.estado === 'hecha').length
  const comentarios = actividadDe('tarea', t.id).filter(a => a.tipo === 'comentario').length
  return (
    <div className={`tarea-card prio-${t.prioridad} ${t.estado === 'hecha' ? 'hecha' : ''} ${arrastrando ? 'arrastrando' : ''} ${overlay ? 'overlay' : ''}`}>
      {p && <div className="proyecto"><i className="punto-proyecto" style={{ background: p.color }} />{p.nombre}</div>}
      <div className="titulo-fila">
        {onAlternar && (
          <span className={`check ${t.estado === 'hecha' ? 'hecho' : ''}`} title={t.estado === 'hecha' ? 'Marcar como pendiente' : 'Marcar como hecha'}
            onPointerDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); onAlternar() }}><Check size={11} strokeWidth={3} /></span>
        )}
        <div className="titulo">{t.importante && <Star size={12} fill="var(--bronze)" stroke="var(--bronze)" style={{ marginRight: 4, verticalAlign: -1 }} />}{t.titulo}</div>
      </div>
      {o && <span className="objetivo-link" title={o.titulo}><Target size={11} />{o.titulo}</span>}
      {t.etiquetas.length > 0 && <div className="etiquetas">{t.etiquetas.map(e => <span key={e} className="chip pequeno acento">{e}</span>)}</div>}
      {subs.length > 0 && (
        <div className="subtareas-mini">
          <div className="progreso"><i style={{ width: `${(subsHechas / subs.length) * 100}%` }} /></div>
          <span><GitBranch size={11} />{subsHechas}/{subs.length}</span>
        </div>
      )}
      <div className="meta">
        <IconoPrioridad prioridad={t.prioridad} />
        {v && <span className={`vence ${v.tono}`}><Calendar size={12} />{v.texto}</span>}
        {t.checklist.length > 0 && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><CheckSquare size={12} />{hechos}/{t.checklist.length}</span>}
        {comentarios > 0 && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><MessageSquare size={12} />{comentarios}</span>}
        <div className="derecha">
          <Avatar miembro={miembro(t.asignadoId)} tamano="pequeno" />
        </div>
      </div>
    </div>
  )
}
