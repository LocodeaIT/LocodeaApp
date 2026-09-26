/**
 * Proyectos: la cartera y la ficha de cada proyecto.
 *
 * Un proyecto se organiza en apartados (una tecnología, una fase, un
 * entregable) y cada apartado lleva sus tareas. La ficha enseña los apartados
 * como tarjetas con su avance y deja añadir tareas escribiendo en cada uno,
 * que es como se va rellenando una cartera como la de soluciones de Locodea.
 *
 * Los proyectos internos (de Locodea) no llevan cliente; los de cliente,
 * además, enlazan su carpeta de documentación en SharePoint.
 */
import { useMemo, useState, type ReactNode } from 'react'
import {
  ArrowDown, ArrowLeft, ArrowUp, Calendar, Check, ExternalLink, FolderPlus, Layers, Pencil, Play, Plus, Search, Target, Trash2,
} from 'lucide-react'
import { useApp } from '../store'
import { Anillo, Avatar, Campo, IconoPrioridad, Modal, Progreso, Vacio, confirmar } from '../ui/basicos'
import { Select } from '../ui/Select'
import { IconoApartado } from '../ui/IconoApartado'
import { ModalProyecto } from './Modales'
import type { Objetivo } from '../domain/types'
import { ETIQUETA_ICONO, iconoPorNombre } from '../domain/apartados'
import {
  ETIQUETA_ESTADO_OBJETIVO, ETIQUETA_ESTADO_PROYECTO, ETIQUETA_ESTADO_TAREA, ORDEN_ESTADOS_TAREA,
  type ApartadoProyecto, type EstadoProyecto, type IconoApartado as Icono, type Proyecto, type Tarea,
} from '../domain/types'
import { esVencida, etiquetaSemanaCorta, fechaCorta } from '../domain/fechas'
import { nuevoId } from '../data/repo'

/**
 * Avance de un proyecto contando solo tareas principales (sin subtareas), igual
 * que las tarjetas de apartado: así las cifras de la cartera, del resumen y de
 * cada apartado cuadran entre sí.
 */
interface SaludProyecto { proyecto: Proyecto; total: number; hechas: number; vencidas: number; pct: number; objetivosAbiertos: number }

function salud(p: Proyecto, tareas: Tarea[], objetivos: Objetivo[]): SaludProyecto {
  const suyas = tareas.filter(t => t.proyectoId === p.id && !t.padreId)
  const hechas = suyas.filter(t => t.estado === 'hecha').length
  return {
    proyecto: p, total: suyas.length, hechas,
    vencidas: suyas.filter(t => t.estado !== 'hecha' && esVencida(t.vence)).length,
    pct: suyas.length ? Math.round((hechas / suyas.length) * 100) : 0,
    objetivosAbiertos: objetivos.filter(o => o.proyectoId === p.id && o.estado === 'pendiente').length,
  }
}

type FiltroEstado = EstadoProyecto | 'todos'
type FiltroTipo = 'todos' | 'cliente' | 'interno'

const FILTROS_ESTADO: { valor: FiltroEstado; etiqueta: string }[] = [
  { valor: 'activo', etiqueta: 'Activos' }, { valor: 'pausado', etiqueta: 'Pausados' },
  { valor: 'cerrado', etiqueta: 'Cerrados' }, { valor: 'todos', etiqueta: 'Todos' },
]
const FILTROS_TIPO: { valor: FiltroTipo; etiqueta: string }[] = [
  { valor: 'todos', etiqueta: 'Todos' }, { valor: 'cliente', etiqueta: 'De cliente' }, { valor: 'interno', etiqueta: 'Internos' },
]
const TONO_ESTADO: Record<EstadoProyecto, string> = { activo: 'ok', pausado: 'aviso', cerrado: '' }

