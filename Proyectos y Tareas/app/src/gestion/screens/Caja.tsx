/**
 * Caja: lo que entra y lo que sale en los próximos 90 días, a partir de las
 * facturas del CRM (pendientes de cobro y de pago), los gastos pendientes y
 * los gastos fijos. Con un saldo inicial, dibuja el saldo semana a semana y
 * avisa del mínimo. Desde aquí se marca una factura como cobrada o se apunta
 * un cobro parcial.
 */
import { useMemo, useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, Check, Euro, TrendingDown, Wallet } from 'lucide-react'
import { useApp } from '../../store'
import { useCrm } from '../../crm/contexto'
import { Campo, Modal, Vacio } from '../../ui/basicos'
import { eur, eur0, fecha } from '../../crm/formato'
import { totales } from '../../crm/documentos'
import { fechaCorta, hoy } from '../../domain/fechas'
import { useGestion } from '../store'
import { pendienteCobro, pendientePago, previsionCaja, type Movimiento } from '../calculos'

const CLAVE_SALDO = 'locodea.gestion.saldo'

function leerSaldo(): number {
  try { return Number(localStorage.getItem(CLAVE_SALDO)) || 0 } catch { return 0 }
}

type Vista = 'todo' | 'cobros' | 'pagos'

export function Caja() {
  const { datos } = useGestion()
  const crm = useCrm()
  const { setPantalla } = useApp()
  const [saldoInicial, setSaldoInicial] = useState(leerSaldo)
  const [vista, setVista] = useState<Vista>('todo')
  const [parcial, setParcial] = useState<Movimiento | null>(null)

  const prev = useMemo(() => previsionCaja(crm.datos, datos, saldoInicial, 90), [crm.datos, datos, saldoInicial])
  const movimientos = prev.movimientos.filter(m => vista === 'todo' || (vista === 'cobros' ? m.importe > 0 : m.importe < 0))
  const maxSemana = Math.max(1, ...prev.semanas.map(s => Math.max(s.cobros, s.pagos)))

  const cambiarSaldo = (v: number) => {
    setSaldoInicial(v)
    try { localStorage.setItem(CLAVE_SALDO, String(v)) } catch { /* sin permisos */ }
  }

  const abrir = (m: Movimiento) => {
    if (m.ref.col === 'gastos') { setPantalla('gestion-gastos'); return }
    crm.abrir(m.ref.col, m.ref.id)
    setPantalla(m.ref.col === 'facturasVenta' ? 'crm-facturas-venta' : 'crm-facturas-compra')
  }

  const marcar = async (m: Movimiento) => {
    if (m.ref.col === 'facturasVenta') {
      const f = crm.datos.facturasVenta.find(x => x.id === m.ref.id)
      if (f) await crm.cambiarEstadoDocumento('facturasVenta', f, 'pagada')
    } else if (m.ref.col === 'facturasCompra') {
      const f = crm.datos.facturasCompra.find(x => x.id === m.ref.id)
      if (f) await crm.cambiarEstadoDocumento('facturasCompra', f, 'pagada')
    }
  }

  return (
    <div className="pagina">
      <div className="titulo-pagina">
        <div>
          <h1>Caja.</h1>
          <div className="sub">Cobros y pagos previstos para los próximos 90 días, con las facturas del CRM y los gastos fijos. Nada se inventa: si algo no está aquí, es que no está registrado.</div>
        </div>
        <div className="acciones">
          <div className="ges-saldo-inicial">
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>Saldo en el banco hoy</span>
            <input type="number" step={100} value={saldoInicial || ''} placeholder="0" onChange={e => cambiarSaldo(Number(e.target.value) || 0)} />
          </div>
        </div>
      </div>

      <div className="kpis ges-kpis">
        <div className="tarjeta kpi ges-kpi anim-aparecer retraso-1">
          <div className="etiqueta"><span className="ico"><ArrowDownLeft size={14} /></span>A cobrar</div>
          <div className="valor pos">{eur0(prev.aCobrar)}</div>
          <div className={`pie ${prev.vencidoCobro ? 'mal' : ''}`}>{prev.vencidoCobro ? `${eur0(prev.vencidoCobro)} ya vencido` : 'Nada vencido'}</div>
        </div>
        <div className="tarjeta kpi ges-kpi anim-aparecer retraso-2">
          <div className="etiqueta"><span className="ico"><ArrowUpRight size={14} /></span>A pagar</div>
          <div className="valor neg">{eur0(prev.aPagar)}</div>
          <div className={`pie ${prev.vencidoPago ? 'mal' : ''}`}>{prev.vencidoPago ? `${eur0(prev.vencidoPago)} ya vencido` : 'Nada vencido'}</div>
        </div>
        <div className="tarjeta kpi ges-kpi anim-aparecer retraso-3">
          <div className="etiqueta"><span className="ico"><Wallet size={14} /></span>Saldo a 90 días</div>
          <div className={`valor ${prev.saldoFinal < 0 ? 'neg' : ''}`}>{eur0(prev.saldoFinal)}</div>
          <div className="pie">{saldoInicial ? `desde ${eur0(saldoInicial)} hoy` : 'Pon el saldo del banco para afinarlo'}</div>
        </div>
        <div className="tarjeta kpi ges-kpi anim-aparecer retraso-4">
          <div className="etiqueta"><span className="ico"><TrendingDown size={14} /></span>Mínimo previsto</div>
          <div className={`valor ${prev.minimo && prev.minimo.saldo < 0 ? 'neg' : ''}`}>{prev.minimo ? eur0(prev.minimo.saldo) : '—'}</div>
          <div className={`pie ${prev.minimo && prev.minimo.saldo < 0 ? 'mal' : ''}`}>{prev.minimo ? `semana del ${fechaCorta(prev.minimo.fecha)}` : ''}</div>
        </div>
      </div>

      <div className="ges-caja">
        <div className="tarjeta padded">
          <div className="tarjeta-cabecera">
            <div><h3>Vencimientos</h3><div className="sub">{movimientos.length} movimientos hasta el {fecha(prev.semanas.at(-1)?.desde ?? hoy())}</div></div>
            <div className="btn-grupo">
              {(['todo', 'cobros', 'pagos'] as Vista[]).map(v => <button key={v} className={vista === v ? 'activo' : ''} onClick={() => setVista(v)}>{v === 'todo' ? 'Todo' : v === 'cobros' ? 'Cobros' : 'Pagos'}</button>)}
            </div>
          </div>
          {movimientos.length === 0 ? (
            <Vacio icono={<Euro size={32} />} titulo="Sin movimientos previstos" texto="Las facturas registradas y los gastos pendientes o fijos aparecerán aquí." />
          ) : movimientos.map((m, i) => (
            <div key={m.ref.col + m.ref.id + m.fecha + i} className="ges-mov clicable" onClick={() => abrir(m)}>
              <span className={`cuando ${m.vencido ? 'vencido' : ''}`} title={m.vencido ? 'Vencido' : undefined}>{m.vencido ? 'Vencido' : fechaCorta(m.fecha)}</span>
              <span className="que"><b>{m.concepto}</b><small>{[m.tercero, m.tipo === 'fijo' ? 'gasto fijo' : m.tipo === 'gasto' ? 'gasto' : m.tipo === 'cobro' ? 'factura de venta' : 'factura de compra'].filter(Boolean).join(' · ')}</small></span>
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                <span className={`cuanto ${m.importe < 0 ? 'neg' : 'pos'}`}>{m.importe < 0 ? '−' : '+'}{eur(Math.abs(m.importe))}</span>
                {(m.tipo === 'cobro' || m.tipo === 'pago') && (
                  <>
                    <button className="btn sutil icono pequeno" title={m.tipo === 'cobro' ? 'Cobro parcial' : 'Pago parcial'} onClick={e => { e.stopPropagation(); setParcial(m) }}><Euro size={14} /></button>
                    <button className="btn sutil icono pequeno" title={m.tipo === 'cobro' ? 'Marcar como cobrada' : 'Marcar como pagada'} onClick={e => { e.stopPropagation(); void marcar(m) }}><Check size={14} /></button>
                  </>
                )}
              </span>
            </div>
          ))}
        </div>

        <div className="tarjeta padded">
          <div className="tarjeta-cabecera"><div><h3>Semana a semana</h3><div className="sub">Cobros en verde, pagos en rojo y saldo al cierre</div></div></div>
          <div className="ges-semanas">
            {prev.semanas.map(s => (
              <div key={s.desde} className="ges-semana">
                <span style={{ color: 'var(--muted)' }}>{fechaCorta(s.desde)}</span>
                <span className="barras">
                  <span className="barra" title={`Cobros ${eur(s.cobros)}`}><i style={{ width: `${(s.cobros / maxSemana) * 100}%` }} /></span>
                  <span className="barra pago" title={`Pagos ${eur(s.pagos)}`}><i style={{ width: `${(s.pagos / maxSemana) * 100}%` }} /></span>
                </span>
                <span className={`saldo ${s.saldo < 0 ? 'neg' : ''}`}>{eur0(s.saldo)}</span>
              </div>
            ))}
          </div>
          <div className="ges-aviso" style={{ marginTop: 16 }}>
            Las facturas vencidas se cuentan como si se cobraran o pagaran hoy. Los gastos fijos se proyectan cada mes en su día de cargo.
          </div>
        </div>
      </div>

      {parcial && <ModalParcial mov={parcial} onCerrar={() => setParcial(null)} />}
    </div>
  )
}

