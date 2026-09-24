/**
 * Reuniones del equipo y el orden del día de cada una.
 *
 * Lo importante no es la reunión: son los temas. Cada tema se marca como
 * tratado o aplazado, y los aplazados se arrastran a la siguiente reunión con
 * un botón, que es donde se pierde el hilo en la práctica.
 *
 * Al guardar, la reunión se refleja en el calendario de Outlook del organizador
 * con los asistentes invitados (ver data/calendario.ts).
 */
import { useMemo, useState } from 'react'
import {
  CalendarDays, CalendarPlus, Check, ChevronDown, Clock, MapPin, Plus, Trash2, X,
} from 'lucide-react'
import { useApp } from '../store'
import { Avatar, Campo, ChipProyecto, Modal, SelectProyecto, Vacio } from '../ui/basicos'
import { Select } from '../ui/Select'
import type { EstadoTema, Reunion, TemaReunion } from '../domain/types'
import { ETIQUETA_ESTADO_TEMA } from '../domain/types'
import { nuevoId } from '../data/repo'

const SIGUIENTE: Record<EstadoTema, EstadoTema> = { pendiente: 'tratado', tratado: 'aplazado', aplazado: 'pendiente' }
const TONO: Record<EstadoTema, string> = { pendiente: '', tratado: 'ok', aplazado: 'aviso' }

