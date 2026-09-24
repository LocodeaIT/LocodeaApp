/**
 * Skills y agentes de IA: el catálogo de lo que el equipo ya ha montado.
 *
 * Existe para que nadie rehaga lo que ya existe. De cada pieza importa qué hace,
 * cómo se invoca, dónde vive y a quién preguntar; por eso la tarjeta enseña
 * «Cómo se usa» a la vista y el enlace se abre (si es una URL) o se copia (si
 * es una ruta, como las skills de Claude en ~/.claude/skills).
 */
import { useMemo, useState } from 'react'
import { Bot, Copy, ExternalLink, MessageSquareText, Plus, Search, Sparkles, Trash2, Workflow } from 'lucide-react'
import { useApp } from '../store'
import { Avatar, Campo, ChipProyecto, Modal, SelectMiembro, SelectProyecto, Vacio, confirmar } from '../ui/basicos'
import { Select } from '../ui/Select'
import type { EstadoRecursoIA, PlataformaIA, RecursoIA, TipoRecursoIA } from '../domain/types'
import {
  ESTADOS_IA, ETIQUETA_ESTADO_IA, ETIQUETA_PLATAFORMA_IA, ETIQUETA_TIPO_IA, PLATAFORMAS_IA, TIPOS_IA,
} from '../domain/types'
import type { Nuevo } from '../data/repo'

const ICONO_TIPO: Record<TipoRecursoIA, typeof Bot> = {
  skill: Sparkles, agente: Bot, prompt: MessageSquareText, flujo: Workflow,
}

/** Tono de la etiqueta de estado: en uso es lo que se puede usar ya. */
const TONO_ESTADO: Record<EstadoRecursoIA, string> = {
  uso: 'ok', desarrollo: 'aviso', idea: '', retirado: 'contorno',
}

const OPC_TIPO = TIPOS_IA.map(t => ({ valor: t, etiqueta: ETIQUETA_TIPO_IA[t] }))
const OPC_PLATAFORMA = PLATAFORMAS_IA.map(p => ({ valor: p, etiqueta: ETIQUETA_PLATAFORMA_IA[p] }))
const OPC_ESTADO = ESTADOS_IA.map(e => ({ valor: e, etiqueta: ETIQUETA_ESTADO_IA[e] }))

type Filtro = 'todo' | EstadoRecursoIA
const FILTROS: { valor: Filtro; etiqueta: string }[] = [
  { valor: 'todo', etiqueta: 'Todo' },
  { valor: 'uso', etiqueta: 'En uso' },
  { valor: 'desarrollo', etiqueta: 'En desarrollo' },
  { valor: 'idea', etiqueta: 'Ideas' },
  { valor: 'retirado', etiqueta: 'Retirados' },
]

/** Orden de la rejilla: lo que ya se usa primero; lo retirado, al final. */
const ORDEN_ESTADO: Record<EstadoRecursoIA, number> = { uso: 0, desarrollo: 1, idea: 2, retirado: 3 }