export default function Proyectos({ abrirTarea }: { abrirTarea: (id: string) => void }) {
  const { datos } = useApp()
  const [estado, setEstado] = useState<FiltroEstado>('activo')
  const [tipo, setTipo] = useState<FiltroTipo>('todos')
  const [texto, setTexto] = useState('')
  const [creando, setCreando] = useState(false)
  const [abierto, setAbierto] = useState<string | null>(null)

  const saludes = useMemo(() => datos.proyectos.map(p => salud(p, datos.tareas, datos.objetivos)), [datos])
  const q = texto.trim().toLowerCase()
  const visibles = saludes
    .filter(s => estado === 'todos' || s.proyecto.estado === estado)
    .filter(s => tipo === 'todos' || (tipo === 'interno') === s.proyecto.interno)
    .filter(s => !q || `${s.proyecto.nombre} ${s.proyecto.cliente}`.toLowerCase().includes(q))
    .sort((a, b) => a.proyecto.nombre.localeCompare(b.proyecto.nombre))

  const proyecto = abierto ? datos.proyectos.find(p => p.id === abierto) : null
  if (proyecto) return <FichaProyecto proyecto={proyecto} onVolver={() => setAbierto(null)} abrirTarea={abrirTarea} />

  return (
    <div className="pagina">
      <div className="titulo-pagina">
        <div>
          <h1>Proyectos.</h1>
          <div className="sub">Lo que tenemos entre manos, de clientes y nuestros.</div>
        </div>
        <div className="acciones">
          <button className="btn primario" onClick={() => setCreando(true)}><Plus size={16} /> Nuevo proyecto</button>
        </div>
      </div>

      <div className="herramientas herramientas-proyectos">
        <Segmentado valor={estado} opciones={FILTROS_ESTADO} onCambio={setEstado} etiqueta="Estado" />
        <Segmentado valor={tipo} opciones={FILTROS_TIPO} onCambio={setTipo} etiqueta="Tipo" />
        <label className="buscar-ia">
          <Search size={16} />
          <input value={texto} onChange={e => setTexto(e.target.value)} placeholder="Buscar proyecto o cliente…" />
        </label>
      </div>

      {!visibles.length && (
        <Vacio icono={<Layers size={32} />} titulo={datos.proyectos.length ? 'Nada con esos filtros' : 'Todavía no hay proyectos'}
          texto={datos.proyectos.length ? 'Prueba con otro estado o tipo.' : 'Crea el primero y organízalo en apartados.'}
          accion={!datos.proyectos.length ? <button className="btn primario" onClick={() => setCreando(true)}><Plus size={15} /> Nuevo proyecto</button> : undefined} />
      )}

      <div className="rejilla-proyectos">
        {visibles.map(s => <TarjetaProyecto key={s.proyecto.id} s={s} onAbrir={() => setAbierto(s.proyecto.id)} />)}
      </div>

      {creando && <ModalProyecto inicial={null} onCerrar={() => setCreando(false)} onCreado={p => setAbierto(p.id)} />}
    </div>
  )
}

/** Pocas opciones siempre visibles: el segmentado del sistema. */
function Segmentado<T extends string>({ valor, opciones, onCambio, etiqueta }: {
  valor: T; opciones: { valor: T; etiqueta: string }[]; onCambio: (v: T) => void; etiqueta: string
}) {
  return (
    <div className="btn-grupo" role="radiogroup" aria-label={etiqueta}>
      {opciones.map(o => (
        <button key={o.valor} type="button" role="radio" aria-checked={valor === o.valor}
          className={valor === o.valor ? 'activo' : ''} onClick={() => onCambio(o.valor)}>{o.etiqueta}</button>
      ))}
    </div>
  )
}

function Ficha({ proyecto: p, tam = 44 }: { proyecto: Proyecto; tam?: number }) {
  return <span className="proyecto-inicial" style={{ background: p.color, width: tam, height: tam, fontSize: tam * .42 }}>{p.nombre.trim().slice(0, 1).toUpperCase()}</span>
}

