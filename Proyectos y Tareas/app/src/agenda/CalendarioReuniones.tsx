/**
 * Calendario de reuniones del equipo: lo que hay en los calendarios de Outlook
 * de cada persona, en una sola vista. Se filtra por persona y por «con
 * clientes», y cada reunión con un cliente lleva a su ficha del CRM, donde
 * queda como cita.
 */
import { useMemo, useState } from 'react'
import {
  AlertCircle, Building2, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock, ExternalLink, HelpCircle, MapPin,
  RefreshCw, UserPlus, Users,
} from 'lucide-react'
import { addDays, endOfMonth, format, getISOWeek, isSameMonth, parseISO, startOfMonth } from 'date-fns'
import { es } from 'date-fns/locale'
import { useApp } from '../store'
import { useCrm } from '../crm/contexto'
import { nombreRegistro, registroDe } from '../crm/consultas'
import { NOMBRE_REGISTRO, ESTADO_ACTIVIDAD } from '../crm/catalogos'
import { Avatar, Modal, Panel, Segmentado, Vacio } from '../ui/basicos'
import { aIso, hoy, lunesDe, sumarDias } from '../domain/fechas'
import type { Miembro } from '../domain/types'
import { useAgenda } from './contexto'
import type { EventoAgenda } from './tipos'
import { conClientes, dominio, DOMINIOS_GENERICOS, externos, vincular } from './vincular'
import './agenda.css'

type Escala = 'mes' | 'semana' | 'lista'
type Alcance = 'clientes' | 'todas'