export default function SkillsIA() {
  const { datos } = useApp()
  const [filtro, setFiltro] = useState<Filtro>('todo')
  const [plataforma, setPlataforma] = useState<PlataformaIA | ''>('')
  const [texto, setTexto] = useState('')
  const [editando, setEditando] = useState<RecursoIA | Partial<RecursoIA> | null>(null)

  const visibles = useMemo(() => {
    const q = texto.trim().toLowerCase()
    return datos.recursosIA
      .filter(r => filtro === 'todo' || r.estado === filtro)
      .filter(r => !plataforma || r.plataforma === plataforma)
      .filter(r => !q || `${r.nombre} ${r.descripcion} ${r.comoUsar}`.toLowerCase().includes(q))
      .sort((a, b) => ORDEN_ESTADO[a.estado] - ORDEN_ESTADO[b.estado] || a.nombre.localeCompare(b.nombre))
  }, [datos.recursosIA, filtro, plataforma, texto])

  const enUso = datos.recursosIA.filter(r => r.estado === 'uso').length

  return (
    <div className="pagina">
      <div className="titulo-pagina">
        <div>
          <h1>Skills y agentes de IA.</h1>
          <div className="sub">
            Lo que el equipo ya ha montado con IA, para no rehacerlo: qué hace, cómo se usa y a quién preguntar.
            {enUso > 0 && <> <b>{enUso}</b> {enUso === 1 ? 'pieza en uso' : 'piezas en uso'}.</>}
          </div>
        </div>
        <div className="acciones">
          <button className="btn acento" onClick={() => setEditando({})}><Plus size={16} /> Añadir al catálogo</button>
        </div>
      </div>

      <div className="herramientas herramientas-ia">
        <div className="btn-grupo" role="tablist" aria-label="Filtrar por estado">
          {FILTROS.map(f => (
            <button key={f.valor} role="tab" aria-selected={filtro === f.valor} className={filtro === f.valor ? 'activo' : ''} onClick={() => setFiltro(f.valor)}>
              {f.etiqueta}
            </button>
          ))}
        </div>
        <Select valor={plataforma} onCambio={v => setPlataforma(v as PlataformaIA | '')} pequeno ancho={210}
          opciones={[{ valor: '', etiqueta: 'Todas las plataformas' }, ...OPC_PLATAFORMA]} />
        <label className="buscar-ia">
          <Search size={16} />
          <input value={texto} onChange={e => setTexto(e.target.value)} placeholder="Buscar en el catálogo…" />
        </label>
      </div>

      {!datos.recursosIA.length && (
        <Vacio icono={<Sparkles size={32} />} titulo="El catálogo está vacío"
          texto="Apunta la primera skill, agente o prompt que uséis. Con el nombre y cómo se usa ya sirve."
          accion={<button className="btn primario" onClick={() => setEditando({})}><Plus size={15} /> Añadir la primera</button>} />
      )}
      {!!datos.recursosIA.length && !visibles.length && (
        <Vacio icono={<Search size={32} />} titulo="Nada con esos filtros" texto="Prueba con otro estado o quita la búsqueda." />
      )}

      <div className="rejilla-ia">
        {visibles.map(r => <Tarjeta key={r.id} r={r} onAbrir={() => setEditando(r)} />)}
      </div>

      {editando && <ModalRecurso inicial={editando} onCerrar={() => setEditando(null)} />}
    </div>
  )
}

function Tarjeta({ r, onAbrir }: { r: RecursoIA; onAbrir: () => void }) {
  const { miembro, proyecto, avisar } = useApp()
  const I = ICONO_TIPO[r.tipo]
  const esUrl = /^https?:\/\//i.test(r.enlace)
  const resp = miembro(r.responsableId)

  const copiar = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try { await navigator.clipboard.writeText(r.enlace); avisar('Ruta copiada') }
    catch { avisar('No se pudo copiar', 'error') }
  }

  return (
    <article className={`tarjeta recurso-ia ${r.estado}`} onClick={onAbrir} tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter') onAbrir() }}>
      <div className="recurso-cima">
        <span className="icono-marca"><I size={20} /></span>
        <div className="grow">
          <h3 className="recurso-nombre">{r.nombre || 'Sin nombre'}</h3>
          <div className="recurso-meta">{ETIQUETA_TIPO_IA[r.tipo]} · {ETIQUETA_PLATAFORMA_IA[r.plataforma]}</div>
        </div>
        <span className={`chip pequeno ${TONO_ESTADO[r.estado]}`}>{ETIQUETA_ESTADO_IA[r.estado]}</span>
      </div>

      {r.descripcion && <p className="recurso-desc">{r.descripcion}</p>}

      {r.comoUsar && (
        <div className="recurso-uso">
          <span className="recurso-uso-etiqueta">Cómo se usa</span>
          <p>{r.comoUsar}</p>
        </div>
      )}

      <div className="recurso-pie">
        <span className="recurso-resp"><Avatar miembro={resp} tamano="pequeno" /> {resp?.nombre ?? 'Sin responsable'}</span>
        <ChipProyecto proyecto={proyecto(r.proyectoId)} />
        {r.enlace && (esUrl
          ? <a className="btn sutil pequeno" href={r.enlace} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}><ExternalLink size={13} /> Abrir</a>
          : <button className="btn sutil pequeno" onClick={copiar} title={r.enlace}><Copy size={13} /> Copiar ruta</button>)}
      </div>
    </article>
  )
}

