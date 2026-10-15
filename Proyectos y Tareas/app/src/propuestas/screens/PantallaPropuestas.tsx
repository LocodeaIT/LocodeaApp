/**
 * Propuestas: los apuntes y posibles proyectos de clientes, en un tablero por
 * estados (de la primera idea al «sí») o en lista. Las tarjetas se arrastran
 * de una columna a otra y cada una abre su ficha con el hilo de apuntes.
 *
 * Arriba, las cifras del embudo: lo que hay abierto, el valor en juego, la
 * previsión ponderada por probabilidad y la tasa de éxito.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  DndContext, DragOverlay, PointerSensor, closestCorners, useDroppable, useSensor, useSensors,
  type DragEndEvent, type DragOverEvent, type DragStartEvent,
} from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Archive, CalendarClock, Euro, FolderKanban, Handshake, List, MessageSquareText, Paperclip, Plus, Search, Sparkles, Target, TrendingUp,
} from 'lucide-react'
import { useApp } from '../../store'
import { Avatar, FiltroPersonas, Segmentado, Vacio } from '../../ui/basicos'
import { fechaCorta, hoy, relativoVencimiento } from '../../domain/fechas'
import { usePropuestas } from '../store'
import type { EstadoPropuesta, Propuesta } from '../types'
import { AYUDA_ESTADO_PROPUESTA, ESTADOS_ABIERTOS, ESTADOS_PROPUESTA, ETIQUETA_ESTADO_PROPUESTA } from '../types'
import { columna, estaAbierta, formatoEuros, probabilidadDe, resumirEmbudo } from '../calculos'
import { BarraProbabilidad, ChipEstado, InsigniaCliente } from './comunes'
import { ModalPropuesta } from './ModalPropuesta'
import { FichaPropuesta } from './FichaPropuesta'

type Vista = 'tablero' | 'lista'
const PREF_VISTA = 'locodea.propuestas.vista'
const PREF_DESCARTADAS = 'locodea.propuestas.descartadas'

function leerPref(clave: string): string | null {
  try { return localStorage.getItem(clave) } catch { return null }
}
function guardarPref(clave: string, valor: string): void {
  try { localStorage.setItem(clave, valor) } catch { /* modo privado */ }
}

const ID_COLUMNA = (e: EstadoPropuesta) => `columna:${e}`
const estadoDeColumna = (id: string): EstadoPropuesta | null => (id.startsWith('columna:') ? id.slice(8) as EstadoPropuesta : null)

