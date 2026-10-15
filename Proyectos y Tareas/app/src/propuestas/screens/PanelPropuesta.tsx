/**
 * Ficha lateral de una propuesta: el recorrido por los estados (se cambia con
 * un clic), los datos clave, el paso a proyecto cuando se acepta y el hilo de
 * apuntes del equipo, del más reciente al más antiguo.
 */
import { useState } from 'react'
import { ArrowRight, CalendarClock, Check, Euro, FolderKanban, MessageSquareText, Pencil, Rocket, Trash2, TrendingUp, User, X } from 'lucide-react'
import { useApp } from '../../store'
import { Avatar, Panel, confirmar } from '../../ui/basicos'
import { fechaHora, fechaLarga, relativoVencimiento } from '../../domain/fechas'
import { usePropuestas } from '../store'
import type { EstadoPropuesta, Propuesta } from '../types'
import { AYUDA_ESTADO_PROPUESTA, ESTADOS_ABIERTOS, ETIQUETA_ESTADO_PROPUESTA, ETIQUETA_PRIORIDAD_PROPUESTA } from '../types'
import { estaAbierta, formatoEuros, probabilidadDe } from '../calculos'
import { BarraProbabilidad, ChipEstado, InsigniaCliente } from './comunes'
import { ModalPropuesta } from './ModalPropuesta'
import { Adjuntos } from './Adjuntos'

const RECORRIDO: EstadoPropuesta[] = [...ESTADOS_ABIERTOS, 'aceptado']

