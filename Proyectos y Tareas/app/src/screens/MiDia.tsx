/**
 * Mi día / To Do personal, al estilo Microsoft To Do: las listas viven en una
 * banda a la izquierda y el contenido ocupa el resto del panel.
 *
 * Cada tarea se puede posponer a mañana desde la propia fila, sin abrirla.
 *
 * El arrastre no usa DragOverlay: el propio elemento se desplaza, que en una
 * lista vertical es lo más estable.
 */
import { useMemo, useState } from 'react'
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Calendar, Check, ChevronDown, ChevronsRight, ClipboardList, Plus, Star, Sun, User, X } from 'lucide-react'
import { useApp } from '../store'
import { ChipProyecto, SelectProyecto, Vacio } from '../ui/basicos'
import type { Tarea } from '../domain/types'
import { fechaLarga, hoy, relativoVencimiento, sumarDias } from '../domain/fechas'

type Lista = 'midia' | 'importante' | 'planificado' | 'asignadas' | 'personales'
const LISTAS: { id: Lista; nombre: string; icono: typeof Sun }[] = [
  { id: 'midia', nombre: 'Mi día', icono: Sun },
  { id: 'importante', nombre: 'Importante', icono: Star },
  { id: 'planificado', nombre: 'Planificado', icono: Calendar },
  { id: 'asignadas', nombre: 'Mis tareas', icono: User },
  { id: 'personales', nombre: 'Personales', icono: ClipboardList },
]

function enLista(t: Tarea, lista: Lista): boolean {
  switch (lista) {
    case 'midia': return t.miDia || (!!t.vence && t.vence <= hoy() && t.estado !== 'hecha')
    case 'importante': return t.importante
    case 'planificado': return !!t.vence
    case 'asignadas': return !t.personal
    case 'personales': return t.personal
  }
}

/** Número de tareas abiertas en «Mi día» del usuario, para el globo del botón flotante. */
export function contarMiDia(tareas: Tarea[], yoId: string): number {
  return tareas.filter(t => t.asignadoId === yoId && t.estado !== 'hecha' && enLista(t, 'midia')).length
}

export function MiDia({ abrirTarea, onCerrar }: { abrirTarea: (id: string) => void; onCerrar: () => void }) {
  const { datos, yo, guardarTarea, alternarHecha, reordenarTodo, tareaBase } = useApp()
  const [lista, setLista] = useState<Lista>('midia')
  const [titulo, setTitulo] = useState('')
  const [proyectoNuevo, setProyectoNuevo] = useState<string | null>(null)
  const [verHechas, setVerHechas] = useState(false)

  const mias = useMemo(() => datos.tareas.filter(t => t.asignadoId === yo!.id), [datos.tareas, yo])
  const orden = (a: Tarea, b: Tarea) => lista === 'planificado' ? (a.vence ?? '').localeCompare(b.vence ?? '') || a.ordenTodo - b.ordenTodo : a.ordenTodo - b.ordenTodo
  const abiertas = mias.filter(t => t.estado !== 'hecha' && enLista(t, lista)).sort(orden)
  const hechas = mias.filter(t => t.estado === 'hecha' && enLista(t, lista)).sort((a, b) => (b.completadoEl ?? '').localeCompare(a.completadoEl ?? ''))
  const cuenta = (l: Lista) => mias.filter(t => t.estado !== 'hecha' && enLista(t, l)).length

  const sensores = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const ids = abiertas.map(t => t.id)
    void reordenarTodo(arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id))))
  }

  const crear = async () => {
    if (!titulo.trim() || !yo) return
    await guardarTarea(tareaBase({
      titulo: titulo.trim(), proyectoId: lista === 'personales' ? null : proyectoNuevo, asignadoId: yo.id,
      vence: lista === 'planificado' ? hoy() : null, ordenTodo: -1, miDia: lista === 'midia', importante: lista === 'importante',
      personal: lista === 'personales' || (!proyectoNuevo && lista !== 'asignadas'),
    }))
    setTitulo('')
  }

  /** Pasa la tarea a mañana: sale de «Mi día» y vence al día siguiente. */
  const posponer = (t: Tarea) => guardarTarea({ ...t, vence: sumarDias(t.vence ?? hoy(), 1), miDia: false })

  const actual = LISTAS.find(l => l.id === lista)!

  return (
    <div className="todo-popup">
      <aside className="todo-rail">
        <div className="todo-rail-cabecera"><Sun size={16} /> Mi día</div>
        {LISTAS.map(l => (
          <button key={l.id} className={`todo-lista-btn ${lista === l.id ? 'activo' : ''}`} onClick={() => setLista(l.id)} title={l.nombre}>
            <l.icono size={16} /><span>{l.nombre}</span>{cuenta(l.id) > 0 && <span className="n">{cuenta(l.id)}</span>}
          </button>
        ))}
      </aside>

      <div className="todo-panel">
        <div className="todo-popup-cabecera">
          <div>
            <h2><actual.icono size={18} style={{ color: 'var(--acento)' }} />{actual.nombre}</h2>
            <div className="fecha">{lista === 'midia' ? fechaLarga(hoy()) : `${abiertas.length} pendientes`}</div>
          </div>
          <button className="btn sutil icono" onClick={onCerrar} aria-label="Cerrar"><X size={18} /></button>
        </div>

        <div className="todo-nueva">
          <Plus size={16} />
          <input placeholder={lista === 'personales' ? 'Añadir una tarea personal' : 'Añadir una tarea'} value={titulo} onChange={e => setTitulo(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void crear() }} />
          {lista !== 'personales' && <SelectProyecto valor={proyectoNuevo} onCambio={setProyectoNuevo} textoNinguno="Personal" sutil pequeno ancho={130} />}
          <button className="btn primario pequeno icono" onClick={() => void crear()} disabled={!titulo.trim()} title="Añadir"><Check size={14} /></button>
        </div>

        <div className="todo-items">
          {abiertas.length === 0 && hechas.length === 0 && <Vacio icono={<actual.icono size={32} />} titulo={lista === 'midia' ? 'Tu día está despejado' : 'Nada por aquí'} texto={lista === 'midia' ? 'Añade tareas a Mi día desde el tablero o escribe una arriba.' : undefined} />}
          <DndContext sensors={sensores} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={abiertas.map(t => t.id)} strategy={verticalListSortingStrategy}>
              {abiertas.map(t => (
                <ItemSortable key={t.id} tarea={t} onAbrir={() => abrirTarea(t.id)} onHecha={() => void alternarHecha(t.id)}
                  onEstrella={() => void guardarTarea({ ...t, importante: !t.importante })}
                  onMiDia={() => void guardarTarea({ ...t, miDia: !t.miDia })}
                  onPosponer={() => void posponer(t)} />
              ))}
            </SortableContext>
          </DndContext>
          {hechas.length > 0 && (
            <>
              <div className={`todo-grupo ${verHechas ? '' : 'cerrado'}`} onClick={() => setVerHechas(v => !v)}><ChevronDown size={14} /> Completadas · {hechas.length}</div>
              {verHechas && hechas.map(t => <Item key={t.id} tarea={t} onAbrir={() => abrirTarea(t.id)} onHecha={() => void alternarHecha(t.id)} onEstrella={() => void guardarTarea({ ...t, importante: !t.importante })} />)}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function ItemSortable(props: { tarea: Tarea; onAbrir: () => void; onHecha: () => void; onEstrella: () => void; onMiDia: () => void; onPosponer: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.tarea.id })
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition, position: 'relative', zIndex: isDragging ? 5 : undefined }} {...attributes} {...listeners}>
      <Item {...props} arrastrando={isDragging} />
    </div>
  )
}