const p2 = (n: number) => String(n).padStart(2, '0')
const diaDe = (iso: string) => { const d = new Date(iso); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}` }
const horaDe = (iso: string) => { const d = new Date(iso); return `${p2(d.getHours())}:${p2(d.getMinutes())}` }

function haceCuanto(iso: string | null): string {
  if (!iso) return ''
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  return min < 1 ? 'ahora mismo' : min < 60 ? `hace ${min} min` : `a las ${horaDe(iso)}`
}

export default function CalendarioReuniones() {
  const { datos: app } = useApp()
  const { datos: crm } = useCrm()
  const agenda = useAgenda()
  const [escala, setEscala] = useState<Escala>('mes')
  const [alcance, setAlcance] = useState<Alcance>('clientes')
  const [personas, setPersonas] = useState<string[]>([])
  const [ancla, setAncla] = useState(() => hoy())
  const [abierto, setAbierto] = useState<EventoAgenda | null>(null)
  const [ayuda, setAyuda] = useState(false)

  const miembro = (id: string | null | undefined) => app.miembros.find(m => m.id === id)
  const conCalendario = agenda.calendarios.map(c => miembro(c.cal.miembroId)).filter((m): m is Miembro => !!m)

  const visibles = useMemo(() => agenda.eventos.filter(e =>
    (alcance === 'todas' ? !e.cancelado : conClientes(e)) &&
    (!personas.length || e.miembrosIds.some(id => personas.includes(id))),
  ), [agenda.eventos, alcance, personas])

  const porDia = useMemo(() => {
    const m = new Map<string, EventoAgenda[]>()
    for (const e of visibles) { const d = diaDe(e.inicio); m.set(d, [...(m.get(d) ?? []), e]) }
    return m
  }, [visibles])

  const dias = useMemo(() => {
    if (escala === 'semana') { const l = lunesDe(ancla); return Array.from({ length: 7 }, (_, i) => sumarDias(l, i)) }
    const ini = lunesDe(aIso(startOfMonth(parseISO(ancla))))
    const fin = aIso(endOfMonth(parseISO(ancla)))
    const lista: string[] = []
    for (let d = ini; lista.length < 42 && (d <= fin || lista.length % 7 !== 0); d = sumarDias(d, 1)) lista.push(d)
    return lista
  }, [ancla, escala])

  const mover = (n: number) => setAncla(a => escala === 'semana' ? sumarDias(a, 7 * n) : aIso(addDays(startOfMonth(parseISO(a)), 32 * n)))
  const titulo = escala === 'semana'
    ? `Semana ${getISOWeek(parseISO(lunesDe(ancla)))} · ${format(parseISO(lunesDe(ancla)), 'd MMM', { locale: es })} – ${format(parseISO(sumarDias(lunesDe(ancla), 6)), 'd MMM yyyy', { locale: es })}`
    : format(parseISO(ancla), 'MMMM yyyy', { locale: es })
  const fueraDeVentana = escala !== 'lista' && (dias[dias.length - 1] < diaDe(agenda.desde) || dias[0] > diaDe(agenda.hasta))

  const proximas = visibles.filter(e => e.fin >= new Date().toISOString())
  const conCliente = agenda.eventos.filter(conClientes)
  const semanaActual = conCliente.filter(e => lunesDe(diaDe(e.inicio)) === lunesDe(hoy())).length
  const alternar = (id: string) => setPersonas(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])
  const sincronizando = agenda.estado === 'sincronizando'

  return (
    <div className="pagina agenda">
      <div className="titulo-pagina">
        <div>
          <h1>Calendario de reuniones.</h1>
          <div className="sub">Las reuniones de cada uno, sacadas de su calendario de Outlook de Locodea. Las de clientes quedan además en su ficha del CRM.</div>
        </div>
        <div className="acciones">
          <span className="agenda-ultima">{sincronizando ? 'Sincronizando…' : agenda.ultima ? `Sincronizado ${haceCuanto(agenda.ultima)}` : ''}</span>
          <button className="btn" onClick={() => void agenda.sincronizar(true)} disabled={sincronizando}>
            <RefreshCw size={15} className={sincronizando ? 'girando' : undefined} /> Sincronizar
          </button>
        </div>
      </div>

      <EstadoCalendarios conCalendario={conCalendario} onAyuda={() => setAyuda(true)} />

      <div className="agenda-cifras">
        <div><b className="num">{semanaActual}</b><span>con clientes esta semana</span></div>
        <div><b className="num">{conCliente.filter(e => e.fin >= new Date().toISOString()).length}</b><span>próximas con clientes</span></div>
        <div><b className="num">{conCliente.filter(e => !vincular(e, crm)).length}</b><span>con gente que no está en el CRM</span></div>
      </div>

      <div className="agenda-barra">
        <div className="agenda-personas" role="group" aria-label="Personas">
          <button className={`chip ${!personas.length ? 'activo' : ''}`} onClick={() => setPersonas([])}><Users size={13} /> Todo el equipo</button>
          {conCalendario.map(m => (
            <button key={m.id} className={`chip ${personas.includes(m.id) ? 'activo' : ''}`} onClick={() => alternar(m.id)} aria-pressed={personas.includes(m.id)}>
              <i className="agenda-punto" style={{ background: m.color }} />{m.nombre.split(' ')[0]}
            </button>
          ))}
        </div>
        <Segmentado etiqueta="Qué reuniones" valor={alcance} onCambio={setAlcance}
          opciones={[{ valor: 'clientes', etiqueta: 'Con clientes' }, { valor: 'todas', etiqueta: 'Todas' }]} />
        <Segmentado etiqueta="Vista" valor={escala} onCambio={setEscala}
          opciones={[{ valor: 'mes', etiqueta: 'Mes' }, { valor: 'semana', etiqueta: 'Semana' }, { valor: 'lista', etiqueta: 'Próximas' }]} />
      </div>

      {escala === 'lista' ? (
        <ListaProximas eventos={proximas} onAbrir={setAbierto} cargando={sincronizando && !agenda.eventos.length} />
      ) : (
        <div className="calendario">
          <div className="calendario-cabecera">
            <div className="semana-nav">
              <button className="btn sutil icono pequeno" onClick={() => mover(-1)} aria-label="Anterior"><ChevronLeft size={16} /></button>
              <span className="nombre" style={{ textTransform: 'capitalize', minWidth: 220 }}>{titulo}</span>
              <button className="btn sutil icono pequeno" onClick={() => mover(1)} aria-label="Siguiente"><ChevronRight size={16} /></button>
            </div>
            <button className="btn pequeno" onClick={() => setAncla(hoy())}>Hoy</button>
            {fueraDeVentana && <span className="chip pequeno contorno" style={{ marginLeft: 'auto' }}>Fuera de lo sincronizado (dos meses atrás, seis adelante)</span>}
          </div>
          <div className={`calendario-rejilla ${escala === 'semana' ? 'semana' : ''}`}>
            {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => <div key={d} className="dia-nombre">{d}</div>)}
            {dias.map(d => {
              const finde = [0, 6].includes(parseISO(d).getDay())
              const fuera = escala === 'mes' && !isSameMonth(parseISO(d), parseISO(ancla))
              return (
                <div key={d} className={`dia ${fuera ? 'fuera' : ''} ${d === hoy() ? 'hoy' : ''} ${finde ? 'finde' : ''}`}>
                  <div className="dia-numero"><span>{parseISO(d).getDate()}</span></div>
                  <div className="dia-eventos">
                    {(porDia.get(d) ?? []).map(e => <ChipEvento key={e.id} e={e} onAbrir={() => setAbierto(e)} detalle={escala === 'semana'} />)}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {abierto && <DetalleEvento e={abierto} onCerrar={() => setAbierto(null)} />}
      {ayuda && <AyudaCompartir onCerrar={() => setAyuda(false)} />}
    </div>
  )
}

// ─────────────────────────────────────────────── estado de los calendarios

function EstadoCalendarios({ conCalendario, onAyuda }: { conCalendario: Miembro[]; onAyuda: () => void }) {
  const { datos: app } = useApp()
  const agenda = useAgenda()
  const sin = agenda.sinCompartir.map(id => app.miembros.find(m => m.id === id)).filter((m): m is Miembro => !!m)
  const fallidos = agenda.calendarios.filter(c => !c.ok)
  if (agenda.estado === 'esperando' || (agenda.estado === 'sincronizando' && !agenda.calendarios.length)) {
    return <div className="agenda-estado"><RefreshCw size={15} className="girando" /> Leyendo los calendarios de Outlook…</div>
  }
  if (agenda.estado === 'error' && !agenda.calendarios.length) {
    return (
      <div className="agenda-estado error">
        <AlertCircle size={15} /> <span>No se pudieron leer los calendarios de Outlook. {agenda.error}</span>
        <button className="btn sutil pequeno" onClick={onAyuda}><HelpCircle size={14} /> Cómo se conecta</button>
      </div>
    )
  }
  return (
    <div className={`agenda-estado ${sin.length || fallidos.length ? 'aviso' : ''}`}>
      {conCalendario.length > 0 && <span><CheckCircle2 size={15} className="ok" /> Calendarios de {lista(conCalendario.map(m => m.nombre.split(' ')[0]))}</span>}
      {fallidos.map(c => <span key={c.cal.id}><AlertCircle size={15} className="mal" /> {app.miembros.find(m => m.id === c.cal.miembroId)?.nombre ?? c.cal.nombre}: {c.error}</span>)}
      {sin.length > 0 && <span><AlertCircle size={15} className="mal" /> {lista(sin.map(m => m.nombre))} {sin.length === 1 ? 'no ha compartido su calendario' : 'no han compartido su calendario'}</span>}
      {!conCalendario.length && !sin.length && <span>Nadie del equipo ha compartido todavía su calendario.</span>}
      <button className="btn sutil pequeno" onClick={onAyuda}><HelpCircle size={14} /> Cómo compartirlo</button>
    </div>
  )
}

const lista = (xs: string[]) => xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`