function TarjetaProyecto({ s, onAbrir }: { s: SaludProyecto; onAbrir: () => void }) {
  const { miembro } = useApp()
  const p = s.proyecto
  const resp = miembro(p.responsableId)
  const abiertas = s.total - s.hechas
  return (
    <article className="tarjeta tarjeta-proyecto" onClick={onAbrir} tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') onAbrir() }}>
      <div className="tp-cima">
        <Ficha proyecto={p} />
        <div className="grow">
          <h3 className="tp-nombre">{p.nombre}</h3>
          <div className="tp-cliente">{p.interno ? 'Proyecto interno' : p.cliente || 'Sin cliente'}</div>
        </div>
        <Anillo pct={s.total ? s.pct : null} tamano={50} color={p.color} />
      </div>

      {p.descripcion && <p className="tp-desc">{p.descripcion}</p>}

      {p.apartados.length > 0 && (
        <div className="tp-apartados">
          {p.apartados.slice(0, 4).map(a => <span key={a.id} className="chip pequeno"><IconoApartado icono={a.icono} tam={12} /> {a.nombre}</span>)}
          {p.apartados.length > 4 && <span className="chip pequeno contorno">+{p.apartados.length - 4}</span>}
        </div>
      )}

      <div className="tp-cifras">
        <span><b>{abiertas}</b> abiertas</span>
        <span className={s.vencidas ? 'alerta' : ''}><b>{s.vencidas}</b> vencidas</span>
        <span><b>{s.hechas}</b> hechas</span>
      </div>
      <Progreso pct={s.pct} tono={s.vencidas ? 'error' : s.total && s.pct === 100 ? 'ok' : undefined} />

      <div className="tp-pie">
        <span className="tp-resp"><Avatar miembro={resp} tamano="pequeno" /> {resp?.nombre ?? 'Sin responsable'}</span>
        {p.fechaFin && <span className="tp-fecha"><Calendar size={12} /> {fechaCorta(p.fechaFin)}</span>}
        <span className={`chip pequeno ${TONO_ESTADO[p.estado]}`}>{ETIQUETA_ESTADO_PROYECTO[p.estado]}</span>
      </div>
    </article>
  )
}

// ─────────────────────────────────────────────── ficha del proyecto

type Pestana = 'apartados' | 'lista' | 'objetivos'

