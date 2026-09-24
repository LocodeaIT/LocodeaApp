/**
 * Panel lateral con el detalle completo de una tarea: propiedades editables,
 * subtareas, pasos, comentarios y actividad. Guarda al vuelo, campo a campo.
 */
import { useEffect, useMemo, useState } from 'react'
import { Check, CornerLeftUp, GitBranch, MessageSquare, Plus, Send, Star, Sun, Trash2, X } from 'lucide-react'
import { useApp } from '../store'
import { Avatar, Panel, SelectMiembro, SelectProyecto, confirmar } from '../ui/basicos'
import { Select } from '../ui/Select'
import { ModalTarea, OPCIONES_PRIORIDAD } from './Modales'
import type { EstadoTarea, Tarea } from '../domain/types'
import { ETIQUETA_ESTADO_TAREA, ORDEN_ESTADOS_TAREA } from '../domain/types'
import { COLOR_ESTADO } from '../domain/vistas'
import { fechaHora, lunesDe, hoy, relativoVencimiento } from '../domain/fechas'
import { nuevoId } from '../data/repo'

export const OPCIONES_ESTADO = ORDEN_ESTADOS_TAREA.map(e => ({ valor: e, etiqueta: ETIQUETA_ESTADO_TAREA[e], color: COLOR_ESTADO[e] }))

