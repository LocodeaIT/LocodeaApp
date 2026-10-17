/**
 * Piezas del recorrido del cliente potencial: sus reuniones (las de
 * Proyectos y Tareas, enlazadas al cliente potencial y sincronizadas con
 * Outlook), sus propuestas (ofertas enlazadas), los diálogos de programar una
 * reunión, registrar su resumen, descartar y arrancar el proyecto, y la
 * tarjeta del tablero.
 */
import { useEffect, useState } from 'react'
import { CalendarPlus, ExternalLink, FilePlus2, NotebookPen, Rocket } from 'lucide-react'
import { useApp } from '../../store'
import { Campo, Modal } from '../../ui/basicos'
import { Select } from '../../ui/Select'
import type { Reunion, TipoReunion } from '../../domain/types'
import { ETIQUETA_ESTADO_REUNION, ETIQUETA_TIPO_REUNION } from '../../domain/types'
import { hoy, sumarDias } from '../../domain/fechas'
import { useCrm } from '../contexto'
import type { MotivoDescarte, Potencial } from '../types'
import { ESTADO_OFERTA, ETAPA, MOTIVO_DESCARTE, SEGUIMIENTO, opcionesDe } from '../catalogos'
import {
  ESTADO_PROPUESTA_DE_ETAPA, accionVencida, citasDe, citasSinReunion, diasEnEtapa, propuestasComercialesDe, propuestasDe, reunionesDe,
} from '../recorrido'
import { usePropuestas } from '../../propuestas/store'
import { ESTADOS_ABIERTOS, ETIQUETA_ESTADO_PROPUESTA, propuestaVacia } from '../../propuestas/types'
import { totalDoc } from '../documentos'
import { eur, eur0, fecha } from '../formato'
import { nombreCompleto } from '../consultas'
import { ChipEstado, Fecha } from '../ui'

// ─────────────────────────────────────────────── utilidades

