/**
 * Contenido de redes: qué vamos a hacer, quién lo hace, dónde sale y cuándo.
 *
 * Tres vistas sobre las mismas piezas:
 * - «Plan de trabajo»: solo lo que sí vamos a hacer. Agrupado por dónde se
 *   publica (página de locodea. o el perfil de cada persona), por quién lo
 *   hace o por estado. Cada pieza puede salir en varios canales (LinkedIn y
 *   YouTube) y tener varias personas asignadas.
 * - «Banco de ideas»: lo que todavía no está en el plan, agrupado por serie y
 *   con las favoritas arriba. Una idea pasa al plan con un botón.
 * - «Calendario»: todo, agrupado por cuándo sale.
 *
 * Se escribe rápido, como las tareas: título y Enter. En el plan se eligen
 * antes perfil, canales y personas; el resto se rellena abriendo la fila.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AtSign, Ban, Building2, CalendarDays, Check, ChevronDown, CirclePlay, ClipboardList, Code2, ExternalLink, FileText,
  Lightbulb, ListPlus, Mail, Megaphone, Plus, Search, Star, ThumbsDown, ThumbsUp, Trash2, Undo2, UserPlus,
} from 'lucide-react'
import { useApp } from '../store'
import { Avatar, ChipProyecto, FiltroPersonas, Progreso, Segmentado, SelectProyecto, Vacio, confirmar } from '../ui/basicos'
import { Select } from '../ui/Select'
import type { CanalContenido, Contenido as Pieza, EstadoContenido, FormatoContenido, Miembro, Valoracion } from '../domain/types'
import {
  CANALES, COLOR_CANAL, ETIQUETA_CANAL, ETIQUETA_ESTADO_CONTENIDO, ETIQUETA_FORMATO, ETIQUETA_VALORACION, FORMATOS,
  ORDEN_ESTADOS_CONTENIDO, PERFIL_LOCODEA, VALORACIONES, conAsignados, conCanales, listaTecnologias,
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

/** En el plan, una pieza en «idea» es algo que todavía nadie ha empezado. */
const etiquetaEstado = (e: EstadoContenido, enPlan: boolean) => (enPlan && e === 'idea' ? 'Por empezar' : ETIQUETA_ESTADO_CONTENIDO[e])

/** Los dos canales con los que trabajamos van primero en todos los selectores. */
const CANALES_ORDEN: CanalContenido[] = ['linkedin', 'youtube', ...CANALES.filter(c => c !== 'linkedin' && c !== 'youtube')]
const OPCIONES_ESTADO = ORDEN_ESTADOS_CONTENIDO.map(e => ({ valor: e, etiqueta: ETIQUETA_ESTADO_CONTENIDO[e] }))
const OPCIONES_FORMATO = [
  { valor: '' as const, etiqueta: 'Sin formato' },
  ...FORMATOS.map(f => ({ valor: f, etiqueta: ETIQUETA_FORMATO[f] })),
]

type Vista = 'plan' | 'ideas' | 'calendario'
type AgruparPlan = 'perfil' | 'persona' | 'estado'
/** Filtro de valoración: todas (sin las descartadas), una concreta o las que nadie ha valorado. */
type FiltroValoracion = 'todas' | 'sinvalorar' | Valoracion

/** Orden dentro de una serie: lo que más gusta, primero. */
const PESO: Record<string, number> = { favorita: 0, gusta: 1, sin: 2, nogusta: 3, descartada: 4 }
const peso = (p: Pieza) => PESO[p.valoracion ?? 'sin']

type Grupo = { clave: string; nombre: string; piezas: Pieza[]; icono?: 'locodea' | Miembro | null }

/** Nombre del perfil donde se publica. */
function nombrePerfil(perfil: string | null, miembro: (id: string | null) => Miembro | undefined): string {
  if (!perfil) return 'Sin decidir dónde sale'
  if (perfil === PERFIL_LOCODEA) return 'Página de locodea.'
  return miembro(perfil)?.nombre ?? 'Perfil desconocido'
}