export function PanelPropuesta({ propuesta: p, onCerrar }: { propuesta: Propuesta; onCerrar: () => void }) {
  const { miembro, proyecto, setPantalla } = useApp()
  const { mover, anadirApunte, borrarApunte, convertirEnProyecto, adjuntos } = usePropuestas()
  const [editando, setEditando] = useState(false)
  const [texto, setTexto] = useState('')
  const [convirtiendo, setConvirtiendo] = useState(false)

  const paso = RECORRIDO.indexOf(p.estado)
  const resp = miembro(p.responsableId)
  const proyectoHijo = proyecto(p.proyectoId)
  const venc = p.fechaPrevista && estaAbierta(p) ? relativoVencimiento(p.fechaPrevista) : null
  const apuntes = [...p.apuntes].sort((a, b) => b.fecha.localeCompare(a.fecha))

  const apuntar = async () => {
    if (!texto.trim()) return
    const t = texto
    setTexto('')
    try { await anadirApunte(p.id, t) } catch { setTexto(t) }
  }

  const convertir = async () => {
    setConvirtiendo(true)
    try { await convertirEnProyecto(p.id) } finally { setConvirtiendo(false) }
  }

  return (
    <Panel onCerrar={onCerrar} cabecera={
      <div className="prop-panel-cabecera">
        <InsigniaCliente nombre={p.cliente} tam={44} />
        <div style={{ minWidth: 0 }}>
          <div className="prop-panel-cliente">{p.cliente}{p.contacto && <span> · {p.contacto}</span>}</div>
          <h2 className="prop-panel-titulo">{p.titulo}</h2>
        </div>
      </div>
    }>
      {/* recorrido por los estados */}
      <section className="prop-recorrido" data-estado={p.estado} aria-label="Estado de la propuesta">
        <ol>
          {RECORRIDO.map((e, i) => {
            const hecho = p.estado !== 'descartado' && i < paso
            const actual = e === p.estado
            return (
              <li key={e} className={`${hecho ? 'hecho' : ''} ${actual ? 'actual' : ''}`} data-estado={e}>
                <button type="button" onClick={() => void mover(p.id, e)} disabled={actual} title={AYUDA_ESTADO_PROPUESTA[e]}>
                  <span className="prop-paso-punto">{hecho ? <Check size={12} strokeWidth={3} /> : i + 1}</span>
                  <span className="prop-paso-nombre">{ETIQUETA_ESTADO_PROPUESTA[e]}</span>
                </button>
              </li>
            )
          })}
        </ol>
        <div className="prop-recorrido-pie">
          <span>{AYUDA_ESTADO_PROPUESTA[p.estado]}</span>
          {p.estado === 'descartado'
            ? <button type="button" className="btn sutil pequeno" onClick={() => void mover(p.id, 'apunte')}>Recuperar</button>
            : <button type="button" className="btn sutil pequeno peligro" onClick={() => void mover(p.id, 'descartado')}><X size={13} /> Descartar</button>}
        </div>
      </section>

      {/* aceptada: paso a proyecto */}
      {p.estado === 'aceptado' && (
        proyectoHijo ? (
          <button type="button" className="prop-proyecto enlazado" onClick={() => { setPantalla('proyectos'); onCerrar() }}>
            <FolderKanban size={20} />
            <span><b>Ya es un proyecto</b><small>{proyectoHijo.nombre}</small></span>
            <ArrowRight size={16} />
          </button>
        ) : (
          <div className="prop-proyecto">
            <Rocket size={20} />
            <span><b>¡Aceptada!</b><small>Pásala a la cartera de proyectos: se lleva la descripción, las tecnologías como apartados y los adjuntos.</small></span>
            <button type="button" className="btn primario" onClick={() => void convertir()} disabled={convirtiendo}>Convertir en proyecto</button>
          </div>
        )
      )}

      {/* datos clave */}
      <section className="prop-datos">
        <div><span><Euro size={14} /> Importe</span><b>{formatoEuros(p.importe)}</b></div>
        <div><span><TrendingUp size={14} /> Probabilidad</span><BarraProbabilidad pct={probabilidadDe(p)} /></div>
        <div>
          <span><CalendarClock size={14} /> Decisión</span>
          <b className={venc?.tono === 'vencida' ? 'prop-atrasada' : ''} title={p.fechaPrevista ? fechaLarga(p.fechaPrevista) : undefined}>
            {p.fechaPrevista ? (venc ? venc.texto : fechaLarga(p.fechaPrevista)) : '—'}
          </b>
        </div>
        <div><span><User size={14} /> Responsable</span><b className="prop-resp"><Avatar miembro={resp} tamano="pequeno" /> {resp?.nombre ?? 'Sin asignar'}</b></div>
      </section>

      <div className="prop-etiquetas">
        <ChipEstado estado={p.estado} />
        <span className={`chip pequeno ${p.prioridad === 'alta' ? 'error' : 'contorno'}`}>Prioridad {ETIQUETA_PRIORIDAD_PROPUESTA[p.prioridad].toLowerCase()}</span>
        {p.cuentaId && <span className="chip pequeno acento">En el CRM</span>}
        {p.tecnologias.map(t => <span key={t} className="chip pequeno">{t}</span>)}
        <button type="button" className="btn sutil pequeno" style={{ marginLeft: 'auto' }} onClick={() => setEditando(true)}><Pencil size={13} /> Editar</button>
      </div>

      {p.descripcion && <p className="prop-descripcion">{p.descripcion}</p>}

      <Adjuntos propuestaId={p.id} adjuntos={adjuntos.filter(a => a.propuestaId === p.id)} />

      {/* apuntes */}
      <section className="prop-apuntes">
        <h3><MessageSquareText size={16} /> Apuntes <small>{p.apuntes.length}</small></h3>
        <div className="prop-redactar">
          <textarea value={texto} onChange={e => setTexto(e.target.value)} placeholder="Apunta lo que vaya pasando: llamadas, ideas, próximos pasos…"
            onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void apuntar() } }} />
          <div>
            <small>Ctrl + Intro para apuntar</small>
            <button type="button" className="btn primario pequeno" onClick={() => void apuntar()} disabled={!texto.trim()}>Apuntar</button>
          </div>
        </div>

        {!apuntes.length && <div className="prop-sin-apuntes">Todavía no hay apuntes. El primero suele ser lo que contó el cliente.</div>}
        <ol className="prop-hilo">
          {apuntes.map(a => {
            const autor = miembro(a.autorId)
            return (
              <li key={a.id} className={a.estado ? 'cambio' : ''} data-estado={a.estado}>
                {a.estado ? <span className="prop-hilo-punto" /> : <Avatar miembro={autor} tamano="pequeno" />}
                <div className="prop-hilo-cuerpo">
                  <div className="prop-hilo-meta">
                    <b>{autor?.nombre ?? 'Alguien del equipo'}</b>
                    <time dateTime={a.fecha}>{fechaHora(a.fecha)}</time>
                    <button type="button" className="btn sutil icono pequeno prop-hilo-borrar" aria-label="Borrar apunte" onClick={async () => {
                      if (await confirmar('¿Borrar el apunte?', { aceptar: 'Borrar', peligro: true })) void borrarApunte(p.id, a.id)
                    }}><Trash2 size={13} /></button>
                  </div>
                  {a.estado ? <ChipEstado estado={a.estado} pequeno /> : null}
                  {(!a.estado || !a.texto.startsWith('Pasa a ')) && <p>{a.texto}</p>}
                </div>
              </li>
            )
          })}
        </ol>
      </section>

      {editando && <ModalPropuesta inicial={p} onCerrar={() => setEditando(false)} />}
    </Panel>
  )
}
