/**
 * Contabilidad por partida doble, sacada sola del CRM (ventas, compras,
 * cobros, pagos, gastos, liquidaciones de IVA y pagos de modelos) más los
 * asientos escritos a mano (capital, ajustes, impuesto). Libro diario, mayor,
 * sumas y saldos, balance y cuenta de pérdidas y ganancias del modelo de
 * pymes, y el cuadro de amortización de los bienes de inversión.
 */
import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Download, Plus, Trash2 } from 'lucide-react'
import { useApp } from '../../store'
import { useCrm } from '../../crm/contexto'
import { descargar } from '../../crm/csv'
import { eur, fecha } from '../../crm/formato'
import { hoy } from '../../domain/fechas'
import { Campo, Modal, confirmar } from '../../ui/basicos'
import { Select } from '../../ui/Select'
import { useGestion } from '../../gestion/store'
import { useGestoria } from '../store'
import type { AsientoManual, LineaAsiento, TipoAsiento } from '../types'
import { PLAN, asientosDelEjercicio, balance, cuadroAmortizacion, libroDiario, mayor, nombreCuenta, perdidasYGanancias, sumasYSaldos } from '../contabilidad'
import type { Asiento, MasaBalance } from '../contabilidad'

type Vista = 'diario' | 'mayor' | 'sumas' | 'balance' | 'pyg' | 'amortizacion'
const VISTAS: { valor: Vista; etiqueta: string }[] = [
  { valor: 'diario', etiqueta: 'Libro diario' }, { valor: 'mayor', etiqueta: 'Mayor' }, { valor: 'sumas', etiqueta: 'Sumas y saldos' },
  { valor: 'balance', etiqueta: 'Balance' }, { valor: 'pyg', etiqueta: 'Pérdidas y ganancias' }, { valor: 'amortizacion', etiqueta: 'Amortizaciones' },
]

const TIPOS_ASIENTO: Record<TipoAsiento, string> = {
  apertura: 'Apertura', capital: 'Capital', ajuste: 'Ajuste', amortizacion: 'Amortización', periodificacion: 'Periodificación', impuesto: 'Impuesto',
  regularizacion: 'Regularización', cierre: 'Cierre', otro: 'Otro',
}

const num = (n: number) => (n ? eur(n) : '')