function AyudaCompartir({ onCerrar }: { onCerrar: () => void }) {
  return (
    <Modal titulo="Compartir el calendario con la app" onCerrar={onCerrar}>
      <div className="agenda-ayuda">
        <p>La app entra con la cuenta <b>admin@locodea.com</b> y solo ve los calendarios que le han compartido. Cada persona lo hace una vez, desde su Outlook:</p>
        <ol>
          <li>En Outlook (web o escritorio), en <b>Calendario</b>, botón derecho sobre «Calendario» → <b>Compartir</b> (o «Permisos de uso compartido»).</li>
          <li>Añade <b>admin@locodea.com</b> con el permiso <b>Puede ver todos los detalles</b> y pulsa Compartir.</li>
          <li>En el buzón de admin@locodea.com llega una invitación: ábrela y pulsa <b>Aceptar</b> (o «Agregar este calendario»).</li>
          <li>Vuelve aquí y pulsa <b>Sincronizar</b>: el calendario aparece con el nombre de su dueño.</li>
        </ol>
        <p className="sub">Solo cuentan los calendarios de cuentas <b>@locodea.com</b>. Si alguien comparte el de otra empresa (Ortoalresa, por ejemplo), la app no lo lee.</p>
        <p className="sub">Las citas privadas siguen siendo privadas: Outlook no da sus detalles. Se lee desde dos meses atrás hasta seis meses adelante, al abrir la app y cada cuarto de hora.</p>
        <p className="sub">Una reunión cuenta como «con clientes» cuando algún asistente tiene un correo de fuera de locodea.com. Se casa con el CRM por el correo exacto del contacto, del cliente potencial o de la cuenta, y si no, por el dominio de su empresa.</p>
      </div>
    </Modal>
  )
}

