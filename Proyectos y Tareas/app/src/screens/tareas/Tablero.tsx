/**
 * Tablero Kanban. Las columnas son los grupos de la vista (estado por
 * defecto, pero también proyecto, persona, prioridad u objetivo): al soltar
 * una tarjeta en otra columna se aplica el cambio correspondiente.
 *
 * Arrastre con @dnd-kit. Detalles que evitan los saltos típicos:
 *  - detección de colisión: primero por puntero, luego por intersección;
 *  - la posición de inserción se calcula con el centro de la tarjeta;
 *  - mientras se arrastra no se resincroniza el estado local con los datos.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  DndContext, DragOverlay, PointerSensor, pointerWithin, rectIntersection, useDroppable, useSensor, useSensors,
  type CollisionDetection, type DragEndEvent, type DragOverEvent, type DragStartEvent,
} from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Plus } from 'lucide-react'
import { useApp } from '../../store'
import { TarjetaTarea } from '../../ui/TarjetaTarea'
import type { Tarea, Vista } from '../../domain/types'
import { agruparTareas, ordenarTareas, type Grupo } from '../../domain/vistas'

interface Props { vista: Vista; tareas: Tarea[]; abrirTarea: (id: string) => void; onNueva: (t: Partial<Tarea>) => void }

const PREFIJO_COL = 'col:'

export default function Tablero({ vista, tareas, abrirTarea, onNueva }: Props) {
  const { datos, yo, moverTarea, guardarTarea, tareaBase } = useApp()
  const grupos = useMemo(() => agruparTareas(ordenarTareas(tareas, vista.ordenar, vista.ordenDesc), vista.agrupar, datos), [tareas, vista.agrupar, vista.ordenar, vista.ordenDesc, datos])
  const [columnas, setColumnas] = useState<Record<string, string[]>>({})
  const [arrastrando, setArrastrando] = useState<Tarea | null>(null)
  const arrastrandoRef = useRef(false)
  const [rapida, setRapida] = useState<{ clave: string; titulo: string } | null>(null)

  useEffect(() => {
    if (arrastrandoRef.current) return
    setColumnas(Object.fromEntries(grupos.map(g => [g.clave, g.tareas.map(t => t.id)])))
  }, [grupos])

  const sensores = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const colDe = (id: string) => Object.keys(columnas).find(k => columnas[k].includes(id))
  const claveOver = (overId: string) => overId.startsWith(PREFIJO_COL) ? overId.slice(PREFIJO_COL.length) : colDe(overId)

  const colision: CollisionDetection = args => {
    const porPuntero = pointerWithin(args)
    if (porPuntero.length) {
      // dentro de una columna, preferir la tarjeta bajo el puntero antes que la columna
      const tarjeta = porPuntero.find(c => !String(c.id).startsWith(PREFIJO_COL))
      return tarjeta ? [tarjeta] : porPuntero
    }
    return rectIntersection(args)
  }

  const onDragStart = (e: DragStartEvent) => {
    arrastrandoRef.current = true
    setArrastrando(datos.tareas.find(t => t.id === e.active.id) ?? null)
  }
  const onDragOver = (e: DragOverEvent) => {
    const { active, over } = e
    if (!over) return
    const activeId = String(active.id)
    const origen = colDe(activeId)
    const destino = claveOver(String(over.id))
    if (!origen || !destino || origen === destino) return
    setColumnas(c => {
      const de = c[origen].filter(x => x !== activeId)
      const a = c[destino].filter(x => x !== activeId)
      let idx = a.length
      if (!String(over.id).startsWith(PREFIJO_COL)) {
        const overIdx = a.indexOf(String(over.id))
        const rectActivo = active.rect.current.translated
        const debajo = rectActivo ? rectActivo.top + rectActivo.height / 2 > over.rect.top + over.rect.height / 2 : false
        idx = overIdx >= 0 ? overIdx + (debajo ? 1 : 0) : a.length
      }
      a.splice(idx, 0, activeId)
      return { ...c, [origen]: de, [destino]: a }
    })
  }
  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    arrastrandoRef.current = false
    setArrastrando(null)
    const activeId = String(active.id)
    const col = colDe(activeId)
    if (!over || !col) { setColumnas(Object.fromEntries(grupos.map(g => [g.clave, g.tareas.map(t => t.id)]))); return }
    const lista = [...columnas[col]]
    if (!String(over.id).startsWith(PREFIJO_COL)) {
      const from = lista.indexOf(activeId)
      const to = lista.indexOf(String(over.id))
      if (from >= 0 && to >= 0 && from !== to) { lista.splice(from, 1); lista.splice(to, 0, activeId) }
    }
    setColumnas(c => ({ ...c, [col]: lista }))
    const grupo = grupos.find(g => g.clave === col)
    void moverTarea(activeId, grupo?.cambio ?? {}, lista)
  }
  const onDragCancel = () => {
    arrastrandoRef.current = false
    setArrastrando(null)
    setColumnas(Object.fromEntries(grupos.map(g => [g.clave, g.tareas.map(t => t.id)])))
  }

  const crearRapida = async () => {
    if (!rapida?.titulo.trim() || !yo) return
    const grupo = grupos.find(g => g.clave === rapida.clave)
    await guardarTarea(tareaBase({
      titulo: rapida.titulo.trim(), proyectoId: vista.filtros.proyectoId, asignadoId: vista.filtros.asignadoId ?? yo.id,
      ...grupo?.cambio, orden: (columnas[rapida.clave]?.length ?? 0),
    }))
    setRapida({ clave: rapida.clave, titulo: '' })
  }

  return (
    <DndContext sensors={sensores} collisionDetection={colision} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={onDragCancel}>
      <div className="tablero">
        {grupos.map(g => (
          <Columna key={g.clave} grupo={g} ids={columnas[g.clave] ?? []} abrirTarea={abrirTarea} arrastrando={!!arrastrando}
            rapida={rapida?.clave === g.clave ? rapida.titulo : null}
            onRapida={v => setRapida(v === null ? null : { clave: g.clave, titulo: v })} onCrearRapida={() => void crearRapida()}
            onNueva={() => onNueva({ proyectoId: vista.filtros.proyectoId, asignadoId: vista.filtros.asignadoId ?? undefined, ...g.cambio })} />
        ))}
      </div>
      <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(.2,0,0,1)' }}>{arrastrando && <TarjetaTarea tarea={arrastrando} overlay />}</DragOverlay>
    </DndContext>
  )
}

function Columna({ grupo: g, ids, abrirTarea, arrastrando, rapida, onRapida, onCrearRapida, onNueva }: {
  grupo: Grupo; ids: string[]; abrirTarea: (id: string) => void; arrastrando: boolean
  rapida: string | null; onRapida: (v: string | null) => void; onCrearRapida: () => void; onNueva: () => void
}) {
  const { datos } = useApp()
  const { setNodeRef, isOver } = useDroppable({ id: PREFIJO_COL + g.clave })
  const tareas = ids.map(id => datos.tareas.find(t => t.id === id)).filter((t): t is Tarea => !!t)
  return (
    <div className={`columna ${isOver && arrastrando ? 'sobre' : ''}`} style={{ ['--col' as string]: g.color }}>
      <div className="columna-cabecera">
        <span className="barra" />
        <span className="nombre" title={g.nombre}>{g.nombre}</span>
        <span className="n">{tareas.length}</span>
        <button className="btn sutil icono pequeno" onClick={() => onRapida('')} title="Añadir tarea"><Plus size={14} /></button>
      </div>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className="columna-cuerpo">
          {tareas.map(t => <TarjetaSortable key={t.id} tarea={t} onClick={() => abrirTarea(t.id)} />)}
          {rapida !== null && (
            <div className="entrada-rapida">
              <input autoFocus placeholder="Título y Enter…" value={rapida} onChange={e => onRapida(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') onCrearRapida(); if (e.key === 'Escape') onRapida(null) }} onBlur={() => { if (!rapida.trim()) onRapida(null) }} />
            </div>
          )}
          {!tareas.length && rapida === null && <div className="columna-vacia">Suelta aquí</div>}
        </div>
      </SortableContext>
      <div className="columna-pie">
        <button className="btn sutil pequeno" onClick={() => onRapida('')} onDoubleClick={onNueva}><Plus size={14} /> Añadir tarea</button>
      </div>
    </div>
  )
}

function TarjetaSortable({ tarea, onClick }: { tarea: Tarea; onClick: () => void }) {
  const { alternarHecha } = useApp()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: tarea.id })
  const estilo = { transform: CSS.Translate.toString(transform), transition }
  const pulsado = useRef<{ x: number; y: number } | null>(null)
  return (
    <div ref={setNodeRef} style={estilo} {...attributes} {...listeners}
      onPointerDown={e => { pulsado.current = { x: e.clientX, y: e.clientY }; listeners?.onPointerDown?.(e) }}
      onClick={e => {
        // solo abre si no ha habido arrastre real
        const p = pulsado.current
        if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) < 5) onClick()
      }}>
      <TarjetaTarea tarea={tarea} arrastrando={isDragging} onAlternar={() => void alternarHecha(tarea.id)} />
    </div>
  )
}
