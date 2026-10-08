/**
 * Panel y calendario: lo próximo que hay que presentar con los días que
 * quedan, lo que se quedó sin presentar, el importe previsto a pagar, las
 * incidencias del trimestre que se cierra y el estado de Verifactu. Las
 * obligaciones salen del perfil fiscal; su estado, de las presentaciones.
 */
import { useMemo } from 'react'
import { AlertTriangle, CalendarClock, ClipboardCheck, Euro, ShieldCheck } from 'lucide-react'
import { useApp } from '../../store'
import { useCrm } from '../../crm/contexto'
import { eur, fecha } from '../../crm/formato'
import { hoy, sumarDias } from '../../domain/fechas'
import { useGestion } from '../../gestion/store'
import { useGestoria } from '../store'
import type { EstadoPresentacion } from '../types'
import { apuntesFiscales, obligaciones, rangoPeriodo, revisar, type Obligacion } from '../fiscal'
import { cuotaUltimoIS } from '../impuesto'
import { impuestosPrevistos } from '../caja'

const ESTADOS: Record<EstadoPresentacion, string> = { pendiente: 'Pendiente', preparada: 'Preparada', presentada: 'Presentada', pagada: 'Pagada', domiciliada: 'Domiciliada', 'no-procede': 'No procede' }
const HECHA: EstadoPresentacion[] = ['presentada', 'pagada', 'domiciliada', 'no-procede']
const dias = (d: string) => Math.round((Date.parse(d) - Date.parse(hoy())) / 86400000)