// ─────────────────────────────────────────────── eventos

function colorDe(e: EventoAgenda, miembros: Miembro[]): string {
  const org = miembros.find(m => m.email.toLowerCase() === e.organizador)
  return (org ?? miembros.find(m => m.id === e.miembrosIds[0]))?.color ?? 'var(--acento)'
}

function ChipEvento({ e, onAbrir, detalle }: { e: EventoAgenda; onAbrir: () => void; detalle?: boolean }) {
  const { datos: app } = useApp()
  const { datos: crm } = useCrm()
  const v = conClientes(e) ? vincular(e, crm) : null
  const reg = v ? registroDe(crm, v.col, v.id) : undefined
  return (
    <button type="button" className={`evento agenda-evento ${e.cancelado ? 'cancelado' : ''}`} style={{ ['--col' as string]: colorDe(e, app.miembros) }} onClick={onAbrir}
      title={`${e.todoElDia ? 'Todo el día' : horaDe(e.inicio)} · ${e.titulo}`}>
      {!e.todoElDia && <span className="hora num">{horaDe(e.inicio)}</span>}
      <span className="texto">
        {e.titulo}
        {detalle && reg && v && <span className="cliente">{nombreRegistro(crm, v.col, reg)}</span>}
      </span>
      {conClientes(e) && !reg && <span className="sin-crm" title="Gente de fuera que no está en el CRM">?</span>}
    </button>
  )
}