function ModalRecurso({ inicial, onCerrar }: { inicial: RecursoIA | Partial<RecursoIA>; onCerrar: () => void }) {
  const { guardarRecursoIA, borrarRecursoIA, recursoIABase } = useApp()
  const existente = 'id' in inicial && inicial.id ? (inicial as RecursoIA) : null
  const [r, setR] = useState<Nuevo<RecursoIA>>(() => existente ?? recursoIABase(inicial))
  const cambiar = <K extends keyof Nuevo<RecursoIA>>(k: K, v: Nuevo<RecursoIA>[K]) => setR(x => ({ ...x, [k]: v }))

  const guardar = async () => {
    if (!r.nombre.trim()) return
    const limpio = { ...r, nombre: r.nombre.trim(), enlace: r.enlace.trim() }
    await guardarRecursoIA(existente ? { ...existente, ...limpio } : limpio)
    onCerrar()
  }

  const borrar = async () => {
    if (!existente) return
    if (await confirmar(`¿Quitar «${existente.nombre}» del catálogo?`, { texto: 'Si solo ha dejado de usarse, mejor márcalo como Retirado: así queda constancia.', aceptar: 'Quitar', peligro: true })) {
      await borrarRecursoIA(existente.id)
      onCerrar()
    }
  }

  return (
    <Modal titulo={existente ? 'Editar' : 'Añadir al catálogo'} ancho onCerrar={onCerrar} pie={<>
      {existente && <button className="btn peligro" style={{ marginRight: 'auto' }} onClick={() => void borrar()}><Trash2 size={14} /> Quitar</button>}
      <button className="btn" onClick={onCerrar}>Cancelar</button>
      <button className="btn primario" onClick={() => void guardar()} disabled={!r.nombre.trim()}>{existente ? 'Guardar' : 'Añadir'}</button>
    </>}>
      <div className="formulario">
        <Campo label="Nombre">
          <input autoFocus value={r.nombre} onChange={e => cambiar('nombre', e.target.value)} placeholder="Ej.: Redactor de propuestas comerciales" />
        </Campo>
        <div className="fila-campos">
          <Campo label="Tipo"><Select valor={r.tipo} onCambio={v => cambiar('tipo', v)} opciones={OPC_TIPO} /></Campo>
          <Campo label="Plataforma"><Select valor={r.plataforma} onCambio={v => cambiar('plataforma', v)} opciones={OPC_PLATAFORMA} /></Campo>
          <Campo label="Estado"><Select valor={r.estado} onCambio={v => cambiar('estado', v)} opciones={OPC_ESTADO} /></Campo>
        </div>
        <Campo label="Qué hace">
          <textarea value={r.descripcion} onChange={e => cambiar('descripcion', e.target.value)} placeholder="Para qué sirve y cuándo conviene usarlo." />
        </Campo>
        <Campo label="Cómo se usa">
          <textarea value={r.comoUsar} onChange={e => cambiar('comoUsar', e.target.value)} placeholder="Comando, disparador o una frase de ejemplo para invocarlo." />
        </Campo>
        <Campo label="Dónde vive">
          <input value={r.enlace} onChange={e => cambiar('enlace', e.target.value)} placeholder="URL del agente, ruta de la skill o repositorio" />
        </Campo>
        <div className="fila-campos dos">
          <Campo label="Responsable"><SelectMiembro valor={r.responsableId} onCambio={v => cambiar('responsableId', v)} /></Campo>
          <Campo label="Proyecto"><SelectProyecto valor={r.proyectoId} onCambio={v => cambiar('proyectoId', v)} textoNinguno="Uso interno" /></Campo>
        </div>
      </div>
    </Modal>
  )
}
