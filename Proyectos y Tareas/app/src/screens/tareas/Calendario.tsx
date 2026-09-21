/**
 * Calendario de vencimientos: mes o semana. Arrastrar una tarea a otro día
 * cambia su fecha de vencimiento (y desplaza el inicio la misma distancia).
 */
import { useMemo, useState } from 'react'
import { DndContext, DragOverlay, PointerSensor, pointerWithin, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core'
import { Check, ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { addDays, differenceInCalendarDays, endOfMonth, format, getISOWeek, isSameMonth, parseISO, startOfMonth } from 'date-fns'
import { es } from 'date-fns/locale'
import { useApp } from '../../store'
import { Avatar } from '../../ui/basicos'
import type { Tarea, Vista } from '../../domain/types'
import { aIso, hoy, lunesDe, sumarDias } from '../../domain/fechas'
import { COLOR_ESTADO } from '../../domain/vistas'

interface Props { vista: Vista; tareas: Tarea[]; abrirTarea: (id: string) => void; onNueva: (t: Partial<Tarea>) => void }

export default function Calendario({ vista, tareas, abrirTarea, onNueva }: Props) {
  const { guardarTarea, miembro, proyecto } = useApp()
  const [ancla, setAncla] = useState(() => hoy())
  const [arrastrando, setArrastrando] = useState<Tarea | null>(null)
  const semana = vista.escala === 'semana'

  const dias = useMemo(() => {
    if (semana) { const l = lunesDe(ancla); return Array.from({ length: 7 }, (_, i) => sumarDias(l, i)) }
    const ini = lunesDe(aIso(startOfMonth(parseISO(ancla))))
    const fin = aIso(endOfMonth(parseISO(ancla)))
    const lista: string[] = []
    for (let d = ini; lista.length < 42 && (d <= fin || lista.length % 7 !== 0); d = sumarDias(d, 1)) lista.push(d)
    return lista
  }, [ancla, semana])

  const porDia = useMemo(() => {
    const m = new Map<string, Tarea[]>()
    for (const t of tareas) if (t.vence) m.set(t.vence, [...(m.get(t.vence) ?? []), t])
    return m
  }, [tareas])
  const sinFecha = tareas.filter(t => !t.vence && t.estado !== 'hecha')

  const sensores = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const onDragEnd = (e: DragEndEvent) => {
    setArrastrando(null)
    const t = tareas.find(x => x.id === e.active.id)
    if (!t || !e.over) return
    const dia = String(e.over.id).replace('dia:', '')
    if (dia === t.vence) return
    const delta = t.vence ? differenceInCalendarDays(parseISO(dia), parseISO(t.vence)) : 0
    void guardarTarea({ ...t, vence: dia, inicio: t.inicio && t.vence ? aIso(addDays(parseISO(t.inicio), delta)) : t.inicio })
  }

  const mover = (n: number) => setAncla(a => semana ? sumarDias(a, 7 * n) : aIso(addDays(startOfMonth(parseISO(a)), 32 * n)))
  const titulo = semana ? `Semana ${getISOWeek(parseISO(lunesDe(ancla)))} · ${format(parseISO(lunesDe(ancla)), 'd MMM', { locale: es })} – ${format(parseISO(sumarDias(lunesDe(ancla), 6)), 'd MMM yyyy', { locale: es })}` : format(parseISO(ancla), 'MMMM yyyy', { locale: es })

  return (
    <DndContext sensors={sensores} collisionDetection={pointerWithin} onDragStart={(e: DragStartEvent) => setArrastrando(tareas.find(t => t.id === e.active.id) ?? null)} onDragEnd={onDragEnd}>
      <div className="calendario">
        <div className="calendario-cabecera">
          <div className="semana-nav">
            <button className="btn sutil icono pequeno" onClick={() => mover(-1)}><ChevronLeft size={16} /></button>
            <span className="nombre" style={{ textTransform: 'capitalize', minWidth: 220 }}>{titulo}</span>
            <button className="btn sutil icono pequeno" onClick={() => mover(1)}><ChevronRight size={16} /></button>
          </div>
          <button className="btn pequeno" onClick={() => setAncla(hoy())}>Hoy</button>
          {sinFecha.length > 0 && <span className="chip pequeno contorno" style={{ marginLeft: 'auto' }}>{sinFecha.length} sin fecha</span>}
        </div>
        <div className={`calendario-rejilla ${semana ? 'semana' : ''}`}>
          {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => <div key={d} className="dia-nombre">{d}</div>)}
          {dias.map(d => <Dia key={d} fecha={d} fuera={!semana && !isSameMonth(parseISO(d), parseISO(ancla))} tareas={porDia.get(d) ?? []} abrirTarea={abrirTarea} onNueva={() => onNueva({ vence: d, inicio: d, proyectoId: vista.filtros.proyectoId, asignadoId: vista.filtros.asignadoId ?? undefined })} />)}
        </div>
        {sinFecha.length > 0 && (
          <div className="calendario-sinfecha">
            <span className="seccion-titulo" style={{ marginBottom: 0 }}>Sin fecha · arrastra a un día</span>
            {sinFecha.map(t => <Evento key={t.id} tarea={t} onClick={() => abrirTarea(t.id)} />)}
          </div>
        )}
      </div>
      <DragOverlay>{arrastrando && (
        <div className="evento overlay" style={{ ['--col' as string]: proyecto(arrastrando.proyectoId)?.color ?? COLOR_ESTADO[arrastrando.estado] }}>
          <span className="texto">{arrastrando.titulo}</span><Avatar miembro={miembro(arrastrando.asignadoId)} tamano="pequeno" />
        </div>
      )}</DragOverlay>
    </DndContext>
  )
}

function Dia({ fecha, fuera, tareas, abrirTarea, onNueva }: { fecha: string; fuera: boolean; tareas: Tarea[]; abrirTarea: (id: string) => void; onNueva: () => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'dia:' + fecha })
  const esHoy = fecha === hoy()
  const finde = [0, 6].includes(parseISO(fecha).getDay())
  return (
    <div ref={setNodeRef} className={`dia ${fuera ? 'fuera' : ''} ${esHoy ? 'hoy' : ''} ${finde ? 'finde' : ''} ${isOver ? 'sobre' : ''}`}>
      <div className="dia-numero"><span>{parseISO(fecha).getDate()}</span><button className="btn sutil icono pequeno anadir" onClick={onNueva}><Plus size={12} /></button></div>
      <div className="dia-eventos">
        {tareas.map(t => <Evento key={t.id} tarea={t} onClick={() => abrirTarea(t.id)} />)}
      </div>
    </div>
  )
}

function Evento({ tarea: t, onClick }: { tarea: Tarea; onClick: () => void }) {
  const { miembro, proyecto, alternarHecha } = useApp()
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: t.id })
  const color = proyecto(t.proyectoId)?.color ?? COLOR_ESTADO[t.estado]
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} className={`evento ${t.estado === 'hecha' ? 'hecha' : ''} ${isDragging ? 'arrastrando' : ''} ${t.vence && t.vence < hoy() && t.estado !== 'hecha' ? 'vencida' : ''}`}
      style={{ ['--col' as string]: color }} onClick={onClick} title={t.titulo}>
      <span className={`check ${t.estado === 'hecha' ? 'hecho' : ''}`} title={t.estado === 'hecha' ? 'Marcar como pendiente' : 'Marcar como hecha'}
        onPointerDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); void alternarHecha(t.id) }}><Check size={9} strokeWidth={3} /></span>
      <span className="texto">{t.titulo}</span>
      <Avatar miembro={miembro(t.asignadoId)} tamano="pequeno" />
    </div>
  )
}
