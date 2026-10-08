/**
 * Cierre anual: la lista guiada del ejercicio (amortizaciones, IVA del 4T,
 * conciliación bancaria, Impuesto sobre Sociedades, formulación, libros,
 * junta, depósito y modelo 200), con el cálculo del impuesto y el botón para
 * contabilizarlo. Los pasos del Registro Mercantil se marcan aquí con su fecha.
 */
import { useMemo, useState } from 'react'
import { CheckCircle2, ChevronLeft, ChevronRight, Circle, AlertCircle, MinusCircle, Calculator } from 'lucide-react'
import { useCrm } from '../../crm/contexto'
import { eur, fecha } from '../../crm/formato'
import { hoy } from '../../domain/fechas'
import { useGestion } from '../../gestion/store'
import { useGestoria } from '../store'
import { asientosDelEjercicio, lineasAsientoImpuesto, pasosCierre, type PasoCierre } from '../contabilidad'
import { calcularIS } from '../impuesto'
import type { ModeloFiscal } from '../types'

const ICONO: Record<PasoCierre['estado'], typeof CheckCircle2> = { hecho: CheckCircle2, pendiente: Circle, aviso: AlertCircle, 'no-aplica': MinusCircle }
const MERCANTIL: ModeloFiscal[] = ['formulacion', 'legalizacion', 'junta', 'deposito']

