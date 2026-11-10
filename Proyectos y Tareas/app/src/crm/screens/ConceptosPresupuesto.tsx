/**
 * Conceptos del presupuesto de ofertas y pedidos de venta: cómo se desglosa
 * (por fases, solo el concepto o con las líneas), el concepto, las fases del
 * proyecto (semanas, pago e importe), la forma de pago, las condiciones, el
 * mantenimiento opcional y qué apartados salen en el impreso. Es lo que la
 * calculadora no sabe y el presupuesto impreso necesita.
 */
import { useMemo } from 'react'
import { ArrowDown, ArrowUp, CalendarClock, ListChecks, Plus, Scale, X } from 'lucide-react'
import type { FasePresupuesto, LineaDocumento, MantenimientoPresupuesto, Presupuesto } from '../types'
import type { CalculoGuardado } from '../../tarifas/motor'
import { useCuotaCalculadora } from '../cuotaCalculadora'
import { totales } from '../documentos'
import { eur } from '../formato'
import {
  APARTADOS, MODOS_PRESUPUESTO, condicionesHabituales, cuadrarImportes, cuotaMantenimiento, formaPagoHabitual, normalizarPresupuesto, nuevaFase,
  pagosPorFase, sumaFases,
} from '../presupuesto'
import { Numero } from './Campos'

export interface DocConPresupuesto {
  lineas: LineaDocumento[]
  calculo?: CalculoGuardado | null
  presupuesto?: Presupuesto | null
  /** Solo en ofertas: si el concepto está vacío, se imprime esto. */
  alcance?: string
}

function mover<T>(lista: T[], i: number, d: -1 | 1): T[] {
  const j = i + d
  if (j < 0 || j >= lista.length) return lista
  const copia = [...lista]
  ;[copia[i], copia[j]] = [copia[j], copia[i]]
  return copia
}

