/**
 * Modelos: una ficha por modelo y periodo con sus casillas calculadas de los
 * datos del CRM, los avisos del cálculo y el estado de la presentación
 * (pendiente, preparada, presentada, pagada o domiciliada) con su
 * justificante. Al presentar se guarda una foto de las casillas y de los
 * documentos incluidos: el modelo presentado ya no se recalcula, y si después
 * cambia algo se avisa de que hará falta una complementaria.
 */
import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ChevronLeft, ChevronRight, Download, FileCheck2, Save } from 'lucide-react'
import { useApp } from '../../store'
import { useCrm } from '../../crm/contexto'
import { descargar } from '../../crm/csv'
import { eur, fecha } from '../../crm/formato'
import { hoy } from '../../domain/fechas'
import { Campo } from '../../ui/basicos'
import { Select } from '../../ui/Select'
import { useGestion } from '../../gestion/store'
import { useGestoria } from '../store'
import type { EstadoPresentacion, ModeloFiscal, Presentacion } from '../types'
import { NOMBRE_MODELO, apuntesFiscales, calcularModelo, clavePeriodo, etiquetaDeClave, periodoDeClave, type Periodo } from '../fiscal'
import { calcular202, calcularIS } from '../impuesto'

/** Cómo se divide el tiempo en cada modelo. */
const TIPO_PERIODO: Record<ModeloFiscal, Periodo['tipo']> = {
  '303': 'T', '349': 'T', '111': 'T', '115': 'T', '123': 'T', '369': 'T', '202': 'P',
  '390': 'A', '190': 'A', '180': 'A', '193': 'A', '347': 'A', '200': 'A', '232': 'A', '036': 'A',
  formulacion: 'A', legalizacion: 'A', junta: 'A', deposito: 'A',
}
const SIN_CALCULO: ModeloFiscal[] = ['036', '232', 'formulacion', 'legalizacion', 'junta', 'deposito']
const ESTADOS: Record<EstadoPresentacion, string> = {
  pendiente: 'Pendiente', preparada: 'Preparada', presentada: 'Presentada', pagada: 'Pagada', domiciliada: 'Domiciliada', 'no-procede': 'No procede',
}
const TONO: Record<EstadoPresentacion, string> = { pendiente: 'aviso', preparada: 'acento', presentada: 'ok', pagada: 'ok', domiciliada: 'ok', 'no-procede': 'contorno' }

/** El periodo que toca mirar por defecto: el último cerrado. */
function periodoPorDefecto(tipo: Periodo['tipo']): Periodo {
  const h = hoy(), anio = Number(h.slice(0, 4)), mes = Number(h.slice(5, 7))
  if (tipo === 'A') return { anio: anio - 1, tipo, n: 0 }
  if (tipo === 'P') return { anio, tipo, n: mes <= 4 ? 1 : mes <= 10 ? 2 : 3 }
  if (tipo === 'M') return mes === 1 ? { anio: anio - 1, tipo, n: 12 } : { anio, tipo, n: mes - 1 }
  const t = Math.floor((mes - 1) / 3) + 1
  return t === 1 ? { anio: anio - 1, tipo, n: 4 } : { anio, tipo, n: t - 1 }
}

function mover(p: Periodo, d: number): Periodo {
  if (p.tipo === 'A') return { ...p, anio: p.anio + d }
  const tam = p.tipo === 'T' ? 4 : p.tipo === 'P' ? 3 : 12
  const i = p.anio * tam + (p.n - 1) + d
  return { anio: Math.floor(i / tam), tipo: p.tipo, n: (i % tam) + 1 }
}

interface Calculo {
  lineas: { casilla: string; descripcion: string; importe: number }[]
  casillas: Record<string, number>
  resultado: number
  incluidos: string[]
  avisos: string[]
  sinActividad: boolean
}