// ─────────────────────────────────────────────── agrupaciones

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

/** En el plan: primero lo que está en marcha, después lo que falta por empezar y lo publicado al final. */
const ORDEN_PLAN: Record<EstadoContenido, number> = { produccion: 0, guion: 1, listo: 2, idea: 3, publicado: 4 }
const ordenPlan = (a: Pieza, b: Pieza) =>
  ORDEN_PLAN[a.estado] - ORDEN_PLAN[b.estado] || (a.fecha ?? '9').localeCompare(b.fecha ?? '9') || a.titulo.localeCompare(b.titulo, 'es')

function agruparPlan(piezas: Pieza[], por: AgruparPlan, miembros: Miembro[]): Grupo[] {
  const activos = miembros.filter(m => m.activo)
  if (por === 'estado') {
    return ORDEN_ESTADOS_CONTENIDO
      .map(e => ({ clave: e, nombre: etiquetaEstado(e, true), piezas: piezas.filter(p => p.estado === e).sort(ordenPlan) }))
      .filter(g => g.piezas.length)
  }
  if (por === 'persona') {
    // Una pieza con dos personas sale con las dos: cada uno ve todo lo suyo.
    return [
      ...activos.map(m => ({ clave: m.id, nombre: m.nombre, icono: m, piezas: piezas.filter(p => p.asignadosIds.includes(m.id)).sort(ordenPlan) })),
      { clave: 'nadie', nombre: 'Sin asignar', icono: null, piezas: piezas.filter(p => !p.asignadosIds.some(id => activos.some(m => m.id === id))).sort(ordenPlan) },
    ].filter(g => g.piezas.length)
  }
  return [
    { clave: PERFIL_LOCODEA, nombre: 'Página de locodea.', icono: 'locodea' as const, piezas: piezas.filter(p => p.perfil === PERFIL_LOCODEA).sort(ordenPlan) },
    ...miembros.map(m => ({ clave: m.id, nombre: `Perfil de ${m.nombre}`, icono: m, piezas: piezas.filter(p => p.perfil === m.id).sort(ordenPlan) })),
    { clave: 'sinperfil', nombre: 'Sin decidir dónde sale', icono: null, piezas: piezas.filter(p => !p.perfil || (p.perfil !== PERFIL_LOCODEA && !miembros.some(m => m.id === p.perfil))).sort(ordenPlan) },
  ].filter(g => g.piezas.length)
}

// ─────────────────────────────────────────────── pantalla

