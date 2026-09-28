/**
 * Contenido de redes: qué se publica, dónde y cuándo, y el banco de ideas.
 *
 * Dos vistas sobre las mismas piezas:
 * - «Calendario»: agrupado por cuándo sale; lo que se pregunta el equipo es
 *   "qué sale esta semana". El estado es un chip que avanza con un clic.
 * - «Banco de ideas»: agrupado por serie, con las favoritas arriba. Cada idea
 *   se valora con la estrella (favorita), «me gusta», «no me convence» o
 *   «descartada»; las descartadas no se ven salvo que se filtren.
 *
 * Se escribe rápido, como las tareas: título, canal, fecha y Enter. El resto
 * (formato, serie, tecnologías, guion) se rellena abriendo la fila.
 */
import { useMemo, useState } from 'react'
import {
  AtSign, Ban, CalendarDays, ChevronDown, CirclePlay, Code2, ExternalLink, FileText, Lightbulb, Mail, Megaphone, Plus,
  Search, Star, ThumbsDown, ThumbsUp, Trash2,
} from 'lucide-react'
import { useApp } from '../store'
import { Avatar, ChipProyecto, FiltroPersonas, Segmentado, SelectMiembro, SelectProyecto, Vacio, confirmar } from '../ui/basicos'
import { Select } from '../ui/Select'
import type { CanalContenido, Contenido as Pieza, EstadoContenido, FormatoContenido, Valoracion } from '../domain/types'
import {
  CANALES, COLOR_CANAL, ETIQUETA_CANAL, ETIQUETA_ESTADO_CONTENIDO, ETIQUETA_FORMATO, ETIQUETA_VALORACION, FORMATOS,
  ORDEN_ESTADOS_CONTENIDO, VALORACIONES, listaTecnologias,
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

const ICONO_VALORACION: Record<Valoracion, typeof Star> = {
  favorita: Star, gusta: ThumbsUp, nogusta: ThumbsDown, descartada: Ban,
}

const TONO_ESTADO: Record<EstadoContenido, string> = {
  idea: '', guion: '', produccion: 'aviso', listo: 'ok', publicado: 'ok',
}

const OPCIONES_CANAL = CANALES.map(c => ({ valor: c, etiqueta: ETIQUETA_CANAL[c], color: COLOR_CANAL[c] }))
const OPCIONES_ESTADO = ORDEN_ESTADOS_CONTENIDO.map(e => ({ valor: e, etiqueta: ETIQUETA_ESTADO_CONTENIDO[e] }))
const OPCIONES_FORMATO = [
  { valor: '' as const, etiqueta: 'Sin formato' },
  ...FORMATOS.map(f => ({ valor: f, etiqueta: ETIQUETA_FORMATO[f] })),
]

type Vista = 'calendario' | 'ideas'
/** Filtro de valoración: todas (sin las descartadas), una concreta o las que nadie ha valorado. */
type FiltroValoracion = 'todas' | 'sinvalorar' | Valoracion

/** Orden dentro de una serie: lo que más gusta, primero. */
const PESO: Record<string, number> = { favorita: 0, gusta: 1, sin: 2, nogusta: 3, descartada: 4 }
const peso = (p: Pieza) => PESO[p.valoracion ?? 'sin']

type Grupo = { clave: string; nombre: string; piezas: Pieza[] }

function agruparPorFecha(piezas: Pieza[]): Grupo[] {
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
    { clave: 'sinFecha', nombre: 'Sin fecha', piezas: g.sinFecha.sort((a, b) => peso(a) - peso(b)) },
    { clave: 'publicado', nombre: 'Publicado', piezas: g.publicado.sort(porFecha).reverse() },
  ].filter(x => x.piezas.length > 0)
}

function agruparPorSerie(piezas: Pieza[]): Grupo[] {
  const mapa = new Map<string, Pieza[]>()
  for (const p of piezas) {
    const k = p.serie.trim() || 'Sin serie'
    mapa.set(k, [...(mapa.get(k) ?? []), p])
  }
  const favoritas = (xs: Pieza[]) => xs.filter(p => p.valoracion === 'favorita').length
  return [...mapa.entries()]
    .map(([nombre, xs]) => ({
      clave: nombre, nombre,
      piezas: xs.sort((a, b) => peso(a) - peso(b) || a.titulo.localeCompare(b.titulo, 'es')),
    }))
    // Las series con más favoritas suben; «Sin serie» siempre al final.
    .sort((a, b) => (a.nombre === 'Sin serie' ? 1 : b.nombre === 'Sin serie' ? -1 : favoritas(b.piezas) - favoritas(a.piezas) || a.nombre.localeCompare(b.nombre, 'es')))
}