function FichaProyecto({ proyecto: p, onVolver, abrirTarea }: { proyecto: Proyecto; onVolver: () => void; abrirTarea: (id: string) => void }) {
  const { datos, miembro, guardarProyecto } = useApp()
  const [pestana, setPestana] = useState<Pestana>('apartados')
  const [editando, setEditando] = useState(false)
  const [editandoApartado, setEditandoApartado] = useState<ApartadoProyecto | null>(null)

  const tareas = datos.tareas.filter(t => t.proyectoId === p.id && !t.padreId)
  const objetivos = datos.objetivos.filter(o => o.proyectoId === p.id)
  const s = salud(p, datos.tareas, datos.objetivos)
  const enCurso = tareas.filter(t => t.estado === 'en_curso').length
  const resp = miembro(p.responsableId)

  // las tareas cuyo apartado ya no existe caen en «Sin apartado»
  const idsApartado = new Set(p.apartados.map(a => a.id))
  const sinApartado = tareas.filter(t => !t.apartadoId || !idsApartado.has(t.apartadoId))

  const nuevoApartado = async (nombre: string) => {
    const a: ApartadoProyecto = { id: nuevoId(), nombre, descripcion: '', icono: iconoPorNombre(nombre) }
    await guardarProyecto({ ...p, apartados: [...p.apartados, a] })
  }

  return (
    <div className="pagina">
      <button className="btn sutil volver" onClick={onVolver}><ArrowLeft size={15} /> Proyectos</button>

      <div className="titulo-pagina ficha-cabecera">
        <div className="ficha-titulo">
          <Ficha proyecto={p} tam={52} />
          <div>
            <div className="antetitulo">{p.interno ? 'Proyecto interno' : `Cliente · ${p.cliente || 'sin indicar'}`}</div>
            <h1>{p.nombre}</h1>
            <div className="ficha-meta">
              <span className={`chip pequeno ${TONO_ESTADO[p.estado]}`}>{ETIQUETA_ESTADO_PROYECTO[p.estado]}</span>
              <span className="ficha-resp"><Avatar miembro={resp} tamano="pequeno" /> {resp?.nombre ?? 'Sin responsable'}</span>
              {(p.fechaInicio || p.fechaFin) && <span className="ficha-plazo"><Calendar size={13} /> {p.fechaInicio ? fechaCorta(p.fechaInicio) : '…'} → {p.fechaFin ? fechaCorta(p.fechaFin) : '…'}</span>}
            </div>
          </div>
        </div>
        <div className="acciones">
          {p.enlaceDocumentos && <a className="btn" href={p.enlaceDocumentos} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Documentación</a>}
          <button className="btn" onClick={() => setEditando(true)}><Pencil size={14} /> Editar</button>
        </div>
      </div>

      {p.descripcion && <p className="ficha-desc">{p.descripcion}</p>}

      <div className="tarjeta ficha-resumen">
        <div className="fr-avance">
          <Anillo pct={s.total ? s.pct : null} tamano={64} color={p.color} />
          <div><div className="fr-valor">{s.hechas} <small>de {s.total}</small></div><div className="fr-etiqueta">tareas hechas</div></div>
        </div>
        <Cifra valor={s.total - s.hechas} etiqueta="abiertas" detalle={enCurso ? `${enCurso} en curso` : undefined} />
        <Cifra valor={s.vencidas} etiqueta="vencidas" alerta={s.vencidas > 0} />
        <Cifra valor={p.apartados.length} etiqueta={p.apartados.length === 1 ? 'apartado' : 'apartados'} />
        <Cifra valor={s.objetivosAbiertos} etiqueta="objetivos abiertos" />
      </div>

      <div className="ficha-pestanas">
        <Segmentado<Pestana> valor={pestana} onCambio={setPestana} etiqueta="Vista"
          opciones={[{ valor: 'apartados', etiqueta: 'Apartados' }, { valor: 'lista', etiqueta: 'Lista' }, { valor: 'objetivos', etiqueta: `Objetivos · ${objetivos.length}` }]} />
      </div>

      {pestana === 'apartados' && (
        <div className="rejilla-apartados">
          {p.apartados.map(a => (
            <TarjetaApartado key={a.id} proyecto={p} apartado={a} tareas={tareas.filter(t => t.apartadoId === a.id)}
              abrirTarea={abrirTarea} onEditar={() => setEditandoApartado(a)} />
          ))}
          {(sinApartado.length > 0 || !p.apartados.length) && (
            <TarjetaApartado proyecto={p} apartado={null} tareas={sinApartado} abrirTarea={abrirTarea} />
          )}
          <NuevoApartado onCrear={nombre => void nuevoApartado(nombre)} primero={!p.apartados.length} />
        </div>
      )}

      {pestana === 'lista' && <ListaTareas proyecto={p} tareas={tareas} abrirTarea={abrirTarea} />}

      {pestana === 'objetivos' && (
        <div className="tarjeta">
          {objetivos.length === 0 ? <Vacio icono={<Target size={32} />} titulo="Este proyecto no tiene objetivos semanales" texto="Se enlazan desde Objetivos semanales, eligiendo este proyecto." /> : (
            <table className="tabla">
              <thead><tr><th>Semana</th><th>Objetivo</th><th>Responsable</th><th>Prioridad</th><th>Estado</th></tr></thead>
              <tbody>
                {[...objetivos].sort((a, b) => (datos.semanas.find(x => x.id === b.semanaId)?.inicio ?? '').localeCompare(datos.semanas.find(x => x.id === a.semanaId)?.inicio ?? '')).map(o => {
                  const sem = datos.semanas.find(x => x.id === o.semanaId)
                  return (
                    <tr key={o.id}>
                      <td className="muted" style={{ whiteSpace: 'nowrap' }}>{sem ? etiquetaSemanaCorta(sem.inicio) : '—'}</td>
                      <td style={{ fontWeight: 500 }}>{o.titulo}</td>
                      <td><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Avatar miembro={miembro(o.responsableId)} tamano="pequeno" />{miembro(o.responsableId)?.nombre.split(' ')[0] ?? 'General'}</span></td>
                      <td><IconoPrioridad prioridad={o.prioridad} conTexto /></td>
                      <td><span className={`chip pequeno ${o.estado === 'cumplido' ? 'ok' : ''}`}>{ETIQUETA_ESTADO_OBJETIVO[o.estado]}</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {editando && <ModalProyecto inicial={p} onCerrar={() => setEditando(false)} />}
      {editandoApartado && <ModalApartado proyecto={p} apartado={editandoApartado} onCerrar={() => setEditandoApartado(null)} />}
    </div>
  )
}

function Cifra({ valor, etiqueta, detalle, alerta }: { valor: number; etiqueta: string; detalle?: string; alerta?: boolean }) {
  return (
    <div className={`fr-cifra ${alerta ? 'alerta' : ''}`}>
      <div className="fr-valor">{valor}</div>
      <div className="fr-etiqueta">{etiqueta}{detalle && <> · {detalle}</>}</div>
    </div>
  )
}

/** Pendientes primero, por orden; las hechas al final, las más recientes arriba. */
function ordenar(tareas: Tarea[]): Tarea[] {
  const abiertas = tareas.filter(t => t.estado !== 'hecha').sort((a, b) => a.orden - b.orden)
  const hechas = tareas.filter(t => t.estado === 'hecha').sort((a, b) => (b.completadoEl ?? '').localeCompare(a.completadoEl ?? ''))
  return [...abiertas, ...hechas]
}

function TarjetaApartado({ proyecto: p, apartado: a, tareas, abrirTarea, onEditar }: {
  proyecto: Proyecto; apartado: ApartadoProyecto | null; tareas: Tarea[]; abrirTarea: (id: string) => void; onEditar?: () => void
}) {
  const { yo, guardarTarea, tareaBase } = useApp()
  const [nueva, setNueva] = useState('')
  const hechas = tareas.filter(t => t.estado === 'hecha').length
  const enMarcha = tareas.filter(t => t.estado === 'en_curso').length
  const pct = tareas.length ? Math.round((hechas / tareas.length) * 100) : 0
  const nombre = a ? a.nombre : p.apartados.length ? 'Sin apartado' : 'Tareas'

  const crear = async () => {
    const titulo = nueva.trim()
    if (!titulo) return
    setNueva('')
    // la tarea nace en el apartado, del proyecto, y asignada al responsable del proyecto
    await guardarTarea(tareaBase({ titulo, proyectoId: p.id, apartadoId: a?.id ?? null, asignadoId: p.responsableId ?? yo?.id ?? null, orden: Math.max(-1, ...tareas.map(t => t.orden)) + 1 }))
  }

  return (
    <section className={`tarjeta apartado ${a ? '' : 'sin-apartado'}`}>
      <header className="apartado-cab">
        <span className="icono-marca"><IconoApartado icono={a?.icono ?? 'general'} tam={19} /></span>
        <div className="grow">
          <h3>{nombre}</h3>
          <div className="apartado-sub">
            {tareas.length ? `${hechas} de ${tareas.length} hechas` : 'Sin tareas todavía'}
            {enMarcha > 0 && <span className="apartado-en-marcha"> · {enMarcha} en curso</span>}
          </div>
        </div>
        {onEditar && <button className="btn sutil icono pequeno" onClick={onEditar} title="Editar el apartado" aria-label={`Editar ${nombre}`}><Pencil size={14} /></button>}
      </header>
      {tareas.length > 0 && <Progreso pct={pct} tono={pct === 100 ? 'ok' : undefined} />}
      {a?.descripcion && <p className="apartado-desc">{a.descripcion}</p>}

      {tareas.length > 0 && (
        <ul className="apartado-tareas">
          {ordenar(tareas).map(t => <FilaTarea key={t.id} t={t} abrir={() => abrirTarea(t.id)} />)}
        </ul>
      )}

      <label className="apartado-nueva">
        <Plus size={15} />
        <input value={nueva} onChange={e => setNueva(e.target.value)} placeholder={`Añadir a ${nombre}…`}
          onKeyDown={e => { if (e.key === 'Enter') void crear(); if (e.key === 'Escape') setNueva('') }} />
      </label>
    </section>
  )
}

function FilaTarea({ t, abrir, extra }: { t: Tarea; abrir: () => void; extra?: ReactNode }) {
  const { yo, miembro, alternarHecha, guardarTarea } = useApp()
  const hecha = t.estado === 'hecha'
  const enCurso = t.estado === 'en_curso'
  const vencida = !hecha && esVencida(t.vence)
  // «En curso» ya lo dicen el color de la fila y el botón; los otros estados siguen con su etiqueta
  const estadoVisible = t.estado === 'bloqueada' || t.estado === 'revision'
  const quien = miembro(t.asignadoId)

  /**
   * «Estoy con ello»: la tarea pasa a En curso, que es el mismo estado que ve el
   * tablero de Tareas. Si nadie la tenía, se la queda quien pulsa; si ya era de
   * alguien, no se le quita. Otro clic la devuelve a Pendiente.
   */
  const alternarEnCurso = () => {
    if (enCurso) { void guardarTarea({ ...t, estado: 'pendiente' }); return }
    void guardarTarea({ ...t, estado: 'en_curso', asignadoId: t.asignadoId ?? yo?.id ?? null })
  }

  return (
    <li className={`fila-apartado ${hecha ? 'hecha' : ''} ${enCurso ? 'en-curso' : ''}`} onClick={abrir}>
      <button className={`check ${hecha ? 'hecho' : ''}`} onClick={e => { e.stopPropagation(); void alternarHecha(t.id) }}
        title={hecha ? 'Marcar como pendiente' : 'Marcar como hecha'} aria-label={hecha ? 'Marcar como pendiente' : 'Marcar como hecha'}>
        <Check size={11} strokeWidth={3} />
      </button>
      <span className="fa-titulo">{t.titulo}</span>
      {estadoVisible && <span className={`chip pequeno ${t.estado === 'bloqueada' ? 'error' : t.estado === 'revision' ? 'morado' : 'acento'}`}>{ETIQUETA_ESTADO_TAREA[t.estado]}</span>}
      {t.vence && !hecha && <span className={`fa-vence ${vencida ? 'vencida' : ''}`}>{fechaCorta(t.vence)}</span>}
      {extra}
      {!hecha && (
        <button className={`boton-en-ello ${enCurso ? 'activo' : ''}`} onClick={e => { e.stopPropagation(); alternarEnCurso() }}
          aria-pressed={enCurso}
          title={enCurso ? `En curso${quien ? ` · ${quien.nombre}` : ''}. Pulsa para dejarla pendiente` : 'Marcar que estoy trabajando en ello'}>
          <Play size={11} fill={enCurso ? 'currentColor' : 'none'} />{enCurso && <span>En ello</span>}
        </button>
      )}
      {t.asignadoId && <Avatar miembro={quien} tamano="pequeno" />}
    </li>
  )
}

function NuevoApartado({ onCrear, primero }: { onCrear: (nombre: string) => void; primero: boolean }) {
  const [abierto, setAbierto] = useState(false)
  const [nombre, setNombre] = useState('')
  const crear = () => { const n = nombre.trim(); if (!n) return; onCrear(n); setNombre(''); setAbierto(false) }
  if (!abierto) {
    return (
      <button className="apartado-nuevo" onClick={() => setAbierto(true)}>
        <FolderPlus size={20} />
        <b>Nuevo apartado</b>
        <span>{primero ? 'Organiza el proyecto por tecnología, fase o entregable.' : 'Otra tecnología, fase o entregable.'}</span>
      </button>
    )
  }
  return (
    <div className="apartado-nuevo abierto">
      <FolderPlus size={20} />
      <input autoFocus value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre del apartado y Enter"
        onKeyDown={e => { if (e.key === 'Enter') crear(); if (e.key === 'Escape') setAbierto(false) }}
        onBlur={() => { if (!nombre.trim()) setAbierto(false) }} />
    </div>
  )
}

function ModalApartado({ proyecto: p, apartado: a, onCerrar }: { proyecto: Proyecto; apartado: ApartadoProyecto; onCerrar: () => void }) {
  const { datos, guardarProyecto } = useApp()
  const [nombre, setNombre] = useState(a.nombre)
  const [icono, setIcono] = useState<Icono>(a.icono)
  const [descripcion, setDescripcion] = useState(a.descripcion)
  const i = p.apartados.findIndex(x => x.id === a.id)
  const nTareas = datos.tareas.filter(t => t.proyectoId === p.id && t.apartadoId === a.id).length

  const guardarLista = async (lista: ApartadoProyecto[]) => { await guardarProyecto({ ...p, apartados: lista }) }
  const guardar = async () => {
    if (!nombre.trim()) return
    await guardarLista(p.apartados.map(x => (x.id === a.id ? { ...x, nombre: nombre.trim(), icono, descripcion } : x)))
    onCerrar()
  }
  const mover = async (d: -1 | 1) => {
    const l = [...p.apartados]; const j = i + d
    if (j < 0 || j >= l.length) return
    ;[l[i], l[j]] = [l[j], l[i]]
    await guardarLista(l)
  }
  const borrar = async () => {
    const ok = await confirmar(`¿Borrar el apartado «${a.nombre}»?`, {
      texto: nTareas ? `Sus ${nTareas} tareas no se borran: pasan a «Sin apartado».` : 'No tiene tareas.', aceptar: 'Borrar', peligro: true,
    })
    if (!ok) return
    await guardarLista(p.apartados.filter(x => x.id !== a.id))
    onCerrar()
  }

  return (
    <Modal titulo="Editar apartado" onCerrar={onCerrar} pie={<>
      <button className="btn peligro" style={{ marginRight: 'auto' }} onClick={() => void borrar()}><Trash2 size={14} /> Borrar</button>
      <button className="btn" onClick={onCerrar}>Cancelar</button>
      <button className="btn primario" onClick={() => void guardar()} disabled={!nombre.trim()}>Guardar</button>
    </>}>
      <div className="formulario">
        <Campo label="Nombre"><input autoFocus value={nombre} onChange={e => setNombre(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void guardar() }} /></Campo>
        <Campo label="Icono">
          <Select valor={icono} onCambio={setIcono}
            opciones={(Object.keys(ETIQUETA_ICONO) as Icono[]).map(k => ({ valor: k, etiqueta: ETIQUETA_ICONO[k], icono: <IconoApartado icono={k} tam={15} /> }))} />
        </Campo>
        <Campo label="Descripción"><textarea value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="Qué entra en este apartado (opcional)." /></Campo>
        <Campo label="Posición">
          <div className="fila-botones">
            <button className="btn pequeno" disabled={i <= 0} onClick={() => void mover(-1)}><ArrowUp size={14} /> Antes</button>
            <button className="btn pequeno" disabled={i >= p.apartados.length - 1} onClick={() => void mover(1)}><ArrowDown size={14} /> Después</button>
            <span className="muted">{i + 1} de {p.apartados.length}</span>
          </div>
        </Campo>
      </div>
    </Modal>
  )
}

/** Todas las tareas del proyecto por estado, con su apartado al lado. */
function ListaTareas({ proyecto: p, tareas, abrirTarea }: { proyecto: Proyecto; tareas: Tarea[]; abrirTarea: (id: string) => void }) {
  if (!tareas.length) return <div className="tarjeta"><Vacio icono={<Layers size={32} />} titulo="Sin tareas todavía" texto="Añádelas desde cada apartado." /></div>
  const apartado = (id: string | null) => p.apartados.find(a => a.id === id)
  return (
    <div className="tarjeta lista-proyecto">
      {ORDEN_ESTADOS_TAREA.map(e => {
        const lista = tareas.filter(t => t.estado === e).sort((a, b) => a.orden - b.orden)
        if (!lista.length) return null
        return (
          <div key={e} className="lp-grupo">
            <div className="seccion-titulo">{ETIQUETA_ESTADO_TAREA[e]} · {lista.length}</div>
            <ul className="apartado-tareas">
              {lista.map(t => {
                const a = apartado(t.apartadoId)
                return (
                  <FilaTarea key={t.id} t={t} abrir={() => abrirTarea(t.id)}
                    extra={<span className="lp-apartado">{a ? <><IconoApartado icono={a.icono} tam={12} /> {a.nombre}</> : 'Sin apartado'}</span>} />
                )
              })}
            </ul>
          </div>
        )
      })}
    </div>
  )
}
