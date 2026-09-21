/**
 * Diagrama de Gantt editable. Cada tarea es una barra entre `inicio` y
 * `vence`. Se puede arrastrar entera (mover), o por sus extremos (cambiar
 * inicio o fin). Todo se ajusta a días. Las tareas sin fechas se crean con
 * un clic en su fila. Sin librerías: eventos de puntero y cálculo en píxeles.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { addDays, differenceInCalendarDays, format, getISOWeek, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { Check, ChevronDown, ChevronRight, Plus } from 'lucide-react'
import { useApp } from '../../store'
import { Avatar } from '../../ui/basicos'
import type { Tarea, Vista } from '../../domain/types'
import { aIso, hoy, lunesDe, sumarDias } from '../../domain/fechas'
import { agruparTareas, ordenarTareas, COLOR_ESTADO } from '../../domain/vistas'

interface Props { vista: Vista; tareas: Tarea[]; abrirTarea: (id: string) => void; onNueva: (t: Partial<Tarea>) => void }

const PX: Record<Vista['escala'], number> = { dia: 34, semana: 14, mes: 5 }
const ALTO_FILA = 38

type Arrastre = { id: string; modo: 'mover' | 'inicio' | 'fin'; x0: number; inicio: string; vence: string; dInicio: number; dVence: number }

export default function Gantt({ vista, tareas, abrirTarea, onNueva }: Props) {
  const { datos, guardarTarea, miembro, proyecto, subtareasDe, alternarHecha } = useApp()
  const px = PX[vista.escala]
  const [cerrados, setCerrados] = useState<Set<string>>(new Set())
  const [arrastre, setArrastre] = useState<Arrastre | null>(null)
  const contenedor = useRef<HTMLDivElement>(null)

  // rango: desde 2 semanas antes de la fecha mínima hasta 6 semanas después de la máxima, cubriendo siempre hoy
  const { inicioRango, dias } = useMemo(() => {
    const fechas = tareas.flatMap(t => [t.inicio, t.vence]).filter((f): f is string => !!f)
    const min = [...fechas, hoy()].reduce((a, b) => (a < b ? a : b))
    const max = [...fechas, hoy()].reduce((a, b) => (a > b ? a : b))
    const ini = lunesDe(sumarDias(min, -14))
    const fin = sumarDias(lunesDe(sumarDias(max, 42)), 6)
    return { inicioRango: ini, dias: differenceInCalendarDays(parseISO(fin), parseISO(ini)) + 1 }
  }, [tareas])
  const xDe = (fecha: string) => differenceInCalendarDays(parseISO(fecha), parseISO(inicioRango)) * px
  const fechaDe = (x: number) => sumarDias(inicioRango, Math.round(x / px))

  useEffect(() => {
    // al abrir, centrar en hoy
    const el = contenedor.current
    if (el) el.scrollLeft = Math.max(0, xDe(hoy()) - el.clientWidth / 3 + 300)
  }, [px, inicioRango]) // eslint-disable-line react-hooks/exhaustive-deps

  const grupos = agruparTareas(ordenarTareas(tareas.filter(t => !t.padreId || !tareas.some(x => x.id === t.padreId)), vista.ordenar, vista.ordenDesc), vista.agrupar, datos).filter(g => g.tareas.length)

  type Fila = { tipo: 'grupo'; clave: string; nombre: string; color: string; inicio: string | null; fin: string | null; n: number; cambio: Partial<Tarea> } | { tipo: 'tarea'; tarea: Tarea; nivel: number }
  const filas: Fila[] = []
  for (const g of grupos) {
    const todas = g.tareas.flatMap(t => [t, ...subtareasDe(t.id)])
    const ini = todas.map(t => t.inicio ?? t.vence).filter((f): f is string => !!f).sort()[0] ?? null
    const fin = todas.map(t => t.vence ?? t.inicio).filter((f): f is string => !!f).sort().at(-1) ?? null
    if (vista.agrupar !== 'ninguno') filas.push({ tipo: 'grupo', clave: g.clave, nombre: g.nombre, color: g.color, inicio: ini, fin, n: g.tareas.length, cambio: g.cambio })
    if (cerrados.has(g.clave)) continue
    for (const t of g.tareas) {
      filas.push({ tipo: 'tarea', tarea: t, nivel: 0 })
      if (vista.filtros.mostrarSubtareas) for (const s of subtareasDe(t.id)) filas.push({ tipo: 'tarea', tarea: s, nivel: 1 })
    }
  }

  // ──────────────────────────────────────────── arrastre de barras
  const empezar = (e: React.PointerEvent, t: Tarea, modo: Arrastre['modo']) => {
    if (!t.inicio && !t.vence) return
    e.preventDefault(); e.stopPropagation()
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    const inicio = t.inicio ?? t.vence!
    const vence = t.vence ?? t.inicio!
    setArrastre({ id: t.id, modo, x0: e.clientX, inicio, vence, dInicio: 0, dVence: 0 })
  }
  const mover = (e: React.PointerEvent) => {
    if (!arrastre) return
    const d = Math.round((e.clientX - arrastre.x0) / px)
    setArrastre(a => a && ({ ...a, dInicio: a.modo === 'fin' ? 0 : d, dVence: a.modo === 'inicio' ? 0 : d }))
  }
  const soltar = () => {
    if (!arrastre) return
    const t = datos.tareas.find(x => x.id === arrastre.id)
    if (t && (arrastre.dInicio || arrastre.dVence)) {
      let inicio = sumarDias(arrastre.inicio, arrastre.dInicio)
      let vence = sumarDias(arrastre.vence, arrastre.dVence)
      if (vence < inicio) { if (arrastre.modo === 'inicio') inicio = vence; else vence = inicio }
      void guardarTarea({ ...t, inicio, vence })
    }
    setArrastre(null)
  }

  const barraDe = (t: Tarea) => {
    let inicio = t.inicio ?? t.vence
    let vence = t.vence ?? t.inicio
    if (!inicio || !vence) return null
    if (arrastre?.id === t.id) {
      inicio = sumarDias(arrastre.inicio, arrastre.dInicio); vence = sumarDias(arrastre.vence, arrastre.dVence)
      if (vence < inicio) { if (arrastre.modo === 'inicio') inicio = vence; else vence = inicio }
    }
    return { inicio, vence, left: xDe(inicio), width: (differenceInCalendarDays(parseISO(vence), parseISO(inicio)) + 1) * px }
  }

  // ──────────────────────────────────────────── cabeceras de tiempo
  const cabeceraSuperior: { x: number; w: number; texto: string }[] = []
  const cabeceraInferior: { x: number; w: number; texto: string; finde: boolean; hoy: boolean }[] = []
  for (let i = 0; i < dias; i++) {
    const f = sumarDias(inicioRango, i)
    const d = parseISO(f)
    if (vista.escala === 'dia') {
      cabeceraInferior.push({ x: i * px, w: px, texto: format(d, 'd'), finde: [0, 6].includes(d.getDay()), hoy: f === hoy() })
      if (d.getDay() === 1) cabeceraSuperior.push({ x: i * px, w: px * 7, texto: `S${getISOWeek(d)} · ${format(d, 'd MMM', { locale: es })}` })
    } else if (vista.escala === 'semana') {
      if (d.getDay() === 1) cabeceraInferior.push({ x: i * px, w: px * 7, texto: `S${getISOWeek(d)}`, finde: false, hoy: f <= hoy() && hoy() <= sumarDias(f, 6) })
      if (d.getDate() === 1 || i === 0) cabeceraSuperior.push({ x: i * px, w: px * 31, texto: format(d, 'MMMM yyyy', { locale: es }) })
    } else {
      if (d.getDate() === 1 || i === 0) cabeceraInferior.push({ x: i * px, w: px * 30, texto: format(d, 'MMM', { locale: es }), finde: false, hoy: false })
      if ((d.getMonth() === 0 && d.getDate() === 1) || i === 0) cabeceraSuperior.push({ x: i * px, w: px * 365, texto: format(d, 'yyyy') })
    }
  }
  const anchoTotal = dias * px

  return (
    <div className="gantt tarjeta" ref={contenedor} onPointerMove={mover} onPointerUp={soltar} onPointerCancel={soltar}>
      <div className="gantt-interior" style={{ width: 300 + anchoTotal }}>
        {/* cabecera */}
        <div className="gantt-fila cabecera" style={{ height: 48 }}>
          <div className="gantt-izq"><b>Tarea</b><span style={{ marginLeft: 'auto', color: 'var(--texto-3)', fontSize: 12 }}>{tareas.length}</span></div>
          <div className="gantt-der" style={{ width: anchoTotal }}>
            {cabeceraSuperior.map(c => <div key={'s' + c.x} className="g-cab sup" style={{ left: c.x, width: c.w }}>{c.texto}</div>)}
            {cabeceraInferior.map(c => <div key={'i' + c.x} className={`g-cab inf ${c.finde ? 'finde' : ''} ${c.hoy ? 'hoy' : ''}`} style={{ left: c.x, width: c.w }}>{c.texto}</div>)}
          </div>
        </div>
        {/* filas */}
        {filas.map((f, i) => f.tipo === 'grupo' ? (
          <div key={'g' + f.clave} className="gantt-fila grupo" style={{ height: ALTO_FILA }}>
            <div className="gantt-izq" onClick={() => setCerrados(s => { const n = new Set(s); if (n.has(f.clave)) n.delete(f.clave); else n.add(f.clave); return n })}>
              {cerrados.has(f.clave) ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
              <i className="punto-proyecto" style={{ background: f.color }} /><b className="texto">{f.nombre}</b><span className="n">{f.n}</span>
              <button className="btn sutil icono pequeno" style={{ marginLeft: 'auto' }} onClick={e => { e.stopPropagation(); onNueva({ ...f.cambio, inicio: hoy(), vence: sumarDias(hoy(), 2) }) }}><Plus size={13} /></button>
            </div>
            <div className="gantt-der" style={{ width: anchoTotal }}>
              <Fondo dias={dias} px={px} inicioRango={inicioRango} escala={vista.escala} />
              {f.inicio && f.fin && <div className="g-resumen" style={{ left: xDe(f.inicio), width: (differenceInCalendarDays(parseISO(f.fin), parseISO(f.inicio)) + 1) * px, background: f.color }} />}
            </div>
          </div>
        ) : (
          <FilaTarea key={f.tarea.id} tarea={f.tarea} nivel={f.nivel} px={px} dias={dias} inicioRango={inicioRango} escala={vista.escala} barra={barraDe(f.tarea)} par={i % 2 === 0}
            color={proyecto(f.tarea.proyectoId)?.color ?? COLOR_ESTADO[f.tarea.estado]} miembro={miembro(f.tarea.asignadoId)} subtareas={subtareasDe(f.tarea.id)}
            arrastrando={arrastre?.id === f.tarea.id} onAbrir={() => abrirTarea(f.tarea.id)} onAlternar={() => void alternarHecha(f.tarea.id)} onEmpezar={empezar}
            onCrearBarra={x => { const d = fechaDe(x); void guardarTarea({ ...f.tarea, inicio: d, vence: sumarDias(d, Math.max(0, Math.ceil((f.tarea.estimadoH ?? 4) / 4) - 1)) }) }} />
        ))}
        {!filas.length && <div className="vacio">No hay tareas con estos filtros.</div>}
        {/* línea de hoy */}
        <div className="g-hoy" style={{ left: 300 + xDe(hoy()) + px / 2 }} />
      </div>
    </div>
  )
}