export default function PantallaPropuestas() {
  const { propuestas, cargado, cargando, error, cargar } = usePropuestas()
  const [vista, setVistaEstado] = useState<Vista>(() => (leerPref(PREF_VISTA) === 'lista' ? 'lista' : 'tablero'))
  const [verDescartadas, setVerDescartadasEstado] = useState(() => leerPref(PREF_DESCARTADAS) === '1')
  const [persona, setPersona] = useState<string | null>(null)
  const [texto, setTexto] = useState('')
  const [creando, setCreando] = useState<EstadoPropuesta | null>(null)
  const [abierta, setAbierta] = useState<string | null>(null)

  useEffect(() => { if (!cargado && !cargando) void cargar() }, [cargado, cargando, cargar])

  const setVista = (v: Vista) => { setVistaEstado(v); guardarPref(PREF_VISTA, v) }
  const setVerDescartadas = (v: boolean) => { setVerDescartadasEstado(v); guardarPref(PREF_DESCARTADAS, v ? '1' : '0') }

  const q = texto.trim().toLowerCase()
  const visibles = useMemo(() => propuestas
    .filter(p => !persona || p.responsableId === persona)
    .filter(p => !q || `${p.titulo} ${p.cliente} ${p.contacto} ${p.tecnologias.join(' ')}`.toLowerCase().includes(q)),
  [propuestas, persona, q])
  const resumen = useMemo(() => resumirEmbudo(visibles, hoy()), [visibles])
  const propuestaAbierta = abierta ? propuestas.find(p => p.id === abierta) ?? null : null

  if (error) {
    return (
      <div className="pagina">
        <Cabecera onNueva={() => undefined} deshabilitado />
        <Vacio icono={<Handshake size={32} />} titulo="Propuestas aún no está listo aquí" texto={`${error} Hay que crear la tabla con scripts/propuestas-esquema.mjs y añadirla como fuente de datos de la app.`}
          accion={<button className="btn" onClick={() => void cargar()}>Reintentar</button>} />
      </div>
    )
  }

  if (!cargado) return <div className="carga"><div className="spinner" /></div>
  if (propuestaAbierta) return <FichaPropuesta propuesta={propuestaAbierta} onVolver={() => setAbierta(null)} />

  return (
    <div className="pagina prop-pagina">
      <Cabecera onNueva={() => setCreando('apunte')} />

      <section className="prop-kpis">
        <Kpi icono={<Target size={16} />} etiqueta="Abiertas" valor={String(resumen.abiertas)}
          pie={resumen.atrasadas ? `${resumen.atrasadas} con la decisión pasada` : 'Ninguna con la decisión pasada'} tono={resumen.atrasadas ? 'mal' : undefined} />
        <Kpi icono={<Euro size={16} />} etiqueta="En juego" valor={formatoEuros(resumen.enJuego, true)} pie="Suma de lo abierto" />
        <Kpi icono={<TrendingUp size={16} />} etiqueta="Previsión ponderada" valor={formatoEuros(resumen.ponderado, true)} pie="Importe × probabilidad" destacado />
        <Kpi icono={<Sparkles size={16} />} etiqueta="Tasa de éxito" valor={resumen.tasaExito === null ? '—' : `${resumen.tasaExito}%`}
          pie={`${resumen.aceptadas} aceptadas · ${formatoEuros(resumen.importeAceptado, true)}`} tono={resumen.tasaExito !== null && resumen.tasaExito >= 50 ? 'ok' : undefined} />
      </section>

      <Embudo resumen={resumen} />

      <div className="herramientas prop-herramientas">
        <Segmentado valor={vista} onCambio={setVista} etiqueta="Vista" opciones={[{ valor: 'tablero', etiqueta: 'Tablero' }, { valor: 'lista', etiqueta: 'Lista' }]} />
        <FiltroPersonas valor={persona} onCambio={setPersona} />
        <button type="button" className={`btn sutil pequeno prop-ver-descartadas ${verDescartadas ? 'activo' : ''}`} aria-pressed={verDescartadas} onClick={() => setVerDescartadas(!verDescartadas)}>
          <Archive size={14} /> {verDescartadas ? 'Ocultar' : 'Ver'} descartadas{resumen.descartadas ? ` (${resumen.descartadas})` : ''}
        </button>
        <label className="buscar-ia">
          <Search size={16} />
          <input value={texto} onChange={e => setTexto(e.target.value)} placeholder="Buscar propuesta, cliente o tecnología…" />
        </label>
      </div>

      {!propuestas.length ? (
        <Vacio icono={<Handshake size={32} />} titulo="Todavía no hay propuestas"
          texto="Apunta aquí cada posible proyecto que salga con un cliente, aunque solo sea una idea. Luego lo vas moviendo por el tablero."
          accion={<button className="btn primario" onClick={() => setCreando('apunte')}><Plus size={15} /> Primera propuesta</button>} />
      ) : vista === 'tablero' ? (
        <Tablero propuestas={visibles} verDescartadas={verDescartadas} onAbrir={setAbierta} onNueva={setCreando} />
      ) : (
        <Lista propuestas={visibles.filter(p => verDescartadas || p.estado !== 'descartado')} onAbrir={setAbierta} />
      )}

      {creando && <ModalPropuesta inicial={null} estadoInicial={creando} onCerrar={() => setCreando(null)} onCreada={p => setAbierta(p.id)} />}
    </div>
  )
}