export default function Contenido() {
  const { datos, yo, guardarContenido, borrarContenido, contenidoBase } = useApp()
  const [vista, setVista] = useState<Vista>('ideas')
  const [canalFiltro, setCanalFiltro] = useState<CanalContenido | null>(null)
  const [valoracion, setValoracion] = useState<FiltroValoracion>('todas')
  const [formato, setFormato] = useState<FormatoContenido | ''>('')
  const [persona, setPersona] = useState<string | null>(null)
  const [texto, setTexto] = useState('')
  const [abierta, setAbierta] = useState<string | null>(null)

  // composer
  const [titulo, setTitulo] = useState('')
  const [canal, setCanal] = useState<CanalContenido>('linkedin')
  const [fecha, setFecha] = useState('')

  const visibles = useMemo(() => {
    const q = texto.trim().toLowerCase()
    return datos.contenidos.filter(p =>
      (!canalFiltro || p.canal === canalFiltro) &&
      (!persona || p.responsableId === persona) &&
      (!formato || p.formato === formato) &&
      (valoracion === 'todas' ? p.valoracion !== 'descartada'
        : valoracion === 'sinvalorar' ? !p.valoracion
          : p.valoracion === valoracion) &&
      (!q || [p.titulo, p.serie, p.tecnologias, p.origen, p.notas].some(t => t.toLowerCase().includes(q)))
    )
  }, [datos.contenidos, canalFiltro, persona, formato, valoracion, texto])

  const grupos = useMemo(() => (vista === 'ideas' ? agruparPorSerie(visibles) : agruparPorFecha(visibles)), [visibles, vista])

  const crear = async () => {
    const t = titulo.trim()
    if (!t) return
    setTitulo('')
    await guardarContenido(contenidoBase({ titulo: t, canal, fecha: fecha || null, responsableId: yo?.id ?? null }))
  }

  const pendientes = datos.contenidos.filter(p => p.estado !== 'publicado').length
  const cuenta = (v: FiltroValoracion) => datos.contenidos.filter(p =>
    v === 'todas' ? p.valoracion !== 'descartada' : v === 'sinvalorar' ? !p.valoracion : p.valoracion === v).length
  const filtrosValoracion: { valor: FiltroValoracion; etiqueta: string; icono?: typeof Star }[] = [
    { valor: 'todas', etiqueta: 'Todas' },
    { valor: 'favorita', etiqueta: 'Favoritas', icono: Star },
    { valor: 'gusta', etiqueta: 'Me gusta', icono: ThumbsUp },
    { valor: 'sinvalorar', etiqueta: 'Sin valorar' },
    { valor: 'nogusta', etiqueta: 'No me convencen', icono: ThumbsDown },
    { valor: 'descartada', etiqueta: 'Descartadas', icono: Ban },
  ]

  return (
    <div className="pagina">
      <div className="titulo-pagina">
        <div>
          <h1>Contenido.</h1>
          <div className="sub">
            Qué publicamos, en qué canal y qué día.
            {pendientes > 0 && <> · <b>{pendientes}</b> {pendientes === 1 ? 'pieza' : 'piezas'} por publicar</>}
            {cuenta('favorita') > 0 && <> · <b>{cuenta('favorita')}</b> favoritas</>}
          </div>
        </div>
        <div className="acciones">
          <Segmentado<Vista> valor={vista} onCambio={setVista} etiqueta="Vista"
            opciones={[{ valor: 'ideas', etiqueta: 'Banco de ideas' }, { valor: 'calendario', etiqueta: 'Calendario' }]} />
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

      <div className="herramientas contenido-filtros">
        <div className="filtro-canales">
          {filtrosValoracion.map(f => {
            const I = f.icono
            return (
              <button key={f.valor} className={`chip pequeno ${valoracion === f.valor ? 'activo' : 'contorno'} ${f.valor === 'favorita' ? 'chip-favorita' : ''}`}
                onClick={() => setValoracion(f.valor)}>
                {I && <I size={11} />} {f.etiqueta} <span className="cuenta-chip">{cuenta(f.valor)}</span>
              </button>
            )
          })}
        </div>
        <label className="buscar-ia">
          <Search size={14} />
          <input value={texto} onChange={e => setTexto(e.target.value)} placeholder="Buscar por título, tecnología, app…" />
        </label>
      </div>

      <div className="herramientas">
        <div className="filtro-canales">
          <button className={`chip pequeno ${canalFiltro === null ? 'activo' : 'contorno'}`} onClick={() => setCanalFiltro(null)}>Todos los canales</button>
          {CANALES.filter(c => datos.contenidos.some(p => p.canal === c)).map(c => (
            <button key={c} className={`chip pequeno ${canalFiltro === c ? 'activo' : 'contorno'}`} onClick={() => setCanalFiltro(canalFiltro === c ? null : c)}>
              <i className="punto-proyecto" style={{ background: COLOR_CANAL[c] }} /> {ETIQUETA_CANAL[c]}
            </button>
          ))}
        </div>
        <div className="contenido-filtros-dcha">
          <Select<FormatoContenido | ''> valor={formato} onCambio={setFormato} pequeno ancho={160}
            opciones={[{ valor: '', etiqueta: 'Todos los formatos' }, ...FORMATOS.map(f => ({ valor: f, etiqueta: ETIQUETA_FORMATO[f] }))]} />
          <FiltroPersonas valor={persona} onCambio={setPersona} />
        </div>
      </div>

      {!datos.contenidos.length && (
        <Vacio icono={<CalendarDays size={32} />} titulo="Todavía no hay contenido planificado"
          texto="Escribe arriba el título de un vídeo o un post y elige el día en que sale." />
      )}

      {!!datos.contenidos.length && !visibles.length && (
        <Vacio icono={<Lightbulb size={32} />} titulo="Nada con esos filtros" />
      )}

      {grupos.map(g => (
        <div key={g.clave}>
          <div className={`seccion-titulo ${g.clave === 'atrasado' ? 'alerta' : ''}`}>
            {g.nombre} · {g.piezas.length}
            {vista === 'ideas' && g.piezas.some(p => p.valoracion === 'favorita') && (
              <span className="serie-favoritas"><Star size={11} /> {g.piezas.filter(p => p.valoracion === 'favorita').length}</span>
            )}
          </div>
          <div className="lista-contenido">
            {g.piezas.map(p => (
              <Fila key={p.id} pieza={p} abierta={abierta === p.id} verSerie={vista === 'calendario'}
                onAbrir={() => setAbierta(abierta === p.id ? null : p.id)}
                onGuardar={c => void guardarContenido(c)} onBorrar={() => void borrarContenido(p.id)} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function Fila({ pieza: p, abierta, verSerie, onAbrir, onGuardar, onBorrar }: {
  pieza: Pieza; abierta: boolean; verSerie: boolean; onAbrir: () => void
  onGuardar: (c: Pieza) => void; onBorrar: () => void
}) {
  const { miembro, proyecto } = useApp()
  const I = ICONO[p.canal]
  const tecnologias = listaTecnologias(p.tecnologias)
  const favorita = p.valoracion === 'favorita'

  /** Un clic recorre el avance; es más rápido que abrir un desplegable. */
  const siguienteEstado = () => {
    const i = ORDEN_ESTADOS_CONTENIDO.indexOf(p.estado)
    onGuardar({ ...p, estado: ORDEN_ESTADOS_CONTENIDO[(i + 1) % ORDEN_ESTADOS_CONTENIDO.length] })
  }
  /** Pulsar la valoración que ya tiene la quita. */
  const valorar = (v: Valoracion) => onGuardar({ ...p, valoracion: p.valoracion === v ? null : v })
  const VI = p.valoracion && p.valoracion !== 'favorita' ? ICONO_VALORACION[p.valoracion] : null

  return (
    <div className={`tarjeta contenido ${p.estado} ${p.valoracion ? `val-${p.valoracion}` : ''}`} style={{ ['--canal' as string]: COLOR_CANAL[p.canal] }}>
      <div className="contenido-cima" onClick={onAbrir}>
        <button className={`estrella ${favorita ? 'activa' : ''}`} title={favorita ? 'Quitar de favoritas' : 'Marcar como favorita'}
          aria-pressed={favorita} onClick={e => { e.stopPropagation(); valorar('favorita') }}>
          <Star size={16} />
        </button>
        <span className="canal" title={ETIQUETA_CANAL[p.canal]}><I size={15} /></span>
        <div className="grow">
          <div className="contenido-titulo">{p.titulo || 'Sin título'}</div>
          <div className="contenido-meta">
            <span className="canal-nombre">{ETIQUETA_CANAL[p.canal]}</span>
            {p.formato && <span className="formato">{ETIQUETA_FORMATO[p.formato]}</span>}
            {VI && <span className={`valoracion-chip ${p.valoracion}`}><VI size={11} /> {ETIQUETA_VALORACION[p.valoracion!]}</span>}
            {verSerie && p.serie && <span className="serie">{p.serie}</span>}
            {tecnologias.slice(0, 3).map(t => <span key={t} className="tecno">{t}</span>)}
            {tecnologias.length > 3 && <span className="tecno mas">+{tecnologias.length - 3}</span>}
            {p.proyectoId && <ChipProyecto proyecto={proyecto(p.proyectoId)} />}
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
          <div className="valorar" role="group" aria-label="Valoración">
            <span className="valorar-titulo">¿Qué nos parece?</span>
            {VALORACIONES.map(v => {
              const VIc = ICONO_VALORACION[v]
              return (
                <button key={v} type="button" className={`valorar-btn ${v} ${p.valoracion === v ? 'activo' : ''}`}
                  aria-pressed={p.valoracion === v} onClick={() => valorar(v)}>
                  <VIc size={14} /> {ETIQUETA_VALORACION[v]}
                </button>
              )
            })}
          </div>
          <div className="fila-campos">
            <label className="campo"><span>Canal</span>
              <Select valor={p.canal} onCambio={v => onGuardar({ ...p, canal: v })} opciones={OPCIONES_CANAL} /></label>
            <label className="campo"><span>Formato</span>
              <Select<FormatoContenido | ''> valor={p.formato ?? ''} onCambio={v => onGuardar({ ...p, formato: v || null })} opciones={OPCIONES_FORMATO} /></label>
            <label className="campo"><span>Estado</span>
              <Select valor={p.estado} onCambio={v => onGuardar({ ...p, estado: v })} opciones={OPCIONES_ESTADO} /></label>
            <label className="campo"><span>Publicación</span>
              <input type="date" value={p.fecha ?? ''} onChange={e => onGuardar({ ...p, fecha: e.target.value || null })} /></label>
          </div>
          <div className="fila-campos dos">
            <label className="campo"><span>Serie</span>
              <input defaultValue={p.serie} placeholder="Una app en 60 segundos, Construido con IA…"
                onBlur={e => { if (e.target.value !== p.serie) onGuardar({ ...p, serie: e.target.value }) }} /></label>
            <label className="campo"><span>Desarrollo en el que se basa</span>
              <input defaultValue={p.origen} placeholder="Code App · Producción"
                onBlur={e => { if (e.target.value !== p.origen) onGuardar({ ...p, origen: e.target.value }) }} /></label>
          </div>
          <label className="campo"><span><Code2 size={12} /> Tecnologías (separadas por comas)</span>
            <input defaultValue={p.tecnologias} placeholder="Power Apps (Code App), Dataverse, Power Automate…"
              onBlur={e => { if (e.target.value !== p.tecnologias) onGuardar({ ...p, tecnologias: e.target.value }) }} /></label>
          <div className="fila-campos dos">
            <label className="campo"><span>Responsable</span>
              <SelectMiembro valor={p.responsableId} onCambio={v => onGuardar({ ...p, responsableId: v })} /></label>
            <label className="campo"><span>Proyecto</span>
              <SelectProyecto valor={p.proyectoId} onCambio={v => onGuardar({ ...p, proyectoId: v })} /></label>
          </div>
          <label className="campo"><span>Guion o notas</span>
            <textarea className="notas-contenido" defaultValue={p.notas} placeholder="Gancho, qué se enseña, estructura, por qué puede funcionar…"
              onBlur={e => { if (e.target.value !== p.notas) onGuardar({ ...p, notas: e.target.value }) }} /></label>
          <label className="campo"><span>Enlace publicado</span>
            <input defaultValue={p.enlace} placeholder="https://…"
              onBlur={e => { if (e.target.value !== p.enlace) onGuardar({ ...p, enlace: e.target.value }) }} /></label>
          <div className="contenido-pie">
            <button className="btn peligro pequeno" onClick={async () => { if (await confirmar('¿Borrar esta pieza de contenido?', { aceptar: 'Borrar', peligro: true })) onBorrar() }}>
              <Trash2 size={13} /> Borrar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