export function Cierre() {
  const g = useGestoria()
  const crm = useCrm()
  const gestion = useGestion()
  const lectura = g.acceso !== 'completo'
  // por defecto, el último ejercicio terminado
  const [ejercicio, setEjercicio] = useState(() => Number(hoy().slice(0, 4)) - (hoy().slice(5) < '07-31' ? 1 : 0))
  const asientos = useMemo(() => asientosDelEjercicio({ crm: crm.datos, gestion: gestion.datos, gestoria: g.datos, ejercicio, perfil: g.datos.perfil[0] ?? null }), [crm.datos, gestion.datos, g.datos, ejercicio])
  const pasos = useMemo(() => pasosCierre({ ejercicio, asientos, gestoria: g.datos, crm: crm.datos, perfil: g.datos.perfil[0] ?? null, gestion: gestion.datos }), [ejercicio, asientos, g.datos, crm.datos, gestion.datos])
  const is = useMemo(() => calcularIS({ crm: crm.datos, gestion: gestion.datos, gestoria: g.datos, perfil: g.perfil, ejercicio }), [crm.datos, gestion.datos, g.datos, g.perfil, ejercicio])
  const r = is.resultado
  const impuestoContabilizado = g.datos.asientos.some(a => a.ejercicio === ejercicio && a.tipo === 'impuesto')

  const marcar = async (modelo: ModeloFiscal) => {
    const existente = g.datos.presentaciones.find(p => p.modelo === modelo && p.periodo === String(ejercicio))
    await g.guardarPresentacion({
      ...(existente ?? { id: '', creadoEl: '', modelo, periodo: String(ejercicio), importe: 0, csv: '', nrc: '', justificante: '', casillas: {}, incluidos: [], complementariaDe: null, notas: '' }),
      estado: 'presentada', presentadaEl: hoy(),
    })
  }

  const contabilizarImpuesto = async () => {
    await g.guardarAsiento({
      id: '', creadoEl: '', fecha: `${ejercicio}-12-31`, ejercicio, tipo: 'impuesto', concepto: `Impuesto sobre Sociedades del ejercicio ${ejercicio}`,
      lineas: lineasAsientoImpuesto(r),
    })
    // el perfil recuerda las bases negativas pendientes y el primer ejercicio con base positiva (para el 15 %)
    await g.guardarPerfil({ ...g.perfil, basesNegativas: r.basesNegativasPendientes, primerEjercicioPositivo: r.primerEjercicioPositivo })
  }

  return (
    <div className="pagina">
      <div className="titulo-pagina">
        <div>
          <h1>Cierre anual.</h1>
          <div className="sub">Lo que hay que hacer para cerrar el ejercicio, en orden: contabilidad, impuesto y Registro Mercantil. Cada paso se comprueba con los datos; los mercantiles se marcan al hacerlos.</div>
        </div>
        <div className="acciones">
          <div className="ges-selector">
            <button onClick={() => setEjercicio(e => e - 1)}><ChevronLeft size={16} /></button>
            <b>Ejercicio {ejercicio}</b>
            <button onClick={() => setEjercicio(e => e + 1)}><ChevronRight size={16} /></button>
          </div>
        </div>
      </div>

      <div className="gst-dos">
        <div className="tarjeta padded">
          <div className="tarjeta-cabecera"><div><h3>Pasos del cierre</h3></div></div>
          {pasos.map(p => {
            const Ico = ICONO[p.estado]
            const mercantil = p.modelo && MERCANTIL.includes(p.modelo)
            return (
              <div key={p.clave} className="gst-paso">
                <span className={`ico ${p.estado}`}><Ico size={18} /></span>
                <span>{p.titulo}<small>{p.detalle}{p.plazo ? ` · plazo: ${fecha(p.plazo)}` : ''}</small></span>
                <span>
                  {!lectura && mercantil && p.estado !== 'hecho' && <button className="btn sutil pequeno" onClick={() => void marcar(p.modelo!)}>Hecho hoy</button>}
                  {p.modelo === '200' && <button className="btn sutil pequeno" onClick={() => g.abrirModelo('200', String(ejercicio))}>Ver el 200</button>}
                </span>
              </div>
            )
          })}
        </div>

        <div className="tarjeta padded">
          <div className="tarjeta-cabecera"><div><h3>Impuesto sobre Sociedades</h3><div className="sub">{r.tipoAplicado}</div></div><Calculator size={18} style={{ color: 'var(--faint)' }} /></div>
          <div className="gst-partida"><span>Resultado contable</span><span>{eur(r.resultadoContable)}</span></div>
          <div className="gst-partida"><span>Ajustes positivos</span><span>{eur(r.ajustesPositivos)}</span></div>
          {is.ajustes.detalle.map((a, i) => <div key={i} className="gst-partida nivel-2"><span>{a.concepto}</span><span>{eur(a.importe)}</span></div>)}
          <div className="gst-partida"><span>Ajustes negativos</span><span>{eur(-r.ajustesNegativos)}</span></div>
          <div className="gst-partida nivel-0"><span>Base imponible previa</span><span>{eur(r.baseImponiblePrevia)}</span></div>
          <div className="gst-partida"><span>Compensación de bases negativas</span><span>{eur(-r.compensacionBins)}</span></div>
          <div className="gst-partida nivel-0"><span>Base imponible</span><span>{eur(r.baseImponible)}</span></div>
          {r.tramos.map((t, i) => <div key={i} className="gst-partida nivel-2"><span>{eur(t.base)} al {t.tipo} %</span><span>{eur(t.cuota)}</span></div>)}
          <div className="gst-partida"><span>Cuota íntegra</span><span>{eur(r.cuotaIntegra)}</span></div>
          <div className="gst-partida"><span>Pagos fraccionados y retenciones</span><span>{eur(-(r.pagosFraccionados + r.retenciones))}</span></div>
          <div className="ges-resultado"><span>{r.cuotaDiferencial >= 0 ? 'A ingresar' : 'A devolver'}</span><span className="valor">{eur(Math.abs(r.cuotaDiferencial))}</span></div>
          {r.basesNegativasGeneradas > 0 && <div className="ges-aviso">El ejercicio deja una base negativa de {eur(r.basesNegativasGeneradas)} para compensar en los siguientes.</div>}
          {!lectura && (
            <button className="btn acento" style={{ marginTop: 12 }} disabled={impuestoContabilizado} onClick={() => void contabilizarImpuesto()}>
              {impuestoContabilizado ? 'Impuesto ya contabilizado' : 'Contabilizar el impuesto (31/12)'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
