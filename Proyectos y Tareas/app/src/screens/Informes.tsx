/**
 * Informes en PDF. Se generan como una página de impresión limpia (solo se
 * imprime el informe) y el navegador la guarda como PDF con «Imprimir».
 */
import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, FileDown, Printer } from 'lucide-react'
import { useApp } from '../store'
import { Avatar, SelectProyecto } from '../ui/basicos'
import { Select } from '../ui/Select'
import { resumenSemana, saludProyectos, avanceObjetivo } from '../domain/metricas'
import { etiquetaSemana, etiquetaSemanaCorta, fechaCorta, fechaLarga, hoy, lunesDe, sumarDias } from '../domain/fechas'
import { ETIQUETA_ESTADO_OBJETIVO, ETIQUETA_ESTADO_TAREA, ETIQUETA_PRIORIDAD, ORDEN_ESTADOS_TAREA } from '../domain/types'

type Tipo = 'semana' | 'proyecto' | 'equipo'
const TIPOS: { valor: Tipo; etiqueta: string; detalle: string }[] = [
  { valor: 'semana', etiqueta: 'Informe semanal', detalle: 'objetivos y evaluación' },
  { valor: 'proyecto', etiqueta: 'Informe de proyecto', detalle: 'tareas por estado' },
  { valor: 'equipo', etiqueta: 'Rendimiento del equipo', detalle: 'últimas semanas' },
]

export default function Informes(_: { abrirTarea: (id: string) => void }) {
  const { datos, yo } = useApp()
  const [tipo, setTipo] = useState<Tipo>('semana')
  const [lunes, setLunes] = useState(lunesDe(hoy()))
  const [proyectoId, setProyectoId] = useState<string | null>(datos.proyectos[0]?.id ?? null)
  const [rango, setRango] = useState<'4' | '8' | '12'>('8')

  return (
    <div className="pagina">
      <div className="titulo-pagina no-imprimir">
        <div><h1>Informes.</h1><div className="sub">Elige el informe, revísalo y guárdalo en PDF con el botón de imprimir (destino «Guardar como PDF»).</div></div>
        <div className="acciones">
          <button className="btn primario" onClick={() => window.print()}><Printer size={15} /> Imprimir / Guardar PDF</button>
        </div>
      </div>

      <div className="herramientas no-imprimir">
        <Select valor={tipo} onCambio={setTipo} opciones={TIPOS} ancho={260} />
        {tipo === 'semana' && (
          <div className="semana-nav">
            <button className="btn sutil icono pequeno" onClick={() => setLunes(sumarDias(lunes, -7))}><ChevronLeft size={16} /></button>
            <span className="nombre">{etiquetaSemana(lunes)}</span>
            <button className="btn sutil icono pequeno" onClick={() => setLunes(sumarDias(lunes, 7))}><ChevronRight size={16} /></button>
          </div>
        )}
        {tipo === 'proyecto' && <SelectProyecto valor={proyectoId} onCambio={setProyectoId} textoNinguno="Elige un proyecto" ancho={260} />}
        {tipo === 'equipo' && <Select valor={rango} onCambio={setRango} opciones={[{ valor: '4', etiqueta: 'Últimas 4 semanas' }, { valor: '8', etiqueta: 'Últimas 8 semanas' }, { valor: '12', etiqueta: 'Últimas 12 semanas' }]} ancho={200} />}
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--texto-3)' }}><FileDown size={12} style={{ verticalAlign: -2 }} /> Se imprime solo el informe, en A4</span>
      </div>

      <div className="informe tarjeta">
        <div className="informe-cabecera">
          <div className="marca"><span className="logo">L</span><b>Locodea</b></div>
          <div className="meta">Generado el {fechaLarga(hoy())} por {yo?.nombre}</div>
        </div>
        {tipo === 'semana' && <InformeSemana lunes={lunes} />}
        {tipo === 'proyecto' && proyectoId && <InformeProyecto proyectoId={proyectoId} />}
        {tipo === 'equipo' && <InformeEquipo n={Number(rango)} />}
      </div>
    </div>
  )
}