export function ConceptosPresupuesto({ doc, bloqueado, onCambio }: { doc: DocConPresupuesto; bloqueado: boolean; onCambio: (p: Presupuesto) => void }) {
  const p = useMemo(() => normalizarPresupuesto(doc.presupuesto), [doc.presupuesto])
  const cuotaCalc = useCuotaCalculadora(doc.calculo)
  const base = Math.round(totales(doc).base * 100) / 100

  const cambiar = (cambio: Partial<Presupuesto>) => onCambio({ ...p, ...cambio })
  const cambiarFase = (i: number, c: Partial<FasePresupuesto>) => cambiar({ fases: p.fases.map((f, j) => (j === i ? { ...f, ...c } : f)) })
  const cambiarMant = (c: Partial<MantenimientoPresupuesto>) => cambiar({ mantenimiento: { ...p.mantenimiento, ...c } })

  const totalFases = sumaFases(p)
  const difFases = Math.round((totalFases - base) * 100) / 100
  const porFases = p.modo === 'fases'
  const cuota = cuotaMantenimiento(p, cuotaCalc)

  return (
    <div className="crm-presupuesto">
      <p className="tar-ayuda">
        Lo que sale en el presupuesto impreso además de los importes. Elige cómo se desglosa y qué apartados se imprimen.
      </p>

      <div className="crm-presupuesto-modo" role="radiogroup" aria-label="Cómo se desglosa el presupuesto">
        {MODOS_PRESUPUESTO.map(m => (
          <button key={m.id} type="button" role="radio" aria-checked={p.modo === m.id} className={p.modo === m.id ? 'activo' : ''}
            disabled={bloqueado} onClick={() => cambiar({ modo: m.id })}>
            <b>{m.etiqueta}</b><span>{m.detalle}</span>
          </button>
        ))}
      </div>

      <div className="crm-campos">
        <div className="crm-campo completo">
          <label htmlFor="pres-concepto">Concepto</label>
          {bloqueado
            ? <div className="crm-valor" style={{ whiteSpace: 'pre-line' }}>{p.concepto || <span className="crm-apagado">—</span>}</div>
            : <textarea id="pres-concepto" value={p.concepto} onChange={e => cambiar({ concepto: e.target.value })}
                placeholder={doc.alcance ? `Vacío: se imprime el alcance de la oferta («${doc.alcance.slice(0, 80)}${doc.alcance.length > 80 ? '…' : ''}»)` : 'Diseño, desarrollo y puesta en marcha de…'} />}
        </div>
        <div className="crm-campo">
          <label htmlFor="pres-moneda">Moneda</label>
          {bloqueado
            ? <div className="crm-valor">{p.moneda}</div>
            : <input id="pres-moneda" value={p.moneda} maxLength={3} onChange={e => cambiar({ moneda: e.target.value.toUpperCase() })} autoComplete="off" />}
        </div>
      </div>

      {porFases && <>
        <h3 className="tar-ficha-titulo">Fases del proyecto</h3>
        <div className="crm-lineas-marco">
          <table className="crm-lineas crm-fases">
            <thead>
              <tr>
                <th style={{ width: 60 }}>Fase</th><th>Título y descripción</th><th style={{ width: 96 }}>Semanas</th><th style={{ width: 150 }}>Pago</th>
                <th className="num" style={{ width: 120 }}>Importe</th><th style={{ width: bloqueado ? 0 : 96 }} />
              </tr>
            </thead>
            <tbody>
              {p.fases.map((f, i) => (
                <tr key={i}>
                  <td><input value={f.fase} onChange={e => cambiarFase(i, { fase: e.target.value })} disabled={bloqueado} aria-label="Fase" /></td>
                  <td>
                    <input className="titulo" value={f.titulo} onChange={e => cambiarFase(i, { titulo: e.target.value })} disabled={bloqueado} aria-label="Título de la fase" placeholder="Título" />
                    <input value={f.descripcion} onChange={e => cambiarFase(i, { descripcion: e.target.value })} disabled={bloqueado} aria-label="Descripción de la fase" placeholder="Descripción (opcional)" />
                  </td>
                  <td><input value={f.semanas} onChange={e => cambiarFase(i, { semanas: e.target.value })} disabled={bloqueado} aria-label="Semanas" placeholder="1 - 3" /></td>
                  <td><input value={f.pago} onChange={e => cambiarFase(i, { pago: e.target.value })} disabled={bloqueado} aria-label="Pago" placeholder={i === 0 ? 'A la firma' : 'Antes de sem. 4'} /></td>
                  <td className="num"><Numero valor={f.importe} onCambio={n => cambiarFase(i, { importe: n })} step={0.01} min={0} disabled={bloqueado} aria-label="Importe" /></td>
                  <td>{!bloqueado && (
                    <span className="crm-fila-acciones">
                      <button type="button" className="btn sutil icono pequeno" aria-label="Subir" disabled={i === 0} onClick={() => cambiar({ fases: mover(p.fases, i, -1) })}><ArrowUp size={14} /></button>
                      <button type="button" className="btn sutil icono pequeno" aria-label="Bajar" disabled={i === p.fases.length - 1} onClick={() => cambiar({ fases: mover(p.fases, i, 1) })}><ArrowDown size={14} /></button>
                      <button type="button" className="btn sutil icono pequeno" aria-label="Quitar fase" onClick={() => cambiar({ fases: p.fases.filter((_, j) => j !== i) })}><X size={14} /></button>
                    </span>
                  )}</td>
                </tr>
              ))}
              {!p.fases.length && <tr><td colSpan={6} className="crm-vacio">Sin fases: mientras no las haya, el presupuesto enseña las líneas.{!bloqueado && ' Añade la primera con «Nueva fase».'}</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="crm-presupuesto-pie">
          {!bloqueado && <div className="crm-presupuesto-botones">
            <button type="button" className="btn pequeno" onClick={() => cambiar({ fases: [...p.fases, nuevaFase(p.fases.length)] })}><Plus size={14} /> Nueva fase</button>
            {p.fases.length > 0 && (
              <button type="button" className="btn pequeno" title="La primera a la firma y el resto antes de su primera semana" onClick={() => cambiar({ fases: pagosPorFase(p.fases) })}>
                <CalendarClock size={14} /> Rellenar pagos
              </button>
            )}
            {p.fases.length > 0 && difFases !== 0 && base > 0 && (
              <button type="button" className="btn pequeno" title="Reparte la base imponible entre las fases manteniendo sus proporciones"
                onClick={() => { const r = cuadrarImportes(p.fases.map(f => f.importe), base); cambiar({ fases: p.fases.map((f, i) => ({ ...f, importe: r[i] })) }) }}>
                <Scale size={14} /> Cuadrar con la base imponible
              </button>
            )}
          </div>}
          {p.fases.length > 0 && (
            <div className={`crm-cuadre ${difFases === 0 ? 'ok' : 'aviso'}`}>
              Suma de las fases: <b>{eur(totalFases)}</b>
              {difFases === 0 ? ' · cuadra con la base imponible' : ` · la base imponible es ${eur(base)} (${difFases > 0 ? 'sobran' : 'faltan'} ${eur(Math.abs(difFases))})`}
            </div>
          )}
        </div>
      </>}
      {p.modo === 'concepto' && <div className="tar-nota">Se imprime el concepto y debajo la base imponible, los impuestos y el total, sin desglose.</div>}
      {p.modo === 'lineas' && <div className="tar-nota">Se imprimen las líneas de la calculadora con su cantidad, precio e importe.</div>}

      <div className="crm-campos">
        <TextoConPartida id="pres-formapago" titulo="Forma de pago" valor={p.formaPago} bloqueado={bloqueado}
          onCambio={v => cambiar({ formaPago: v })} partida={() => formaPagoHabitual(p.modo)} textoPartida="Poner la habitual" />
        <TextoConPartida id="pres-condiciones" titulo="Condiciones (una por línea)" valor={p.condiciones} bloqueado={bloqueado}
          onCambio={v => cambiar({ condiciones: v })} partida={() => condicionesHabituales(porFases ? p.fases : [])} textoPartida="Poner las habituales" />
      </div>

      <h3 className="tar-ficha-titulo">Soporte y mantenimiento (opcional)</h3>
      <p className="tar-ayuda">El cliente marca al firmar si lo contrata. Sale en el impreso con la cuota y la permanencia mínima.</p>
      <div className="crm-campos">
        <div className="crm-campo">
          <label htmlFor="pres-cuota">Cuota mensual</label>
          {bloqueado
            ? <div className="crm-valor">{eur(cuota)}</div>
            : <Numero id="pres-cuota" valor={cuota} step={10} min={0} onCambio={n => cambiarMant({ cuota: n })} />}
          <small className="crm-presupuesto-nota">
            {p.mantenimiento.cuota == null
              ? `La de la calculadora${cuotaCalc ? '' : ' (sin cálculo, 0 €)'}.`
              : <>Pactada. {!bloqueado && <button type="button" className="crm-enlace" onClick={() => cambiarMant({ cuota: null })}>Usar la de la calculadora ({eur(cuotaCalc)})</button>}</>}
          </small>
        </div>
        <div className="crm-campo">
          <label htmlFor="pres-meses">Permanencia mínima (meses)</label>
          {bloqueado
            ? <div className="crm-valor">{p.mantenimiento.meses}</div>
            : <Numero id="pres-meses" valor={p.mantenimiento.meses} step={1} min={1} onCambio={n => cambiarMant({ meses: Math.max(1, Math.floor(n) || 1) })} />}
        </div>
      </div>

      <h3 className="tar-ficha-titulo">Qué se imprime</h3>
      <div className="crm-presupuesto-incluir">
        {APARTADOS.filter(a => !a.soloFases || porFases).map(a => (
          <label key={a.id}>
            <input type="checkbox" checked={p.incluir[a.id]} disabled={bloqueado}
              onChange={e => cambiar({ incluir: { ...p.incluir, [a.id]: e.target.checked } })} /> {a.etiqueta}
          </label>
        ))}
      </div>
    </div>
  )
}

function TextoConPartida({ id, titulo, valor, bloqueado, onCambio, partida, textoPartida }: {
  id: string; titulo: string; valor: string; bloqueado: boolean; onCambio: (v: string) => void; partida: () => string; textoPartida: string
}) {
  return (
    <div className="crm-campo completo">
      <label htmlFor={id}>{titulo}</label>
      {bloqueado
        ? <div className="crm-valor" style={{ whiteSpace: 'pre-line' }}>{valor || <span className="crm-apagado">—</span>}</div>
        : <textarea id={id} rows={4} value={valor} onChange={e => onCambio(e.target.value)} />}
      {!bloqueado && !valor.trim() && (
        <div className="crm-presupuesto-botones" style={{ marginTop: 6 }}>
          <button type="button" className="btn pequeno" onClick={() => onCambio(partida())}><ListChecks size={14} /> {textoPartida}</button>
        </div>
      )}
    </div>
  )
}
