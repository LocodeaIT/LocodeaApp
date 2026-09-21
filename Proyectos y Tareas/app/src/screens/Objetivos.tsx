/**
 * Objetivos semanales: una columna por persona.
 *
 * Sin ceremonia: cualquiera añade objetivos, a sí mismo o a un compañero, y se
 * marcan con su casilla cuando se cumplen. Arrastrar sirve para reordenar o
 * para pasar un objetivo a otra persona.
 */
import { useEffect, useMemo, useState } from 'react'
import {
  DndContext, DragOverlay, PointerSensor, closestCorners, useDroppable, useSensor, useSensors,
  type DragEndEvent, type DragOverEvent, type DragStartEvent,
} from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Check, ChevronLeft, ChevronRight, GripVertical, Plus } from 'lucide-react'
import { useApp } from '../store'
import { Avatar, ChipProyecto, IconoPrioridad, Progreso } from '../ui/basicos'
import { ModalObjetivo } from './Modales'
import type { Miembro, Objetivo, Semana } from '../domain/types'
import { avanceObjetivo, resumenSemana } from '../domain/metricas'
import { etiquetaSemana, hoy, lunesDe, sumarDias } from '../domain/fechas'

export default function Objetivos({ abrirTarea }: { abrirTarea: (id: string) => void }) {
  const { datos, semanaSel, setSemanaSel, semanaDe, asegurarSemana, reordenarObjetivos } = useApp()
  const semana = semanaDe(semanaSel)
  const [nuevo, setNuevo] = useState<{ responsableId: string } | null>(null)
  const [editar, setEditar] = useState<Objetivo | null>(null)
  const [arrastrando, setArrastrando] = useState<Objetivo | null>(null)
  // columnas en local durante el arrastre
  const [columnas, setColumnas] = useState<Record<string, string[]>>({})

  useEffect(() => { if (!semana) void asegurarSemana(semanaSel) }, [semana, semanaSel, asegurarSemana])

  const miembros = datos.miembros.filter(m => m.activo)
  const objetivos = useMemo(() => semana ? datos.objetivos.filter(o => o.semanaId === semana.id).sort((a, b) => a.orden - b.orden) : [], [datos.objetivos, semana])

  useEffect(() => {
    const c: Record<string, string[]> = {}
    for (const m of miembros) c[m.id] = objetivos.filter(o => o.responsableId === m.id).map(o => o.id)
    setColumnas(c)
  }, [objetivos, datos.miembros]) // eslint-disable-line react-hooks/exhaustive-deps

  const sensores = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  const resumen = semana ? resumenSemana(semana, datos.objetivos) : null
  const esActual = semanaSel === lunesDe(hoy())

  const colDe = (id: string) => Object.keys(columnas).find(k => columnas[k].includes(id))

  const onDragStart = (e: DragStartEvent) => setArrastrando(objetivos.find(o => o.id === e.active.id) ?? null)
  const onDragOver = (e: DragOverEvent) => {
    const { active, over } = e
    if (!over) return
    const origen = colDe(String(active.id))
    const destino = colDe(String(over.id)) ?? (columnas[String(over.id)] ? String(over.id) : undefined)
    if (!origen || !destino || origen === destino) return
    setColumnas(c => {
      const de = c[origen].filter(x => x !== active.id)
      const a = [...c[destino]]
      const idx = a.indexOf(String(over.id))
      a.splice(idx >= 0 ? idx : a.length, 0, String(active.id))
      return { ...c, [origen]: de, [destino]: a }
    })
  }
  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    setArrastrando(null)
    if (!over) return
    const col = colDe(String(active.id))
    if (!col) return
    const lista = [...columnas[col]]
    const from = lista.indexOf(String(active.id))
    const to = lista.indexOf(String(over.id))
    if (from >= 0 && to >= 0 && from !== to) { lista.splice(from, 1); lista.splice(to, 0, String(active.id)) }
    setColumnas(c => ({ ...c, [col]: lista }))
    void reordenarObjetivos(lista, col)
  }

  if (!semana) return <div className="carga"><div className="spinner" /></div>

  return (
    <div className="pagina">
      <div className="titulo-pagina">
        <div>
          <h1>Objetivos semanales</h1>
          <div className="sub">
            Apunta lo que quieres sacar esta semana, tuyo o de un compañero. Se marca cuando está hecho.
            {resumen && resumen.total > 0 && <> · <b>{resumen.cumplidos} de {resumen.total}</b> cumplidos</>}
          </div>
        </div>
        <div className="acciones">
          <div className="semana-nav">
            <button className="btn sutil icono pequeno" onClick={() => setSemanaSel(sumarDias(semanaSel, -7))}><ChevronLeft size={16} /></button>
            <span className="nombre">{etiquetaSemana(semanaSel)}</span>
            <button className="btn sutil icono pequeno" onClick={() => setSemanaSel(sumarDias(semanaSel, 7))}><ChevronRight size={16} /></button>
          </div>
          {!esActual && <button className="btn" onClick={() => setSemanaSel(lunesDe(hoy()))}>Semana actual</button>}
        </div>
      </div>

      <DndContext sensors={sensores} collisionDetection={closestCorners} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd}>
        <div className="columnas-objetivos">
          {miembros.map(m => (
            <ColumnaMiembro key={m.id} miembro={m} ids={columnas[m.id] ?? []} objetivos={objetivos} semana={semana}
              onNuevo={() => setNuevo({ responsableId: m.id })} onEditar={setEditar} abrirTarea={abrirTarea} />
          ))}
        </div>
        <DragOverlay>{arrastrando && <div className="objetivo-card overlay"><div className="cima"><span className="titulo">{arrastrando.titulo}</span></div></div>}</DragOverlay>
      </DndContext>

      {nuevo && <ModalObjetivo inicial={{ responsableId: nuevo.responsableId }} semanaId={semana.id} onCerrar={() => setNuevo(null)} />}
      {editar && <ModalObjetivo inicial={editar} semanaId={semana.id} onCerrar={() => setEditar(null)} />}
    </div>
  )
}