/** '2026-10-20T10:00' para los input datetime-local, en hora local. */
function paraInput(iso: string): string {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

const fechaHoraLegible = (iso: string) =>
  new Date(iso).toLocaleString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

/** Mañana a las 10:00, hora local. */
function mananaALasDiez(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  d.setHours(10, 0, 0, 0)
  return d.toISOString()
}

// ─────────────────────────────────────────────── reuniones

export function ReunionesPotencial({ p }: { p: Potencial }) {
  const { datos } = useApp()
  const c = useCrm()
  const [nueva, setNueva] = useState<TipoReunion | null>(null)
  const [resumen, setResumen] = useState<Reunion | null>(null)
  const lista = reunionesDe(datos.reuniones, p.id)
  // las que trae el calendario de reuniones de Outlook y no son ya una de estas
  const citas = citasSinReunion(citasDe(c.datos.actividades, p.id), lista).sort((a, b) => `${b.fecha}${b.hora}`.localeCompare(`${a.fecha}${a.hora}`))
  return (
    <div className="crm-sublista">
      {lista.map(r => (
        <div key={r.id} className="crm-sublista-fila">
          <div>
            <b>{r.titulo}</b>
            <small>
              {fechaHoraLegible(r.fecha)} · {r.duracionMin} min · {ETIQUETA_TIPO_REUNION[r.tipo ?? ''] ?? 'Sin tipo'}
            </small>
            {r.resumen ? <p>{r.resumen}</p> : r.estado === 'celebrada' && <small className="crm-tarde">Sin resumen</small>}
          </div>
          <div className="crm-sublista-acciones">
            <ChipEstado estado={r.estado === 'celebrada' ? 'completada' : r.estado === 'cancelada' ? 'cancelada' : 'abierta'} etiqueta={ETIQUETA_ESTADO_REUNION[r.estado]} />
            {r.enlaceTeams && <a className="btn sutil pequeno" href={r.enlaceTeams} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Teams</a>}
            {r.grabacion && <a className="btn sutil pequeno" href={r.grabacion} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Grabación</a>}
            {r.estado !== 'cancelada' && <button type="button" className="btn sutil pequeno" onClick={() => setResumen(r)}><NotebookPen size={14} /> Resumen</button>}
          </div>
        </div>
      ))}
      {citas.map(a => (
        <div key={a.id} className="crm-sublista-fila">
          <div>
            <button type="button" className="crm-enlace" onClick={() => c.abrir('actividades', a.id)}>{a.asunto}</button>
            <small>{fecha(a.fecha)}{a.hora && ` · ${a.hora}`} · del calendario de Outlook</small>
          </div>
          <div className="crm-sublista-acciones">
            <ChipEstado estado={a.estado} etiqueta={a.fecha && a.fecha < hoy() ? 'Celebrada' : 'Pendiente'} />
          </div>
        </div>
      ))}
      {!lista.length && !citas.length && <div className="crm-vacio">Todavía no hay reuniones con este cliente potencial.</div>}
      {p.estado === 'abierto' && (
        <div className="crm-sublista-pie">
          <button type="button" className="btn pequeno" onClick={() => setNueva(p.etapa === 'entrada' ? 'auditoria' : p.etapa === 'propuesta' ? 'propuesta' : 'seguimiento')}>
            <CalendarPlus size={14} /> Nueva reunión
          </button>
        </div>
      )}
      {nueva !== null && <ModalReunionCrm p={p} tipo={nueva} onCerrar={() => setNueva(null)} />}
      {resumen && <ModalResumenReunion r={resumen} p={p} onCerrar={() => setResumen(null)} />}
    </div>
  )
}

/** Programar una reunión con el cliente potencial: se guarda en Reuniones y va al calendario de Outlook con el cliente invitado. */
export function ModalReunionCrm({ p, tipo: tipoInicial, onCerrar }: { p: Potencial; tipo: TipoReunion; onCerrar: () => void }) {
  const { guardarReunion, reunionBase, yo, avisar } = useApp()
  const c = useCrm()
  const empresa = p.empresa || nombreCompleto(p)
  const tituloDe = (t: TipoReunion) => `${ETIQUETA_TIPO_REUNION[t] || 'Reunión'} · ${empresa}`
  const [tipo, setTipo] = useState<TipoReunion>(tipoInicial)
  const [titulo, setTitulo] = useState(tituloDe(tipoInicial))
  const [fechaLocal, setFechaLocal] = useState(paraInput(mananaALasDiez()))
  const [duracion, setDuracion] = useState(tipoInicial === 'auditoria' ? 60 : 30)
  const [externos, setExternos] = useState(p.email)
  const [enlaceTeams, setEnlaceTeams] = useState('')
  const [guardando, setGuardando] = useState(false)

  const guardar = async () => {
    if (!titulo.trim() || !fechaLocal) { avisar('Pon el título y la fecha de la reunión.', 'error'); return }
    setGuardando(true)
    const equipo = [...new Set([p.propietarioId, yo?.id].filter((x): x is string => !!x))]
    // la invitación al calendario de Outlook puede tardar: no se espera a ella para seguir
    void guardarReunion(reunionBase({
      titulo: titulo.trim(), fecha: new Date(fechaLocal).toISOString(), duracionMin: duracion, asistentesIds: equipo,
      lugar: enlaceTeams ? 'Microsoft Teams' : '', potencialId: p.id, cuentaId: p.cuentaId, tipo, asistentesExternos: externos.trim(),
      enlaceTeams: enlaceTeams.trim(), notas: p.procesosRevisar ? `Procesos que nos ha contado:\n${p.procesosRevisar}` : '',
    })).catch(() => undefined)
    onCerrar()
    // programar la auditoría saca al cliente potencial de la entrada
    if (tipo === 'auditoria' && p.etapa === 'entrada') await c.cambiarEtapa(p, 'auditoria')
  }

  return (
    <Modal titulo="Nueva reunión con el cliente" onCerrar={onCerrar} pie={<>
      <button className="btn" onClick={onCerrar}>Cancelar</button>
      <button className="btn primario" disabled={guardando} onClick={() => void guardar()}><CalendarPlus size={15} /> Guardar y enviar invitación</button>
    </>}>
      <div className="formulario">
        <Campo label="Tipo">
          <Select valor={tipo} opciones={opcionesDe(ETIQUETA_TIPO_REUNION).filter(o => o.valor !== '' && o.valor !== 'interna')}
            onCambio={v => { const t = v as TipoReunion; if (titulo === tituloDe(tipo)) setTitulo(tituloDe(t)); setTipo(t) }} />
        </Campo>
        <Campo label="Título"><input value={titulo} onChange={e => setTitulo(e.target.value)} /></Campo>
        <div className="fila-campos dos">
          <Campo label="Fecha y hora"><input type="datetime-local" value={fechaLocal} onChange={e => setFechaLocal(e.target.value)} /></Campo>
          <Campo label="Duración (min)"><input type="number" min={15} step={15} value={duracion} onChange={e => setDuracion(Number(e.target.value) || 30)} /></Campo>
        </div>
        <Campo label="Asistentes del cliente (correos separados por ;)"><input value={externos} onChange={e => setExternos(e.target.value)} placeholder="nombre@empresa.com" /></Campo>
        <Campo label="Enlace de Teams"><input value={enlaceTeams} onChange={e => setEnlaceTeams(e.target.value)} placeholder="https://teams.microsoft.com/l/meetup-join/…" /></Campo>
      </div>
    </Modal>
  )
}

/** Tras la reunión: resumen y acuerdos, la grabación y, si fue la auditoría, los procesos que hay que revisar. */
function ModalResumenReunion({ r, p, onCerrar }: { r: Reunion; p: Potencial; onCerrar: () => void }) {
  const { guardarReunion } = useApp()
  const c = useCrm()
  const [resumen, setResumen] = useState(r.resumen ?? '')
  const [grabacion, setGrabacion] = useState(r.grabacion ?? '')
  const [procesos, setProcesos] = useState(p.procesosRevisar)
  const esAuditoria = r.tipo === 'auditoria'
  const guardar = async () => {
    // como al programarla: el calendario de Outlook se actualiza sin bloquear el diálogo
    void guardarReunion({ ...r, resumen: resumen.trim(), grabacion: grabacion.trim(), estado: 'celebrada' }).catch(() => undefined)
    onCerrar()
    if (esAuditoria && procesos.trim() !== p.procesosRevisar) await c.guardar('potenciales', { ...p, procesosRevisar: procesos.trim() })
  }
  return (
    <Modal titulo={`Resumen · ${r.titulo}`} ancho onCerrar={onCerrar} pie={<>
      <button className="btn" onClick={onCerrar}>Cancelar</button>
      <button className="btn primario" onClick={() => void guardar()}>Guardar y marcar como celebrada</button>
    </>}>
      <div className="formulario">
        <Campo label="Resumen y acuerdos"><textarea rows={5} autoFocus value={resumen} onChange={e => setResumen(e.target.value)} placeholder="Qué se habló y qué se acordó" /></Campo>
        {esAuditoria && <Campo label="Procesos a revisar (uno por línea)"><textarea rows={4} value={procesos} onChange={e => setProcesos(e.target.value)} /></Campo>}
        <Campo label="Grabación o transcripción de Teams"><input value={grabacion} onChange={e => setGrabacion(e.target.value)} placeholder="https://…" /></Campo>
      </div>
    </Modal>
  )
}

// ─────────────────────────────────────────────── propuestas

/**
 * Las dos caras de la propuesta, cada una en su sitio: la ficha comercial de
 * «Propuestas de clientes» (tablero, apuntes, adjuntos y paso a proyecto) y la
 * oferta con importe y líneas del CRM, que es la que acaba en pedido y factura.
 */
export function PropuestasPotencial({ p }: { p: Potencial }) {
  return (
    <div className="crm-sublista">
      <PropuestasComerciales p={p} />
      <OfertasPotencial p={p} />
    </div>
  )
}

/** Propuestas del módulo Propuestas de clientes que son de este cliente potencial. */
function PropuestasComerciales({ p }: { p: Potencial }) {
  const { setPantalla, avisar } = useApp()
  const pr = usePropuestas()
  // se cargan al abrir su pantalla; desde aquí también, si aún no están
  const { cargado, cargando, cargar } = pr
  useEffect(() => { if (!cargado && !cargando) void cargar() }, [cargado, cargando, cargar])
  const lista = propuestasComercialesDe(pr.propuestas, p)
  const crear = async () => {
    if (!p.empresa.trim()) { avisar('Pon el nombre de la empresa del cliente potencial para enlazar su propuesta.', 'error'); return }
    await pr.crear(propuestaVacia({
      titulo: p.tema, cliente: p.empresa.trim(), cuentaId: p.cuentaId, contacto: nombreCompleto(p), estado: ESTADO_PROPUESTA_DE_ETAPA[p.etapa],
      descripcion: [p.procesosRevisar, p.descripcion].filter(Boolean).join('\n\n'), importe: p.importeEst || null, responsableId: p.propietarioId,
    }))
  }
  return (
    <>
      <p className="crm-sublista-titulo">En Propuestas de clientes</p>
      {lista.map(x => (
        <div key={x.id} className="crm-sublista-fila">
          <div>
            <b>{x.titulo}</b>
            <small>{x.importe ? eur0(x.importe) : 'Sin importe'}{x.probabilidad != null && ` · ${x.probabilidad} %`}{x.fechaPrevista && ` · decisión el ${fecha(x.fechaPrevista)}`}</small>
          </div>
          <div className="crm-sublista-acciones">
            <ChipEstado estado={x.estado === 'aceptado' ? 'aceptada' : x.estado === 'descartado' ? 'rechazada' : 'enviada'} etiqueta={ETIQUETA_ESTADO_PROPUESTA[x.estado]} />
          </div>
        </div>
      ))}
      {!lista.length && <div className="crm-vacio">{pr.cargado ? 'No hay ninguna con el nombre de esta empresa.' : 'Cargando…'}</div>}
      <div className="crm-sublista-pie">
        {p.estado === 'abierto' && !lista.length && <button type="button" className="btn pequeno" onClick={() => void crear()}><FilePlus2 size={14} /> Crear en Propuestas de clientes</button>}
        <button type="button" className="btn sutil pequeno" onClick={() => setPantalla('propuestas')}><ExternalLink size={14} /> Ir a Propuestas de clientes</button>
      </div>
    </>
  )
}

/** Ofertas del CRM enlazadas al cliente potencial: importe, líneas, versión y documento. */
function OfertasPotencial({ p }: { p: Potencial }) {
  const c = useCrm()
  const lista = propuestasDe(c.datos.ofertas, p.id)
  return (
    <>
      <p className="crm-sublista-titulo">Ofertas con importe</p>
      {lista.map(q => (
        <div key={q.id} className="crm-sublista-fila">
          <div>
            <button type="button" className="crm-enlace" onClick={() => c.abrir('ofertas', q.id)}>{q.no || 'Borrador'} · versión {q.version}</button>
            <small>
              {q.enviadaEl ? `Enviada el ${fecha(q.enviadaEl)}` : `Creada el ${fecha(q.fecha)}`} · {eur(totalDoc(q))}
              {q.documento && <> · <a href={q.documento} target="_blank" rel="noreferrer">documento</a></>}
            </small>
            {q.alcance && <p>{q.alcance}</p>}
            {q.estado === 'rechazada' && q.motivoRechazo && <small className="crm-tarde">Rechazada: {q.motivoRechazo}</small>}
          </div>
          <div className="crm-sublista-acciones">
            <ChipEstado estado={q.estado} etiqueta={ESTADO_OFERTA[q.estado]} />
          </div>
        </div>
      ))}
      {!lista.length && <div className="crm-vacio">Todavía no hay ninguna oferta.</div>}
      {p.estado === 'abierto' && (
        <div className="crm-sublista-pie">
          <button type="button" className="btn pequeno" onClick={() => void c.nuevaPropuesta(p)}>
            <FilePlus2 size={14} /> {lista.length ? 'Nueva versión de la oferta' : 'Nueva oferta'}
          </button>
        </div>
      )}
    </>
  )
}

// ─────────────────────────────────────────────── descartar y arrancar

export function ModalDescartar({ p, onCerrar }: { p: Potencial; onCerrar: () => void }) {
  const c = useCrm()
  const [motivo, setMotivo] = useState<MotivoDescarte>(p.seguimiento === 'sinrespuesta' ? 'sinrespuesta' : 'noencaja')
  const [detalle, setDetalle] = useState('')
  const [volver, setVolver] = useState('')
  return (
    <Modal titulo="Descartar cliente potencial" onCerrar={onCerrar} pie={<>
      <button className="btn" onClick={onCerrar}>Cancelar</button>
      <button className="btn peligro" onClick={() => { onCerrar(); void c.descartarPotencial(p, motivo, detalle.trim(), volver) }}>Descartar</button>
    </>}>
      <div className="formulario">
        <p className="crm-texto-modal">{p.tema}{p.empresa ? ` · ${p.empresa}` : ''}</p>
        <Campo label="Motivo">
          <Select valor={motivo} opciones={opcionesDe(MOTIVO_DESCARTE).filter(o => o.valor !== '')}
            onCambio={v => { setMotivo(v as MotivoDescarte); if (v === 'ahorano' && !volver) setVolver(sumarDias(hoy(), 90)) }} />
        </Campo>
        <Campo label="Detalle"><input value={detalle} onChange={e => setDetalle(e.target.value)} placeholder="Opcional" /></Campo>
        <Campo label="Volver a contactar el"><input type="date" value={volver} onChange={e => setVolver(e.target.value)} /></Campo>
      </div>
    </Modal>
  )
}

/** Confirmación de arrancar el proyecto: dice qué se va a crear y avisa si no hay propuesta aceptada. */
export function ModalArrancar({ p, onCerrar }: { p: Potencial; onCerrar: () => void }) {
  const c = useCrm()
  const { datos } = useApp()
  const pr = usePropuestas()
  const aceptada = propuestasDe(c.datos.ofertas, p.id).find(q => q.estado === 'aceptada' || q.estado === 'convertida')
  const cuentaExiste = !!p.cuentaId || c.datos.cuentas.some(a => a.nombre.trim().toLowerCase() === p.empresa.trim().toLowerCase())
  const comerciales = propuestasComercialesDe(pr.propuestas, p)
  // si su propuesta en Propuestas de clientes ya creó el proyecto, se usa ese
  const yaConProyecto = comerciales.find(x => x.proyectoId && datos.proyectos.some(y => y.id === x.proyectoId))
  const abierta = comerciales.find(x => ESTADOS_ABIERTOS.includes(x.estado) && !x.proyectoId)
  const arrancar = async () => {
    onCerrar()
    const proyectoId = await c.arrancarProyecto(p, yaConProyecto?.proyectoId ?? null)
    // la propuesta abierta del cliente queda aceptada y enlazada al mismo proyecto
    if (abierta && proyectoId) {
      await pr.guardar({ ...abierta, estado: 'aceptado', probabilidad: 100, proyectoId })
      await pr.anadirApunte(abierta.id, `Proyecto arrancado desde el cliente potencial ${p.no}.`)
    }
  }
  return (
    <Modal titulo="Arrancar proyecto" onCerrar={onCerrar} pie={<>
      <button className="btn" onClick={onCerrar}>Cancelar</button>
      <button className="btn primario" autoFocus onClick={() => void arrancar()}><Rocket size={15} /> Arrancar proyecto</button>
    </>}>
      <div className="formulario">
        {!aceptada && <p className="crm-texto-modal crm-tarde">No hay ninguna oferta aceptada. Puedes arrancar igualmente.</p>}
        <p className="crm-texto-modal">Al arrancar el proyecto:</p>
        <ul className="crm-texto-modal">
          <li>{p.empresa ? (cuentaExiste ? `Se usa la cuenta «${p.empresa}», que ya existe.` : `Se crea la cuenta «${p.empresa}».`) : 'No se crea cuenta: falta el nombre de la empresa.'}</li>
          {(p.nombre || p.apellidos) && <li>Se crea el contacto {nombreCompleto(p)}.</li>}
          <li>Las propuestas, actividades y notas se enlazan también a la cuenta.</li>
          {yaConProyecto
            ? <li>Se usa el proyecto que ya creó la propuesta «{yaConProyecto.titulo}» en Propuestas de clientes.</li>
            : <li>Se crea el proyecto «{p.tema}» en Proyectos y Tareas{aceptada ? `, con la oferta ${aceptada.no} como referencia` : ''}.</li>}
          {abierta && <li>La propuesta «{abierta.titulo}» de Propuestas de clientes pasa a Aceptado y se enlaza al proyecto.</li>}
        </ul>
      </div>
    </Modal>
  )
}

// ─────────────────────────────────────────────── tablero

export function TarjetaPotencial({ p }: { p: Potencial }) {
  const c = useCrm()
  const vencida = accionVencida(p, hoy())
  return (
    <>
      <b>{p.empresa || p.tema}</b>
      <small>{p.empresa ? p.tema : nombreCompleto(p)}</small>
      {p.seguimiento && p.etapa === 'entrada' && <span><ChipEstado estado={p.seguimiento} etiqueta={SEGUIMIENTO[p.seguimiento]} /></span>}
      {p.proximaAccion && (
        <small className={vencida ? 'crm-tarde' : undefined}>
          {p.proximaAccion}{p.proximaAccionFecha && <> · <Fecha dia={p.proximaAccionFecha} /></>}
        </small>
      )}
      <span className="crm-tarjeta-pie">
        <span>{p.importeEst ? eur0(p.importeEst) : ''}</span>
        <span>{diasEnEtapa(p, hoy())} d en {ETAPA[p.etapa].toLowerCase()} · {c.nombreMiembro(p.propietarioId).split(' ')[0] || '—'}</span>
      </span>
    </>
  )
}
