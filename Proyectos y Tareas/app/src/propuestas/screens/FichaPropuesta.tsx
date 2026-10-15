/**
 * Ficha de una propuesta, a página completa (como la de un proyecto):
 *
 *   - cabecera con el cliente, el estado y el recorrido por los estados (se
 *     cambia con un clic), y el paso a proyecto cuando se acepta;
 *   - las cifras clave: importe, probabilidad, previsión ponderada y decisión;
 *   - a la izquierda, el resumen (la descripción ordenada en bloques), los
 *     adjuntos y el hilo de apuntes;
 *   - a la derecha, los datos de la propuesta de un vistazo.
 */
import { useEffect, useState, type ReactNode } from 'react'
import {
  ArrowLeft, ArrowRight, Building, CalendarClock, Check, Clock, Euro, FileText, FolderKanban, Layers, MessageSquareText, Paperclip,
  Pencil, Rocket, Trash2, TrendingUp, User, UserRound, X,
} from 'lucide-react'
import { useApp } from '../../store'
import { Anillo, Avatar, confirmar } from '../../ui/basicos'
import { differenceInCalendarDays, parseISO } from 'date-fns'
import { fechaHora, fechaLarga, hoy, relativoVencimiento } from '../../domain/fechas'
import { usePropuestas } from '../store'
import type { EstadoPropuesta, Propuesta } from '../types'
import { AYUDA_ESTADO_PROPUESTA, ESTADOS_ABIERTOS, ETIQUETA_ESTADO_PROPUESTA, ETIQUETA_PRIORIDAD_PROPUESTA } from '../types'
import { estaAbierta, formatoEuros, probabilidadDe } from '../calculos'
import { ChipEstado, InsigniaCliente } from './comunes'
import { ModalPropuesta } from './ModalPropuesta'
import { Adjuntos } from './Adjuntos'

const RECORRIDO: EstadoPropuesta[] = [...ESTADOS_ABIERTOS, 'aceptado']