export default function Contenido() {
  const { datos, yo, miembro, guardarContenido, borrarContenido, contenidoBase, avisar } = useApp()
  const [vista, setVista] = useState<Vista>('plan')
  const [agrupar, setAgrupar] = useState<AgruparPlan>('perfil')
  const [canalFiltro, setCanalFiltro] = useState<CanalContenido | null>(null)
  const [valoracion, setValoracion] = useState<FiltroValoracion>('todas')
  const [formato, setFormato] = useState<FormatoContenido | ''>('')
  const [persona, setPersona] = useState<string | null>(null)
  const [verPublicadas, setVerPublicadas] = useState(true)
  const [texto, setTexto] = useState('')
  const [abierta, setAbierta] = useState<string | null>(null)

  // composer
  const [titulo, setTitulo] = useState('')
  const [canales, setCanales] = useState<CanalContenido[]>(['linkedin'])
  const [perfil, setPerfil] = useState<string>(PERFIL_LOCODEA)
  const [asignados, setAsignados] = useState<string[]>(yo ? [yo.id] : [])
  const [fecha, setFecha] = useState('')

  const enPlan = useMemo(() => datos.contenidos.filter(p => p.enPlan), [datos.contenidos])
  const enBanco = useMemo(() => datos.contenidos.filter(p => !p.enPlan), [datos.contenidos])
  const base = vista === 'plan' ? enPlan : vista === 'ideas' ? enBanco : datos.contenidos

  const visibles = useMemo(() => {
    const q = texto.trim().toLowerCase()
    return base.filter(p =>
      (!canalFiltro || p.canales.includes(canalFiltro)) &&
      (!persona || p.asignadosIds.includes(persona) || p.perfil === persona) &&
      (!formato || p.formato === formato) &&
      (vista !== 'plan' || verPublicadas || p.estado !== 'publicado') &&
      (vista !== 'ideas' || (valoracion === 'todas' ? p.valoracion !== 'descartada'
        : valoracion === 'sinvalorar' ? !p.valoracion
          : p.valoracion === valoracion)) &&
      (!q || [p.titulo, p.serie, p.tecnologias, p.origen, p.notas].some(t => t.toLowerCase().includes(q)))
    )
  }, [base, canalFiltro, persona, formato, valoracion, texto, vista, verPublicadas])

  const grupos = useMemo(() => (
    vista === 'plan' ? agruparPlan(visibles, agrupar, datos.miembros)
      : vista === 'ideas' ? agruparPorSerie(visibles)
        : agruparPorFecha(visibles)
  ), [visibles, vista, agrupar, datos.miembros])

  const crear = async () => {
    const t = titulo.trim()
    if (!t) return
    setTitulo('')
    const nueva = vista === 'plan'
      ? conAsignados(conCanales(contenidoBase({ titulo: t, perfil, enPlan: true, fecha: fecha || null }), canales), asignados)
      : contenidoBase({ titulo: t, canal: canales[0] ?? 'linkedin', canales: canales.length ? [canales[0]] : ['linkedin'], fecha: fecha || null })
    await guardarContenido(nueva)
  }

  /** Pasa una idea del banco al plan: sale donde publica su responsable si no se ha dicho otra cosa. */
  const alPlan = async (p: Pieza) => {
    await guardarContenido({ ...p, enPlan: true, perfil: p.perfil ?? p.responsableId ?? null })
    avisar(`«${p.titulo}» pasa al plan de trabajo`)
  }
  const sacarDelPlan = async (p: Pieza) => {
    await guardarContenido({ ...p, enPlan: false })
    avisar(`«${p.titulo}» vuelve al banco de ideas`)
  }

  const publicadasPlan = enPlan.filter(p => p.estado === 'publicado').length
  const enMarcha = enPlan.filter(p => p.estado !== 'idea' && p.estado !== 'publicado').length
  const cuenta = (v: FiltroValoracion) => enBanco.filter(p =>
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
            {vista === 'plan' ? (
              <>Lo que sí vamos a hacer, quién lo hace y dónde sale · <b>{enPlan.length}</b> en el plan
                {enMarcha > 0 && <> · <b>{enMarcha}</b> en marcha</>}
                {publicadasPlan > 0 && <> · <b>{publicadasPlan}</b> publicadas</>}</>
            ) : vista === 'ideas' ? (
              <>Ideas que todavía no están en el plan · <b>{enBanco.length}</b> en el banco
                {cuenta('favorita') > 0 && <> · <b>{cuenta('favorita')}</b> favoritas</>}</>
            ) : (
              <>Qué publicamos y qué día · <b>{datos.contenidos.filter(p => p.estado !== 'publicado').length}</b> por publicar</>
            )}
          </div>
        </div>
        <div className="acciones">
          <Segmentado<Vista> valor={vista} onCambio={v => { setVista(v); setAbierta(null) }} etiqueta="Vista"
            opciones={[
              { valor: 'plan', etiqueta: `Plan de trabajo · ${enPlan.length}` },
              { valor: 'ideas', etiqueta: 'Banco de ideas' },
              { valor: 'calendario', etiqueta: 'Calendario' },
            ]} />
        </div>
      </div>

      {vista === 'plan' ? (
        <div className="componer-tarea componer-plan">
          <Plus size={16} />
          <input value={titulo} onChange={e => setTitulo(e.target.value)}
            placeholder="Añade algo al plan: «Post sobre Power BI», «Vídeo de presentación»… y Enter"
            onKeyDown={e => { if (e.key === 'Enter') void crear(); if (e.key === 'Escape') setTitulo('') }} />
          <SelectPerfil valor={perfil} onCambio={v => setPerfil(v ?? PERFIL_LOCODEA)} pequeno />
          <BotonesCanal valor={canales} onCambio={setCanales} />
          <AsignarPersonas valor={asignados} onCambio={setAsignados} />
          <input className="fecha-componer" type="date" value={fecha} onChange={e => setFecha(e.target.value)} title="Fecha de publicación" />
        </div>
      ) : (
        <div className="componer-tarea">
          <Plus size={16} />
          <input value={titulo} onChange={e => setTitulo(e.target.value)}
            placeholder={vista === 'ideas' ? 'Apunta una idea y pulsa Enter…' : 'Escribe una pieza de contenido y pulsa Enter…'}
            onKeyDown={e => { if (e.key === 'Enter') void crear(); if (e.key === 'Escape') setTitulo('') }} />
          <Select valor={canales[0] ?? 'linkedin'} onCambio={c => setCanales([c])} pequeno ancho={150}
            opciones={CANALES_ORDEN.map(c => ({ valor: c, etiqueta: ETIQUETA_CANAL[c], color: COLOR_CANAL[c] }))} />
          <input className="fecha-componer" type="date" value={fecha} onChange={e => setFecha(e.target.value)} title="Fecha de publicación" />
        </div>
      )}

      {vista === 'plan' && (
        <div className="herramientas contenido-filtros">
          <div className="plan-agrupar">
            <span className="etiqueta-agrupar">Agrupar por</span>
            <Segmentado<AgruparPlan> valor={agrupar} onCambio={setAgrupar} etiqueta="Agrupar por"
              opciones={[{ valor: 'perfil', etiqueta: 'Dónde sale' }, { valor: 'persona', etiqueta: 'Quién lo hace' }, { valor: 'estado', etiqueta: 'Estado' }]} />
            <button className={`chip pequeno ${verPublicadas ? 'contorno' : 'activo'}`} onClick={() => setVerPublicadas(!verPublicadas)}
              title="Ocultar o mostrar lo ya publicado">
              {verPublicadas ? 'Ocultar publicadas' : 'Publicadas ocultas'}
            </button>
          </div>
          <label className="buscar-ia">
            <Search size={14} />
            <input value={texto} onChange={e => setTexto(e.target.value)} placeholder="Buscar en el plan…" />
          </label>
        </div>
      )}

      {vista === 'ideas' && (
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
      )}

      <div className="herramientas">
        <div className="filtro-canales">
          <button className={`chip pequeno ${canalFiltro === null ? 'activo' : 'contorno'}`} onClick={() => setCanalFiltro(null)}>Todos los canales</button>
          {CANALES_ORDEN.filter(c => base.some(p => p.canales.includes(c))).map(c => (
            <button key={c} className={`chip pequeno ${canalFiltro === c ? 'activo' : 'contorno'}`} onClick={() => setCanalFiltro(canalFiltro === c ? null : c)}>
              <i className="punto-proyecto" style={{ background: COLOR_CANAL[c] }} /> {ETIQUETA_CANAL[c]}
              <span className="cuenta-chip">{base.filter(p => p.canales.includes(c)).length}</span>
            </button>
          ))}
        </div>
        <div className="contenido-filtros-dcha">
          {vista === 'calendario' && (
            <label className="buscar-ia">
              <Search size={14} />
              <input value={texto} onChange={e => setTexto(e.target.value)} placeholder="Buscar…" />
            </label>
          )}
          <Select<FormatoContenido | ''> valor={formato} onCambio={setFormato} pequeno ancho={160}
            opciones={[{ valor: '', etiqueta: 'Todos los formatos' }, ...FORMATOS.map(f => ({ valor: f, etiqueta: ETIQUETA_FORMATO[f] }))]} />
          <FiltroPersonas valor={persona} onCambio={setPersona} />
        </div>
      </div>

      {vista === 'plan' && !enPlan.length && (
        <Vacio icono={<ClipboardList size={32} />} titulo="El plan de trabajo está vacío"
          texto="Escribe arriba lo que vais a hacer, o pasa ideas desde el banco con «Al plan»." />
      )}
      {vista !== 'plan' && !base.length && (
        <Vacio icono={<CalendarDays size={32} />} titulo={vista === 'ideas' ? 'No hay ideas en el banco' : 'Todavía no hay contenido planificado'}
          texto="Escribe arriba el título de un vídeo o un post." />
      )}
      {!!base.length && !visibles.length && (
        <Vacio icono={<Lightbulb size={32} />} titulo="Nada con esos filtros" />
      )}

      {grupos.map(g => {
        const publicadas = g.piezas.filter(p => p.estado === 'publicado').length
        return (
          <div key={g.clave} className={vista === 'plan' ? 'grupo-plan' : undefined}>
            <div className={`seccion-titulo ${g.clave === 'atrasado' ? 'alerta' : ''}`}>
              <span className="seccion-nombre">
                {g.icono === 'locodea' && <span className="avatar pequeno perfil-locodea" title="Página de locodea."><Building2 size={12} /></span>}
                {g.icono && g.icono !== 'locodea' && <Avatar miembro={g.icono} tamano="pequeno" />}
                {g.nombre} · {g.piezas.length}
              </span>
              {vista === 'ideas' && g.piezas.some(p => p.valoracion === 'favorita') && (
                <span className="serie-favoritas"><Star size={11} /> {g.piezas.filter(p => p.valoracion === 'favorita').length}</span>
              )}
              {vista === 'plan' && agrupar !== 'estado' && (
                <span className="avance-grupo" title={`${publicadas} de ${g.piezas.length} publicadas`}>
                  {publicadas}/{g.piezas.length} publicadas
                  <Progreso pct={(publicadas / g.piezas.length) * 100} tono="ok" />
                </span>
              )}
            </div>
            <div className="lista-contenido">
              {g.piezas.map(p => (
                <Fila key={`${g.clave}-${p.id}`} pieza={p} abierta={abierta === `${g.clave}-${p.id}`} vista={vista}
                  verPerfil={vista !== 'plan' || agrupar !== 'perfil'}
                  onAbrir={() => setAbierta(abierta === `${g.clave}-${p.id}` ? null : `${g.clave}-${p.id}`)}
                  onGuardar={c => void guardarContenido(c)} onBorrar={() => void borrarContenido(p.id)}
                  onAlPlan={() => void alPlan(p)} onSacarDelPlan={() => void sacarDelPlan(p)}
                  nombrePerfil={nombrePerfil(p.perfil, miembro)} />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────── fila

function Fila({ pieza: p, abierta, vista, verPerfil, nombrePerfil, onAbrir, onGuardar, onBorrar, onAlPlan, onSacarDelPlan }: {
  pieza: Pieza; abierta: boolean; vista: Vista; verPerfil: boolean; nombrePerfil: string; onAbrir: () => void
  onGuardar: (c: Pieza) => void; onBorrar: () => void; onAlPlan: () => void; onSacarDelPlan: () => void
}) {
  const { proyecto } = useApp()
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
        {vista === 'plan' ? (
          <span className="canal" title={p.canales.map(c => ETIQUETA_CANAL[c]).join(' y ')}><I size={15} /></span>
        ) : (
          <button className={`estrella ${favorita ? 'activa' : ''}`} title={favorita ? 'Quitar de favoritas' : 'Marcar como favorita'}
            aria-pressed={favorita} onClick={e => { e.stopPropagation(); valorar('favorita') }}>
            <Star size={16} />
          </button>
        )}
        <div className="grow">
          <div className="contenido-titulo">{p.titulo || 'Sin título'}</div>
          <div className="contenido-meta">
            {p.canales.map(c => <ChipCanal key={c} canal={c} enlace={p.enlaces[c]} />)}
            {verPerfil && p.enPlan && <span className="perfil-chip">{p.perfil === PERFIL_LOCODEA && <Building2 size={11} />} {nombrePerfil}</span>}
            {p.formato && <span className="formato">{ETIQUETA_FORMATO[p.formato]}</span>}
            {VI && <span className={`valoracion-chip ${p.valoracion}`}><VI size={11} /> {ETIQUETA_VALORACION[p.valoracion!]}</span>}
            {vista === 'calendario' && p.serie && <span className="serie">{p.serie}</span>}
            {vista === 'calendario' && p.enPlan && <span className="chip pequeno acento">En el plan</span>}
            {tecnologias.slice(0, 3).map(t => <span key={t} className="tecno">{t}</span>)}
            {tecnologias.length > 3 && <span className="tecno mas">+{tecnologias.length - 3}</span>}
            {p.proyectoId && <ChipProyecto proyecto={proyecto(p.proyectoId)} />}
          </div>
        </div>
        {vista === 'ideas' && (
          <button className="btn pequeno al-plan" title="Pasar al plan de trabajo: lo vamos a hacer"
            onClick={e => { e.stopPropagation(); onAlPlan() }}><ListPlus size={13} /> Al plan</button>
        )}
        <button className={`chip pequeno ${TONO_ESTADO[p.estado]}`} title="Cambiar estado"
          onClick={e => { e.stopPropagation(); siguienteEstado() }}>{etiquetaEstado(p.estado, p.enPlan)}</button>
        <span className="cuando">{p.fecha ? fechaCorta(p.fecha) : 'Sin fecha'}</span>
        <span onClick={e => e.stopPropagation()}>
          <AsignarPersonas valor={p.asignadosIds} onCambio={ids => onGuardar(conAsignados(p, ids))} compacto />
        </span>
        <ChevronDown size={16} className={`chev ${abierta ? 'abierto' : ''}`} />
      </div>

      {abierta && (
        <div className="contenido-cuerpo">
          {vista !== 'plan' && (
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
          )}
          <div className="fila-campos dos">
            <div className="campo"><span>Dónde sale</span>
              <SelectPerfil valor={p.perfil} onCambio={v => onGuardar({ ...p, perfil: v })} /></div>
            <div className="campo"><span>Quién lo hace</span>
              <SelectorPersonas valor={p.asignadosIds} onCambio={ids => onGuardar(conAsignados(p, ids))} /></div>
          </div>
          <div className="campo"><span>Canales</span>
            <BotonesCanal valor={p.canales} onCambio={cs => onGuardar(conCanales(p, cs))} todos /></div>
          <div className="fila-campos">
            <label className="campo"><span>Formato</span>
              <Select<FormatoContenido | ''> valor={p.formato ?? ''} onCambio={v => onGuardar({ ...p, formato: v || null })} opciones={OPCIONES_FORMATO} /></label>
            <label className="campo"><span>Estado</span>
              <Select valor={p.estado} onCambio={v => onGuardar({ ...p, estado: v })} opciones={OPCIONES_ESTADO} /></label>
            <label className="campo"><span>Publicación</span>
              <input type="date" value={p.fecha ?? ''} onChange={e => onGuardar({ ...p, fecha: e.target.value || null })} /></label>
            <label className="campo"><span>Proyecto</span>
              <SelectProyecto valor={p.proyectoId} onCambio={v => onGuardar({ ...p, proyectoId: v })} /></label>
          </div>
          <div className={`fila-campos ${p.canales.length > 1 ? 'dos' : ''}`}>
            {p.canales.map(c => (
              <label key={c} className="campo"><span>Enlace en {ETIQUETA_CANAL[c]}</span>
                <input key={`${p.id}-${c}`} defaultValue={p.enlaces[c] ?? ''} placeholder={c === 'youtube' ? 'https://youtu.be/…' : c === 'linkedin' ? 'https://www.linkedin.com/posts/…' : 'https://…'}
                  onBlur={e => { const v = e.target.value.trim(); if (v !== (p.enlaces[c] ?? '')) onGuardar({ ...p, enlaces: { ...p.enlaces, [c]: v } }) }} /></label>
            ))}
          </div>
          <label className="campo"><span>Guion o notas</span>
            <textarea className="notas-contenido" defaultValue={p.notas} placeholder="Gancho, qué se enseña, estructura, por qué puede funcionar…"
              onBlur={e => { if (e.target.value !== p.notas) onGuardar({ ...p, notas: e.target.value }) }} /></label>
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
          <div className="contenido-pie">
            {p.enPlan
              ? <button className="btn pequeno" onClick={onSacarDelPlan}><Undo2 size={13} /> Devolver al banco de ideas</button>
              : <button className="btn primario pequeno" onClick={onAlPlan}><ListPlus size={13} /> Pasar al plan de trabajo</button>}
            <button className="btn peligro pequeno" onClick={async () => { if (await confirmar('¿Borrar esta pieza de contenido?', { aceptar: 'Borrar', peligro: true })) onBorrar() }}>
              <Trash2 size={13} /> Borrar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────── piezas pequeñas

/** El canal con su color; si ya está publicado en él, se abre el enlace. */
function ChipCanal({ canal, enlace }: { canal: CanalContenido; enlace?: string }) {
  const estilo = { ['--canal' as string]: COLOR_CANAL[canal] }
  if (enlace) {
    return (
      <a href={enlace} target="_blank" rel="noreferrer" className="canal-chip publicado" style={estilo}
        title={`Ver en ${ETIQUETA_CANAL[canal]}`} onClick={e => e.stopPropagation()}>
        {ETIQUETA_CANAL[canal]} <ExternalLink size={10} />
      </a>
    )
  }
  return <span className="canal-chip" style={estilo}>{ETIQUETA_CANAL[canal]}</span>
}

/** Botones de canal: LinkedIn y YouTube siempre a la vista; con `todos`, el resto también. */
function BotonesCanal({ valor, onCambio, todos }: { valor: CanalContenido[]; onCambio: (cs: CanalContenido[]) => void; todos?: boolean }) {
  const lista = todos ? CANALES_ORDEN : CANALES_ORDEN.filter(c => c === 'linkedin' || c === 'youtube' || valor.includes(c))
  const alternar = (c: CanalContenido) => {
    const nuevo = valor.includes(c) ? valor.filter(x => x !== c) : [...valor, c]
    // Orden estable: el principal es el primero de la lista de canales.
    onCambio(nuevo.length ? CANALES_ORDEN.filter(x => nuevo.includes(x)) : valor)
  }
  return (
    <div className="botones-canal" role="group" aria-label="Canales">
      {lista.map(c => (
        <button key={c} type="button" className={`canal-boton ${valor.includes(c) ? 'activo' : ''}`} aria-pressed={valor.includes(c)}
          style={{ ['--canal' as string]: COLOR_CANAL[c] }} onClick={() => alternar(c)}
          title={valor.includes(c) && valor.length === 1 ? 'Tiene que salir al menos en un canal' : ETIQUETA_CANAL[c]}>
          {valor.includes(c) && <Check size={11} />} {ETIQUETA_CANAL[c]}
        </button>
      ))}
    </div>
  )
}

/** Dónde se publica: la página de locodea. o el perfil de una persona. */
function SelectPerfil({ valor, onCambio, pequeno }: { valor: string | null; onCambio: (v: string | null) => void; pequeno?: boolean }) {
  const { datos } = useApp()
  const opciones = [
    { valor: '', etiqueta: 'Sin decidir', icono: <Avatar miembro={null} tamano="pequeno" /> },
    { valor: PERFIL_LOCODEA, etiqueta: 'Página de locodea.', icono: <span className="avatar pequeno perfil-locodea"><Building2 size={12} /></span> },
    ...datos.miembros.filter(m => m.activo || m.id === valor).map(m => ({ valor: m.id, etiqueta: `Perfil de ${m.nombre}`, icono: <Avatar miembro={m} tamano="pequeno" /> })),
  ]
  return <Select valor={valor ?? ''} opciones={opciones} onCambio={v => onCambio(v || null)} pequeno={pequeno} ancho={pequeno ? 190 : undefined} />
}

/** Personas como botones con su nombre: se marcan y desmarcan con un clic. */
function SelectorPersonas({ valor, onCambio }: { valor: string[]; onCambio: (ids: string[]) => void }) {
  const { datos } = useApp()
  const alternar = (id: string) => onCambio(valor.includes(id) ? valor.filter(x => x !== id) : [...valor, id])
  return (
    <div className="selector-personas">
      {datos.miembros.filter(m => m.activo || valor.includes(m.id)).map(m => (
        <button key={m.id} type="button" className={`persona-boton ${valor.includes(m.id) ? 'activo' : ''}`}
          aria-pressed={valor.includes(m.id)} onClick={() => alternar(m.id)}>
          <Avatar miembro={m} tamano="pequeno" /> {m.nombre.split(' ')[0]}
          {valor[0] === m.id && valor.length > 1 && <span className="lleva">lleva</span>}
        </button>
      ))}
    </div>
  )
}

/**
 * Avatares de quién lo hace y un botón para cambiarlo sin abrir la fila.
 * `compacto`: solo los avatares apilados (en la fila); si no, con texto (en el compositor).
 */
function AsignarPersonas({ valor, onCambio, compacto }: { valor: string[]; onCambio: (ids: string[]) => void; compacto?: boolean }) {
  const { datos, miembro } = useApp()
  const [abierto, setAbierto] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!abierto) return
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(false) }
    document.addEventListener('mousedown', h)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('keydown', esc) }
  }, [abierto])
  const personas = valor.map(id => miembro(id)).filter((m): m is Miembro => !!m)
  const alternar = (id: string) => onCambio(valor.includes(id) ? valor.filter(x => x !== id) : [...valor, id])

  return (
    <div className={`asignar ${compacto ? 'compacto' : ''}`} ref={ref}>
      <button type="button" className="asignar-boton" onClick={() => setAbierto(!abierto)}
        title={personas.length ? `Lo hace: ${personas.map(m => m.nombre).join(', ')}. Clic para cambiar` : 'Asignar a alguien'}>
        {personas.length ? (
          <span className="pila-avatares">{personas.slice(0, 3).map(m => <Avatar key={m.id} miembro={m} tamano="pequeno" />)}
            {personas.length > 3 && <span className="avatar pequeno mas">+{personas.length - 3}</span>}</span>
        ) : <span className="avatar pequeno vacio"><UserPlus size={12} /></span>}
        {!compacto && <span className="asignar-texto">{personas.length ? personas.map(m => m.nombre.split(' ')[0]).join(', ') : 'Asignar'}</span>}
      </button>
      {abierto && (
        <div className="asignar-pop" role="menu">
          <div className="asignar-pop-titulo">¿Quién lo hace?</div>
          {datos.miembros.filter(m => m.activo || valor.includes(m.id)).map(m => (
            <button key={m.id} type="button" role="menuitemcheckbox" aria-checked={valor.includes(m.id)}
              className={`asignar-opcion ${valor.includes(m.id) ? 'activo' : ''}`} onClick={() => alternar(m.id)}>
              <Avatar miembro={m} tamano="pequeno" /> <span className="grow">{m.nombre}</span>
              {valor.includes(m.id) && <Check size={14} />}
            </button>
          ))}
          {valor.length > 0 && (
            <button type="button" className="asignar-opcion quitar" onClick={() => onCambio([])}>Quitar a todos</button>
          )}
        </div>
      )}
    </div>
  )
}
