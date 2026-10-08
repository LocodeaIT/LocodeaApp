/**
 * Revisión: las comprobaciones que hace la Gestoría antes de cerrar un
 * periodo. Cada incidencia lleva al registro del CRM que hay que corregir:
 * la Gestoría nunca cambia una factura, la corrección se hace en el CRM (con
 * una rectificativa si el periodo ya está presentado).
 */
import { useMemo, useState } from 'react'
import { AlertCircle, AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react'
import { useApp } from '../../store'
import { useCrm } from '../../crm/contexto'
import { PANTALLA_DE } from '../../crm/navegacion'
import { Vacio } from '../../ui/basicos'
import { hoy } from '../../domain/fechas'
import { useGestion } from '../../gestion/store'
import { useGestoria } from '../store'
import { clavePeriodo, etiquetaPeriodo, rangoPeriodo, revisar, type Incidencia, type Periodo } from '../fiscal'

const trimestreDe = (dia: string): Periodo => ({ anio: Number(dia.slice(0, 4)), tipo: 'T', n: Math.floor((Number(dia.slice(5, 7)) - 1) / 3) + 1 })
const mover = (p: Periodo, d: number): Periodo => {
  const i = p.anio * 4 + (p.n - 1) + d
  return { anio: Math.floor(i / 4), tipo: 'T', n: (i % 4) + 1 }
}

export function Revision() {
  const g = useGestoria()
  const crm = useCrm()
  const gestion = useGestion()
  const { setPantalla } = useApp()
  // por defecto, el trimestre que se cierra ahora: el anterior al actual
  const [p, setP] = useState<Periodo>(() => mover(trimestreDe(hoy()), -1))
  const { desde, hasta } = rangoPeriodo(p)
  const incidencias = useMemo(() => revisar({ crm: crm.datos, gestion: gestion.datos, gestoria: g.datos, desde, hasta }), [crm.datos, gestion.datos, g.datos, desde, hasta])
  const errores = incidencias.filter(i => i.gravedad === 'error')
  const avisos = incidencias.filter(i => i.gravedad === 'aviso')
  const presentado = g.datos.presentaciones.some(x => x.modelo === '303' && x.periodo === clavePeriodo(p) && ['presentada', 'pagada', 'domiciliada'].includes(x.estado))

  const abrir = (i: Incidencia) => {
    if (!i.registroId && i.col !== 'perfil' && i.col !== 'verifactu') return
    switch (i.col) {
      case 'gastos': setPantalla('gestion-gastos'); return
      case 'perfil': setPantalla('gestoria-perfil'); return
      case 'verifactu': setPantalla('gestoria-verifactu'); return
      case 'presentaciones': { const x = g.datos.presentaciones.find(y => y.id === i.registroId); if (x) g.abrirModelo(x.modelo, x.periodo); return }
      default:
        crm.abrir(i.col, i.registroId!)
        setPantalla(PANTALLA_DE[i.col])
    }
  }

  const fila = (i: Incidencia) => (
    <div key={i.id} className="gst-incidencia">
      <span className={`ico ${i.gravedad}`}>{i.gravedad === 'error' ? <AlertCircle size={17} /> : <AlertTriangle size={17} />}</span>
      <span>{i.texto}<small>{i.tipo}</small></span>
      {(i.registroId || i.col === 'perfil' || i.col === 'verifactu') && <button className="btn sutil pequeno" onClick={() => abrir(i)}><ExternalLink size={14} /> Corregir</button>}
    </div>
  )

  return (
    <div className="pagina">
      <div className="titulo-pagina">
        <div>
          <h1>Revisión.</h1>
          <div className="sub">Lo que hay que arreglar en el CRM antes de presentar los modelos del periodo. Gestoría no toca las facturas: cada incidencia lleva a su registro.</div>
        </div>
        <div className="acciones">
          <div className="ges-selector">
            <button onClick={() => setP(mover(p, -1))} title="Trimestre anterior"><ChevronLeft size={16} /></button>
            <b>{etiquetaPeriodo(p)}</b>
            <button onClick={() => setP(mover(p, 1))} title="Trimestre siguiente"><ChevronRight size={16} /></button>
          </div>
        </div>
      </div>

      <div className="kpis ges-kpis">
        <div className="tarjeta kpi ges-kpi"><div className="etiqueta">Errores</div><div className={`valor ${errores.length ? 'neg' : 'pos'}`}>{errores.length}</div><div className="pie">impiden cerrar el periodo</div></div>
        <div className="tarjeta kpi ges-kpi"><div className="etiqueta">Avisos</div><div className="valor">{avisos.length}</div><div className="pie">conviene revisarlos</div></div>
        <div className="tarjeta kpi ges-kpi"><div className="etiqueta">Periodo</div><div className="valor" style={{ fontSize: 20 }}>{presentado ? 'Presentado' : 'Abierto'}</div><div className="pie">{presentado ? 'los cambios irán por rectificativa o complementaria' : 'se puede corregir en el CRM'}</div></div>
      </div>

      <div className="tarjeta padded">
        {incidencias.length === 0
          ? <Vacio icono={<CheckCircle2 size={36} />} titulo="Sin incidencias" texto={`Todo lo del ${etiquetaPeriodo(p)} está listo para calcular los modelos.`} />
          : <>{errores.map(fila)}{avisos.map(fila)}</>}
      </div>
    </div>
  )
}