export function FichaPropuesta({ propuesta: p, onVolver }: { propuesta: Propuesta; onVolver: () => void }) {
  const { miembro, proyecto, setPantalla } = useApp()
  const { mover, convertirEnProyecto, adjuntos, borrar } = usePropuestas()
  const [editando, setEditando] = useState(false)
  const [convirtiendo, setConvirtiendo] = useState(false)

  // al abrir otra propuesta, la ficha empieza arriba (el tablero se había desplazado)
  useEffect(() => { document.querySelector('.contenido')?.scrollTo({ top: 0 }) }, [p.id])

  const resp = miembro(p.responsableId)
  const proyectoHijo = proyecto(p.proyectoId)
  const abierta = estaAbierta(p)
  const venc = p.fechaPrevista && abierta ? relativoVencimiento(p.fechaPrevista) : null
  const prob = probabilidadDe(p)
  const suyos = adjuntos.filter(a => a.propuestaId === p.id)
  const notas = p.apuntes.filter(a => !a.estado || !a.texto.startsWith('Pasa a '))
  const diasAbierta = p.creadoEl ? Math.max(0, differenceInCalendarDays(parseISO(hoy()), parseISO(p.creadoEl.slice(0, 10)))) : null

  const convertir = async () => {
    setConvirtiendo(true)
    try { await convertirEnProyecto(p.id) } finally { setConvirtiendo(false) }
  }

  return (
    <div className="pagina prop-ficha" data-estado={p.estado}>
      <button className="btn sutil volver" onClick={onVolver}><ArrowLeft size={15} /> Propuestas</button>

      {/* cabecera */}
      <header className="tarjeta prop-ficha-cabecera">
        <div className="prop-ficha-titulo">
          <InsigniaCliente nombre={p.cliente} tam={60} />
          <div className="grow">
            <div className="antetitulo">{p.cliente}{p.contacto && <span className="prop-ficha-contacto"> · {p.contacto}</span>}</div>
            <h1>{p.titulo}</h1>
            <div className="prop-ficha-meta">
              <ChipEstado estado={p.estado} />
              <span className={`chip pequeno ${p.prioridad === 'alta' ? 'error' : 'contorno'}`}>Prioridad {ETIQUETA_PRIORIDAD_PROPUESTA[p.prioridad].toLowerCase()}</span>
              {p.cuentaId && <span className="chip pequeno acento">En el CRM</span>}
              <span className="prop-ficha-resp"><Avatar miembro={resp} tamano="pequeno" /> {resp?.nombre ?? 'Sin responsable'}</span>
            </div>
          </div>
          <div className="acciones">
            <button className="btn" onClick={() => setEditando(true)}><Pencil size={14} /> Editar</button>
            {p.estado === 'descartado'
              ? <button className="btn" onClick={() => void mover(p.id, 'apunte')}>Recuperar</button>
              : p.estado !== 'aceptado' && <button className="btn peligro" onClick={() => void mover(p.id, 'descartado')}><X size={14} /> Descartar</button>}
          </div>
        </div>

        <Recorrido propuesta={p} onMover={e => void mover(p.id, e)} />

        {p.estado === 'aceptado' && (
          proyectoHijo ? (
            <button type="button" className="prop-proyecto enlazado" onClick={() => setPantalla('proyectos')}>
              <FolderKanban size={20} />
              <span><b>Ya es un proyecto</b><small>{proyectoHijo.nombre} · se ve en Proyectos con sus apuntes y adjuntos</small></span>
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
      </header>

      {/* cifras clave */}
      <section className="prop-ficha-cifras">
        <Cifra icono={<Euro size={16} />} etiqueta="Importe estimado" valor={p.importe === null ? 'Sin importe' : formatoEuros(p.importe)} apagado={p.importe === null}
          pie={p.importe === null ? 'Ponlo al editar' : undefined} />
        <div className="tarjeta prop-cifra prop-cifra-anillo">
          <Anillo pct={prob} tamano={58} color="var(--e)" />
          <div><span className="prop-cifra-etiqueta"><TrendingUp size={14} /> Probabilidad</span><span className="prop-cifra-pie">{p.probabilidad === null && abierta ? 'La típica de su estado' : 'Fijada a mano'}</span></div>
        </div>
        <Cifra icono={<TrendingUp size={16} />} etiqueta="Previsión ponderada" valor={p.importe === null ? '—' : formatoEuros(p.importe * prob / 100)} pie="Importe × probabilidad" apagado={p.importe === null} />
        <Cifra icono={<CalendarClock size={16} />} etiqueta="Decisión prevista" valor={p.fechaPrevista ? (venc ? venc.texto : fechaLarga(p.fechaPrevista)) : 'Sin fecha'}
          pie={p.fechaPrevista ? fechaLarga(p.fechaPrevista) : undefined} tono={venc?.tono === 'vencida' ? 'mal' : undefined} apagado={!p.fechaPrevista} />
      </section>

      <div className="prop-ficha-rejilla">
        <div className="prop-ficha-principal">
          <section className="tarjeta prop-bloque">
            <h2><FileText size={17} /> Resumen</h2>
            {p.descripcion.trim() ? <Descripcion texto={p.descripcion} /> : (
              <button type="button" className="prop-vacio-bloque" onClick={() => setEditando(true)}>Añade qué necesita el cliente y qué le propondríamos</button>
            )}
          </section>

          <section className="tarjeta prop-bloque">
            <Adjuntos propuestaId={p.id} adjuntos={suyos} />
          </section>

          <section className="tarjeta prop-bloque">
            <HiloApuntes propuesta={p} />
          </section>
        </div>

        <aside className="prop-ficha-lateral">
          <section className="tarjeta prop-bloque">
            <h2>Datos</h2>
            <dl className="prop-dl">
              <Dato icono={<Building size={15} />} etiqueta="Cliente">{p.cliente}{p.cuentaId && <small>Cuenta del CRM</small>}</Dato>
              <Dato icono={<UserRound size={15} />} etiqueta="Contacto">{p.contacto || <span className="prop-tenue">Sin indicar</span>}</Dato>
              <Dato icono={<User size={15} />} etiqueta="Responsable"><span className="prop-ficha-resp"><Avatar miembro={resp} tamano="pequeno" /> {resp?.nombre ?? 'Sin asignar'}</span></Dato>
              <Dato icono={<Layers size={15} />} etiqueta="Tecnologías">
                {p.tecnologias.length ? <span className="prop-dl-chips">{p.tecnologias.map(t => <span key={t} className="chip pequeno">{t}</span>)}</span> : <span className="prop-tenue">Sin indicar</span>}
              </Dato>
              <Dato icono={<Clock size={15} />} etiqueta="Creada">{p.creadoEl ? fechaHora(p.creadoEl) : '—'}{diasAbierta !== null && abierta && <small>Hace {diasAbierta} {diasAbierta === 1 ? 'día' : 'días'}</small>}</Dato>
              {p.actualizadoEl && <Dato icono={<Clock size={15} />} etiqueta="Último cambio">{fechaHora(p.actualizadoEl)}</Dato>}
            </dl>
          </section>

          <section className="tarjeta prop-bloque prop-resumen-actividad">
            <div><MessageSquareText size={16} /><b>{notas.length}</b><span>apuntes</span></div>
            <div><Paperclip size={16} /><b>{suyos.length}</b><span>adjuntos</span></div>
            <div><Layers size={16} /><b>{p.tecnologias.length}</b><span>tecnologías</span></div>
          </section>

          <button type="button" className="btn sutil peligro prop-borrar" onClick={async () => {
            if (await confirmar('¿Borrar la propuesta?', { texto: 'Se pierden también sus apuntes y adjuntos. Si ya es un proyecto, el proyecto se queda.', aceptar: 'Borrar', peligro: true })) {
              await borrar(p.id); onVolver()
            }
          }}><Trash2 size={14} /> Borrar propuesta</button>
        </aside>
      </div>

      {editando && <ModalPropuesta inicial={p} onCerrar={() => setEditando(false)} />}
    </div>
  )
}

function Recorrido({ propuesta: p, onMover }: { propuesta: Propuesta; onMover: (e: EstadoPropuesta) => void }) {
  const paso = RECORRIDO.indexOf(p.estado)
  return (
    <section className="prop-recorrido" data-estado={p.estado} aria-label="Estado de la propuesta">
      <ol>
        {RECORRIDO.map((e, i) => {
          const hecho = p.estado !== 'descartado' && i < paso
          const actual = e === p.estado
          return (
            <li key={e} className={`${hecho ? 'hecho' : ''} ${actual ? 'actual' : ''}`} data-estado={e}>
              <button type="button" onClick={() => onMover(e)} disabled={actual} title={AYUDA_ESTADO_PROPUESTA[e]}>
                <span className="prop-paso-punto">{hecho ? <Check size={12} strokeWidth={3} /> : i + 1}</span>
                <span className="prop-paso-nombre">{ETIQUETA_ESTADO_PROPUESTA[e]}</span>
              </button>
            </li>
          )
        })}
      </ol>
      <div className="prop-recorrido-pie"><span>{AYUDA_ESTADO_PROPUESTA[p.estado]}</span></div>
    </section>
  )
}

function Cifra({ icono, etiqueta, valor, pie, tono, apagado }: { icono: ReactNode; etiqueta: string; valor: string; pie?: string; tono?: 'mal'; apagado?: boolean }) {
  return (
    <div className={`tarjeta prop-cifra ${apagado ? 'apagado' : ''}`}>
      <span className="prop-cifra-etiqueta"><i>{icono}</i>{etiqueta}</span>
      <span className={`prop-cifra-valor ${tono ?? ''}`}>{valor}</span>
      {pie && <span className="prop-cifra-pie">{pie}</span>}
    </div>
  )
}

function Dato({ icono, etiqueta, children }: { icono: ReactNode; etiqueta: string; children: ReactNode }) {
  return (
    <div className="prop-dl-fila">
      <dt>{icono}{etiqueta}</dt>
      <dd>{children}</dd>
    </div>
  )
}

/**
 * La descripción escrita a mano, ordenada en bloques: los párrafos se separan,
 * las líneas con «- » o «• » se ven como lista, y un «ETIQUETA:» al principio
 * de una línea (FALTA:, OJO:, Alcance:…) se resalta como encabezado del bloque.
 */
function Descripcion({ texto }: { texto: string }) {
  const bloques = texto.replace(/\r/g, '').split(/\n\s*\n/).map(b => b.trim()).filter(Boolean)
  return (
    <div className="prop-desc">
      {bloques.map((b, i) => {
        const lineas = b.split('\n').map(l => l.trim()).filter(Boolean)
        const lista = lineas.length > 1 && lineas.slice(1).every(l => /^[-•*]\s/.test(l)) ? lineas.slice(1) : lineas.every(l => /^[-•*]\s/.test(l)) ? lineas : null
        const cabeza = lista && lista !== lineas ? lineas[0] : null
        if (lista) {
          return (
            <div key={i} className="prop-desc-bloque">
              {cabeza && <p><Etiquetado linea={cabeza} /></p>}
              <ul>{lista.map((l, j) => <li key={j}><Etiquetado linea={l.replace(/^[-•*]\s+/, '')} /></li>)}</ul>
            </div>
          )
        }
        return <p key={i} className="prop-desc-bloque">{lineas.map((l, j) => <span key={j}>{j > 0 && <br />}<Etiquetado linea={l} /></span>)}</p>
      })}
    </div>
  )
}

function Etiquetado({ linea }: { linea: string }) {
  // «Alcance:» solo en su línea es el título de lo que viene debajo
  if (/^[^:]{1,40}:$/.test(linea)) return <b className="prop-desc-etiqueta">{linea.slice(0, -1)}</b>
  const m = linea.match(/^([A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ ]{1,28}):\s+(.*)$/)
  if (!m) return <>{linea}</>
  const aviso = /^(FALTA|OJO|PENDIENTE|IMPORTANTE)$/i.test(m[1])
  return <><b className={aviso ? 'prop-desc-aviso' : 'prop-desc-etiqueta'}>{m[1]}</b> {m[2]}</>
}

function HiloApuntes({ propuesta: p }: { propuesta: Propuesta }) {
  const { miembro } = useApp()
  const { anadirApunte, borrarApunte } = usePropuestas()
  const [texto, setTexto] = useState('')
  const apuntes = [...p.apuntes].sort((a, b) => b.fecha.localeCompare(a.fecha))

  const apuntar = async () => {
    if (!texto.trim()) return
    const t = texto
    setTexto('')
    try { await anadirApunte(p.id, t) } catch { setTexto(t) }
  }

  return (
    <div className="prop-apuntes">
      <h3><MessageSquareText size={16} /> Apuntes <small>{p.apuntes.length || ''}</small></h3>
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
    </div>
  )
}