export function Panel() {
  const g = useGestoria()
  const crm = useCrm()
  const gestion = useGestion()
  const { setPantalla } = useApp()
  const h = hoy()

  const apuntes = useMemo(() => apuntesFiscales(crm.datos, gestion.datos), [crm.datos, gestion.datos])
  const lista = useMemo(() => obligaciones({ perfil: g.perfil, desde: sumarDias(h, -400), hasta: sumarDias(h, 400), apuntes, cuotaUltimoIS: cuotaUltimoIS(g.datos, Number(h.slice(0, 4))) }),
    [g.perfil, g.datos, apuntes, h])
  const estadoDe = (o: Obligacion): EstadoPresentacion => g.datos.presentaciones.find(p => p.modelo === o.modelo && p.periodo === o.periodo)?.estado ?? 'pendiente'
  const atrasadas = lista.filter(o => o.aplica && o.hasta < h && !HECHA.includes(estadoDe(o)))
  const proximas = lista.filter(o => o.hasta >= h).slice(0, 14)
  const siguiente = proximas.find(o => o.aplica && !HECHA.includes(estadoDe(o)))

  const pagos = useMemo(() => impuestosPrevistos({ crm: crm.datos, gestion: gestion.datos, gestoria: g.datos, perfil: g.perfil, dias: 90 }), [crm.datos, gestion.datos, g.datos, g.perfil])
  const aPagar = -pagos.reduce((s, m) => s + m.importe, 0)

  // el trimestre que se cierra: el anterior al actual
  const mes = Number(h.slice(5, 7)), anio = Number(h.slice(0, 4)), t = Math.floor((mes - 1) / 3) + 1
  const cierre = t === 1 ? { anio: anio - 1, tipo: 'T' as const, n: 4 } : { anio, tipo: 'T' as const, n: t - 1 }
  const r = rangoPeriodo(cierre)
  const incidencias = useMemo(() => revisar({ crm: crm.datos, gestion: gestion.datos, gestoria: g.datos, desde: r.desde, hasta: r.hasta }), [crm.datos, gestion.datos, g.datos, r.desde, r.hasta])
  const errores = incidencias.filter(i => i.gravedad === 'error').length

  const diasVerifactu = dias('2027-01-01')

  const fila = (o: Obligacion) => {
    const estado = estadoDe(o), d = dias(o.hasta)
    const urgente = o.aplica && !HECHA.includes(estado) && d <= 7
    return (
      <div key={o.modelo + o.periodo} className={`gst-oblig clicable ${o.aplica ? '' : 'no-aplica'}`} onClick={() => g.abrirModelo(o.modelo, o.periodo)} title={o.motivo}>
        <span className="modelo">{/^\d/.test(o.modelo) ? o.modelo : '·'}</span>
        <span className="que"><b>{o.nombre}</b><small>{o.etiquetaPeriodo} · {o.organismo}{o.aplica ? '' : ` · no aplica: ${o.motivo}`}</small></span>
        <span className={`chip pequeno ${HECHA.includes(estado) ? 'ok' : estado === 'preparada' ? 'acento' : 'contorno'}`}>{ESTADOS[estado]}</span>
        <span className={`cuando ${urgente ? 'urgente' : ''}`}>
          {d < 0 ? `venció el ${fecha(o.hasta)}` : d === 0 ? 'hoy' : `${fecha(o.hasta)} · ${d} d`}
          {o.domiciliarHasta && d >= 0 && <><br /><small>domiciliar hasta {fecha(o.domiciliarHasta)}</small></>}
        </span>
      </div>
    )
  }

  return (
    <div className="pagina">
      <div className="titulo-pagina">
        <div>
          <h1>Gestoría.</h1>
          <div className="sub">Lo que tiene que presentar {g.perfil.razonSocial || 'la sociedad'} y cuándo. El calendario sale del perfil fiscal; cada modelo se calcula con lo que se registra en el CRM.</div>
        </div>
      </div>

      {!g.perfil.id && <div className="ges-aviso" style={{ marginBottom: 12 }}>Falta guardar el perfil fiscal. <button className="btn sutil pequeno" onClick={() => setPantalla('gestoria-perfil')}>Revisarlo</button></div>}
      {!g.perfil.fechaConstitucion && <div className="ges-aviso" style={{ marginBottom: 12 }}>La sociedad aún no tiene fecha de constitución: el calendario cuenta desde hoy. Cuando exista, ponla en el perfil fiscal.</div>}

      <div className="kpis ges-kpis">
        <div className="tarjeta kpi ges-kpi">
          <div className="etiqueta"><span className="ico"><CalendarClock size={14} /></span>Próximo plazo</div>
          <div className="valor" style={{ fontSize: 20 }}>{siguiente ? `${/^\d/.test(siguiente.modelo) ? siguiente.modelo : siguiente.nombre} · ${dias(siguiente.hasta)} d` : '—'}</div>
          <div className="pie">{siguiente ? `${siguiente.etiquetaPeriodo}, hasta el ${fecha(siguiente.hasta)}` : 'nada pendiente'}</div>
        </div>
        <div className="tarjeta kpi ges-kpi">
          <div className="etiqueta"><span className="ico"><Euro size={14} /></span>A pagar en 90 días</div>
          <div className="valor">{eur(aPagar)}</div>
          <div className="pie">{pagos.length ? pagos.map(m => m.concepto.replace('Modelo ', '')).join(' · ') : 'sin pagos previstos'}</div>
        </div>
        <div className="tarjeta kpi ges-kpi clicable" onClick={() => setPantalla('gestoria-revision')}>
          <div className="etiqueta"><span className="ico"><ClipboardCheck size={14} /></span>Revisión {cierre.n}T {cierre.anio}</div>
          <div className={`valor ${errores ? 'neg' : 'pos'}`}>{incidencias.length}</div>
          <div className="pie">{errores} {errores === 1 ? 'error' : 'errores'} · {incidencias.length - errores} avisos</div>
        </div>
        <div className="tarjeta kpi ges-kpi clicable" onClick={() => setPantalla('gestoria-verifactu')}>
          <div className="etiqueta"><span className="ico"><ShieldCheck size={14} /></span>Verifactu</div>
          <div className="valor" style={{ fontSize: 20 }}>{g.config.entorno === 'produccion' ? 'En producción' : g.config.entorno === 'pruebas' ? 'En pruebas' : 'Preparación'}</div>
          <div className={`pie ${g.config.entorno !== 'produccion' && diasVerifactu < 90 ? 'mal' : ''}`}>{g.config.entorno === 'produccion' ? `${g.datos.registros.length} registros` : diasVerifactu > 0 ? `obligatorio en ${diasVerifactu} días` : 'ya es obligatorio'}</div>
        </div>
      </div>

      <div className="gst-dos">
        <div className="tarjeta padded">
          <div className="tarjeta-cabecera"><div><h3>Calendario</h3><div className="sub">Plazos de los próximos meses. Los que no aplican a Locodea se ven atenuados, con el motivo.</div></div></div>
          {proximas.map(fila)}
          <div className="ges-aviso" style={{ marginTop: 12 }}>Si el último día cae en fin de semana o festivo nacional, el plazo pasa al siguiente día hábil (ya está aplicado). Domiciliando, el cargo llega el último día del plazo.</div>
        </div>
        <div className="gst-columna">
          <div className="tarjeta padded">
            <div className="tarjeta-cabecera"><div><h3>Sin presentar</h3><div className="sub">Plazos vencidos que aplican y no constan presentados</div></div>{atrasadas.length > 0 && <AlertTriangle size={18} style={{ color: 'var(--danger)' }} />}</div>
            {atrasadas.length ? atrasadas.map(fila) : <div style={{ color: 'var(--texto-3)', fontSize: 13.5 }}>Nada atrasado.</div>}
          </div>
          <div className="tarjeta padded">
            <div className="tarjeta-cabecera"><div><h3>Cierre de un trimestre</h3></div></div>
            <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, lineHeight: 1.6 }}>
              <li><b>Día 1:</b> revisión e incidencias en el CRM.</li>
              <li><b>Hasta el día 10:</b> correcciones en el CRM.</li>
              <li><b>Día 10:</b> modelos preparados y comparados con el trimestre anterior.</li>
              <li><b>Antes del día 15:</b> presentación domiciliada en la Sede.</li>
              <li><b>Después:</b> justificante guardado; el periodo queda cerrado.</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  )
}