function InformeSemana({ lunes }: { lunes: string }) {
  const { datos, proyecto } = useApp()
  const semana = datos.semanas.find(s => s.inicio === lunes)
  if (!semana) return <p className="vacio">No hay datos para esta semana.</p>
  const r = resumenSemana(semana, datos.objetivos)
  const objetivos = datos.objetivos.filter(o => o.semanaId === semana.id).sort((a, b) => (a.responsableId ?? '').localeCompare(b.responsableId ?? '') || a.orden - b.orden)
  const miembros = datos.miembros.filter(m => objetivos.some(o => o.responsableId === m.id))
  return (
    <>
      <h1>Informe semanal · {etiquetaSemana(lunes)}</h1>
      <div className="informe-kpis">
        <div><b>{r.total}</b><span>objetivos</span></div>
        <div><b>{r.cumplidos}</b><span>cumplidos</span></div>
        <div><b>{r.pendientes}</b><span>pendientes</span></div>
        <div><b>{r.cumplimiento ?? '–'}%</b><span>cumplimiento</span></div>
      </div>
      {miembros.map(m => {
        const rm = resumenSemana(semana, datos.objetivos, m.id)
        return (
          <div key={m.id} className="informe-bloque">
            <h2><Avatar miembro={m} tamano="pequeno" /> {m.nombre} <small>{rm.cumplidos}/{rm.total} cumplidos{rm.cumplimiento !== null && ` · ${rm.cumplimiento}%`}</small></h2>
            <table className="tabla">
              <thead><tr><th>Objetivo</th><th>Proyecto</th><th>Prioridad</th><th>Estado</th><th>Tareas</th></tr></thead>
              <tbody>
                {objetivos.filter(o => o.responsableId === m.id).map(o => {
                  const av = avanceObjetivo(o, datos.tareas)
                  return (
                    <tr key={o.id}>
                      <td><b>{o.titulo}</b>{o.descripcion && <div className="peq">{o.descripcion}</div>}</td>
                      <td>{proyecto(o.proyectoId)?.nombre ?? '—'}</td>
                      <td>{ETIQUETA_PRIORIDAD[o.prioridad]}</td>
                      <td><span className={`chip pequeno ${o.estado === 'cumplido' ? 'ok' : ''}`}>{ETIQUETA_ESTADO_OBJETIVO[o.estado]}</span></td>
                      <td>{av.hechas}/{av.total}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      })}
    </>
  )
}

function InformeProyecto({ proyectoId }: { proyectoId: string }) {
  const { datos, miembro, subtareasDe } = useApp()
  const p = datos.proyectos.find(x => x.id === proyectoId)
  if (!p) return null
  const s = saludProyectos([p], datos.tareas, datos.objetivos)[0]
  const tareas = datos.tareas.filter(t => t.proyectoId === p.id && !t.padreId)
  const objetivos = datos.objetivos.filter(o => o.proyectoId === p.id)
  return (
    <>
      <h1><i className="punto-proyecto" style={{ background: p.color, width: 14, height: 14, borderRadius: 4 }} /> {p.nombre} <small>· {p.cliente}</small></h1>
      <p className="sub">{p.descripcion}{p.fechaInicio && ` · ${fechaCorta(p.fechaInicio)} → ${p.fechaFin ? fechaCorta(p.fechaFin) : '…'}`} · responsable {miembro(p.responsableId)?.nombre ?? '—'}</p>
      <div className="informe-kpis">
        <div><b>{s.pct}%</b><span>avance</span></div>
        <div><b>{s.hechas}/{s.total}</b><span>tareas hechas</span></div>
        <div><b>{s.vencidas}</b><span>vencidas</span></div>
        <div><b>{s.objetivosAbiertos}</b><span>objetivos abiertos</span></div>
      </div>
      {ORDEN_ESTADOS_TAREA.map(e => {
        const lista = tareas.filter(t => t.estado === e)
        if (!lista.length) return null
        return (
          <div key={e} className="informe-bloque">
            <h2>{ETIQUETA_ESTADO_TAREA[e]} <small>{lista.length}</small></h2>
            <table className="tabla">
              <thead><tr><th>Tarea</th><th>Asignada a</th><th>Prioridad</th><th>Inicio</th><th>Vence</th><th>Subtareas</th></tr></thead>
              <tbody>
                {lista.map(t => { const subs = subtareasDe(t.id); return (
                  <tr key={t.id}>
                    <td><b>{t.titulo}</b>{t.descripcion && <div className="peq">{t.descripcion}</div>}</td>
                    <td>{miembro(t.asignadoId)?.nombre ?? '—'}</td>
                    <td>{ETIQUETA_PRIORIDAD[t.prioridad]}</td>
                    <td>{t.inicio ? fechaCorta(t.inicio) : '—'}</td>
                    <td>{t.vence ? fechaCorta(t.vence) : '—'}</td>
                    <td>{subs.length ? `${subs.filter(x => x.estado === 'hecha').length}/${subs.length}` : '—'}</td>
                  </tr>
                ) })}
              </tbody>
            </table>
          </div>
        )
      })}
      {objetivos.length > 0 && (
        <div className="informe-bloque">
          <h2>Objetivos semanales del proyecto</h2>
          <table className="tabla">
            <thead><tr><th>Semana</th><th>Objetivo</th><th>Responsable</th><th>Estado</th></tr></thead>
            <tbody>
              {objetivos.map(o => <tr key={o.id}><td>{etiquetaSemanaCorta(datos.semanas.find(s => s.id === o.semanaId)?.inicio ?? '')}</td><td>{o.titulo}</td><td>{miembro(o.responsableId)?.nombre}</td><td>{ETIQUETA_ESTADO_OBJETIVO[o.estado]}</td></tr>)}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

function InformeEquipo({ n }: { n: number }) {
  const { datos } = useApp()
  const conObjetivos = useMemo(() => datos.semanas
    .filter(s => datos.objetivos.some(o => o.semanaId === s.id))
    .sort((a, b) => a.inicio.localeCompare(b.inicio)).slice(-n), [datos.semanas, datos.objetivos, n])
  const miembros = datos.miembros.filter(m => m.activo)
  const salud = saludProyectos(datos.proyectos.filter(p => p.estado !== 'cerrado'), datos.tareas, datos.objetivos)
  return (
    <>
      <h1>Rendimiento del equipo <small>· últimas {n} semanas</small></h1>
      <p className="sub">{conObjetivos.length ? `${etiquetaSemanaCorta(conObjetivos[0].inicio)} a ${etiquetaSemanaCorta(conObjetivos.at(-1)!.inicio)}` : 'Todavía sin objetivos'}</p>
      <div className="informe-bloque">
        <h2>Cumplimiento por persona</h2>
        <table className="tabla">
          <thead><tr><th>Persona</th><th>Objetivos</th><th>Cumplidos</th><th>Pendientes</th><th>% cumplimiento</th><th>Tareas hechas</th></tr></thead>
          <tbody>
            {miembros.map(m => {
              const objs = datos.objetivos.filter(o => o.responsableId === m.id && conObjetivos.some(s => s.id === o.semanaId))
              const c = objs.filter(o => o.estado === 'cumplido').length
              return (
                <tr key={m.id}>
                  <td><b>{m.nombre}</b></td><td>{objs.length}</td><td>{c}</td><td>{objs.length - c}</td>
                  <td><b>{objs.length ? Math.round((c / objs.length) * 100) : '–'}%</b></td>
                  <td>{datos.tareas.filter(t => t.asignadoId === m.id && !t.personal && t.estado === 'hecha').length}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="informe-bloque">
        <h2>Semana a semana</h2>
        <table className="tabla">
          <thead><tr><th>Semana</th><th>Objetivos</th><th>Cumplidos</th><th>Pendientes</th><th>%</th>{miembros.map(m => <th key={m.id}>{m.nombre.split(' ')[0]}</th>)}</tr></thead>
          <tbody>
            {conObjetivos.map(s => { const r = resumenSemana(s, datos.objetivos); return (
              <tr key={s.id}><td>{etiquetaSemanaCorta(s.inicio)}</td><td>{r.total}</td><td>{r.cumplidos}</td><td>{r.pendientes}</td><td><b>{r.cumplimiento ?? '–'}%</b></td>
                {miembros.map(m => <td key={m.id}>{resumenSemana(s, datos.objetivos, m.id).cumplimiento ?? '–'}%</td>)}</tr>
            ) })}
          </tbody>
        </table>
      </div>
      <div className="informe-bloque">
        <h2>Salud de proyectos</h2>
        <table className="tabla">
          <thead><tr><th>Proyecto</th><th>Cliente</th><th>Tareas hechas</th><th>Vencidas</th><th>Avance</th></tr></thead>
          <tbody>{salud.map(s => <tr key={s.proyecto.id}><td><b>{s.proyecto.nombre}</b></td><td>{s.proyecto.cliente}</td><td>{s.hechas}/{s.total}</td><td>{s.vencidas}</td><td><b>{s.pct}%</b></td></tr>)}</tbody>
        </table>
      </div>
    </>
  )
}