function ColumnaMiembro({ miembro, ids, objetivos, semana, onNuevo, onEditar, abrirTarea }: {
  miembro: Miembro; ids: string[]; objetivos: Objetivo[]; semana: Semana
  onNuevo: () => void; onEditar: (o: Objetivo) => void; abrirTarea: (id: string) => void
}) {
  const { datos } = useApp()
  const { setNodeRef, isOver } = useDroppable({ id: miembro.id })
  const propios = ids.map(id => objetivos.find(o => o.id === id)).filter((o): o is Objetivo => !!o)
  const r = resumenSemana(semana, datos.objetivos, miembro.id)
  return (
    <div className="col-miembro">
      <div className="col-miembro-cabecera">
        <Avatar miembro={miembro} />
        <div>
          <div className="nombre">{miembro.nombre}</div>
          <div className="resumen">{r.total === 0 ? 'Sin objetivos' : `${r.cumplidos} de ${r.total} cumplidos`}</div>
        </div>
      </div>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className={`col-miembro-cuerpo ${isOver ? 'sobre' : ''}`}>
          {propios.map(o => <TarjetaObjetivo key={o.id} objetivo={o} onEditar={onEditar} abrirTarea={abrirTarea} />)}
          <button className="anadir-objetivo" onClick={onNuevo}><Plus size={15} /> Añadir objetivo</button>
        </div>
      </SortableContext>
    </div>
  )
}

function TarjetaObjetivo({ objetivo: o, onEditar, abrirTarea }: {
  objetivo: Objetivo; onEditar: (o: Objetivo) => void; abrirTarea: (id: string) => void
}) {
  const { datos, proyecto, alternarObjetivo, alternarHecha } = useApp()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: o.id })
  const estilo = { transform: CSS.Transform.toString(transform), transition }
  const av = avanceObjetivo(o, datos.tareas)
  const tareas = datos.tareas.filter(t => t.objetivoId === o.id)
  const cumplido = o.estado === 'cumplido'

  return (
    <div ref={setNodeRef} style={estilo} className={`objetivo-card ${o.estado} ${isDragging ? 'arrastrando' : ''}`}>
      <div className="cima">
        <span className="asa" {...attributes} {...listeners}><GripVertical size={16} /></span>
        <span className={`check ${cumplido ? 'hecho' : ''}`} title={cumplido ? 'Marcar como pendiente' : 'Marcar como cumplido'}
          onClick={() => void alternarObjetivo(o.id)}><Check size={11} strokeWidth={3} /></span>
        <span className="titulo" style={{ textDecoration: cumplido ? 'line-through' : 'none', opacity: cumplido ? .6 : 1 }}
          onClick={() => onEditar(o)}>{o.titulo}</span>
      </div>
      {o.descripcion && <p style={{ fontSize: 12, color: 'var(--texto-2)' }}>{o.descripcion}</p>}
      {av.total > 0 && (
        <div className="avance">
          <Progreso pct={av.pct} tono={av.pct === 100 ? 'ok' : undefined} />
          <span title="Tareas enlazadas hechas / total">{av.hechas}/{av.total} tareas</span>
        </div>
      )}
      {tareas.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {tareas.slice(0, 4).map(t => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: t.estado === 'hecha' ? 'var(--texto-3)' : 'var(--texto-2)', cursor: 'pointer' }} onClick={() => abrirTarea(t.id)}>
              <span className={`check ${t.estado === 'hecha' ? 'hecho' : ''}`} style={{ width: 14, height: 14 }} title={t.estado === 'hecha' ? 'Marcar como pendiente' : 'Marcar como hecha'}
                onClick={e => { e.stopPropagation(); void alternarHecha(t.id) }}><Check size={9} strokeWidth={3} /></span>
              <span style={{ textDecoration: t.estado === 'hecha' ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.titulo}</span>
            </div>
          ))}
          {tareas.length > 4 && <span style={{ fontSize: 11, color: 'var(--texto-3)' }}>+{tareas.length - 4} más</span>}
        </div>
      )}
      <div className="pie">
        <IconoPrioridad prioridad={o.prioridad} />
        <ChipProyecto proyecto={proyecto(o.proyectoId)} />
      </div>
    </div>
  )
}
