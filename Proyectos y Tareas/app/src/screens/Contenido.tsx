/**
 * Contenido de redes: qué se publica, dónde y cuándo.
 *
 * El eje es el calendario, no el estado: lo que se pregunta el equipo es "qué
 * sale esta semana", así que las piezas van agrupadas por cuándo se publican y
 * no en un tablero por fases. El estado es un chip que avanza con un clic.
 *
 * Se escribe rápido, como las tareas: título, canal, fecha y Enter. El resto
 * (guion, enlace, responsable) se rellena luego abriendo la fila.
 */
import { useMemo, useState } from 'react'
import {
  AtSign, CalendarDays, CirclePlay, ExternalLink, FileText, Mail, Megaphone, Plus, Trash2, ChevronDown,
} from 'lucide-react'
import { useApp } from '../store'
import { Avatar, ChipProyecto, FiltroPersonas, SelectMiembro, SelectProyecto, Vacio } from '../ui/basicos'
import { Select } from '../ui/Select'
import type { CanalContenido, Contenido as Pieza, EstadoContenido } from '../domain/types'
import {
  CANALES, COLOR_CANAL, ETIQUETA_CANAL, ETIQUETA_ESTADO_CONTENIDO, ORDEN_ESTADOS_CONTENIDO,
} from '../domain/types'
import { hoy, lunesDe, sumarDias, fechaCorta } from '../domain/fechas'

/** Icono genérico por familia de canal: lucide ya no trae iconos de marca. */
const ICONO: Record<CanalContenido, typeof CirclePlay> = {
  youtube: CirclePlay,
  tiktok: CirclePlay,
  instagram: CirclePlay,
  linkedin: Megaphone,
  x: AtSign,
  blog: FileText,
  newsletter: Mail,
}

const TONO_ESTADO: Record<EstadoContenido, string> = {
  idea: '', guion: '', produccion: 'aviso', listo: 'ok', publicado: 'ok',
}

const OPCIONES_CANAL = CANALES.map(c => ({ valor: c, etiqueta: ETIQUETA_CANAL[c], color: COLOR_CANAL[c] }))
const OPCIONES_ESTADO = ORDEN_ESTADOS_CONTENIDO.map(e => ({ valor: e, etiqueta: ETIQUETA_ESTADO_CONTENIDO[e] }))

/** Grupos por cuándo se publica. El orden es el de la lista. */
type Grupo = { clave: string; nombre: string; piezas: Pieza[] }

function agrupar(piezas: Pieza[]): Grupo[] {
  const H = hoy()
  const finEstaSemana = sumarDias(lunesDe(H), 6)
  const finSiguiente = sumarDias(lunesDe(H), 13)

  const g: Record<string, Pieza[]> = { atrasado: [], estaSemana: [], siguiente: [], adelante: [], sinFecha: [], publicado: [] }
  for (const p of piezas) {
    if (p.estado === 'publicado') g.publicado.push(p)
    else if (!p.fecha) g.sinFecha.push(p)
    else if (p.fecha < H) g.atrasado.push(p)
    else if (p.fecha <= finEstaSemana) g.estaSemana.push(p)
    else if (p.fecha <= finSiguiente) g.siguiente.push(p)
    else g.adelante.push(p)
  }
  const porFecha = (a: Pieza, b: Pieza) => (a.fecha ?? '').localeCompare(b.fecha ?? '')
  return [
    { clave: 'atrasado', nombre: 'Se ha pasado la fecha', piezas: g.atrasado.sort(porFecha) },
    { clave: 'estaSemana', nombre: 'Esta semana', piezas: g.estaSemana.sort(porFecha) },
    { clave: 'siguiente', nombre: 'La semana que viene', piezas: g.siguiente.sort(porFecha) },
    { clave: 'adelante', nombre: 'Más adelante', piezas: g.adelante.sort(porFecha) },
    { clave: 'sinFecha', nombre: 'Sin fecha', piezas: g.sinFecha },
    { clave: 'publicado', nombre: 'Publicado', piezas: g.publicado.sort(porFecha).reverse() },
  ].filter(x => x.piezas.length > 0)
}