function Cabecera({ onNueva, deshabilitado }: { onNueva: () => void; deshabilitado?: boolean }) {
  return (
    <div className="titulo-pagina">
      <div>
        <h1>Propuestas.</h1>
        <div className="sub">Apuntes y posibles proyectos de clientes, de la primera idea al «sí».</div>
      </div>
      <div className="acciones">
        <button className="btn primario" onClick={onNueva} disabled={deshabilitado}><Plus size={16} /> Nueva propuesta</button>
      </div>
    </div>
  )
}

function Kpi({ icono, etiqueta, valor, pie, tono, destacado }: { icono: ReactNode; etiqueta: string; valor: string; pie: string; tono?: 'ok' | 'mal'; destacado?: boolean }) {
  return (
    <div className={`tarjeta prop-kpi ${destacado ? 'destacado' : ''}`}>
      <span className="prop-kpi-etiqueta"><i>{icono}</i>{etiqueta}</span>
      <span className="prop-kpi-valor">{valor}</span>
      <span className={`prop-kpi-pie ${tono ?? ''}`}>{pie}</span>
    </div>
  )
}

/** Barra del embudo: cuántas hay en cada estado, de un vistazo. */
function Embudo({ resumen }: { resumen: ReturnType<typeof resumirEmbudo> }) {
  const tramos = [...ESTADOS_ABIERTOS, 'aceptado' as const].map(e => ({ e, ...resumen.porEstado[e] }))
  const total = tramos.reduce((s, t) => s + t.cuantas, 0)
  if (!total) return null
  return (
    <section className="prop-embudo" aria-label="Embudo de propuestas">
      <div className="prop-embudo-barra">
        {tramos.filter(t => t.cuantas).map(t => (
          <span key={t.e} data-estado={t.e} style={{ flexGrow: t.cuantas }} title={`${ETIQUETA_ESTADO_PROPUESTA[t.e]}: ${t.cuantas} · ${formatoEuros(t.importe)}`} />
        ))}
      </div>
      <div className="prop-embudo-leyenda">
        {tramos.map(t => (
          <span key={t.e} data-estado={t.e} className={t.cuantas ? '' : 'cero'}><i />{ETIQUETA_ESTADO_PROPUESTA[t.e]} <b>{t.cuantas}</b></span>
        ))}
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────── tablero

function Tablero({ propuestas, verDescartadas, onAbrir, onNueva }: {
  propuestas: Propuesta[]; verDescartadas: boolean; onAbrir: (id: string) => void; onNueva: (e: EstadoPropuesta) => void
}) {
  const { mover } = usePropuestas()
  const sensores = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  const [arrastrando, setArrastrando] = useState<string | null>(null)
  const [sobre, setSobre] = useState<EstadoPropuesta | null>(null)
  const estados = ESTADOS_PROPUESTA.filter(e => verDescartadas || e !== 'descartado')
  const porId = new Map(propuestas.map(p => [p.id, p]))

  const columnaDe = (id: string): EstadoPropuesta | null => estadoDeColumna(id) ?? porId.get(id)?.estado ?? null

  const onDragStart = (e: DragStartEvent) => setArrastrando(String(e.active.id))
  const onDragOver = (e: DragOverEvent) => setSobre(e.over ? columnaDe(String(e.over.id)) : null)
  const onDragEnd = (e: DragEndEvent) => {
    setArrastrando(null)
    setSobre(null)
    if (!e.over) return
    const id = String(e.active.id), sobreId = String(e.over.id)
    const destino = columnaDe(sobreId)
    if (!destino) return
    const lista = columna(propuestas, destino).filter(p => p.id !== id)
    const indice = estadoDeColumna(sobreId) ? lista.length : Math.max(0, lista.findIndex(p => p.id === sobreId))
    void mover(id, destino, indice)
  }

  const activa = arrastrando ? porId.get(arrastrando) : null

  return (
    <DndContext sensors={sensores} collisionDetection={closestCorners} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd}
      onDragCancel={() => { setArrastrando(null); setSobre(null) }}>
      <div className="prop-tablero" style={{ ['--columnas' as string]: estados.length }}>
        {estados.map(e => (
          <Columna key={e} estado={e} propuestas={columna(propuestas, e)} resaltada={sobre === e && !!activa && activa.estado !== e}
            onAbrir={onAbrir} onNueva={() => onNueva(e)} />
        ))}
      </div>
      <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(.2,.8,.2,1)' }}>
        {activa ? <Tarjeta propuesta={activa} flotando /> : null}
      </DragOverlay>
    </DndContext>
  )
}

function Columna({ estado, propuestas, resaltada, onAbrir, onNueva }: {
  estado: EstadoPropuesta; propuestas: Propuesta[]; resaltada: boolean; onAbrir: (id: string) => void; onNueva: () => void
}) {
  const { setNodeRef } = useDroppable({ id: ID_COLUMNA(estado) })
  const importe = propuestas.reduce((s, p) => s + (p.importe ?? 0), 0)
  return (
    <section className={`prop-columna ${resaltada ? 'resaltada' : ''}`} data-estado={estado} aria-label={ETIQUETA_ESTADO_PROPUESTA[estado]}>
      <header className="prop-columna-cabecera" title={AYUDA_ESTADO_PROPUESTA[estado]}>
        <i className="prop-punto" />
        <h2>{ETIQUETA_ESTADO_PROPUESTA[estado]}</h2>
        <span className="prop-cuenta">{propuestas.length}</span>
        <button type="button" className="btn sutil icono pequeno" onClick={onNueva} aria-label={`Nueva propuesta en ${ETIQUETA_ESTADO_PROPUESTA[estado]}`}><Plus size={15} /></button>
      </header>
      <div className="prop-columna-importe">{importe ? formatoEuros(importe, true) : 'Sin importe'}</div>
      <SortableContext items={propuestas.map(p => p.id)} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className="prop-columna-cuerpo">
          {propuestas.map(p => <TarjetaOrdenable key={p.id} propuesta={p} onAbrir={() => onAbrir(p.id)} />)}
          {!propuestas.length && <div className="prop-columna-vacia">Arrastra aquí</div>}
        </div>
      </SortableContext>
    </section>
  )
}

function TarjetaOrdenable({ propuesta, onAbrir }: { propuesta: Propuesta; onAbrir: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: propuesta.id })
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={isDragging ? 'prop-hueco' : ''} {...attributes} {...listeners}>
      <Tarjeta propuesta={propuesta} onAbrir={onAbrir} />
    </div>
  )
}

