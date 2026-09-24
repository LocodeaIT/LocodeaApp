/**
 * Análisis: rendimiento por persona y por semana. Es la pantalla con la que
 * se ve, con datos, si se está trabajando en lo acordado.
 */
import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { FileText, TrendingUp } from 'lucide-react'
import { useApp } from '../store'
import { Anillo, Avatar, Vacio } from '../ui/basicos'
import { cargaPorMiembro, resumenSemana, saludProyectos, serieCumplimiento, serieVelocidad } from '../domain/metricas'
import { etiquetaSemana, etiquetaSemanaCorta, hoy, lunesDe } from '../domain/fechas'

export default function Analisis(_: { abrirTarea: (id: string) => void }) {
  const { datos, miembro, setPantalla } = useApp()
  const [rango, setRango] = useState<4 | 8 | 12>(8)
  const miembros = datos.miembros.filter(m => m.activo)
  const conObjetivos = useMemo(() => datos.semanas
    .filter(s => datos.objetivos.some(o => o.semanaId === s.id))
    .sort((a, b) => a.inicio.localeCompare(b.inicio)), [datos.semanas, datos.objetivos])
  const ultimas = conObjetivos.slice(-rango)
  const cumplimiento = serieCumplimiento(ultimas, datos.objetivos, miembros, rango)
  const velocidad = serieVelocidad(datos.tareas, miembros, rango)
  const carga = cargaPorMiembro(miembros, datos.tareas, lunesDe(hoy()))
  const salud = saludProyectos(datos.proyectos.filter(p => p.estado !== 'cerrado'), datos.tareas, datos.objetivos)

  const porPersona = miembros.map(m => {
    const objs = datos.objetivos.filter(o => o.responsableId === m.id && ultimas.some(s => s.id === o.semanaId))
    const cumplidos = objs.filter(o => o.estado === 'cumplido').length
    const tareas = datos.tareas.filter(t => t.asignadoId === m.id && !t.personal)
    return {
      miembro: m,
      total: objs.length,
      pendientes: objs.length - cumplidos,
      cumplidos,
      cumplimiento: objs.length ? Math.round((cumplidos / objs.length) * 100) : null,
      hechas: tareas.filter(t => t.estado === 'hecha').length,
      abiertas: tareas.filter(t => t.estado !== 'hecha').length,
    }
  })

  const Tip = ({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number | null; color: string }[]; label?: string }) => active && payload?.length ? (
    <div className="tooltip-grafico"><b>{etiquetaSemana(String(label))}</b>{payload.map(p => <div key={p.name}><i style={{ width: 8, height: 8, borderRadius: 2, background: p.color, display: 'inline-block' }} />{miembro(p.name)?.nombre ?? 'Equipo'}: {p.value ?? '–'}</div>)}</div>
  ) : null

  return (
    <div className="pagina">
      <div className="titulo-pagina">
        <div><h1>Análisis.</h1><div className="sub">Cumplimiento de objetivos, ritmo de tareas y salud de los proyectos</div></div>
        <div className="acciones">
          <div className="selector">{([4, 8, 12] as const).map(r => <button key={r} className={rango === r ? 'activo' : ''} onClick={() => setRango(r)}>{r} semanas</button>)}</div>
          <button className="btn" onClick={() => setPantalla('informes')}><FileText size={14} /> Informes PDF</button>
        </div>
      </div>

      <div className="rejilla tres" style={{ marginBottom: 16 }}>
        {porPersona.map((p, i) => (
          <div key={p.miembro.id} className={`tarjeta padded anim-aparecer retraso-${i + 1}`} style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <Anillo pct={p.cumplimiento} tamano={72} color={p.miembro.color} />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}><Avatar miembro={p.miembro} tamano="pequeno" /><b>{p.miembro.nombre}</b></div>
              <div style={{ fontSize: 12, color: 'var(--texto-2)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 10px' }}>
                <span>{p.cumplidos} cumplidos</span><span>{p.pendientes} pendientes</span>
                <span>{p.total} en total</span>
                <span>{p.hechas} tareas hechas</span><span>{p.abiertas} abiertas</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="rejilla dos" style={{ marginBottom: 16 }}>
        <div className="tarjeta padded">
          <div className="tarjeta-cabecera"><div><h3>Cumplimiento de objetivos por semana</h3><div className="sub">% de objetivos aceptados que se cumplieron</div></div></div>
          {cumplimiento.length < 2 ? <Vacio icono={<TrendingUp size={32} />} titulo="Hacen falta al menos dos semanas cerradas" /> : (
            <div className="grafico alto">
              <ResponsiveContainer>
                <LineChart data={cumplimiento} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="var(--grid)" />
                  <XAxis dataKey="semana" tickFormatter={etiquetaSemanaCorta} tick={{ fontSize: 11, fill: 'var(--faint)' }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: 'var(--faint)' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<Tip />} />
                  <Legend formatter={v => miembro(v)?.nombre.split(' ')[0] ?? 'Equipo'} iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="equipo" stroke="var(--ink)" strokeWidth={3} dot={{ r: 3 }} connectNulls />
                  {miembros.map(m => <Line key={m.id} type="monotone" dataKey={m.id} stroke={m.color} strokeWidth={2} dot={{ r: 2 }} strokeDasharray="4 3" connectNulls />)}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
        <div className="tarjeta padded">
          <div className="tarjeta-cabecera"><div><h3>Tareas completadas por semana</h3><div className="sub">Ritmo de cada persona</div></div></div>
          <div className="grafico alto">
            <ResponsiveContainer>
              <BarChart data={velocidad} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--grid)" />
                <XAxis dataKey="semana" tickFormatter={etiquetaSemanaCorta} tick={{ fontSize: 11, fill: 'var(--faint)' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--faint)' }} axisLine={false} tickLine={false} />
                <Tooltip content={<Tip />} cursor={{ fill: 'var(--sand-2)' }} />
                <Legend formatter={v => miembro(v)?.nombre.split(' ')[0] ?? v} iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                {miembros.map(m => <Bar key={m.id} dataKey={m.id} stackId="a" fill={m.color} radius={[3, 3, 0, 0]} />)}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="rejilla dos">
        <div className="tarjeta">
          <div className="tarjeta-cabecera" style={{ padding: '16px 16px 0' }}><div><h3>Histórico de semanas</h3><div className="sub">Objetivos cumplidos en cada semana</div></div></div>
          <table className="tabla">
            <thead><tr><th>Semana</th><th className="num">Objetivos</th><th className="num">Cumplidos</th><th className="num">Pendientes</th><th className="num">%</th></tr></thead>
            <tbody>
              {[...conObjetivos].reverse().slice(0, 12).map(s => {
                const r = resumenSemana(s, datos.objetivos)
                return (
                  <tr key={s.id}>
                    <td>{etiquetaSemanaCorta(s.inicio)}</td>
                    <td className="num">{r.total}</td><td className="num" style={{ color: 'var(--ok)' }}>{r.cumplidos}</td><td className="num">{r.pendientes}</td>
                    <td className="num"><b>{r.cumplimiento ?? '–'}</b></td>
                  </tr>
                )
              })}
              {!conObjetivos.length && <tr><td colSpan={5} style={{ color: 'var(--texto-3)', textAlign: 'center' }}>Todavía no hay semanas con objetivos</td></tr>}
            </tbody>
          </table>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="tarjeta">
            <div className="tarjeta-cabecera" style={{ padding: '16px 16px 0' }}><div><h3>Carga actual</h3><div className="sub">Tareas abiertas por persona</div></div></div>
            <table className="tabla">
              <thead><tr><th>Persona</th><th className="num">Abiertas</th><th className="num">En curso</th><th className="num">Vencidas</th><th className="num">Hechas esta semana</th></tr></thead>
              <tbody>
                {carga.map(c => (
                  <tr key={c.miembro.id}>
                    <td><span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Avatar miembro={c.miembro} tamano="pequeno" />{c.miembro.nombre}</span></td>
                    <td className="num">{c.abiertas}</td><td className="num">{c.enCurso}</td>
                    <td className="num" style={{ color: c.vencidas ? 'var(--error)' : undefined, fontWeight: c.vencidas ? 700 : 400 }}>{c.vencidas}</td>
                    <td className="num">{c.hechasSemana}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="tarjeta">
            <div className="tarjeta-cabecera" style={{ padding: '16px 16px 0' }}><div><h3>Salud de proyectos</h3><div className="sub">Tareas completadas sobre el total del proyecto</div></div></div>
            <table className="tabla">
              <thead><tr><th>Proyecto</th><th className="num">Hechas</th><th className="num">Vencidas</th><th className="num">Avance</th><th style={{ width: 120 }}></th></tr></thead>
              <tbody>
                {salud.map(s => (
                  <tr key={s.proyecto.id}>
                    <td><span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><i className="punto-proyecto" style={{ background: s.proyecto.color }} />{s.proyecto.nombre}</span></td>
                    <td className="num">{s.hechas}/{s.total}</td>
                    <td className="num" style={{ color: s.vencidas ? 'var(--error)' : undefined }}>{s.vencidas}</td>
                    <td className="num"><b>{s.pct}%</b></td>
                    <td><div className={`progreso ${s.vencidas ? 'error' : s.pct >= 70 ? 'ok' : ''}`}><i style={{ width: `${s.pct}%` }} /></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