function Fondo({ dias, px, inicioRango, escala }: { dias: number; px: number; inicioRango: string; escala: Vista['escala'] }) {
  if (escala !== 'dia') {
    // líneas por semana
    const lineas = []
    for (let i = 0; i < dias; i++) if (parseISO(sumarDias(inicioRango, i)).getDay() === 1) lineas.push(<i key={i} className="g-linea" style={{ left: i * px }} />)
    return <>{lineas}</>
  }
  const celdas = []
  for (let i = 0; i < dias; i++) {
    const d = parseISO(sumarDias(inicioRango, i)).getDay()
    if (d === 0 || d === 6) celdas.push(<i key={i} className="g-finde" style={{ left: i * px, width: px }} />)
    if (d === 1) celdas.push(<i key={'l' + i} className="g-linea" style={{ left: i * px }} />)
  }
  return <>{celdas}</>
}

function FilaTarea({ tarea: t, nivel, px, dias, inicioRango, escala, barra, par, color, miembro, subtareas, arrastrando, onAbrir, onAlternar, onEmpezar, onCrearBarra }: {
  tarea: Tarea; nivel: number; px: number; dias: number; inicioRango: string; escala: Vista['escala']
  barra: { inicio: string; vence: string; left: number; width: number } | null; par: boolean; color: string
  miembro: ReturnType<ReturnType<typeof useApp>['miembro']>; subtareas: Tarea[]; arrastrando: boolean
  onAbrir: () => void; onAlternar: () => void; onEmpezar: (e: React.PointerEvent, t: Tarea, modo: 'mover' | 'inicio' | 'fin') => void; onCrearBarra: (x: number) => void
}) {
  const pct = subtareas.length ? Math.round((subtareas.filter(s => s.estado === 'hecha').length / subtareas.length) * 100) : t.checklist.length ? Math.round((t.checklist.filter(c => c.hecho).length / t.checklist.length) * 100) : t.estado === 'hecha' ? 100 : 0
  const vencida = t.vence && t.vence < hoy() && t.estado !== 'hecha'
  return (
    <div className={`gantt-fila ${par ? 'par' : ''} ${t.estado === 'hecha' ? 'hecha' : ''}`} style={{ height: ALTO_FILA }}>
      <div className="gantt-izq" style={{ paddingLeft: 12 + nivel * 18 }} onClick={onAbrir}>
        <span className={`check ${t.estado === 'hecha' ? 'hecho' : ''}`} title={t.estado === 'hecha' ? 'Marcar como pendiente' : 'Marcar como hecha'}
          onPointerDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); onAlternar() }}><Check size={10} strokeWidth={3} /></span>
        <Avatar miembro={miembro} tamano="pequeno" />
        <span className="texto" title={t.titulo}>{t.titulo}</span>
        {barra && <span className="fechas">{format(parseISO(barra.inicio), 'd MMM', { locale: es })} – {format(parseISO(barra.vence), 'd MMM', { locale: es })}</span>}
      </div>
      <div className="gantt-der" style={{ width: dias * px }} onClick={e => { if (!barra) onCrearBarra(e.nativeEvent.offsetX) }} title={barra ? undefined : 'Clic para planificar en este día'}>
        <Fondo dias={dias} px={px} inicioRango={inicioRango} escala={escala} />
        {barra ? (
          <div className={`g-barra ${arrastrando ? 'arrastrando' : ''} ${vencida ? 'vencida' : ''} ${t.estado === 'hecha' ? 'hecha' : ''}`} style={{ left: barra.left, width: Math.max(px, barra.width), ['--col' as string]: color }}
            onPointerDown={e => onEmpezar(e, t, 'mover')} onDoubleClick={onAbrir} title={`${t.titulo}\n${barra.inicio} → ${barra.vence}`}>
            <i className="g-progreso" style={{ width: `${pct}%` }} />
            <span className="g-asa izq" onPointerDown={e => onEmpezar(e, t, 'inicio')} />
            <span className="g-texto">{barra.width > 60 ? t.titulo : ''}</span>
            <span className="g-asa der" onPointerDown={e => onEmpezar(e, t, 'fin')} />
          </div>
        ) : <span className="g-sinfecha">Sin fechas · clic para planificar</span>}
      </div>
    </div>
  )
}

export { aIso, addDays }