/** '2026-09-23T10:00' para los input datetime-local. */
function paraInput(iso: string): string {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

function fechaLegible(iso: string): string {
  return new Date(iso).toLocaleString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

export default function Reuniones() {
  const { datos, guardarReunion, borrarReunion, reunionBase } = useApp()
  const [editando, setEditando] = useState<Reunion | null>(null)
  const [creando, setCreando] = useState<Partial<Reunion> | null>(null)
  const [abierta, setAbierta] = useState<string | null>(null)

  const ahora = new Date().toISOString()
  const { proximas, pasadas } = useMemo(() => {
    const orden = [...datos.reuniones].sort((a, b) => a.fecha.localeCompare(b.fecha))
    return {
      proximas: orden.filter(r => r.fecha >= ahora || r.estado === 'pendiente'),
      pasadas: orden.filter(r => r.fecha < ahora && r.estado !== 'pendiente').reverse(),
    }
  }, [datos.reuniones, ahora])

  /** Arrastra los temas sin tratar a una reunión nueva: es lo que se olvida. */
  const heredarTemas = (r: Reunion) => {
    const pendientes = r.temas.filter(t => t.estado !== 'tratado')
    setCreando({
      titulo: `${r.titulo} · seguimiento`,
      proyectoId: r.proyectoId,
      asistentesIds: r.asistentesIds,
      temas: pendientes.map(t => ({ ...t, id: nuevoId(), estado: 'pendiente' as EstadoTema, notas: '' })),
    })
  }

  return (
    <div className="pagina">
      <div className="titulo-pagina">
        <div>
          <h1>Reuniones.</h1>
          <div className="sub">Cuándo os veis y qué hay que tratar. Se sincroniza con tu calendario de Outlook.</div>
        </div>
        <div className="acciones">
          <button className="btn primario" onClick={() => setCreando({})}><Plus size={15} /> Nueva reunión</button>
        </div>
      </div>

      {datos.reuniones.length === 0 && (
        <Vacio icono={<CalendarDays size={32} />} titulo="Todavía no hay reuniones"
          texto="Crea la primera y apunta los temas que queréis tratar."
          accion={<button className="btn primario" onClick={() => setCreando({})}><Plus size={15} /> Nueva reunión</button>} />
      )}

      {proximas.length > 0 && <div className="seccion-titulo">Próximas · {proximas.length}</div>}
      <div className="lista-reuniones">
        {proximas.map(r => (
          <TarjetaReunion key={r.id} reunion={r} abierta={abierta === r.id}
            onAbrir={() => setAbierta(a => (a === r.id ? null : r.id))}
            onEditar={() => setEditando(r)} onBorrar={() => void borrarReunion(r.id)}
            onSeguimiento={() => heredarTemas(r)} />
        ))}
      </div>

      {pasadas.length > 0 && <div className="seccion-titulo" style={{ marginTop: 24 }}>Anteriores · {pasadas.length}</div>}
      <div className="lista-reuniones">
        {pasadas.map(r => (
          <TarjetaReunion key={r.id} reunion={r} abierta={abierta === r.id}
            onAbrir={() => setAbierta(a => (a === r.id ? null : r.id))}
            onEditar={() => setEditando(r)} onBorrar={() => void borrarReunion(r.id)}
            onSeguimiento={() => heredarTemas(r)} />
        ))}
      </div>

      {(creando || editando) && (
        <ModalReunion
          inicial={editando ?? reunionBase(creando ?? {})}
          onGuardar={async r => { await guardarReunion(r); setCreando(null); setEditando(null) }}
          onCerrar={() => { setCreando(null); setEditando(null) }} />
      )}
    </div>
  )
}

function TarjetaReunion({ reunion: r, abierta, onAbrir, onEditar, onBorrar, onSeguimiento }: {
  reunion: Reunion; abierta: boolean; onAbrir: () => void; onEditar: () => void; onBorrar: () => void; onSeguimiento: () => void
}) {
  const { datos, miembro, proyecto, guardarReunion } = useApp()
  const [tema, setTema] = useState('')
  const tratados = r.temas.filter(t => t.estado === 'tratado').length

  const cambiarTemas = (temas: TemaReunion[]) => void guardarReunion({ ...r, temas })
  const anadirTema = () => {
    if (!tema.trim()) return
    cambiarTemas([...r.temas, { id: nuevoId(), texto: tema.trim(), estado: 'pendiente', notas: '' }])
    setTema('')
  }

  return (
    <div className={`tarjeta reunion ${r.estado}`}>
      <div className="reunion-cima" onClick={onAbrir}>
        <div className="reunion-cuando">
          <CalendarDays size={15} />
          <span className="fecha">{fechaLegible(r.fecha)}</span>
          <span className="dur"><Clock size={12} /> {r.duracionMin} min</span>
        </div>
        <div className="grow">
          <div className="reunion-titulo">{r.titulo || 'Sin título'}</div>
          <div className="reunion-meta">
            <ChipProyecto proyecto={proyecto(r.proyectoId)} />
            {r.lugar && <span className="lugar"><MapPin size={12} /> {r.lugar}</span>}
            {r.temas.length > 0 && <span>{tratados}/{r.temas.length} temas tratados</span>}
            {r.eventoId && <span className="chip pequeno" title="Sincronizada con tu calendario de Outlook"><CalendarPlus size={11} /> En calendario</span>}
          </div>
        </div>
        <div className="avatares">
          {r.asistentesIds.slice(0, 4).map(id => <Avatar key={id} miembro={miembro(id)} tamano="pequeno" />)}
        </div>
        <ChevronDown size={16} className={`chev ${abierta ? 'abierto' : ''}`} />
      </div>

      {abierta && (
        <div className="reunion-cuerpo">
          <div className="temas">
            {r.temas.length === 0 && <div className="faint" style={{ fontSize: 13 }}>Sin temas todavía. Añade el primero abajo.</div>}
            {r.temas.map(t => (
              <div key={t.id} className="tema">
                <button className={`chip pequeno ${TONO[t.estado]}`} title="Cambiar estado"
                  onClick={() => cambiarTemas(r.temas.map(x => (x.id === t.id ? { ...x, estado: SIGUIENTE[x.estado] } : x)))}>
                  {ETIQUETA_ESTADO_TEMA[t.estado]}
                </button>
                <span className="texto" style={{ textDecoration: t.estado === 'tratado' ? 'line-through' : 'none' }}>{t.texto}</span>
                <input className="nota" placeholder="Qué se decidió…" defaultValue={t.notas}
                  onBlur={e => { if (e.target.value !== t.notas) cambiarTemas(r.temas.map(x => (x.id === t.id ? { ...x, notas: e.target.value } : x))) }} />
                <button className="btn sutil icono pequeno" title="Quitar tema"
                  onClick={() => cambiarTemas(r.temas.filter(x => x.id !== t.id))}><X size={14} /></button>
              </div>
            ))}
          </div>

          <div className="tema-nuevo">
            <Plus size={15} />
            <input placeholder="Añadir un tema a tratar" value={tema}
              onChange={e => setTema(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') anadirTema() }} />
            <button className="btn pequeno" onClick={anadirTema} disabled={!tema.trim()}>Añadir</button>
          </div>

          {r.notas && <p className="reunion-notas">{r.notas}</p>}

          <div className="reunion-acciones">
            <Select valor={r.estado} onCambio={v => void guardarReunion({ ...r, estado: v as Reunion['estado'] })}
              opciones={[{ valor: 'pendiente', etiqueta: 'Pendiente' }, { valor: 'celebrada', etiqueta: 'Celebrada' }, { valor: 'cancelada', etiqueta: 'Cancelada' }]} pequeno />
            <div className="grow" />
            {r.temas.some(t => t.estado !== 'tratado') && (
              <button className="btn pequeno" onClick={onSeguimiento} title="Crea otra reunión con los temas que quedan">
                <CalendarPlus size={14} /> Pasar pendientes a otra reunión
              </button>
            )}
            <button className="btn pequeno" onClick={onEditar}>Editar</button>
            <button className="btn peligro pequeno" onClick={onBorrar}><Trash2 size={14} /> Borrar</button>
          </div>
          {datos.miembros.length === 0 && null}
        </div>
      )}
    </div>
  )
}

function ModalReunion({ inicial, onGuardar, onCerrar }: {
  inicial: Reunion | Omit<Reunion, 'id' | 'creadoEl'>
  onGuardar: (r: Reunion | Omit<Reunion, 'id' | 'creadoEl'>) => void | Promise<void>
  onCerrar: () => void
}) {
  const { datos } = useApp()
  const [r, setR] = useState(inicial)
  const set = <K extends keyof typeof r>(k: K, v: (typeof r)[K]) => setR(x => ({ ...x, [k]: v }))
  const activos = datos.miembros.filter(m => m.activo)

  return (
    <Modal titulo={'id' in r ? 'Editar reunión' : 'Nueva reunión'} onCerrar={onCerrar} pie={<>
      <button className="btn" onClick={onCerrar}>Cancelar</button>
      <button className="btn primario" disabled={!r.titulo.trim()} onClick={() => void onGuardar(r)}>
        <Check size={15} /> Guardar y enviar al calendario
      </button>
    </>}>
      <div className="formulario">
        <Campo label="Título">
          <input value={r.titulo} autoFocus placeholder="Seguimiento semanal, kickoff con el cliente…"
            onChange={e => set('titulo', e.target.value)} />
        </Campo>
        <div className="fila-campos dos">
          <Campo label="Cuándo">
            <input type="datetime-local" value={paraInput(r.fecha)}
              onChange={e => set('fecha', new Date(e.target.value).toISOString())} />
          </Campo>
          <Campo label="Duración (minutos)">
            <input type="number" min={15} step={15} value={r.duracionMin}
              onChange={e => set('duracionMin', Number(e.target.value) || 60)} />
          </Campo>
        </div>
        <div className="fila-campos dos">
          <Campo label="Lugar o enlace">
            <input value={r.lugar} placeholder="Teams, oficina, casa del cliente…"
              onChange={e => set('lugar', e.target.value)} />
          </Campo>
          <Campo label="Proyecto">
            <SelectProyecto valor={r.proyectoId} onCambio={v => set('proyectoId', v)} />
          </Campo>
        </div>
        <Campo label="Asistentes">
          <div className="elige-personas">
            {activos.map(m => {
              const puesto = r.asistentesIds.includes(m.id)
              return (
                <button key={m.id} className={`persona-chip ${puesto ? 'activa' : ''}`}
                  onClick={() => set('asistentesIds', puesto ? r.asistentesIds.filter(x => x !== m.id) : [...r.asistentesIds, m.id])}>
                  <Avatar miembro={m} tamano="pequeno" /> {m.nombre.split(' ')[0]}
                </button>
              )
            })}
          </div>
        </Campo>
        <Campo label="Notas">
          <textarea value={r.notas} placeholder="Contexto, enlaces, lo que haga falta…"
            onChange={e => set('notas', e.target.value)} />
        </Campo>
      </div>
    </Modal>
  )
}
