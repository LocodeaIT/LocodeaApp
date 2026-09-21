/**
 * Tareas: un mismo conjunto de filtros y agrupaciones con cuatro formas de
 * verlo (Tablero, Lista, Calendario, Gantt). Las vistas se guardan con
 * nombre y se pueden compartir con el equipo o dejar como personales.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Calendar, Check, ChevronDown, Columns3, Filter, GanttChartSquare, KanbanSquare, List, Plus, Save, SlidersHorizontal, Trash2, Users, X,
} from 'lucide-react'
import { useApp } from '../../store'
import { Desplegable, FiltroPersonas, SelectProyecto } from '../../ui/basicos'
import { ModalTarea } from '../Modales'
import type { AgruparPor, ColumnaLista, EstadoTarea, OrdenarPor, Prioridad, Tarea, TipoVista, Vista } from '../../domain/types'
import { COLUMNAS_LISTA, ETIQUETA_ESTADO_TAREA, ETIQUETA_PRIORIDAD, ORDEN_ESTADOS_TAREA } from '../../domain/types'
import { filtrarTareas, vistaNueva, vistasIguales } from '../../domain/vistas'
import Tablero from './Tablero'
import Lista from './Lista'
import Calendario from './Calendario'
import Gantt from './Gantt'

const ICONO_TIPO: Record<TipoVista, typeof List> = { tablero: KanbanSquare, lista: List, calendario: Calendar, gantt: GanttChartSquare }
const NOMBRE_TIPO: Record<TipoVista, string> = { tablero: 'Tablero', lista: 'Lista', calendario: 'Calendario', gantt: 'Gantt' }
const AGRUPACIONES: { id: AgruparPor; nombre: string }[] = [
  { id: 'ninguno', nombre: 'Sin agrupar' }, { id: 'estado', nombre: 'Estado' }, { id: 'proyecto', nombre: 'Proyecto' },
  { id: 'asignado', nombre: 'Persona' }, { id: 'prioridad', nombre: 'Prioridad' }, { id: 'objetivo', nombre: 'Objetivo semanal' },
]
const ORDENES: { id: OrdenarPor; nombre: string }[] = [
  { id: 'orden', nombre: 'Manual' }, { id: 'vence', nombre: 'Vencimiento' }, { id: 'prioridad', nombre: 'Prioridad' },
  { id: 'titulo', nombre: 'Título' }, { id: 'creadoEl', nombre: 'Creación' },
]

const CLAVE_VISTA = 'locodea.vista'

export default function Tareas({ abrirTarea }: { abrirTarea: (id: string) => void }) {
  const { datos, yo, guardarVista, borrarVista, avisar } = useApp()
  const visibles = useMemo(() => datos.vistas.filter(v => !v.miembroId || v.miembroId === yo!.id), [datos.vistas, yo])
  const [vistaId, setVistaId] = useState<string | null>(() => localStorage.getItem(CLAVE_VISTA))
  const guardada = visibles.find(v => v.id === vistaId) ?? visibles.find(v => v.esPredeterminada) ?? visibles[0]
  // copia de trabajo: se edita libremente y se guarda cuando se quiere
  const [vista, setVista] = useState<Vista | null>(null)
  const [nueva, setNueva] = useState<Partial<Tarea> | null>(null)
  const componer = useRef<HTMLInputElement>(null)
  const [menuVistas, setMenuVistas] = useState(false)
  const [menuOpciones, setMenuOpciones] = useState(false)
  const [menuFiltros, setMenuFiltros] = useState(false)
  const [renombrando, setRenombrando] = useState(false)
  const [nombreTmp, setNombreTmp] = useState('')

  useEffect(() => {
    if (guardada && (!vista || vista.id !== guardada.id)) setVista(structuredClone(guardada))
  }, [guardada, vista])
  useEffect(() => { if (vista) localStorage.setItem(CLAVE_VISTA, vista.id) }, [vista?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const modificada = !!vista && !!guardada && !vistasIguales(vista, guardada)
  const cambiar = (c: Partial<Vista>) => setVista(v => (v ? { ...v, ...c } : v))
  const cambiarFiltro = (c: Partial<Vista['filtros']>) => setVista(v => (v ? { ...v, filtros: { ...v.filtros, ...c } } : v))

  const tareas = useMemo(() => vista ? filtrarTareas(datos.tareas, vista.filtros, yo!.id) : [], [datos.tareas, vista, yo])

  const guardar = async () => {
    if (!vista) return
    const r = await guardarVista(vista)
    setVista(structuredClone(r))
  }
  const guardarComo = async (compartida: boolean) => {
    if (!vista) return
    const { id: _id, creadoEl: _c, ...resto } = vista
    const r = await guardarVista({ ...resto, nombre: `${vista.nombre} (copia)`, miembroId: compartida ? null : yo!.id, esPredeterminada: false })
    setVistaId(r.id); setVista(structuredClone(r))
  }
  const crearVista = async (tipo: TipoVista) => {
    const r = await guardarVista(vistaNueva(tipo, yo!.id))
    setVistaId(r.id); setVista(structuredClone(r)); setMenuVistas(false)
    setNombreTmp(r.nombre); setRenombrando(true)
  }
  const borrar = async () => {
    if (!vista) return
    if (visibles.length <= 1) { avisar('Tiene que quedar al menos una vista', 'error'); return }
    if (!confirm(`¿Borrar la vista «${vista.nombre}»?`)) return
    await borrarVista(vista.id)
    setVistaId(null); setVista(null)
  }
  const renombrar = () => {
    if (nombreTmp.trim()) cambiar({ nombre: nombreTmp.trim() })
    setRenombrando(false)
  }

  if (!vista) return <div className="carga"><div className="spinner" /></div>
  const Icono = ICONO_TIPO[vista.tipo]
  const nFiltros = (vista.filtros.proyectoId ? 1 : 0) + (vista.filtros.asignadoId ? 1 : 0) + (vista.filtros.estados.length ? 1 : 0) + (vista.filtros.prioridades.length ? 1 : 0) + (vista.filtros.ocultarHechas ? 1 : 0) + (vista.filtros.soloMias ? 1 : 0)

  return (
    <div className="pagina-ancha">
      <div className="vistas-barra">
        <div className="vistas-pestanas">
          {visibles.map(v => {
            const I = ICONO_TIPO[v.tipo]
            return (
              <button key={v.id} className={`vista-pestana ${v.id === vista.id ? 'activa' : ''}`} onClick={() => { setVistaId(v.id); setVista(structuredClone(v)) }} title={v.miembroId ? 'Vista personal' : 'Vista del equipo'}>
                <I size={15} /><span>{v.nombre}</span>{v.miembroId && <i className="personal" />}
              </button>
            )
          })}
          <Desplegable abierto={menuVistas} setAbierto={setMenuVistas} boton={<button className="vista-pestana nueva" onClick={() => setMenuVistas(m => !m)}><Plus size={15} /> Vista</button>}>
            <div className="cabecera-menu">Nueva vista</div>
            {(Object.keys(NOMBRE_TIPO) as TipoVista[]).map(t => { const I = ICONO_TIPO[t]; return <button key={t} className="item" onClick={() => void crearVista(t)}><I size={15} /> {NOMBRE_TIPO[t]}</button> })}
          </Desplegable>
        </div>
        <div className="vistas-acciones">
          {modificada && <button className="btn primario pequeno" onClick={() => void guardar()}><Save size={13} /> Guardar vista</button>}
          <button className="btn primario" onClick={() => componer.current?.focus()}><Plus size={15} /> Nueva tarea</button>
        </div>
      </div>

      <div className="herramientas vistas-herramientas">
        <div className="vista-titulo">
          <Icono size={18} style={{ color: 'var(--acento)' }} />
          {renombrando
            ? <input autoFocus className="filtro-select" value={nombreTmp} onChange={e => setNombreTmp(e.target.value)} onBlur={renombrar} onKeyDown={e => { if (e.key === 'Enter') renombrar(); if (e.key === 'Escape') setRenombrando(false) }} />
            : <h2 onClick={() => { setNombreTmp(vista.nombre); setRenombrando(true) }} title="Clic para renombrar">{vista.nombre}</h2>}
          <span className="chip pequeno contorno">{tareas.length} tareas</span>
          {modificada && <span className="chip pequeno aviso">Sin guardar</span>}
        </div>

        <input className="filtro-select" placeholder="Buscar…" value={vista.filtros.texto} onChange={e => cambiarFiltro({ texto: e.target.value })} style={{ width: 180 }} />
        <SelectProyecto valor={vista.filtros.proyectoId} onCambio={id => cambiarFiltro({ proyectoId: id })} textoNinguno="Todos los proyectos" pequeno ancho={190} />
        <FiltroPersonas valor={vista.filtros.asignadoId} onCambio={id => cambiarFiltro({ asignadoId: id })} />

        <Desplegable abierto={menuFiltros} setAbierto={setMenuFiltros} boton={<button className={`btn pequeno ${nFiltros ? 'primario' : ''}`} onClick={() => setMenuFiltros(m => !m)}><Filter size={13} /> Filtros {nFiltros > 0 && `(${nFiltros})`}</button>}>
          <div className="cabecera-menu">Estado</div>
          <div className="menu-chips">
            {ORDEN_ESTADOS_TAREA.map(e => <button key={e} className={`chip ${vista.filtros.estados.includes(e) ? 'acento' : 'contorno'}`} onClick={() => cambiarFiltro({ estados: alternar(vista.filtros.estados, e) })}>{ETIQUETA_ESTADO_TAREA[e]}</button>)}
          </div>
          <div className="cabecera-menu">Prioridad</div>
          <div className="menu-chips">
            {(['alta', 'media', 'baja'] as Prioridad[]).map(p => <button key={p} className={`chip ${vista.filtros.prioridades.includes(p) ? 'acento' : 'contorno'}`} onClick={() => cambiarFiltro({ prioridades: alternar(vista.filtros.prioridades, p) })}>{ETIQUETA_PRIORIDAD[p]}</button>)}
          </div>
          <hr />
          <label className="item"><input type="checkbox" checked={vista.filtros.ocultarHechas} onChange={e => cambiarFiltro({ ocultarHechas: e.target.checked })} /> Ocultar hechas</label>
          <label className="item"><input type="checkbox" checked={vista.filtros.soloMias} onChange={e => cambiarFiltro({ soloMias: e.target.checked })} /> Solo mis tareas</label>
          <label className="item"><input type="checkbox" checked={vista.filtros.mostrarSubtareas} onChange={e => cambiarFiltro({ mostrarSubtareas: e.target.checked })} /> Incluir subtareas</label>
          {nFiltros > 0 && <><hr /><button className="item" onClick={() => cambiarFiltro({ proyectoId: null, asignadoId: null, estados: [], prioridades: [], ocultarHechas: false, soloMias: false })}><X size={13} /> Quitar filtros</button></>}
        </Desplegable>

        <Desplegable abierto={menuOpciones} setAbierto={setMenuOpciones} boton={<button className="btn pequeno" onClick={() => setMenuOpciones(m => !m)}><SlidersHorizontal size={13} /> Opciones <ChevronDown size={12} /></button>}>
          <div className="cabecera-menu">Tipo de vista</div>
          <div className="menu-chips">
            {(Object.keys(NOMBRE_TIPO) as TipoVista[]).map(t => <button key={t} className={`chip ${vista.tipo === t ? 'acento' : 'contorno'}`} onClick={() => cambiar({ tipo: t })}>{NOMBRE_TIPO[t]}</button>)}
          </div>
          {vista.tipo !== 'calendario' && <>
            <div className="cabecera-menu">Agrupar por</div>
            <div className="menu-chips">
              {AGRUPACIONES.filter(a => vista.tipo !== 'tablero' || a.id !== 'ninguno' || true).map(a => <button key={a.id} className={`chip ${vista.agrupar === a.id ? 'acento' : 'contorno'}`} onClick={() => cambiar({ agrupar: a.id })}>{a.nombre}</button>)}
            </div>
          </>}
          <div className="cabecera-menu">Ordenar por</div>
          <div className="menu-chips">
            {ORDENES.map(o => <button key={o.id} className={`chip ${vista.ordenar === o.id ? 'acento' : 'contorno'}`} onClick={() => cambiar({ ordenar: o.id })}>{o.nombre}</button>)}
            <button className={`chip ${vista.ordenDesc ? 'acento' : 'contorno'}`} onClick={() => cambiar({ ordenDesc: !vista.ordenDesc })}>Descendente</button>
          </div>
          {vista.tipo === 'lista' && <>
            <div className="cabecera-menu"><Columns3 size={12} style={{ verticalAlign: -2 }} /> Columnas</div>
            <div className="menu-chips">
              {COLUMNAS_LISTA.map(c => <button key={c.id} className={`chip ${vista.columnas.includes(c.id) ? 'acento' : 'contorno'}`} onClick={() => cambiar({ columnas: alternarOrdenado(vista.columnas, c.id, COLUMNAS_LISTA.map(x => x.id)) })}>{c.nombre}</button>)}
            </div>
          </>}
          {(vista.tipo === 'gantt' || vista.tipo === 'calendario') && <>
            <div className="cabecera-menu">Escala</div>
            <div className="menu-chips">
              {(vista.tipo === 'gantt' ? ['dia', 'semana', 'mes'] as const : ['semana', 'mes'] as const).map(e => <button key={e} className={`chip ${vista.escala === e ? 'acento' : 'contorno'}`} onClick={() => cambiar({ escala: e })}>{{ dia: 'Día', semana: 'Semana', mes: 'Mes' }[e]}</button>)}
            </div>
          </>}
          <hr />
          <div className="cabecera-menu">Esta vista</div>
          <button className="item" onClick={() => cambiar({ miembroId: vista.miembroId ? null : yo!.id })}><Users size={13} /> {vista.miembroId ? 'Compartir con el equipo' : 'Hacerla personal'}</button>
          <button className="item" onClick={() => void guardarComo(false)}><Save size={13} /> Guardar como copia</button>
          <button className="item" onClick={() => { setVista(structuredClone(guardada)); setMenuOpciones(false) }} disabled={!modificada}><X size={13} /> Descartar cambios</button>
          <button className="item" onClick={() => void borrar()} style={{ color: 'var(--error)' }}><Trash2 size={13} /> Borrar vista</button>
        </Desplegable>

        {vista.filtros.ocultarHechas && <span className="chip pequeno contorno"><Check size={11} /> Sin hechas</span>}
      </div>

      <ComponerTarea refInput={componer} vista={vista} onDetalles={setNueva} />

      {vista.tipo === 'tablero' && <Tablero vista={vista} tareas={tareas} abrirTarea={abrirTarea} onNueva={setNueva} />}
      {vista.tipo === 'lista' && <Lista vista={vista} tareas={tareas} abrirTarea={abrirTarea} onNueva={setNueva} />}
      {vista.tipo === 'calendario' && <Calendario vista={vista} tareas={tareas} abrirTarea={abrirTarea} onNueva={setNueva} />}
      {vista.tipo === 'gantt' && <Gantt vista={vista} tareas={tareas} abrirTarea={abrirTarea} onNueva={setNueva} />}

      {nueva && <ModalTarea inicial={nueva} onCerrar={() => setNueva(null)} />}
    </div>
  )
}

/**
 * Barra de alta rapida: se escribe el titulo y con Enter la tarea ya existe.
 *
 * Es el camino por defecto a proposito. El formulario completo sigue a un clic,
 * en "Mas opciones", que se lleva lo ya escrito para no repetirlo.
 */