function Tarjeta({ propuesta: p, onAbrir, flotando }: { propuesta: Propuesta; onAbrir?: () => void; flotando?: boolean }) {
  const { miembro } = useApp()
  const { adjuntos } = usePropuestas()
  const resp = miembro(p.responsableId)
  const venc = p.fechaPrevista && estaAbierta(p) ? relativoVencimiento(p.fechaPrevista) : null
  const notas = p.apuntes.filter(a => !a.estado).length
  const archivos = adjuntos.filter(a => a.propuestaId === p.id).length
  return (
    <article className={`prop-tarjeta ${flotando ? 'flotando' : ''}`} data-estado={p.estado} data-prioridad={p.prioridad}
      onClick={onAbrir} onKeyDown={e => { if (e.key === 'Enter') onAbrir?.() }} tabIndex={0}>
      <div className="prop-tarjeta-cliente">
        <InsigniaCliente nombre={p.cliente} tam={22} />
        <span>{p.cliente}</span>
        {p.prioridad === 'alta' && <span className="prop-alta" title="Prioridad alta">Alta</span>}
      </div>
      <h3>{p.titulo}</h3>
      {p.tecnologias.length > 0 && (
        <div className="prop-tarjeta-tec">
          {p.tecnologias.slice(0, 3).map(t => <span key={t}>{t}</span>)}
          {p.tecnologias.length > 3 && <span>+{p.tecnologias.length - 3}</span>}
        </div>
      )}
      {(p.importe !== null || estaAbierta(p)) && (
        <div className="prop-tarjeta-cifras">
          {p.importe === null ? <span className="prop-tenue">Sin importe</span> : <b>{formatoEuros(p.importe)}</b>}
          {estaAbierta(p) && <BarraProbabilidad pct={probabilidadDe(p)} />}
        </div>
      )}
      <footer>
        {venc && <span className={`prop-fecha ${venc.tono}`}><CalendarClock size={12} /> {venc.texto}</span>}
        {p.proyectoId && <span className="prop-es-proyecto"><FolderKanban size={12} /> Proyecto</span>}
        {notas > 0 && <span className="prop-notas" title={`${notas} apuntes`}><MessageSquareText size={12} /> {notas}</span>}
        {archivos > 0 && <span className="prop-notas" title={`${archivos} adjuntos`}><Paperclip size={12} /> {archivos}</span>}
        <span className="grow" />
        <Avatar miembro={resp} tamano="pequeno" />
      </footer>
    </article>
  )
}

