/**
 * Proyectos: tarjetas con salud del proyecto y detalle con sus objetivos y
 * tareas. Preparado para enlazar con el CRM financiero (horas, cliente).
 */
import { useMemo, useState } from 'react'
import { ArrowLeft, Calendar, Clock, Pencil, Plus, Target } from 'lucide-react'
import { useApp } from '../store'
import { Anillo, Avatar, IconoPrioridad, Progreso, Vacio } from '../ui/basicos'
import { ModalProyecto, ModalTarea } from './Modales'
import { TarjetaTarea } from '../ui/TarjetaTarea'
import { saludProyectos } from '../domain/metricas'
import { ETIQUETA_ESTADO_OBJETIVO, ETIQUETA_ESTADO_PROYECTO, ETIQUETA_ESTADO_TAREA, ORDEN_ESTADOS_TAREA, type EstadoProyecto, type Proyecto } from '../domain/types'
import { etiquetaSemanaCorta, fechaCorta } from '../domain/fechas'

export default function Proyectos({ abrirTarea }: { abrirTarea: (id: string) => void }) {
  const { datos, miembro } = useApp()
  const [filtro, setFiltro] = useState<EstadoProyecto | 'todos'>('activo')
  const [editar, setEditar] = useState<Proyecto | null | 'nuevo'>(null)
  const [abierto, setAbierto] = useState<string | null>(null)

  const salud = useMemo(() => saludProyectos(datos.proyectos, datos.tareas, datos.objetivos), [datos])
  const visibles = salud.filter(s => filtro === 'todos' || s.proyecto.estado === filtro)

  if (abierto) {
    const p = datos.proyectos.find(x => x.id === abierto)
    if (p) return <DetalleProyecto proyecto={p} onVolver={() => setAbierto(null)} onEditar={() => setEditar(p)} abrirTarea={abrirTarea} editar={editar} setEditar={setEditar} />
  }

  return (
    <div className="pagina">
      <div className="titulo-pagina">
        <div><h1>Proyectos.</h1><div className="sub">Lo que tenemos entre manos, por cliente</div></div>
        <div className="acciones">
          <div className="selector">
            {(['activo', 'pausado', 'cerrado', 'todos'] as const).map(f => <button key={f} className={filtro === f ? 'activo' : ''} onClick={() => setFiltro(f)}>{f === 'todos' ? 'Todos' : ETIQUETA_ESTADO_PROYECTO[f]}</button>)}
          </div>
          <button className="btn primario" onClick={() => setEditar('nuevo')}><Plus size={15} /> Nuevo proyecto</button>
        </div>
      </div>
      {visibles.length === 0 && <Vacio icono={<Target size={36} />} titulo="No hay proyectos en este estado" />}
      <div className="proyectos-grid">
        {visibles.map((s, i) => (
          <div key={s.proyecto.id} className={`tarjeta proyecto-card retraso-${Math.min(6, i + 1)}`} style={{ ['--color' as string]: s.proyecto.color }} onClick={() => setAbierto(s.proyecto.id)}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ flex: 1 }}><h3>{s.proyecto.nombre}</h3><div className="cliente">{s.proyecto.cliente}</div></div>
              <Anillo pct={s.pct} tamano={52} color={s.proyecto.color} />
            </div>
            <p style={{ fontSize: 13, color: 'var(--texto-2)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{s.proyecto.descripcion || 'Sin descripción'}</p>
            <div className="stats">
              <span><b>{s.total - s.hechas}</b>abiertas</span>
              <span><b style={{ color: s.vencidas ? 'var(--error)' : undefined }}>{s.vencidas}</b>vencidas</span>
              <span><b>{s.objetivosAbiertos}</b>objetivos</span>
              <span><b>{s.hechas}</b>hechas</span>
            </div>
            <Progreso pct={s.pct} tono={s.vencidas ? 'error' : s.pct >= 70 ? 'ok' : undefined} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--texto-3)' }}>
              <Avatar miembro={miembro(s.proyecto.responsableId)} tamano="pequeno" />
              <span>{miembro(s.proyecto.responsableId)?.nombre ?? 'Sin responsable'}</span>
              {s.proyecto.fechaFin && <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4 }}><Calendar size={12} />{fechaCorta(s.proyecto.fechaFin)}</span>}
              <span className={`chip pequeno ${s.proyecto.estado === 'activo' ? 'ok' : s.proyecto.estado === 'pausado' ? 'aviso' : ''}`}>{ETIQUETA_ESTADO_PROYECTO[s.proyecto.estado]}</span>
            </div>
          </div>
        ))}
      </div>
      {editar && <ModalProyecto inicial={editar === 'nuevo' ? null : editar} onCerrar={() => setEditar(null)} />}
    </div>
  )
}