export function Modelos() {
  const g = useGestoria()
  const crm = useCrm()
  const gestion = useGestion()
  const { avisar } = useApp()
  const lectura = g.acceso !== 'completo'
  const inicial = g.seleccion
  const [modelo, setModelo] = useState<ModeloFiscal>(inicial?.modelo ?? '303')
  const [p, setP] = useState<Periodo>(() => (inicial && periodoDeClave(inicial.periodo)) || periodoPorDefecto(TIPO_PERIODO[inicial?.modelo ?? '303']))
  useEffect(() => {
    if (!g.seleccion) return
    setModelo(g.seleccion.modelo)
    const x = periodoDeClave(g.seleccion.periodo)
    if (x) setP(x)
  }, [g.seleccion])

  const cambiarModelo = (m: ModeloFiscal) => {
    setModelo(m)
    if (TIPO_PERIODO[m] !== p.tipo) setP(periodoPorDefecto(TIPO_PERIODO[m]))
  }

  const clave = clavePeriodo(p)
  const apuntes = useMemo(() => apuntesFiscales(crm.datos, gestion.datos), [crm.datos, gestion.datos])

  const calculo = useMemo<Calculo | null>(() => {
    if (SIN_CALCULO.includes(modelo)) return null
    if (modelo === '200') {
      const is = calcularIS({ crm: crm.datos, gestion: gestion.datos, gestoria: g.datos, perfil: g.perfil, ejercicio: p.anio })
      const r = is.resultado
      const lineas = [
        { casilla: 'RC', descripcion: 'Resultado de la cuenta de pérdidas y ganancias', importe: r.resultadoContable },
        { casilla: 'A+', descripcion: 'Ajustes positivos (gastos no deducibles)', importe: r.ajustesPositivos },
        { casilla: 'A−', descripcion: 'Ajustes negativos', importe: r.ajustesNegativos },
        { casilla: 'BP', descripcion: 'Base imponible previa', importe: r.baseImponiblePrevia },
        { casilla: 'BIN', descripcion: 'Compensación de bases imponibles negativas', importe: r.compensacionBins },
        { casilla: 'BI', descripcion: 'Base imponible', importe: r.baseImponible },
        { casilla: 'CI', descripcion: `Cuota íntegra (${r.tipoAplicado})`, importe: r.cuotaIntegra },
        { casilla: 'D', descripcion: 'Deducciones y bonificaciones', importe: r.deducciones },
        { casilla: 'CL', descripcion: 'Cuota líquida', importe: r.cuotaLiquida },
        { casilla: 'R', descripcion: 'Retenciones e ingresos a cuenta', importe: r.retenciones },
        { casilla: 'PF', descripcion: 'Pagos fraccionados (202)', importe: r.pagosFraccionados },
        { casilla: 'CD', descripcion: 'Cuota diferencial', importe: r.cuotaDiferencial },
      ]
      return {
        lineas, casillas: { ...Object.fromEntries(lineas.map(l => [l.casilla, l.importe])), base202: is.base202 }, resultado: r.cuotaDiferencial, incluidos: [],
        avisos: ['Los importes salen de la contabilidad de la app. El 200 se presenta en Sociedades WEB de la AEAT copiando estas cifras en sus casillas.'], sinActividad: false,
      }
    }
    if (modelo === '202') {
      const r = calcular202(g.datos, g.perfil, p.anio, p.n as 1 | 2 | 3)
      const lineas = [{ casilla: '01', descripcion: 'Pago fraccionado a ingresar', importe: r.importe }]
      return { lineas, casillas: { '01': r.importe }, resultado: r.importe, incluidos: [], avisos: [r.motivo], sinActividad: !r.obligado }
    }
    const r = calcularModelo(modelo, clave, { apuntes, presentaciones: g.datos.presentaciones })
    return r ? { lineas: r.lineas, casillas: r.casillas, resultado: r.resultado, incluidos: r.incluidos, avisos: r.avisos, sinActividad: r.sinActividad } : null
  }, [modelo, clave, p, apuntes, crm.datos, gestion.datos, g.datos, g.perfil])

  const guardada = g.datos.presentaciones.find(x => x.modelo === modelo && x.periodo === clave)
  const base: Presentacion = guardada ?? {
    id: '', creadoEl: '', modelo, periodo: clave, estado: 'pendiente', importe: 0, presentadaEl: null, csv: '', nrc: '', justificante: '', casillas: {}, incluidos: [],
    complementariaDe: null, notas: '',
  }
  const [pr, setPr] = useState<Presentacion>(base)
  useEffect(() => { setPr(base) }, [guardada?.id, guardada?.actualizadoEl, modelo, clave]) // eslint-disable-line react-hooks/exhaustive-deps
  const set = (c: Partial<Presentacion>) => setPr(x => ({ ...x, ...c }))

  const presentada = ['presentada', 'pagada', 'domiciliada'].includes(base.estado)
  // la foto guardada manda una vez presentado; si el cálculo de hoy no coincide, algo cambió después
  const difiere = presentada && calculo && Math.abs((base.importe || 0) - calculo.resultado) >= 0.01
  const lineasMostradas = presentada && Object.keys(base.casillas).length ? (calculo?.lineas ?? []).map(l => ({ ...l, importe: base.casillas[l.casilla] ?? l.importe })) : (calculo?.lineas ?? [])

  const guardar = async (estado?: EstadoPresentacion) => {
    const nuevo = estado ?? pr.estado
    const foto = (nuevo === 'presentada' || nuevo === 'preparada') && !presentada && calculo
      ? { casillas: calculo.casillas, incluidos: calculo.incluidos, importe: calculo.resultado } : {}
    await g.guardarPresentacion({ ...pr, ...foto, estado: nuevo, presentadaEl: nuevo === 'presentada' && !pr.presentadaEl ? hoy() : pr.presentadaEl })
  }

  const exportar = () => {
    if (!calculo) return
    const filas = lineasMostradas.map(l => `"${l.casilla}";"${l.descripcion.replace(/"/g, '""')}";${l.importe.toFixed(2).replace('.', ',')}`)
    descargar(`modelo-${modelo}-${clave}.csv`, ['Casilla;Descripción;Importe', ...filas].join('\r\n'))
    avisar('Casillas exportadas: cópialas en el formulario de la Sede de la AEAT')
  }

  return (
    <div className="pagina">
      <div className="titulo-pagina">
        <div>
          <h1>Modelos.</h1>
          <div className="sub">Cada modelo calculado con lo registrado en el CRM. Al marcarlo como presentado se guarda la foto de sus casillas y el justificante.</div>
        </div>
        <div className="acciones">
          <Select valor={modelo} opciones={(Object.keys(TIPO_PERIODO) as ModeloFiscal[]).map(m => ({ valor: m, etiqueta: `${/^\d/.test(m) ? m + ' · ' : ''}${NOMBRE_MODELO[m]}` }))} onCambio={v => cambiarModelo(v as ModeloFiscal)} ancho={330} />
          <div className="ges-selector">
            <button onClick={() => setP(mover(p, -1))}><ChevronLeft size={16} /></button>
            <b>{etiquetaDeClave(clave)}</b>
            <button onClick={() => setP(mover(p, 1))}><ChevronRight size={16} /></button>
          </div>
          {calculo && <button className="btn" onClick={exportar}><Download size={16} /> Casillas</button>}
        </div>
      </div>

      <div className="gst-dos">
        <div className="tarjeta padded">
          <div className="tarjeta-cabecera">
            <div><h3>{/^\d/.test(modelo) ? `Modelo ${modelo}` : NOMBRE_MODELO[modelo]} · {etiquetaDeClave(clave)}</h3><div className="sub">{NOMBRE_MODELO[modelo]}</div></div>
            <span className={`chip pequeno punto ${TONO[base.estado]}`}>{ESTADOS[base.estado]}</span>
          </div>
          {difiere && (
            <div className="error-formulario" style={{ marginBottom: 12 }}>
              <AlertTriangle size={14} /> Se presentó con un resultado de {eur(base.importe)} y hoy sale {eur(calculo!.resultado)}: algo cambió después de presentar. Hará falta una declaración complementaria o rectificativa.
            </div>
          )}
          {!calculo ? (
            <div className="ges-aviso">{SIN_CALCULO.includes(modelo) ? 'Este trámite no tiene casillas que calcular: aquí solo se sigue su estado, su fecha y su justificante.' : 'Sin datos para calcular este modelo.'}</div>
          ) : (
            <>
              {calculo.sinActividad && <div className="ges-aviso" style={{ marginBottom: 12 }}>Sin actividad en el periodo. {modelo === '303' ? 'El 303 se presenta igualmente, marcando «sin actividad».' : ''}</div>}
              <table className="tabla gst-casillas-modelo">
                <thead><tr><th>Casilla</th><th>Concepto</th><th className="num">Importe</th></tr></thead>
                <tbody>
                  {lineasMostradas.map((l, i) => <tr key={l.casilla + i}><td className="casilla">{l.casilla}</td><td>{l.descripcion}</td><td className="num">{eur(l.importe)}</td></tr>)}
                </tbody>
              </table>
              <div className="ges-resultado">
                <span>Resultado</span>
                <span className="valor" style={calculo.resultado > 0 ? { color: 'var(--danger)' } : undefined}>{eur(presentada ? base.importe : calculo.resultado)}</span>
              </div>
              {calculo.avisos.map((a, i) => <div key={i} className="ges-aviso" style={{ marginTop: 8 }}>{a}</div>)}
              {calculo.incluidos.length > 0 && <div style={{ fontSize: 12.5, color: 'var(--texto-3)', marginTop: 8 }}>{calculo.incluidos.length} documentos incluidos.</div>}
            </>
          )}
        </div>

        <div className="tarjeta padded">
          <div className="tarjeta-cabecera"><div><h3>Presentación</h3><div className="sub">{presentada ? `Presentado el ${fecha(base.presentadaEl)}` : 'Sin presentar'}</div></div><FileCheck2 size={18} style={{ color: 'var(--faint)' }} /></div>
          <fieldset disabled={lectura} className="formulario" style={{ border: 0, padding: 0, margin: 0 }}>
            <Campo label="Estado"><Select valor={pr.estado} opciones={(Object.keys(ESTADOS) as EstadoPresentacion[]).map(e => ({ valor: e, etiqueta: ESTADOS[e] }))} onCambio={v => set({ estado: v as EstadoPresentacion })} /></Campo>
            <div className="fila-campos">
              <Campo label="Presentado el"><input type="date" value={pr.presentadaEl ?? ''} onChange={e => set({ presentadaEl: e.target.value || null })} /></Campo>
              <Campo label="Código seguro de verificación"><input value={pr.csv} onChange={e => set({ csv: e.target.value })} /></Campo>
            </div>
            <Campo label="NRC del pago (si no se domicilió)"><input value={pr.nrc} onChange={e => set({ nrc: e.target.value })} /></Campo>
            <Campo label="Enlace al justificante en PDF"><input value={pr.justificante} onChange={e => set({ justificante: e.target.value })} placeholder="https://…" /></Campo>
            <Campo label="Notas"><textarea rows={2} value={pr.notas} onChange={e => set({ notas: e.target.value })} /></Campo>
            {!lectura && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="btn acento" onClick={() => void guardar()}><Save size={15} /> Guardar</button>
                {!presentada && <button className="btn" onClick={() => void guardar('presentada')}><FileCheck2 size={15} /> Marcar presentado hoy</button>}
                {base.estado === 'presentada' && <button className="btn" onClick={() => void guardar('domiciliada')}>Domiciliado</button>}
                {base.estado === 'presentada' && <button className="btn" onClick={() => void guardar('pagada')}>Pagado</button>}
              </div>
            )}
          </fieldset>
          {!SIN_CALCULO.includes(modelo) && modelo !== '200' && <div className="ges-aviso" style={{ marginTop: 12 }}>Para presentar: entra en la Sede de la AEAT con el certificado de la sociedad, abre el formulario del modelo y copia estas casillas (o expórtalas). Después guarda aquí el justificante.</div>}
        </div>
      </div>
    </div>
  )
}