function Item({ tarea: t, onAbrir, onHecha, onEstrella, onMiDia, onPosponer, arrastrando }: {
  tarea: Tarea; onAbrir?: () => void; onHecha?: () => void; onEstrella?: () => void; onMiDia?: () => void; onPosponer?: () => void; arrastrando?: boolean
}) {
  const { proyecto } = useApp()
  const hecha = t.estado === 'hecha'
  const v = t.vence && !hecha ? relativoVencimiento(t.vence) : null
  const pasos = t.checklist.length ? `${t.checklist.filter(c => c.hecho).length}/${t.checklist.length}` : null
  return (
    <div className={`todo-item ${hecha ? 'hecha' : ''} ${arrastrando ? 'arrastrando' : ''}`} onClick={onAbrir}>
      <span className={`check ${hecha ? 'hecho' : ''}`} onClick={e => { e.stopPropagation(); onHecha?.() }}><Check size={11} strokeWidth={3} /></span>
      <div className="texto">
        <div className="titulo">{t.titulo}</div>
        <div className="sub">
          {t.personal ? <span className="chip pequeno morado">Personal</span> : <ChipProyecto proyecto={proyecto(t.proyectoId)} />}
          {t.miDia && !hecha && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><Sun size={11} /> Mi día</span>}
          {v && <span className={`vence ${v.tono}`}><Calendar size={11} />{v.texto}</span>}
          {pasos && <span>{pasos} pasos</span>}
          {t.estado === 'en_curso' && <span className="chip pequeno acento">En curso</span>}
          {t.estado === 'bloqueada' && <span className="chip pequeno error">Bloqueada</span>}
        </div>
      </div>
      {onPosponer && !hecha && (
        <button className="btn sutil icono pequeno estrella" title="Pasar a mañana"
          onClick={e => { e.stopPropagation(); onPosponer() }}><ChevronsRight size={16} /></button>
      )}
      {onMiDia && !hecha && !t.miDia && <button className="btn sutil icono pequeno estrella" title="Añadir a Mi día" onClick={e => { e.stopPropagation(); onMiDia() }}><Sun size={15} /></button>}
      <button className={`btn sutil icono pequeno estrella ${t.importante ? 'activa' : ''}`} title="Importante" onClick={e => { e.stopPropagation(); onEstrella?.() }}><Star size={16} fill={t.importante ? 'currentColor' : 'none'} /></button>
    </div>
  )
}

/** Botón flotante abajo a la derecha que abre Mi día como pop-up. */
export function MiDiaFlotante({ abrirTarea }: { abrirTarea: (id: string) => void }) {
  const { datos, yo } = useApp()
  const [abierto, setAbierto] = useState(false)
  const n = yo ? contarMiDia(datos.tareas, yo.id) : 0
  return (
    <>
      {abierto && <MiDia abrirTarea={abrirTarea} onCerrar={() => setAbierto(false)} />}
      <button className={`fab ${abierto ? 'abierto' : ''}`} onClick={() => setAbierto(a => !a)} title="Mi día">
        {abierto ? <X size={22} /> : <Sun size={22} />}
        {!abierto && n > 0 && <span className="fab-globo">{n}</span>}
      </button>
    </>
  )
}