export default function Contenido() {
  const { datos, yo, guardarContenido, borrarContenido, contenidoBase } = useApp()
  const [canalFiltro, setCanalFiltro] = useState<CanalContenido | null>(null)
  const [persona, setPersona] = useState<string | null>(null)
  const [abierta, setAbierta] = useState<string | null>(null)

  // composer
  const [titulo, setTitulo] = useState('')
  const [canal, setCanal] = useState<CanalContenido>('linkedin')
  const [fecha, setFecha] = useState('')

  const visibles = useMemo(() => datos.contenidos.filter(p =>
    (!canalFiltro || p.canal === canalFiltro) &&
    (!persona || p.responsableId === persona)
  ), [datos.contenidos, canalFiltro, persona])

  const grupos = useMemo(() => agrupar(visibles), [visibles])

  const crear = async () => {
    const t = titulo.trim()
    if (!t) return
    setTitulo('')
    await guardarContenido(contenidoBase({ titulo: t, canal, fecha: fecha || null, responsableId: yo?.id ?? null }))
  }

  const pendientes = datos.contenidos.filter(p => p.estado !== 'publicado').length

  return (
    <div className="pagina">
      <div className="titulo-pagina">
        <div>
          <h1>Contenido</h1>
          <div className="sub">
            Qué publicamos, en qué canal y qué día.
            {pendientes > 0 && <> · <b>{pendientes}</b> {pendientes === 1 ? 'pieza' : 'piezas'} por publicar</>}
          </div>
        </div>
      </div>

      <div className="componer-tarea">
        <Plus size={16} />
        <input value={titulo} onChange={e => setTitulo(e.target.value)}
          placeholder="Escribe una pieza de contenido y pulsa Enter…"
          onKeyDown={e => { if (e.key === 'Enter') void crear(); if (e.key === 'Escape') setTitulo('') }} />
        <Select valor={canal} onCambio={setCanal} opciones={OPCIONES_CANAL} pequeno ancho={150} />
        <input className="fecha-componer" type="date" value={fecha} onChange={e => setFecha(e.target.value)} title="Fecha de publicación" />
      </div>

      <div className="herramientas">
        <div className="filtro-canales">
          <button className={`chip pequeno ${canalFiltro === null ? 'activo' : 'contorno'}`} onClick={() => setCanalFiltro(null)}>Todos</button>
          {CANALES.map(c => (
            <button key={c} className={`chip pequeno ${canalFiltro === c ? 'activo' : 'contorno'}`} onClick={() => setCanalFiltro(canalFiltro === c ? null : c)}>
              <i className="punto-proyecto" style={{ background: COLOR_CANAL[c] }} /> {ETIQUETA_CANAL[c]}
            </button>
          ))}
        </div>
        <div style={{ marginLeft: 'auto' }}><FiltroPersonas valor={persona} onCambio={setPersona} /></div>
      </div>

      {!datos.contenidos.length && (
        <Vacio icono={<CalendarDays size={32} />} titulo="Todavía no hay contenido planificado"
          texto="Escribe arriba el título de un vídeo o un post y elige el día en que sale." />
      )}

      {!!datos.contenidos.length && !visibles.length && (
        <Vacio icono={<CalendarDays size={32} />} titulo="Nada con esos filtros" />
      )}

      {grupos.map(g => (
        <div key={g.clave}>
          <div className={`seccion-titulo ${g.clave === 'atrasado' ? 'alerta' : ''}`}>{g.nombre} · {g.piezas.length}</div>
          <div className="lista-contenido">
            {g.piezas.map(p => (
              <Fila key={p.id} pieza={p} abierta={abierta === p.id}
                onAbrir={() => setAbierta(abierta === p.id ? null : p.id)}
                onGuardar={c => void guardarContenido(c)} onBorrar={() => void borrarContenido(p.id)} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function Fila({ pieza: p, abierta, onAbrir, onGuardar, onBorrar }: {
  pieza: Pieza; abierta: boolean; onAbrir: () => void
  onGuardar: (c: Pieza) => void; onBorrar: () => void
}) {
  const { miembro, proyecto } = useApp()
  const I = ICONO[p.canal]

  /** Un clic recorre el avance; es más rápido que abrir un desplegable. */
  const siguienteEstado = () => {
    const i = ORDEN_ESTADOS_CONTENIDO.indexOf(p.estado)
    onGuardar({ ...p, estado: ORDEN_ESTADOS_CONTENIDO[(i + 1) % ORDEN_ESTADOS_CONTENIDO.length] })
  }

  return (
    <div className={`tarjeta contenido ${p.estado}`} style={{ ['--canal' as string]: COLOR_CANAL[p.canal] }}>
      <div className="contenido-cima" onClick={onAbrir}>
        <span className="canal" title={ETIQUETA_CANAL[p.canal]}><I size={15} /></span>
        <div className="grow">
          <div className="contenido-titulo">{p.titulo || 'Sin título'}</div>
          <div className="contenido-meta">
            <span className="canal-nombre">{ETIQUETA_CANAL[p.canal]}</span>
            <ChipProyecto proyecto={proyecto(p.proyectoId)} />
            {p.enlace && (
              <a href={p.enlace} target="_blank" rel="noreferrer" className="chip pequeno contorno"
                onClick={e => e.stopPropagation()}><ExternalLink size={11} /> Ver</a>
            )}
          </div>
        </div>
        <button className={`chip pequeno ${TONO_ESTADO[p.estado]}`} title="Cambiar estado"
          onClick={e => { e.stopPropagation(); siguienteEstado() }}>{ETIQUETA_ESTADO_CONTENIDO[p.estado]}</button>
        <span className="cuando">{p.fecha ? fechaCorta(p.fecha) : 'Sin fecha'}</span>
        <Avatar miembro={miembro(p.responsableId)} tamano="pequeno" />
        <ChevronDown size={16} className={`chev ${abierta ? 'abierto' : ''}`} />
      </div>

      {abierta && (
        <div className="contenido-cuerpo">
          <div className="fila-campos">
            <label className="campo"><span>Canal</span>
              <Select valor={p.canal} onCambio={v => onGuardar({ ...p, canal: v })} opciones={OPCIONES_CANAL} /></label>
            <label className="campo"><span>Estado</span>
              <Select valor={p.estado} onCambio={v => onGuardar({ ...p, estado: v })} opciones={OPCIONES_ESTADO} /></label>
            <label className="campo"><span>Publicación</span>
              <input type="date" value={p.fecha ?? ''} onChange={e => onGuardar({ ...p, fecha: e.target.value || null })} /></label>
          </div>
          <div className="fila-campos dos">
            <label className="campo"><span>Responsable</span>
              <SelectMiembro valor={p.responsableId} onCambio={v => onGuardar({ ...p, responsableId: v })} /></label>
            <label className="campo"><span>Proyecto</span>
              <SelectProyecto valor={p.proyectoId} onCambio={v => onGuardar({ ...p, proyectoId: v })} /></label>
          </div>
          <label className="campo"><span>Guion o notas</span>
            <textarea defaultValue={p.notas} placeholder="Ideas, guion, enlaces de referencia…"
              onBlur={e => { if (e.target.value !== p.notas) onGuardar({ ...p, notas: e.target.value }) }} /></label>
          <label className="campo"><span>Enlace publicado</span>
            <input defaultValue={p.enlace} placeholder="https://…"
              onBlur={e => { if (e.target.value !== p.enlace) onGuardar({ ...p, enlace: e.target.value }) }} /></label>
          <div className="contenido-pie">
            <button className="btn peligro pequeno" onClick={() => { if (confirm('¿Borrar esta pieza de contenido?')) onBorrar() }}>
              <Trash2 size={13} /> Borrar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