export function DetalleTarea({ id, onCerrar, onAbrirOtra }: { id: string; onCerrar: () => void; onAbrirOtra: (id: string) => void }) {
  const { datos, yo, miembro, guardarTarea, borrarTarea, comentar, actividadDe, semanaDe, subtareasDe, alternarHecha } = useApp()
  const tarea = datos.tareas.find(t => t.id === id)
  const subtareas = subtareasDe(id)
  const padre = tarea?.padreId ? datos.tareas.find(t => t.id === tarea.padreId) : null
  const [nuevaSub, setNuevaSub] = useState(false)
  const [titulo, setTitulo] = useState(tarea?.titulo ?? '')
  const [descripcion, setDescripcion] = useState(tarea?.descripcion ?? '')
  const [nuevoItem, setNuevoItem] = useState('')
  const [comentario, setComentario] = useState('')
  const [etiqueta, setEtiqueta] = useState('')

  useEffect(() => { if (tarea) { setTitulo(tarea.titulo); setDescripcion(tarea.descripcion) } }, [tarea?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const semanaActual = semanaDe(lunesDe(hoy()))
  const objetivosElegibles = useMemo(() => datos.objetivos.filter(o =>
    (semanaActual && o.semanaId === semanaActual.id) || o.id === tarea?.objetivoId,
  ), [datos.objetivos, semanaActual, tarea?.objetivoId])

  if (!tarea) return null
  const t = tarea
  const cambiar = (parcial: Partial<Tarea>) => void guardarTarea({ ...t, ...parcial })
  const actividad = actividadDe('tarea', t.id)

  const guardarTitulo = () => { if (titulo.trim() && titulo !== t.titulo) cambiar({ titulo: titulo.trim() }) }
  const guardarDescripcion = () => { if (descripcion !== t.descripcion) cambiar({ descripcion }) }

  const anadirItem = () => {
    if (!nuevoItem.trim()) return
    cambiar({ checklist: [...t.checklist, { id: nuevoId(), texto: nuevoItem.trim(), hecho: false }] })
    setNuevoItem('')
  }
  const hechos = t.checklist.filter(c => c.hecho).length
  const subsHechas = subtareas.filter(s => s.estado === 'hecha').length

  const enviarComentario = () => {
    if (!comentario.trim()) return
    void comentar('tarea', t.id, comentario.trim())
    setComentario('')
  }

  return (
    <Panel onCerrar={onCerrar} cabecera={
      <div>
        {padre && <button className="btn sutil pequeno" style={{ marginBottom: 4, marginLeft: -8 }} onClick={() => onAbrirOtra(padre.id)}><CornerLeftUp size={13} /> {padre.titulo}</button>}
        <div style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <Select valor={t.estado} onCambio={v => cambiar({ estado: v as EstadoTarea })} opciones={OPCIONES_ESTADO} pequeno colorTexto={COLOR_ESTADO[t.estado]} />
          <button className={`btn pequeno ${t.miDia ? 'primario' : ''}`} onClick={() => cambiar({ miDia: !t.miDia })}><Sun size={13} /> {t.miDia ? 'En Mi día' : 'Añadir a Mi día'}</button>
          <button className={`btn pequeno icono ${t.importante ? 'primario' : ''}`} onClick={() => cambiar({ importante: !t.importante })} title="Importante"><Star size={13} fill={t.importante ? 'currentColor' : 'none'} /></button>
          {t.personal && <span className="chip pequeno morado">Personal</span>}
        </div>
        <textarea className="titulo-editable" rows={2} value={titulo} onChange={e => setTitulo(e.target.value)} onBlur={guardarTitulo}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLTextAreaElement).blur() } }} />
      </div>
    }>
      <div className="propiedades">
        <span className="etiqueta">Asignada a</span>
        <SelectMiembro valor={t.asignadoId} onCambio={v => cambiar({ asignadoId: v })} sutil />
        <span className="etiqueta">Proyecto</span>
        <SelectProyecto valor={t.proyectoId} onCambio={v => cambiar({ proyectoId: v })} sutil />
        <span className="etiqueta">Objetivo semanal</span>
        <Select valor={t.objetivoId ?? ''} onCambio={v => cambiar({ objetivoId: v || null })} sutil
          opciones={[{ valor: '', etiqueta: 'Ninguno' }, ...objetivosElegibles.map(o => ({ valor: o.id, etiqueta: o.titulo, detalle: miembro(o.responsableId)?.iniciales }))]} />
        <span className="etiqueta">Prioridad</span>
        <Select valor={t.prioridad} onCambio={v => cambiar({ prioridad: v })} opciones={OPCIONES_PRIORIDAD} sutil ancho={160} />
        <span className="etiqueta">Fechas</span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input type="date" value={t.inicio ?? ''} title="Inicio" onChange={e => cambiar({ inicio: e.target.value || null })} />
          <span style={{ color: 'var(--texto-3)' }}>→</span>
          <input type="date" value={t.vence ?? ''} title="Vence" onChange={e => cambiar({ vence: e.target.value || null })} />
        </div>
        <span className="etiqueta">Etiquetas</span>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
          {t.etiquetas.map(et => <span key={et} className="chip acento pequeno">{et}<X size={11} style={{ cursor: 'pointer' }} onClick={() => cambiar({ etiquetas: t.etiquetas.filter(x => x !== et) })} /></span>)}
          <input value={etiqueta} placeholder="+ etiqueta" style={{ width: 100, height: 24, fontSize: 12 }} onChange={e => setEtiqueta(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && etiqueta.trim()) { cambiar({ etiquetas: [...new Set([...t.etiquetas, etiqueta.trim()])] }); setEtiqueta('') } }} />
        </div>
      </div>

      <div>
        <div className="seccion-titulo">Descripción</div>
        <textarea className="campo" style={{ width: '100%', minHeight: 70, border: '1px solid var(--borde)', borderRadius: 4, padding: 8, resize: 'vertical' }}
          placeholder="Añade contexto, enlaces, criterios de aceptación…" value={descripcion} onChange={e => setDescripcion(e.target.value)} onBlur={guardarDescripcion} />
      </div>

      <div>
        <div className="seccion-titulo">
          <span><GitBranch size={12} style={{ verticalAlign: -2 }} /> Subtareas {subtareas.length > 0 && <span style={{ fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>· {subsHechas}/{subtareas.length}</span>}</span>
          <button className="btn sutil pequeno" onClick={() => setNuevaSub(true)}><Plus size={13} /> Subtarea</button>
        </div>
        {subtareas.length > 0 && <div style={{ marginBottom: 8 }}><div className="progreso"><i style={{ width: `${(subsHechas / subtareas.length) * 100}%` }} /></div></div>}
        <div className="checklist">
          {subtareas.map(s => (
            <div key={s.id} className={`checklist-item subtarea ${s.estado === 'hecha' ? 'hecho' : ''}`} onClick={() => onAbrirOtra(s.id)}>
              <span className={`check ${s.estado === 'hecha' ? 'hecho' : ''}`} onClick={e => { e.stopPropagation(); void alternarHecha(s.id) }}><Check size={11} strokeWidth={3} /></span>
              <span style={{ flex: 1 }}>{s.titulo}</span>
              {s.vence && <small className={`vence ${relativoVencimiento(s.vence).tono}`}>{relativoVencimiento(s.vence).texto}</small>}
              <span className={`chip pequeno ${s.estado === 'hecha' ? 'ok' : s.estado === 'en_curso' ? 'acento' : s.estado === 'bloqueada' ? 'error' : ''}`}>{ETIQUETA_ESTADO_TAREA[s.estado]}</span>
              <Avatar miembro={miembro(s.asignadoId)} tamano="pequeno" />
            </div>
          ))}
          {!subtareas.length && <span style={{ fontSize: 12, color: 'var(--texto-3)', padding: '2px 6px' }}>Divide la tarea en partes asignables con fechas propias.</span>}
        </div>
      </div>

      <div>
        <div className="seccion-titulo"><span>Pasos {t.checklist.length > 0 && <span style={{ fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>· {hechos}/{t.checklist.length}</span>}</span></div>
        {t.checklist.length > 0 && <div style={{ marginBottom: 8 }}><div className="progreso"><i style={{ width: `${(hechos / t.checklist.length) * 100}%` }} /></div></div>}
        <div className="checklist">
          {t.checklist.map(c => (
            <div key={c.id} className={`checklist-item ${c.hecho ? 'hecho' : ''}`}>
              <span className={`check cuadrado ${c.hecho ? 'hecho' : ''}`} onClick={() => cambiar({ checklist: t.checklist.map(x => (x.id === c.id ? { ...x, hecho: !x.hecho } : x)) })}><Check size={12} strokeWidth={3} /></span>
              <input value={c.texto} onChange={e => cambiar({ checklist: t.checklist.map(x => (x.id === c.id ? { ...x, texto: e.target.value } : x)) })} />
              <button className="btn sutil icono pequeno quitar" onClick={() => cambiar({ checklist: t.checklist.filter(x => x.id !== c.id) })}><X size={13} /></button>
            </div>
          ))}
          <div className="anadir-linea">
            <Plus size={16} />
            <input placeholder="Añadir paso…" value={nuevoItem} onChange={e => setNuevoItem(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') anadirItem() }} onBlur={anadirItem} />
          </div>
        </div>
      </div>

      <div>
        <div className="seccion-titulo"><span><MessageSquare size={12} style={{ verticalAlign: -2 }} /> Comentarios y actividad</span></div>
        <div className="comentar" style={{ marginBottom: 14 }}>
          <Avatar miembro={yo} tamano="pequeno" />
          <textarea placeholder="Escribe un comentario…" value={comentario} onChange={e => setComentario(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) enviarComentario() }} />
          <button className="btn primario icono" onClick={enviarComentario} disabled={!comentario.trim()} title="Enviar (Ctrl+Enter)"><Send size={15} /></button>
        </div>
        <div className="actividad">
          {[...actividad].reverse().map(a => (
            <div key={a.id} className={`actividad-item ${a.tipo}`}>
              <Avatar miembro={miembro(a.autorId)} tamano="pequeno" />
              <div className="cuerpo">
                <div className="quien"><b>{miembro(a.autorId)?.nombre ?? 'Alguien'}</b> · {fechaHora(a.fecha)}</div>
                <div className="texto">{a.texto}</div>
              </div>
            </div>
          ))}
          {!actividad.length && <span style={{ color: 'var(--texto-3)', fontSize: 13 }}>Todavía no hay actividad.</span>}
        </div>
      </div>

      <div style={{ marginTop: 'auto', paddingTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: 'var(--texto-3)' }}>Creada por {miembro(t.creadoPorId)?.nombre ?? '—'} · {fechaHora(t.creadoEl)}</span>
        <button className="btn peligro pequeno" onClick={async () => { if (await confirmar(subtareas.length ? `¿Borrar esta tarea y sus ${subtareas.length} subtareas?` : '¿Borrar esta tarea?', { aceptar: 'Borrar', peligro: true })) { void borrarTarea(t.id); onCerrar() } }}><Trash2 size={13} /> Borrar</button>
      </div>
      {nuevaSub && <ModalTarea inicial={{ padreId: t.id, proyectoId: t.proyectoId, asignadoId: t.asignadoId ?? undefined, objetivoId: t.objetivoId, vence: t.vence }} onCerrar={() => setNuevaSub(false)} />}
    </Panel>
  )
}