function DetalleProyecto({ proyecto: p, onVolver, onEditar, abrirTarea, editar, setEditar }: {
  proyecto: Proyecto; onVolver: () => void; onEditar: () => void; abrirTarea: (id: string) => void; editar: Proyecto | null | 'nuevo'; setEditar: (v: Proyecto | null | 'nuevo') => void
}) {
  const { datos, miembro, alternarHecha } = useApp()
  const [pestana, setPestana] = useState<'tareas' | 'objetivos'>('tareas')
  const [nuevaTarea, setNuevaTarea] = useState(false)
  const tareas = datos.tareas.filter(t => t.proyectoId === p.id && !t.padreId)
  const objetivos = datos.objetivos.filter(o => o.proyectoId === p.id)
  const semanaDeId = (id: string) => datos.semanas.find(s => s.id === id)
  const s = saludProyectos([p], datos.tareas, datos.objetivos)[0]

  return (
    <div className="pagina">
      <button className="btn sutil" onClick={onVolver} style={{ marginBottom: 12 }}><ArrowLeft size={15} /> Proyectos</button>
      <div className="titulo-pagina">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ width: 44, height: 44, borderRadius: 12, background: p.color, display: 'grid', placeItems: 'center', color: 'var(--on-accent)', fontWeight: 500, fontSize: 18 }}>{p.nombre.slice(0, 1)}</span>
          <div><h1>{p.nombre}</h1><div className="sub">{p.cliente} · {ETIQUETA_ESTADO_PROYECTO[p.estado]} · responsable {miembro(p.responsableId)?.nombre ?? '—'}</div></div>
        </div>
        <div className="acciones">
          <button className="btn" onClick={onEditar}><Pencil size={14} /> Editar</button>
          <button className="btn primario" onClick={() => setNuevaTarea(true)}><Plus size={15} /> Nueva tarea</button>
        </div>
      </div>

      <div className="kpis">
        <div className="tarjeta kpi"><div className="etiqueta">Avance por tareas</div><div className="valor">{s.pct}<small>%</small></div><div className="pie">{s.hechas} de {s.total} hechas</div></div>
        <div className="tarjeta kpi"><div className="etiqueta">Abiertas</div><div className="valor">{s.total - s.hechas}</div><div className="pie">{datos.tareas.filter(t => t.proyectoId === p.id && t.estado === 'en_curso').length} en curso ahora</div></div>
        <div className="tarjeta kpi"><div className="etiqueta">Vencidas</div><div className="valor" style={{ color: s.vencidas ? 'var(--error)' : undefined }}>{s.vencidas}</div><div className="pie">tareas fuera de plazo</div></div>
        <div className="tarjeta kpi"><div className="etiqueta">Plazo</div><div className="valor" style={{ fontSize: 18 }}>{p.fechaInicio ? fechaCorta(p.fechaInicio) : '–'} → {p.fechaFin ? fechaCorta(p.fechaFin) : '–'}</div><div className="pie">{objetivos.length} objetivos semanales en total</div></div>
      </div>

      {p.descripcion && <div className="tarjeta padded" style={{ marginBottom: 16 }}><p style={{ color: 'var(--texto-2)' }}>{p.descripcion}</p></div>}

      <div className="pestanas">
        <button className={`pestana ${pestana === 'tareas' ? 'activa' : ''}`} onClick={() => setPestana('tareas')}>Tareas<span className="n">{tareas.length}</span></button>
        <button className={`pestana ${pestana === 'objetivos' ? 'activa' : ''}`} onClick={() => setPestana('objetivos')}>Objetivos semanales<span className="n">{objetivos.length}</span></button>
      </div>

      {pestana === 'tareas' && (
        <div className="rejilla" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
          {ORDEN_ESTADOS_TAREA.map(e => {
            const lista = tareas.filter(t => t.estado === e).sort((a, b) => a.orden - b.orden)
            if (!lista.length) return null
            return (
              <div key={e}>
                <div className="seccion-titulo">{ETIQUETA_ESTADO_TAREA[e]} · {lista.length}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {lista.map(t => <div key={t.id} onClick={() => abrirTarea(t.id)}><TarjetaTarea tarea={t} onAlternar={() => void alternarHecha(t.id)} /></div>)}
                </div>
              </div>
            )
          })}
          {tareas.length === 0 && <Vacio icono={<Clock size={32} />} titulo="Sin tareas todavía" accion={<button className="btn primario pequeno" onClick={() => setNuevaTarea(true)}>Crear la primera</button>} />}
        </div>
      )}

      {pestana === 'objetivos' && (
        <div className="tarjeta">
          {objetivos.length === 0 ? <Vacio icono={<Target size={32} />} titulo="Este proyecto no tiene objetivos semanales" /> : (
            <table className="tabla">
              <thead><tr><th>Semana</th><th>Objetivo</th><th>Responsable</th><th>Prioridad</th><th>Estado</th><th>Resultado</th></tr></thead>
              <tbody>
                {[...objetivos].sort((a, b) => (semanaDeId(b.semanaId)?.inicio ?? '').localeCompare(semanaDeId(a.semanaId)?.inicio ?? '')).map(o => (
                  <tr key={o.id}>
                    <td style={{ whiteSpace: 'nowrap', color: 'var(--texto-2)' }}>{semanaDeId(o.semanaId) ? etiquetaSemanaCorta(semanaDeId(o.semanaId)!.inicio) : '—'}</td>
                    <td style={{ fontWeight: 500 }}>{o.titulo}</td>
                    <td><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Avatar miembro={miembro(o.responsableId)} tamano="pequeno" />{miembro(o.responsableId)?.nombre.split(' ')[0]}</span></td>
                    <td><IconoPrioridad prioridad={o.prioridad} conTexto /></td>
                    <td><span className={`chip pequeno ${o.estado === 'cumplido' ? 'ok' : ''}`}>{ETIQUETA_ESTADO_OBJETIVO[o.estado]}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {nuevaTarea && <ModalTarea inicial={{ proyectoId: p.id, asignadoId: p.responsableId ?? undefined }} onCerrar={() => setNuevaTarea(false)} />}
      {editar && editar !== 'nuevo' && <ModalProyecto inicial={editar} onCerrar={() => setEditar(null)} />}
    </div>
  )
}