function ListaProximas({ eventos, onAbrir, cargando }: { eventos: EventoAgenda[]; onAbrir: (e: EventoAgenda) => void; cargando: boolean }) {
  const { datos: app } = useApp()
  const { datos: crm } = useCrm()
  if (!eventos.length) return <Vacio icono={<CalendarDays size={32} />} titulo={cargando ? 'Leyendo los calendarios…' : 'No hay reuniones próximas'} texto={cargando ? undefined : 'Con los filtros de arriba no queda ninguna en los próximos seis meses.'} />
  const grupos = new Map<string, EventoAgenda[]>()
  for (const e of eventos) { const d = diaDe(e.inicio); grupos.set(d, [...(grupos.get(d) ?? []), e]) }
  return (
    <div className="agenda-lista">
      {[...grupos].map(([dia, es_]) => (
        <section key={dia}>
          <h3>{dia === hoy() ? 'Hoy' : dia === sumarDias(hoy(), 1) ? 'Mañana' : format(parseISO(dia), "EEEE d 'de' MMMM", { locale: es })}</h3>
          {es_.map(e => {
            const v = conClientes(e) ? vincular(e, crm) : null
            const reg = v ? registroDe(crm, v.col, v.id) : undefined
            return (
              <button key={e.id} type="button" className="agenda-fila tarjeta" onClick={() => onAbrir(e)} style={{ ['--col' as string]: colorDe(e, app.miembros) }}>
                <span className="cuando num">{e.todoElDia ? 'Todo el día' : `${horaDe(e.inicio)}–${horaDe(e.fin)}`}</span>
                <span className="que">
                  <b>{e.titulo}</b>
                  <span className="sub">
                    {reg && v ? <><Building2 size={12} /> {nombreRegistro(crm, v.col, reg)} · {NOMBRE_REGISTRO[v.col]}</>
                      : conClientes(e) ? <>Con {externos(e).map(a => a.email).join(', ')} · no está en el CRM</> : 'Del equipo'}
                    {e.lugar && <> · {e.lugar}</>}
                  </span>
                </span>
                <span className="quien">{e.miembrosIds.map(id => <Avatar key={id} miembro={app.miembros.find(m => m.id === id)} tamano="pequeno" />)}</span>
              </button>
            )
          })}
        </section>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────── detalle

/** Nombre de la empresa a partir del dominio: «clinicavega.es» → «Clinicavega». */
const empresaDe = (email: string) => { const d = dominio(email).split('.')[0] ?? ''; return d ? d[0].toUpperCase() + d.slice(1) : '' }

function DetalleEvento({ e, onCerrar }: { e: EventoAgenda; onCerrar: () => void }) {
  const { datos: app } = useApp()
  const { datos: crm, abrir, irLista } = useCrm()
  const v = vincular(e, crm)
  const reg = v ? registroDe(crm, v.col, v.id) : undefined
  const cita = crm.actividades.find(a => a.eventoId === e.id)
  const fuera = externos(e)
  const irA = (col: Parameters<typeof abrir>[0], id: string, prefill?: Record<string, unknown>) => { onCerrar(); abrir(col, id, prefill) }
  const nuevoPotencial = () => {
    const a = fuera[0]
    const generico = DOMINIOS_GENERICOS.has(dominio(a.email))
    const nombre = a.email.split('@')[0].split(/[._-]/)[0]
    irA('potenciales', 'nuevo', {
      tema: e.titulo, email: a.email, nombre: nombre ? nombre[0].toUpperCase() + nombre.slice(1) : '',
      empresa: generico ? '' : empresaDe(a.email), web: generico ? '' : dominio(a.email),
    })
  }
  const fecha = new Date(e.inicio).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const cuando = fecha[0].toUpperCase() + fecha.slice(1) + (e.todoElDia ? ', todo el día' : `, ${horaDe(e.inicio)}–${horaDe(e.fin)}`)

  return (
    <Panel onCerrar={onCerrar} cabecera={<><div className="sub">{e.cancelado ? 'Cancelada' : conClientes(e) ? 'Reunión con clientes' : 'Reunión'}</div><h2 style={{ margin: 0 }}>{e.titulo}</h2></>}>
      <div className="agenda-detalle">
        <p><Clock size={15} /> {cuando}</p>
        {e.lugar && <p><MapPin size={15} /> {e.lugar}</p>}
        {e.enlace && <p><ExternalLink size={15} /> <a href={e.enlace} target="_blank" rel="noreferrer">Abrir en Outlook</a></p>}

        <h3>Del equipo</h3>
        <div className="agenda-personas-detalle">
          {e.miembrosIds.map(id => { const m = app.miembros.find(x => x.id === id); return m && <span key={id}><Avatar miembro={m} tamano="pequeno" /> {m.nombre}{m.email.toLowerCase() === e.organizador && <span className="sub"> · organiza</span>}</span> })}
        </div>

        {fuera.length > 0 && <>
          <h3>De fuera</h3>
          <ul className="agenda-externos">{fuera.map(a => <li key={a.email}>{a.email}</li>)}</ul>
        </>}

        {fuera.length > 0 && (
          <>
            <h3>En el CRM</h3>
            {reg && v ? (
              <div className="agenda-crm">
                <button type="button" className="crm-fila" onClick={() => irA(v.col, v.id)}>
                  <span className="crece"><span className="t">{nombreRegistro(crm, v.col, reg)}</span><span className="s">{NOMBRE_REGISTRO[v.col]} · por {v.por === 'correo' ? `el correo ${v.email}` : `el dominio de ${v.email}`}</span></span>
                </button>
                {cita
                  ? <button type="button" className="btn sutil pequeno" onClick={() => irA('actividades', cita.id)}>Ver la cita en el CRM · {ESTADO_ACTIVIDAD[cita.estado]}</button>
                  : <p className="sub">La cita se crea en su ficha en la próxima sincronización.</p>}
              </div>
            ) : (
              <div className="agenda-crm">
                <p className="sub">Nadie de fuera está en el CRM, así que la reunión no sale en ninguna ficha. Si es un cliente nuevo, créalo y en la próxima sincronización se enlaza solo.</p>
                <div className="fila-botones">
                  <button type="button" className="btn primario pequeno" onClick={nuevoPotencial}><UserPlus size={14} /> Crear cliente potencial</button>
                  <button type="button" className="btn sutil pequeno" onClick={() => { onCerrar(); irLista('potenciales') }}>Ver clientes potenciales</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Panel>
  )
}
