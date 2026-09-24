/**
 * Vista de lista: tabla agrupable con columnas configurables, edición en
 * línea de los campos habituales y subtareas desplegables bajo su padre.
 */
import { useState } from 'react'
import { ChevronDown, ChevronRight, CornerDownRight, Plus, Star } from 'lucide-react'
import { useApp } from '../../store'
import { SelectMiembro, SelectProyecto } from '../../ui/basicos'
import { Select } from '../../ui/Select'
import { OPCIONES_PRIORIDAD } from '../Modales'
import { OPCIONES_ESTADO } from '../DetalleTarea'
import type { ColumnaLista, EstadoTarea, Tarea, Vista } from '../../domain/types'
import { COLUMNAS_LISTA } from '../../domain/types'
import { agruparTareas, ordenarTareas, COLOR_ESTADO } from '../../domain/vistas'
import { fechaCorta, relativoVencimiento } from '../../domain/fechas'

interface Props { vista: Vista; tareas: Tarea[]; abrirTarea: (id: string) => void; onNueva: (t: Partial<Tarea>) => void }

export default function Lista({ vista, tareas, abrirTarea, onNueva }: Props) {
  const { datos, guardarTarea, subtareasDe, alternarHecha } = useApp()
  const [cerrados, setCerrados] = useState<Set<string>>(new Set())
  const [plegadas, setPlegadas] = useState<Set<string>>(new Set())
  // En la lista, las subtareas van bajo su padre aunque el filtro las incluya
  const raiz = tareas.filter(t => !t.padreId || !tareas.some(x => x.id === t.padreId))
  const grupos = agruparTareas(ordenarTareas(raiz, vista.ordenar, vista.ordenDesc), vista.agrupar, datos).filter(g => g.tareas.length || vista.agrupar === 'ninguno')
  const cols = vista.columnas
  const alternarSet = (s: Set<string>, id: string) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n }

  const celda = (t: Tarea, c: ColumnaLista) => {
    const cambiar = (parcial: Partial<Tarea>) => void guardarTarea({ ...t, ...parcial })
    switch (c) {
      case 'proyecto': return <span onClick={e => e.stopPropagation()}><SelectProyecto valor={t.proyectoId} onCambio={v => cambiar({ proyectoId: v })} sutil pequeno /></span>
      case 'asignado': return <span onClick={e => e.stopPropagation()}><SelectMiembro valor={t.asignadoId} onCambio={v => cambiar({ asignadoId: v })} sutil pequeno /></span>
      case 'estado': return <span onClick={e => e.stopPropagation()}><Select valor={t.estado} onCambio={v => cambiar({ estado: v as EstadoTarea })} opciones={OPCIONES_ESTADO} sutil pequeno colorTexto={COLOR_ESTADO[t.estado]} /></span>
      case 'prioridad': return <span onClick={e => e.stopPropagation()}><Select valor={t.prioridad} onCambio={v => cambiar({ prioridad: v })} opciones={OPCIONES_PRIORIDAD} sutil pequeno /></span>
      case 'inicio': return <input type="date" className="celda-fecha" value={t.inicio ?? ''} onChange={e => cambiar({ inicio: e.target.value || null })} onClick={e => e.stopPropagation()} />
      case 'vence': { const v = t.vence && t.estado !== 'hecha' ? relativoVencimiento(t.vence) : null; return (
        <span className="celda-persona" onClick={e => e.stopPropagation()}>
          <input type="date" className={`celda-fecha ${v ? 'vence ' + v.tono : ''}`} value={t.vence ?? ''} onChange={e => cambiar({ vence: e.target.value || null })} />
          {v && <small className={`vence ${v.tono}`}>{v.texto}</small>}
        </span>) }
      case 'objetivo': { const o = datos.objetivos.find(x => x.id === t.objetivoId); return <span className="celda-texto" title={o?.titulo}>{o?.titulo ?? <span style={{ color: 'var(--texto-3)' }}>—</span>}</span> }
      case 'etiquetas': return <span style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>{t.etiquetas.map(e => <span key={e} className="chip pequeno acento">{e}</span>)}</span>
      case 'subtareas': { const s = subtareasDe(t.id); return s.length ? <span className="celda-sub"><span className="progreso" style={{ width: 60 }}><i style={{ width: `${(s.filter(x => x.estado === 'hecha').length / s.length) * 100}%` }} /></span>{s.filter(x => x.estado === 'hecha').length}/{s.length}</span> : <span style={{ color: 'var(--texto-3)' }}>—</span> }
      case 'creadoEl': return <span style={{ color: 'var(--texto-3)', fontSize: 12 }}>{fechaCorta(t.creadoEl.slice(0, 10))}</span>
    }
  }

  const fila = (t: Tarea, nivel: number): React.ReactNode => {
    const subs = subtareasDe(t.id)
    const plegada = plegadas.has(t.id)
    return (
      <>
        <tr key={t.id} className={`fila-tarea ${t.estado === 'hecha' ? 'hecha' : ''}`} onClick={() => abrirTarea(t.id)}>
          <td className="celda-titulo" style={{ paddingLeft: 12 + nivel * 22 }}>
            <span className="fila-titulo">
              {subs.length > 0
                ? <button className="btn sutil icono pequeno plegar" onClick={e => { e.stopPropagation(); setPlegadas(alternarSet(plegadas, t.id)) }}>{plegada ? <ChevronRight size={14} /> : <ChevronDown size={14} />}</button>
                : nivel > 0 ? <CornerDownRight size={13} style={{ color: 'var(--texto-3)', margin: '0 6px' }} /> : <span style={{ width: 26, display: 'inline-block' }} />}
              <span className={`check ${t.estado === 'hecha' ? 'hecho' : ''}`} onClick={e => { e.stopPropagation(); void alternarHecha(t.id) }} />
              <span className="texto">{t.importante && <Star size={12} fill="var(--bronze)" stroke="var(--bronze)" style={{ marginRight: 4, verticalAlign: -1 }} />}{t.titulo}</span>
              {subs.length > 0 && <span className="chip pequeno contorno">{subs.length}</span>}
            </span>
          </td>
          {cols.map(c => <td key={c} className={`celda-${c}`}>{celda(t, c)}</td>)}
          <td className="celda-acciones"><button className="btn sutil icono pequeno" title="Añadir subtarea" onClick={e => { e.stopPropagation(); onNueva({ padreId: t.id, proyectoId: t.proyectoId, asignadoId: t.asignadoId ?? undefined, objetivoId: t.objetivoId }) }}><Plus size={13} /></button></td>
        </tr>
        {!plegada && subs.map(s => fila(s, nivel + 1))}
      </>
    )
  }

  return (
    <div className="lista-contenedor tarjeta">
      <table className="tabla lista-tareas">
        <thead>
          <tr>
            <th>Tarea</th>
            {cols.map(c => <th key={c} className={`celda-${c}`}>{COLUMNAS_LISTA.find(x => x.id === c)?.nombre}</th>)}
            <th style={{ width: 40 }} />
          </tr>
        </thead>
        <tbody>
          {grupos.map(g => (
            <GrupoFilas key={g.clave} nombre={g.nombre} color={g.color} n={g.tareas.length} hechas={g.tareas.filter(t => t.estado === 'hecha').length} cerrado={cerrados.has(g.clave)} onPlegar={() => setCerrados(alternarSet(cerrados, g.clave))} ncols={cols.length + 2} sinCabecera={vista.agrupar === 'ninguno'}
              onNueva={() => onNueva({ proyectoId: vista.filtros.proyectoId, asignadoId: vista.filtros.asignadoId ?? undefined, ...g.cambio })}>
              {g.tareas.map(t => fila(t, 0))}
            </GrupoFilas>
          ))}
          {!tareas.length && <tr><td colSpan={cols.length + 2} style={{ textAlign: 'center', color: 'var(--texto-3)', padding: 32 }}>No hay tareas con estos filtros.</td></tr>}
        </tbody>
      </table>
    </div>
  )
}

function GrupoFilas({ nombre, color, n, hechas, cerrado, onPlegar, ncols, sinCabecera, onNueva, children }: { nombre: string; color: string; n: number; hechas: number; cerrado: boolean; onPlegar: () => void; ncols: number; sinCabecera: boolean; onNueva: () => void; children: React.ReactNode }) {
  return (
    <>
      {!sinCabecera && (
        <tr className="fila-grupo" onClick={onPlegar}>
          <td colSpan={ncols}>
            <span className="grupo-cabecera">
              {cerrado ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
              <i className="punto-proyecto" style={{ background: color }} />
              <b>{nombre}</b>
              <span className="n">{n}</span>
              {n > 0 && <span className="horas">{hechas}/{n} hechas</span>}
              <button className="btn sutil icono pequeno" style={{ marginLeft: 4 }} onClick={e => { e.stopPropagation(); onNueva() }} title="Nueva tarea en este grupo"><Plus size={13} /></button>
            </span>
          </td>
        </tr>
      )}
      {!cerrado && children}
    </>
  )
}