/** Apunta un cobro o pago a cuenta sobre una factura (importeCobrado / importePagado). */
function ModalParcial({ mov, onCerrar }: { mov: Movimiento; onCerrar: () => void }) {
  const crm = useCrm()
  const venta = mov.ref.col === 'facturasVenta'
  const f = venta ? crm.datos.facturasVenta.find(x => x.id === mov.ref.id) : crm.datos.facturasCompra.find(x => x.id === mov.ref.id)
  const [importe, setImporte] = useState(Math.abs(mov.importe))
  const [guardando, setGuardando] = useState(false)
  if (!f) return null
  const total = totales(f).total
  const pendiente = venta ? pendienteCobro(f as never) : pendientePago(f as never)
  const guardar = async () => {
    setGuardando(true)
    try {
      const acumulado = Math.min(total, (venta ? (f as { importeCobrado: number }).importeCobrado : (f as { importePagado: number }).importePagado) + importe)
      if (acumulado >= total - 0.005) {
        await crm.cambiarEstadoDocumento(venta ? 'facturasVenta' : 'facturasCompra', f, 'pagada')
      } else if (venta) {
        await crm.guardar('facturasVenta', { ...(f as never as { importeCobrado: number }), importeCobrado: acumulado } as never)
      } else {
        await crm.guardar('facturasCompra', { ...(f as never as { importePagado: number }), importePagado: acumulado } as never)
      }
      onCerrar()
    } finally { setGuardando(false) }
  }
  return (
    <Modal titulo={venta ? `Cobro a cuenta · ${f.no}` : `Pago a cuenta · ${f.no}`} onCerrar={onCerrar} pie={<>
      <button className="btn sutil" onClick={onCerrar} disabled={guardando}>Cancelar</button>
      <button className="btn acento" onClick={() => void guardar()} disabled={guardando || !(importe > 0)}>{guardando ? 'Guardando…' : 'Apuntar'}</button>
    </>}>
      <div className="formulario">
        <div style={{ fontSize: 13.5, color: 'var(--muted)' }}>Total {eur(total)} · pendiente {eur(pendiente)}. Si el importe cubre lo pendiente, la factura pasa a {venta ? 'cobrada' : 'pagada'}.</div>
        <Campo label="Importe"><input type="number" min={0} step={0.01} value={importe || ''} onChange={e => setImporte(Number(e.target.value) || 0)} autoFocus /></Campo>
      </div>
    </Modal>
  )
}