export function Contabilidad() {
  const g = useGestoria()
  const crm = useCrm()
  const gestion = useGestion()
  const { setPantalla } = useApp()
  const lectura = g.acceso !== 'completo'
  const [ejercicio, setEjercicio] = useState(() => Number(hoy().slice(0, 4)))
  const [vista, setVista] = useState<Vista>('diario')
  const [cuenta, setCuenta] = useState('572')
  const [editando, setEditando] = useState<AsientoManual | null>(null)

  const asientos = useMemo(() => asientosDelEjercicio({ crm: crm.datos, gestion: gestion.datos, gestoria: g.datos, ejercicio, perfil: g.datos.perfil[0] ?? null }),
    [crm.datos, gestion.datos, g.datos, ejercicio])
  const diario = useMemo(() => libroDiario(asientos), [asientos])
  const pyg = useMemo(() => perdidasYGanancias(asientos), [asientos])

  const abrirOrigen = (a: Asiento) => {
    const o = a.origen
    if (!o.col || !o.id) return
    if (o.col === 'asientos') { const m = g.datos.asientos.find(x => x.id === o.id); if (m) setEditando(m); return }
    if (o.col === 'gastos') { setPantalla('gestion-gastos'); return }
    if (o.col === 'presentaciones') { const p = g.datos.presentaciones.find(x => x.id === o.id); if (p) g.abrirModelo(p.modelo, p.periodo); return }
    crm.abrir(o.col, o.id)
    setPantalla(o.col === 'facturasVenta' ? 'crm-facturas-venta' : 'crm-facturas-compra')
  }

  const exportarDiario = () => {
    const filas = diario.asientos.flatMap(a => a.lineas.map(l => [a.numero, a.fecha, a.concepto, l.cuenta, l.nombre, l.debe.toFixed(2).replace('.', ','), l.haber.toFixed(2).replace('.', ',')]))
    const txt = (s: unknown) => `"${String(s ?? '').replace(/"/g, '""')}"`
    descargar(`libro-diario-${ejercicio}.csv`, [['Asiento', 'Fecha', 'Concepto', 'Cuenta', 'Nombre', 'Debe', 'Haber'].join(';'), ...filas.map(f => f.map((x, i) => (i >= 5 ? x : txt(x))).join(';'))].join('\r\n'))
  }

  return (
    <div className="pagina">
      <div className="titulo-pagina">
        <div>
          <h1>Contabilidad.</h1>
          <div className="sub">Partida doble sacada sola de lo que se registra en el CRM, más los asientos escritos a mano. Cada asiento automático lleva a su factura o gasto.</div>
        </div>
        <div className="acciones">
          <div className="ges-selector">
            <button onClick={() => setEjercicio(e => e - 1)} title="Ejercicio anterior"><ChevronLeft size={16} /></button>
            <b>Ejercicio {ejercicio}</b>
            <button onClick={() => setEjercicio(e => e + 1)} title="Ejercicio siguiente"><ChevronRight size={16} /></button>
          </div>
          <button className="btn" onClick={exportarDiario}><Download size={16} /> Diario en CSV</button>
          {!lectura && <button className="btn acento" onClick={() => setEditando({ id: '', creadoEl: '', fecha: hoy(), ejercicio, tipo: 'ajuste', concepto: '', lineas: [{ cuenta: '', debe: 0, haber: 0 }, { cuenta: '', debe: 0, haber: 0 }] })}><Plus size={16} /> Asiento manual</button>}
        </div>
      </div>

      <div className="kpis ges-kpis">
        <div className="tarjeta kpi ges-kpi"><div className="etiqueta">Cifra de negocios</div><div className="valor">{eur(pyg.cifraNegocios)}</div><div className="pie">ejercicio {ejercicio}</div></div>
        <div className="tarjeta kpi ges-kpi"><div className="etiqueta">Resultado de explotación</div><div className={`valor ${pyg.resultadoExplotacion < 0 ? 'neg' : 'pos'}`}>{eur(pyg.resultadoExplotacion)}</div><div className="pie">antes de financieros e impuestos</div></div>
        <div className="tarjeta kpi ges-kpi"><div className="etiqueta">Resultado del ejercicio</div><div className={`valor ${pyg.resultadoEjercicio < 0 ? 'neg' : 'pos'}`}>{eur(pyg.resultadoEjercicio)}</div><div className="pie">después del impuesto contabilizado</div></div>
        <div className="tarjeta kpi ges-kpi"><div className="etiqueta">Asientos</div><div className="valor">{diario.asientos.length}</div><div className={`pie ${diario.descuadrados.length ? 'mal' : ''}`}>{diario.descuadrados.length ? `${diario.descuadrados.length} sin cuadrar` : 'todos cuadran'}</div></div>
      </div>

      <div className="gst-pestanas btn-grupo" role="tablist">
        {VISTAS.map(v => <button key={v.valor} className={vista === v.valor ? 'activo' : ''} onClick={() => setVista(v.valor)} role="tab" aria-selected={vista === v.valor}>{v.etiqueta}</button>)}
      </div>

      {vista === 'diario' && (
        <div className="tarjeta padded">
          {diario.asientos.length === 0 && <div style={{ color: 'var(--texto-3)' }}>Sin asientos en {ejercicio}.</div>}
          {diario.asientos.map(a => (
            <div key={a.id} className="gst-asiento">
              <div className="cab">
                <b>{a.numero}</b><span>{fecha(a.fecha)}</span>
                <span style={{ flex: 1 }}>{a.concepto}</span>
                {!a.cuadra && <span className="chip pequeno error">No cuadra</span>}
                {a.origen.col && <button className="btn sutil pequeno" onClick={() => abrirOrigen(a)}>{a.automatico ? 'Ver origen' : 'Editar'}</button>}
              </div>
              <table>
                <tbody>
                  {a.lineas.map((l, i) => (
                    <tr key={i}><td className="cuenta">{l.cuenta}</td><td>{l.nombre}{l.concepto && l.concepto !== a.concepto ? ` · ${l.concepto}` : ''}</td><td className="num">{num(l.debe)}</td><td className="num">{num(l.haber)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
          <div className="ges-resultado"><span>Totales</span><span>{eur(diario.debe)} · {eur(diario.haber)}</span></div>
        </div>
      )}

      {vista === 'mayor' && <VistaMayor asientos={asientos} cuenta={cuenta} setCuenta={setCuenta} />}

      {vista === 'sumas' && <VistaSumas asientos={asientos} onCuenta={c => { setCuenta(c); setVista('mayor') }} />}

      {vista === 'balance' && <VistaBalance asientos={asientos} />}

      {vista === 'pyg' && (
        <div className="tarjeta padded">
          <div className="tarjeta-cabecera"><div><h3>Cuenta de pérdidas y ganancias</h3><div className="sub">Modelo de pymes · ejercicio {ejercicio}</div></div></div>
          {pyg.partidas.filter(p => p.total || p.importe).map(p => (
            <div key={p.clave} className={`gst-partida ${p.total ? 'nivel-0' : ''}`} title={p.detalle.map(d => `${d.cuenta} ${d.nombre}: ${eur(d.importe)}`).join('\n')}>
              <span>{p.clave}. {p.titulo}</span><span>{eur(p.importe)}</span>
            </div>
          ))}
        </div>
      )}

      {vista === 'amortizacion' && <VistaAmortizacion ejercicio={ejercicio} />}

      {editando && <ModalAsiento inicial={editando} lectura={lectura} onCerrar={() => setEditando(null)} />}
    </div>
  )
}

function VistaMayor({ asientos, cuenta, setCuenta }: { asientos: Asiento[]; cuenta: string; setCuenta: (c: string) => void }) {
  const m = useMemo(() => mayor(asientos, cuenta), [asientos, cuenta])
  const usadas = useMemo(() => [...new Set(asientos.flatMap(a => a.lineas.map(l => l.cuenta)))].sort(), [asientos])
  return (
    <div className="tarjeta padded">
      <div className="tarjeta-cabecera">
        <div><h3>Mayor de {m.cuenta} {m.nombre}</h3><div className="sub">Saldo {eur(m.saldo)} (debe − haber)</div></div>
        <Select valor={cuenta} opciones={usadas.map(c => ({ valor: c, etiqueta: `${c} · ${nombreCuenta(c)}` }))} onCambio={setCuenta} pequeno ancho={280} />
      </div>
      <table className="tabla">
        <thead><tr><th>Asiento</th><th>Fecha</th><th>Concepto</th><th className="num">Debe</th><th className="num">Haber</th><th className="num">Saldo</th></tr></thead>
        <tbody>
          {m.movimientos.map((x, i) => <tr key={i}><td>{x.numero}</td><td>{fecha(x.fecha)}</td><td>{x.concepto}</td><td className="num">{num(x.debe)}</td><td className="num">{num(x.haber)}</td><td className="num">{eur(x.saldo)}</td></tr>)}
          {!m.movimientos.length && <tr><td colSpan={6} style={{ color: 'var(--texto-3)' }}>Sin movimientos.</td></tr>}
        </tbody>
      </table>
    </div>
  )
}

function VistaSumas({ asientos, onCuenta }: { asientos: Asiento[]; onCuenta: (c: string) => void }) {
  const [nivel, setNivel] = useState<string>('')
  const s = useMemo(() => sumasYSaldos(asientos, nivel ? Number(nivel) : undefined), [asientos, nivel])
  return (
    <div className="tarjeta padded">
      <div className="tarjeta-cabecera">
        <div><h3>Balance de sumas y saldos</h3></div>
        <Select valor={nivel} opciones={[{ valor: '', etiqueta: 'Por subcuenta' }, { valor: '3', etiqueta: 'Por cuenta (3 dígitos)' }]} onCambio={setNivel} pequeno ancho={200} />
      </div>
      <table className="tabla">
        <thead><tr><th>Cuenta</th><th>Nombre</th><th className="num">Debe</th><th className="num">Haber</th><th className="num">Saldo deudor</th><th className="num">Saldo acreedor</th></tr></thead>
        <tbody>
          {s.filas.map(f => <tr key={f.cuenta} className="clicable" onClick={() => onCuenta(f.cuenta)}><td>{f.cuenta}</td><td>{f.nombre}</td><td className="num">{num(f.debe)}</td><td className="num">{num(f.haber)}</td><td className="num">{num(f.saldoDeudor)}</td><td className="num">{num(f.saldoAcreedor)}</td></tr>)}
        </tbody>
        <tfoot><tr><td colSpan={2}><b>Totales</b></td><td className="num"><b>{eur(s.totales.debe)}</b></td><td className="num"><b>{eur(s.totales.haber)}</b></td><td className="num"><b>{eur(s.totales.saldoDeudor)}</b></td><td className="num"><b>{eur(s.totales.saldoAcreedor)}</b></td></tr></tfoot>
      </table>
    </div>
  )
}

function Masa({ m }: { m: MasaBalance }) {
  return (
    <>
      <div className="gst-partida nivel-0"><span>{m.titulo}</span><span>{eur(m.importe)}</span></div>
      {m.partidas.filter(p => p.importe).map(p => (
        <div key={p.clave} className="gst-partida" title={p.detalle.map(d => `${d.cuenta} ${d.nombre}: ${eur(d.importe)}`).join('\n')}><span>{p.titulo}</span><span>{eur(p.importe)}</span></div>
      ))}
    </>
  )
}

function VistaBalance({ asientos }: { asientos: Asiento[] }) {
  const b = useMemo(() => balance(asientos), [asientos])
  return (
    <>
      {!b.cuadra && <div className="error-formulario" style={{ marginBottom: 12 }}>El balance no cuadra: diferencia de {eur(b.diferencia)}. Revisa los asientos que no cuadran en el libro diario.</div>}
      <div className="gst-balance">
        <div className="tarjeta padded">
          <div className="tarjeta-cabecera"><div><h3>Activo</h3></div><b>{eur(b.activo.total)}</b></div>
          <Masa m={b.activo.noCorriente} />
          <Masa m={b.activo.corriente} />
        </div>
        <div className="tarjeta padded">
          <div className="tarjeta-cabecera"><div><h3>Patrimonio neto y pasivo</h3></div><b>{eur(b.patrimonioNetoYPasivo.total)}</b></div>
          <Masa m={b.patrimonioNetoYPasivo.patrimonioNeto} />
          <Masa m={b.patrimonioNetoYPasivo.pasivoNoCorriente} />
          <Masa m={b.patrimonioNetoYPasivo.pasivoCorriente} />
        </div>
      </div>
    </>
  )
}

function VistaAmortizacion({ ejercicio }: { ejercicio: number }) {
  const crm = useCrm()
  const filas = useMemo(() => cuadroAmortizacion(crm.datos, ejercicio), [crm.datos, ejercicio])
  return (
    <div className="tarjeta padded">
      <div className="tarjeta-cabecera"><div><h3>Cuadro de amortización</h3><div className="sub">Bienes de inversión de las facturas de compra · lineal por días</div></div></div>
      <table className="tabla">
        <thead><tr><th>Bien</th><th>Cuenta</th><th>Desde</th><th className="num">Años</th><th className="num">Valor</th><th className="num">Cuota {ejercicio}</th><th className="num">Acumulada</th><th className="num">Pendiente</th></tr></thead>
        <tbody>
          {filas.map(f => <tr key={f.facturaId + f.cuenta + f.descripcion}><td>{f.descripcion}</td><td>{f.cuenta}</td><td>{fecha(f.inicio)}</td><td className="num">{f.vidaUtil}</td><td className="num">{eur(f.valor)}</td><td className="num">{eur(f.cuotaEjercicio)}</td><td className="num">{eur(f.acumulada)}</td><td className="num">{eur(f.pendiente)}</td></tr>)}
          {!filas.length && <tr><td colSpan={8} style={{ color: 'var(--texto-3)' }}>No hay bienes de inversión. Se marcan en la pestaña Fiscal de la factura de compra.</td></tr>}
        </tbody>
      </table>
    </div>
  )
}

/** Cuentas del plan para el desplegable de cada línea. */
const OPC_CUENTAS = PLAN.map(c => ({ valor: c.codigo, etiqueta: `${c.codigo} · ${c.nombre}` }))

function ModalAsiento({ inicial, lectura, onCerrar }: { inicial: AsientoManual; lectura: boolean; onCerrar: () => void }) {
  const g = useGestoria()
  const [a, setA] = useState<AsientoManual>(inicial)
  const [error, setError] = useState<string | null>(null)
  const set = (c: Partial<AsientoManual>) => setA(x => ({ ...x, ...c }))
  const setLinea = (i: number, c: Partial<LineaAsiento>) => set({ lineas: a.lineas.map((l, j) => (j === i ? { ...l, ...c } : l)) })
  const debe = a.lineas.reduce((s, l) => s + (Number(l.debe) || 0), 0)
  const haber = a.lineas.reduce((s, l) => s + (Number(l.haber) || 0), 0)
  const cuadra = Math.abs(debe - haber) < 0.005 && debe > 0

  const guardar = async () => {
    if (!a.concepto.trim()) { setError('Escribe el concepto.'); return }
    if (a.lineas.some(l => !l.cuenta)) { setError('Cada línea necesita su cuenta.'); return }
    if (!cuadra) { setError('El asiento no cuadra: el debe tiene que ser igual al haber.'); return }
    await g.guardarAsiento({ ...a, ejercicio: Number(a.fecha.slice(0, 4)) || a.ejercicio, lineas: a.lineas.filter(l => l.debe || l.haber) })
    onCerrar()
  }
  const borrar = async () => {
    if (!(await confirmar('¿Borrar este asiento?', { texto: a.concepto, aceptar: 'Borrar', peligro: true }))) return
    await g.borrar('asientos', a.id)
    onCerrar()
  }

  return (
    <Modal titulo={a.id ? 'Asiento manual' : 'Nuevo asiento manual'} onCerrar={onCerrar} ancho pie={<>
      {a.id && !lectura && <button className="btn sutil peligro" onClick={() => void borrar()}><Trash2 size={15} /> Borrar</button>}
      <span style={{ flex: 1 }} />
      <span className={`chip pequeno ${cuadra ? 'ok' : 'error'}`}>{cuadra ? 'Cuadra' : `Diferencia ${eur(debe - haber)}`}</span>
      <button className="btn sutil" onClick={onCerrar}>{lectura ? 'Cerrar' : 'Cancelar'}</button>
      {!lectura && <button className="btn acento" onClick={() => void guardar()}>Guardar</button>}
    </>}>
      <fieldset disabled={lectura} className="formulario" style={{ border: 0, padding: 0, margin: 0 }}>
        <div className="fila-campos">
          <Campo label="Fecha"><input type="date" value={a.fecha} onChange={e => set({ fecha: e.target.value })} /></Campo>
          <Campo label="Tipo"><Select valor={a.tipo} opciones={(Object.keys(TIPOS_ASIENTO) as TipoAsiento[]).map(t => ({ valor: t, etiqueta: TIPOS_ASIENTO[t] }))} onCambio={v => set({ tipo: v as TipoAsiento })} /></Campo>
        </div>
        <Campo label="Concepto"><input value={a.concepto} onChange={e => set({ concepto: e.target.value })} placeholder="Aportación del capital social" /></Campo>
        <div className="gst-lineas-editor" style={{ fontSize: 12, color: 'var(--texto-3)' }}><span>Cuenta</span><span>Concepto de la línea</span><span>Debe</span><span>Haber</span><span /></div>
        {a.lineas.map((l, i) => (
          <div key={i} className="gst-lineas-editor">
            <Select valor={l.cuenta} opciones={[{ valor: '', etiqueta: 'Cuenta…' }, ...OPC_CUENTAS]} onCambio={v => setLinea(i, { cuenta: v })} pequeno />
            <input value={l.concepto ?? ''} onChange={e => setLinea(i, { concepto: e.target.value })} />
            <input type="number" step={0.01} value={l.debe || ''} onChange={e => setLinea(i, { debe: Number(e.target.value) || 0, haber: 0 })} />
            <input type="number" step={0.01} value={l.haber || ''} onChange={e => setLinea(i, { haber: Number(e.target.value) || 0, debe: 0 })} />
            <button className="btn sutil icono pequeno" onClick={() => set({ lineas: a.lineas.filter((_, j) => j !== i) })} title="Quitar línea"><Trash2 size={14} /></button>
          </div>
        ))}
        <button className="btn sutil pequeno" style={{ justifySelf: 'start' }} onClick={() => set({ lineas: [...a.lineas, { cuenta: '', debe: 0, haber: 0 }] })}><Plus size={14} /> Añadir línea</button>
        {error && <div className="error-formulario">{error}</div>}
      </fieldset>
    </Modal>
  )
}
