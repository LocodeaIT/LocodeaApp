/**
 * Trimestre: lo que la gestoría pide cada tres meses, calculado de las
 * facturas del CRM y de los gastos. IVA repercutido y soportado (303),
 * retenciones (111), terceros del 347 y los próximos plazos. Se exporta a CSV
 * para mandarlo tal cual.
 */
import { useMemo, useState } from 'react'
import { CalendarClock, ChevronLeft, ChevronRight, Download, FileSpreadsheet, Percent, Scale } from 'lucide-react'
import { useApp } from '../../store'
import { useCrm } from '../../crm/contexto'
import { descargar } from '../../crm/csv'
import { eur, eur0, fecha } from '../../crm/formato'
import { fechaCorta } from '../../domain/fechas'
import { useGestion } from '../store'
import {
  UMBRAL_347, csvTrimestre, etiquetaTrimestre, filasTrimestre, proximosPlazos, resumenTrimestre, terceros347, trimestreActual, trimestreAnterior,
  trimestreSiguiente, type Trimestre as T,
} from '../calculos'

export function Trimestre() {
  const { datos } = useGestion()
  const crm = useCrm()
  const { avisar } = useApp()
  const [tri, setTri] = useState<T>(trimestreActual)

  const r = useMemo(() => resumenTrimestre(crm.datos, datos, tri), [crm.datos, datos, tri])
  const t347 = useMemo(() => terceros347(crm.datos, datos, tri.anio), [crm.datos, datos, tri.anio])
  const plazos = useMemo(() => proximosPlazos(6), [])
  const actual = trimestreActual()
  const esFuturo = tri.anio > actual.anio || (tri.anio === actual.anio && tri.t > actual.t)

  const exportar = () => {
    const filas = filasTrimestre(crm.datos, datos, tri)
    if (!filas.length) { avisar('No hay nada que exportar en este trimestre', 'info'); return }
    descargar(`locodea-${tri.t}T${tri.anio}.csv`, csvTrimestre(filas).replace(/^﻿/, ''))
    avisar(`Exportadas ${filas.length} filas del ${etiquetaTrimestre(tri)}`)
  }

  return (
    <div className="pagina">
      <div className="titulo-pagina">
        <div>
          <h1>Trimestre.</h1>
          <div className="sub">Lo que la gestoría pide cada tres meses, calculado de las facturas y los gastos. Solo cuentan las facturas registradas o pagadas; los borradores, no.</div>
        </div>
        <div className="acciones">
          <div className="ges-selector">
            <button onClick={() => setTri(trimestreAnterior(tri))} title="Trimestre anterior"><ChevronLeft size={16} /></button>
            <b>{etiquetaTrimestre(tri)}</b>
            <button onClick={() => setTri(trimestreSiguiente(tri))} title="Trimestre siguiente" disabled={esFuturo}><ChevronRight size={16} /></button>
          </div>
          <button className="btn" onClick={exportar}><Download size={16} /> Exportar para la gestoría</button>
        </div>
      </div>

      <div className="kpis ges-kpis">
        <div className="tarjeta kpi ges-kpi anim-aparecer retraso-1">
          <div className="etiqueta"><span className="ico"><Percent size={14} /></span>IVA repercutido</div>
          <div className="valor">{eur0(r.ventas.iva)}</div>
          <div className="pie">{r.ventas.facturas} {r.ventas.facturas === 1 ? 'factura de venta' : 'facturas de venta'} · base {eur0(r.ventas.base)}</div>
        </div>
        <div className="tarjeta kpi ges-kpi anim-aparecer retraso-2">
          <div className="etiqueta"><span className="ico"><Percent size={14} /></span>IVA soportado</div>
          <div className="valor">{eur0(r.compras.iva)}</div>
          <div className="pie">{r.compras.facturas} {r.compras.facturas === 1 ? 'factura' : 'facturas'} y {r.compras.gastos} {r.compras.gastos === 1 ? 'gasto' : 'gastos'} · base {eur0(r.compras.base)}</div>
        </div>
        <div className="tarjeta kpi ges-kpi anim-aparecer retraso-3">
          <div className="etiqueta"><span className="ico"><Scale size={14} /></span>Modelo 303</div>
          <div className={`valor ${r.resultado303 > 0 ? 'neg' : 'pos'}`}>{eur0(Math.abs(r.resultado303))}</div>
          <div className="pie">{r.resultado303 > 0 ? 'a ingresar' : r.resultado303 < 0 ? 'a compensar' : 'sin resultado'}</div>
        </div>
        <div className="tarjeta kpi ges-kpi anim-aparecer retraso-4">
          <div className="etiqueta"><span className="ico"><FileSpreadsheet size={14} /></span>Modelo 111</div>
          <div className="valor">{eur0(r.retenciones111)}</div>
          <div className="pie">retenciones de IRPF en gastos de profesionales</div>
        </div>
      </div>

      <div className="ges-trimestre">
        <div style={{ display: 'grid', gap: 16 }}>
          <div className="tarjeta padded">
            <div className="tarjeta-cabecera"><div><h3>IVA por tipo</h3><div className="sub">Del {fecha(r.desde)} al {fecha(r.hasta)}</div></div></div>
            <table className="tabla">
              <thead><tr><th>Ventas</th><th className="num">Base</th><th className="num">Cuota</th></tr></thead>
              <tbody>
                {r.ventas.porTipo.length === 0 && <tr><td colSpan={3} style={{ color: 'var(--texto-3)' }}>Sin facturas de venta en el trimestre</td></tr>}
                {r.ventas.porTipo.map(l => <tr key={'v' + l.tipo}><td>IVA {l.tipo} %</td><td className="num">{eur(l.base)}</td><td className="num">{eur(l.cuota)}</td></tr>)}
              </tbody>
              <thead><tr><th>Compras y gastos</th><th className="num">Base</th><th className="num">Cuota</th></tr></thead>
              <tbody>
                {r.compras.porTipo.length === 0 && <tr><td colSpan={3} style={{ color: 'var(--texto-3)' }}>Sin compras ni gastos deducibles en el trimestre</td></tr>}
                {r.compras.porTipo.map(l => <tr key={'c' + l.tipo}><td>IVA {l.tipo} %</td><td className="num">{eur(l.base)}</td><td className="num">{eur(l.cuota)}</td></tr>)}
                {r.compras.noDeducible > 0 && <tr><td style={{ color: 'var(--texto-3)' }}>Gastos no deducibles (fuera del 303)</td><td className="num" style={{ color: 'var(--texto-3)' }}>{eur(r.compras.noDeducible)}</td><td className="num">—</td></tr>}
              </tbody>
            </table>
            <div className="ges-resultado">
              <span>Resultado del 303</span>
              <span className={`valor ${r.resultado303 > 0 ? '' : 'pos'}`} style={r.resultado303 > 0 ? { color: 'var(--danger)' } : undefined}>{r.resultado303 > 0 ? '' : '−'}{eur(Math.abs(r.resultado303))}</span>
            </div>
            <div className="ges-aviso">Cobrado en el trimestre {eur(r.cobrado)} · pagado {eur(r.pagado)}. El IVA se declara por devengo (fecha de factura), no por cobro.</div>
          </div>

          <div className="tarjeta padded">
            <div className="tarjeta-cabecera"><div><h3>Modelo 347 · {tri.anio}</h3><div className="sub">Terceros con más de {eur(UMBRAL_347)} en el año</div></div></div>
            {t347.length === 0 ? (
              <div style={{ color: 'var(--texto-3)', fontSize: 13.5 }}>Ningún cliente ni proveedor supera el umbral por ahora.</div>
            ) : (
              <table className="tabla">
                <thead><tr><th>Tercero</th><th>CIF</th><th className="num">Ventas</th><th className="num">Compras</th></tr></thead>
                <tbody>
                  {t347.map(x => <tr key={x.cuentaId}><td>{x.nombre}</td><td style={{ color: 'var(--texto-3)' }}>{x.cif || '— sin CIF —'}</td><td className="num">{x.ventas ? eur(x.ventas) : '—'}</td><td className="num">{x.compras ? eur(x.compras) : '—'}</td></tr>)}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="tarjeta padded">
          <div className="tarjeta-cabecera"><div><h3>Próximos plazos</h3><div className="sub">Calendario de una SL con IVA trimestral</div></div><CalendarClock size={18} style={{ color: 'var(--faint)' }} /></div>
          {plazos.map(p => (
            <div key={p.modelo + p.periodo} className="ges-plazo">
              <span className="modelo">{p.modelo}</span>
              <span className="nombre">{p.nombre}<small>{p.periodo}</small></span>
              <span className={`cuando ${p.abierto ? 'abierto' : ''}`}>{p.abierto ? `abierto · ${p.dias} d` : `${fechaCorta(p.desde)} – ${fechaCorta(p.hasta)}`}</span>
            </div>
          ))}
          <div className="ges-aviso" style={{ marginTop: 14 }}>Fechas orientativas de la AEAT; si un día cae en festivo, el plazo se mueve al siguiente hábil. Confirma con la gestoría.</div>
        </div>
      </div>
    </div>
  )
}