function ComponerTarea({ refInput, vista, onDetalles }: {
  refInput: React.RefObject<HTMLInputElement | null>; vista: Vista; onDetalles: (t: Partial<Tarea>) => void
}) {
  const { yo, guardarTarea, tareaBase } = useApp()
  const [titulo, setTitulo] = useState('')
  const [guardando, setGuardando] = useState(false)

  // hereda lo que ya filtra la vista: si estas mirando un proyecto, la tarea es de ese proyecto
  const heredado = (): Partial<Tarea> => ({
    proyectoId: vista.filtros.proyectoId,
    asignadoId: vista.filtros.asignadoId ?? yo?.id ?? null,
  })

  const crear = async () => {
    const t = titulo.trim()
    if (!t || !yo || guardando) return
    setGuardando(true)
    setTitulo('')
    try { await guardarTarea(tareaBase({ titulo: t, ...heredado() })) } finally { setGuardando(false) }
    refInput.current?.focus()
  }

  return (
    <div className="componer-tarea">
      <Plus size={16} />
      <input ref={refInput} value={titulo} onChange={e => setTitulo(e.target.value)}
        placeholder="Escribe una tarea y pulsa Enter…"
        onKeyDown={e => { if (e.key === 'Enter') void crear(); if (e.key === 'Escape') setTitulo('') }} />
      <button className="btn sutil pequeno" onClick={() => { onDetalles({ titulo: titulo.trim(), ...heredado() }); setTitulo('') }}>
        Más opciones
      </button>
    </div>
  )
}

function alternar<T>(lista: T[], v: T): T[] { return lista.includes(v) ? lista.filter(x => x !== v) : [...lista, v] }
function alternarOrdenado(lista: ColumnaLista[], v: ColumnaLista, orden: ColumnaLista[]): ColumnaLista[] {
  const r = alternar(lista, v)
  return orden.filter(c => r.includes(c))
}

export type { EstadoTarea }
