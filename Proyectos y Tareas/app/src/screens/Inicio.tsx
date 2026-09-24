/**
 * Inicio: resumen de la semana, «en qué centrarte hoy» (reglas sobre los
 * datos), lo que tengo que revisar y el pulso del equipo.
 */
import { useMemo } from 'react'
import {
  AlertTriangle, ArrowRight, CalendarCheck, Check, CheckCircle2, Flag, Sparkles, Sun, Target, TrendingUp, Unplug,
} from 'lucide-react'
import { Area, AreaChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useApp } from '../store'
import { Anillo, Avatar, ChipProyecto, Progreso, Vacio } from '../ui/basicos'
import { avanceObjetivo, cargaPorMiembro, resumenSemana, serieCumplimiento, tareasPorEstado } from '../domain/metricas'
import { esVencida, etiquetaSemana, etiquetaSemanaCorta, fechaLarga, hoy, lunesDe, relativoVencimiento, sumarDias } from '../domain/fechas'
import { COLOR_ESTADO } from '../domain/vistas'

interface Foco { icono: typeof Flag; tono: 'error' | 'aviso' | 'acento' | 'ok'; titulo: string; texto: string; accion?: { texto: string; ir: () => void } }

export default function Inicio({ abrirTarea }: { abrirTarea: (id: string) => void }) {
  const { datos, yo, proyecto, setPantalla, setSemanaSel, alternarHecha } = useApp()
  const lunes = lunesDe(hoy())
  const semana = datos.semanas.find(s => s.inicio === lunes)
  const resumen = semana ? resumenSemana(semana, datos.objetivos) : null
  const anterior = datos.semanas.find(s => s.inicio === sumarDias(lunes, -7))
  const resumenAnterior = anterior ? resumenSemana(anterior, datos.objetivos) : null
  const irSemana = () => { setSemanaSel(lunes); setPantalla('objetivos') }

  const mias = useMemo(() => datos.tareas.filter(t => t.asignadoId === yo!.id && t.estado !== 'hecha'), [datos.tareas, yo])
  const misHoy = useMemo(() => mias.filter(t => t.miDia || (t.vence && t.vence <= hoy())).sort((a, b) => (a.vence ?? '9').localeCompare(b.vence ?? '9')), [mias])
  const misObjetivos = useMemo(() => semana ? datos.objetivos.filter(o => o.semanaId === semana.id && o.responsableId === yo!.id) : [], [datos.objetivos, semana, yo])
  const vencidas = datos.tareas.filter(t => t.estado !== 'hecha' && !t.personal && !t.padreId && esVencida(t.vence))
  const carga = cargaPorMiembro(datos.miembros, datos.tareas, lunes)
  const serie = serieCumplimiento(datos.semanas.filter(s => datos.objetivos.some(o => o.semanaId === s.id)), datos.objetivos, datos.miembros, 8)
  const porEstado = tareasPorEstado(datos.tareas).filter(x => x.valor > 0)
  const hechasSemana = carga.reduce((s, c) => s + c.hechasSemana, 0)

  // ─────────────────────────────────────────── en qué centrarte (reglas)
  const focos: Foco[] = useMemo(() => {
    const f: Foco[] = []
    const diaSemana = new Date().getDay() // 0 dom … 6 sáb
    const misVencidas = mias.filter(t => !t.personal && esVencida(t.vence))
    const bloqueadas = mias.filter(t => t.estado === 'bloqueada')
    if (!misObjetivos.length) {
      f.push({ icono: Target, tono: 'acento', titulo: 'Aún no tienes objetivos esta semana', texto: 'Apunta dos o tres cosas que quieras sacar adelante.', accion: { texto: 'Ir a objetivos', ir: irSemana } })
    }
    if (misVencidas.length) f.push({ icono: AlertTriangle, tono: 'error', titulo: `${misVencidas.length} tarea(s) tuya(s) fuera de plazo`, texto: misVencidas.slice(0, 3).map(t => t.titulo).join(' · '), accion: { texto: 'Ver', ir: () => abrirTarea(misVencidas[0].id) } })
    if (bloqueadas.length) f.push({ icono: Unplug, tono: 'error', titulo: `${bloqueadas.length} tarea(s) bloqueada(s)`, texto: 'Desbloquéalas o pide ayuda en los comentarios: ' + bloqueadas.map(t => t.titulo).join(' · '), accion: { texto: 'Abrir', ir: () => abrirTarea(bloqueadas[0].id) } })
    const aceptadosAlta = misObjetivos.filter(o => o.estado === 'pendiente').sort((a, b) => (a.prioridad === 'alta' ? -1 : 1) - (b.prioridad === 'alta' ? -1 : 1))
    for (const o of aceptadosAlta.slice(0, 2)) {
      const av = avanceObjetivo(o, datos.tareas)
      if (av.total === 0) f.push({ icono: Flag, tono: 'aviso', titulo: `«${o.titulo}» no tiene tareas`, texto: 'Un objetivo sin tareas no avanza. Crea las tareas que lo consiguen y enlázalas.', accion: { texto: 'Tareas', ir: () => setPantalla('tareas') } })
      else if (av.pct < 50 && diaSemana >= 3) f.push({ icono: Flag, tono: 'aviso', titulo: `«${o.titulo}» va al ${av.pct}%`, texto: `Es ${o.prioridad === 'alta' ? 'prioridad alta y ' : ''}ya es ${['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'][diaSemana]}. Céntrate en sus ${av.total - av.hechas} tareas pendientes.` })
    }
    const enCurso = mias.filter(t => t.estado === 'en_curso' && !t.personal)
    if (enCurso.length > 3) f.push({ icono: Sparkles, tono: 'aviso', titulo: `Tienes ${enCurso.length} tareas en curso a la vez`, texto: 'Termina antes de empezar: elige una o dos y devuelve el resto a «Por hacer».' })
    const sinCumplir = misObjetivos.filter(o => o.estado === 'pendiente')
    if (diaSemana >= 5 && sinCumplir.length) f.push({ icono: Flag, tono: 'acento', titulo: `Te quedan ${sinCumplir.length} objetivo(s) por marcar`, texto: 'Es final de semana: repasa cuáles has cumplido.', accion: { texto: 'Ver objetivos', ir: irSemana } })
    if (!f.length) f.push({ icono: CheckCircle2, tono: 'ok', titulo: 'Todo en orden', texto: misHoy.length ? `Sigue con lo de hoy: ${misHoy[0].titulo}.` : 'Nada urgente. Buen momento para adelantar el objetivo más importante de la semana.' })
    return f.slice(0, 5)
  }, [mias, misObjetivos, semana, datos.tareas, misHoy]) // eslint-disable-line react-hooks/exhaustive-deps

  const resumenTexto = useMemo(() => {
    const partes: string[] = []
    if (resumen) {
      partes.push(`La semana tiene ${resumen.total} objetivo(s)${resumen.pendientes ? `, ${resumen.pendientes} sin cumplir todavía` : ''}.`)
      if (resumen.cumplidos) partes.push(`Ya se han cumplido ${resumen.cumplidos}.`)
    }
    partes.push(`El equipo ha cerrado ${hechasSemana} tareas esta semana y tiene ${vencidas.length} fuera de plazo.`)
    if (resumenAnterior?.cumplimiento != null) partes.push(`La semana pasada se cumplió el ${resumenAnterior.cumplimiento}%.`)
    return partes.join(' ')
  }, [resumen, hechasSemana, vencidas.length, resumenAnterior])

  return (
    <div className="pagina">
      {/* Cabecera como en el resto de code apps de locodea.: la fecha de
          antetítulo, un saludo de una frase con punto y el estado de la semana. */}
      <div className="titulo-pagina">
        <div>
          <div className="antetitulo">{fechaLarga(hoy())}</div>
          <h1>{saludo()}, {yo!.nombre.split(' ')[0]}.</h1>
          <div className="sub">{etiquetaSemana(lunes)}{resumen && resumen.total > 0 && ` · ${resumen.cumplidos} de ${resumen.total} objetivos cumplidos`}.</div>
        </div>
        <div className="acciones">
          {!misObjetivos.length && <button className="btn primario" onClick={irSemana}><Target size={15} /> Añadir objetivos</button>}
          <button className="btn" onClick={() => setPantalla('tareas')}><Sun size={15} /> Tareas</button>
        </div>
      </div>

      <div className="rejilla dos-uno" style={{ marginBottom: 16 }}>
        <div className="tarjeta padded foco anim-aparecer retraso-1">
          <div className="tarjeta-cabecera">
            <div><h3><Sparkles size={16} style={{ verticalAlign: -3, color: 'var(--acento)' }} /> En qué centrarte hoy</h3><div className="sub">{resumenTexto}</div></div>
          </div>
          <div className="focos">
            {focos.map((f, i) => (
              <div key={i} className={`foco-item ${f.tono}`}>
                <span className="ico"><f.icono size={16} /></span>
                <div className="texto"><b>{f.titulo}</b><p>{f.texto}</p></div>
                {f.accion && <button className="btn pequeno" onClick={f.accion.ir}>{f.accion.texto} <ArrowRight size={12} /></button>}
              </div>
            ))}
          </div>
        </div>
        <div className="kpis" style={{ marginBottom: 0, gridTemplateColumns: '1fr 1fr' }}>
          <div className="tarjeta kpi anim-aparecer retraso-1">
            <div className="etiqueta"><span className="ico"><Target size={14} /></span>Objetivos</div>
            <div className="valor">{resumen?.cumplidos ?? 0}<small>cumplidos</small></div>
            <div className="pie">de {resumen?.total ?? 0} esta semana</div>
          </div>
          <div className="tarjeta kpi anim-aparecer retraso-2">
            <div className="etiqueta"><span className="ico" style={{ background: 'var(--ok-suave)', color: 'var(--ok)' }}><CalendarCheck size={14} /></span>Última semana</div>
            <div className="valor">{resumenAnterior?.cumplimiento ?? '–'}<small>%</small></div>
            <div className={`pie ${resumenAnterior && resumenAnterior.cumplimiento !== null ? (resumenAnterior.cumplimiento >= 70 ? 'ok' : 'mal') : ''}`}>{resumenAnterior ? `${resumenAnterior.cumplidos} de ${resumenAnterior.total}` : 'sin datos'}</div>
          </div>
          <div className="tarjeta kpi anim-aparecer retraso-3">
            <div className="etiqueta"><span className="ico" style={{ background: 'var(--morado-suave)', color: 'var(--morado)' }}><CheckCircle2 size={14} /></span>Hechas esta semana</div>
            <div className="valor">{hechasSemana}</div>
            <div className="pie">{datos.tareas.filter(t => t.estado === 'en_curso' && !t.personal).length} en curso</div>
          </div>
          <div className="tarjeta kpi anim-aparecer retraso-4">
            <div className="etiqueta"><span className="ico" style={{ background: vencidas.length ? 'var(--error-suave)' : 'var(--ok-suave)', color: vencidas.length ? 'var(--error)' : 'var(--ok)' }}><AlertTriangle size={14} /></span>Vencidas</div>
            <div className="valor" style={{ color: vencidas.length ? 'var(--error)' : undefined }}>{vencidas.length}</div>
            <div className="pie">{vencidas.filter(t => t.asignadoId === yo!.id).length} son tuyas</div>
          </div>
        </div>
      </div>

      <div className="rejilla dos-uno">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="tarjeta padded anim-aparecer retraso-2">
            <div className="tarjeta-cabecera">
              <div><h3>Hoy</h3><div className="sub">Tareas marcadas para hoy y las que vencen</div></div>
            </div>
            {misHoy.length === 0 ? <Vacio icono={<Sun size={32} />} titulo="Nada marcado para hoy" texto="Añade tareas a Mi día desde el pop-up de abajo a la derecha." /> : (
              <div className="lista-simple">
                {misHoy.slice(0, 6).map(t => {
                  const v = t.vence ? relativoVencimiento(t.vence) : null
                  return (
                    <div key={t.id} style={{ cursor: 'pointer' }} onClick={() => abrirTarea(t.id)}>
                      <span className={`check ${t.estado === 'hecha' ? 'hecho' : ''}`} title="Marcar como hecha" onClick={e => { e.stopPropagation(); void alternarHecha(t.id) }}><Check size={11} strokeWidth={3} /></span>
                      <span style={{ flex: 1, fontWeight: 500 }}>{t.titulo}</span>
                      <ChipProyecto proyecto={proyecto(t.proyectoId)} />
                      {v && <span className={`vence ${v.tono}`} style={{ fontSize: 12 }}>{v.texto}</span>}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="tarjeta padded anim-aparecer retraso-3">
            <div className="tarjeta-cabecera">
              <div><h3>Mis objetivos de la semana</h3><div className="sub">Avance según las tareas enlazadas</div></div>
              <button className="btn sutil pequeno" onClick={irSemana}>Objetivos <ArrowRight size={13} /></button>
            </div>
            {misObjetivos.length === 0 ? <Vacio icono={<Target size={32} />} titulo="Sin objetivos esta semana" accion={<button className="btn primario pequeno" onClick={irSemana}>Proponer objetivos</button>} /> : (
              <div className="lista-simple">
                {misObjetivos.map(o => {
                  const av = avanceObjetivo(o, datos.tareas)
                  return (
                    <div key={o.id}>
                      <span className={`chip pequeno ${o.estado === 'cumplido' ? 'ok' : ''}`}>{o.estado === 'cumplido' ? 'Cumplido' : 'Pendiente'}</span>
                      <span style={{ flex: 1, fontWeight: 500 }}>{o.titulo}</span>
                      <div style={{ width: 120 }}><Progreso pct={av.pct} tono={av.pct === 100 ? 'ok' : undefined} /></div>
                      <span style={{ fontSize: 12, color: 'var(--texto-3)', width: 44, textAlign: 'right' }}>{av.hechas}/{av.total}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="tarjeta padded anim-aparecer retraso-4">
            <div className="tarjeta-cabecera">
              <div><h3>Cumplimiento semanal del equipo</h3><div className="sub">% de objetivos cumplidos en las semanas cerradas</div></div>
              <button className="btn sutil pequeno" onClick={() => setPantalla('analisis')}>Análisis <ArrowRight size={13} /></button>
            </div>
            {serie.length < 2 ? <Vacio icono={<TrendingUp size={32} />} titulo="Aún no hay histórico suficiente" /> : (
              <div className="grafico" style={{ height: 200 }}>
                <ResponsiveContainer>
                  <AreaChart data={serie} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                    <defs><linearGradient id="gEquipo" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--bronze)" stopOpacity=".25" /><stop offset="100%" stopColor="var(--bronze)" stopOpacity="0" /></linearGradient></defs>
                    <XAxis dataKey="semana" tickFormatter={etiquetaSemanaCorta} tick={{ fontSize: 11, fill: 'var(--faint)' }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: 'var(--faint)' }} axisLine={false} tickLine={false} />
                    <Tooltip content={({ active, payload, label }) => active && payload?.length ? <div className="tooltip-grafico"><b>{etiquetaSemana(String(label))}</b><div>Equipo: {payload[0].value}%</div></div> : null} />
                    <Area type="monotone" dataKey="equipo" stroke="var(--bronze)" strokeWidth={2.5} fill="url(#gEquipo)" dot={{ r: 3, fill: 'var(--bronze)' }} isAnimationActive />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          <div className="tarjeta padded anim-aparecer retraso-3">
            <div className="tarjeta-cabecera"><div><h3>Carga del equipo</h3><div className="sub">Tareas abiertas por persona</div></div></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {carga.map(c => (
                <div key={c.miembro.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Avatar miembro={c.miembro} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}><b>{c.miembro.nombre.split(' ')[0]}</b><span style={{ color: 'var(--texto-3)' }}>{c.abiertas} abiertas · {c.enCurso} en curso</span></div>
                    <Progreso pct={Math.min(100, (c.abiertas / 12) * 100)} tono={c.vencidas ? 'error' : c.abiertas > 9 ? 'aviso' : undefined} />
                  </div>
                  {c.vencidas > 0 && <span className="chip error pequeno">{c.vencidas} vencidas</span>}
                </div>
              ))}
            </div>
          </div>

          <div className="tarjeta padded anim-aparecer retraso-4">
            <div className="tarjeta-cabecera"><div><h3>Tareas por estado</h3><div className="sub">Todo el equipo, sin personales</div></div></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 140, height: 140 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={porEstado} dataKey="valor" nameKey="nombre" innerRadius={42} outerRadius={64} paddingAngle={2} stroke="none">
                      {porEstado.map(e => <Cell key={e.estado} fill={COLOR_ESTADO[e.estado as keyof typeof COLOR_ESTADO]} />)}
                    </Pie>
                    <Tooltip content={({ active, payload }) => active && payload?.length ? <div className="tooltip-grafico"><b>{payload[0].name}</b>{payload[0].value} tareas</div> : null} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="leyenda" style={{ flexDirection: 'column', gap: 6 }}>
                {porEstado.map(e => <span key={e.estado}><i style={{ background: COLOR_ESTADO[e.estado as keyof typeof COLOR_ESTADO] }} />{e.nombre} <b style={{ marginLeft: 'auto', paddingLeft: 10 }}>{e.valor}</b></span>)}
              </div>
            </div>
          </div>

          {resumen && (
            <div className="tarjeta padded anim-aparecer retraso-5" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <Anillo pct={resumen.cumplimiento ?? 0} tamano={64} />
              <div><b>Semana en curso</b><div style={{ fontSize: 12, color: 'var(--texto-3)' }}>{resumen.cumplidos} cumplidos de {resumen.total}</div></div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function saludo(): string {
  const h = new Date().getHours()
  return h < 14 ? 'Buenos días' : h < 21 ? 'Buenas tardes' : 'Buenas noches'
}