// ─────────────────────────────────────────────── lista

type Orden = 'estado' | 'importe' | 'fecha' | 'cliente'

function Cab({ id, orden, setOrden, children, derecha }: { id: Orden; orden: Orden; setOrden: (o: Orden) => void; children: ReactNode; derecha?: boolean }) {
  return <th className={derecha ? 'derecha' : ''}><button type="button" className={orden === id ? 'activo' : ''} onClick={() => setOrden(id)}>{children}</button></th>
}

function Lista({ propuestas, onAbrir }: { propuestas: Propuesta[]; onAbrir: (id: string) => void }) {
  const { miembro } = useApp()
  const [orden, setOrden] = useState<Orden>('estado')
  const ordenadas = [...propuestas].sort((a, b) => {
    if (orden === 'importe') return (b.importe ?? -1) - (a.importe ?? -1)
    if (orden === 'fecha') return (a.fechaPrevista ?? '9999').localeCompare(b.fechaPrevista ?? '9999')
    if (orden === 'cliente') return a.cliente.localeCompare(b.cliente, 'es')
    return ESTADOS_PROPUESTA.indexOf(a.estado) - ESTADOS_PROPUESTA.indexOf(b.estado) || a.orden - b.orden
  })
  const cab = { orden, setOrden }
  if (!ordenadas.length) return <Vacio icono={<List size={28} />} titulo="Nada con esos filtros" texto="Prueba con otra persona o búsqueda." />
  return (
    <div className="tarjeta prop-lista">
      <table>
        <thead>
          <tr>
            <Cab {...cab} id="cliente">Propuesta</Cab>
            <Cab {...cab} id="estado">Estado</Cab>
            <Cab {...cab} id="importe" derecha>Importe</Cab>
            <th>Probabilidad</th>
            <Cab {...cab} id="fecha">Decisión</Cab>
            <th>Responsable</th>
            <th>Último apunte</th>
          </tr>
        </thead>
        <tbody>
          {ordenadas.map(p => {
            const ultimo = [...p.apuntes].filter(a => !a.estado).sort((a, b) => b.fecha.localeCompare(a.fecha))[0]
            const venc = p.fechaPrevista && estaAbierta(p) ? relativoVencimiento(p.fechaPrevista) : null
            return (
              <tr key={p.id} onClick={() => onAbrir(p.id)} tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') onAbrir(p.id) }}>
                <td>
                  <div className="prop-lista-titulo">
                    <InsigniaCliente nombre={p.cliente} tam={30} />
                    <span><b>{p.titulo}</b><small>{p.cliente}</small></span>
                  </div>
                </td>
                <td><ChipEstado estado={p.estado} pequeno /></td>
                <td className="derecha num">{formatoEuros(p.importe)}</td>
                <td>{estaAbierta(p) ? <BarraProbabilidad pct={probabilidadDe(p)} /> : <span className="prop-tenue">—</span>}</td>
                <td>{p.fechaPrevista ? <span className={`prop-fecha ${venc?.tono ?? ''}`}>{venc ? venc.texto : fechaCorta(p.fechaPrevista)}</span> : <span className="prop-tenue">—</span>}</td>
                <td><Avatar miembro={miembro(p.responsableId)} tamano="pequeno" /></td>
                <td className="prop-lista-apunte">{ultimo ? ultimo.texto : <span className="prop-tenue">—</span>}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}


