/**
 * Conceptos del presupuesto de ofertas y pedidos de venta: el texto del
 * concepto, las fases del proyecto (con semanas e importe), la forma de pago
 * por hitos y las condiciones. Es lo que la calculadora no sabe y el
 * presupuesto impreso necesita; si no hay fases, el impreso usa las líneas.
 */
import { useMemo } from 'react'
import { ArrowDown, ArrowUp, ListChecks, Plus, Scale, X } from 'lucide-react'
import type { FasePresupuesto, HitoPago, LineaDocumento, Presupuesto } from '../types'
import type { CalculoGuardado } from '../../tarifas/motor'
import { calcular, normalizarCalculo } from '../../tarifas/motor'
import { useTarifas } from '../../tarifas/store'
import { totales } from '../documentos'
import { eur } from '../formato'
import {
  condicionesHabituales, cuadrarImportes, hitosPorFase, normalizarPresupuesto, nuevaFase, nuevoHito, sumaFases, sumaHitos,
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
  const { tarifas } = useTarifas()
  const base = Math.round(totales(doc).base * 100) / 100
  const cuota = useMemo(() => (doc.calculo?.entrada ? calcular(tarifas, normalizarCalculo(doc.calculo.entrada, tarifas)).mantenimiento.cuota : 0), [doc.calculo, tarifas])

  const cambiar = (cambio: Partial<Presupuesto>) => onCambio({ ...p, ...cambio })
  const cambiarFase = (i: number, c: Partial<FasePresupuesto>) => cambiar({ fases: p.fases.map((f, j) => (j === i ? { ...f, ...c } : f)) })
  const cambiarHito = (i: number, c: Partial<HitoPago>) => cambiar({ hitos: p.hitos.map((h, j) => (j === i ? { ...h, ...c } : h)) })

  const totalFases = sumaFases(p)
  const totalHitos = sumaHitos(p)
  const difFases = Math.round((totalFases - base) * 100) / 100
  const difHitos = Math.round((totalHitos - base) * 100) / 100

  return (
    <div className="crm-presupuesto">
      <p className="tar-ayuda">
        Lo que sale en el presupuesto impreso además de los importes: el concepto, las fases del proyecto, cómo se paga y las condiciones.
        Si no hay fases, el impreso enseña las líneas de la calculadora.
      </p>

      <div className="crm-campos">
        <div className="crm-campo completo">
          <label htmlFor="pres-concepto">Concepto</label>
          {bloqueado
            ? <div className="crm-valor">{p.concepto || <span className="crm-apagado">—</span>}</div>
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

      <h3 className="tar-ficha-titulo">Fases del proyecto</h3>
      <div className="crm-lineas-marco">
        <table className="crm-lineas crm-fases">
          <thead>
            <tr>
              <th style={{ width: 64 }}>Fase</th><th>Título y descripción</th><th style={{ width: 110 }}>Semanas</th>
              <th className="num" style={{ width: 130 }}>Importe</th><th style={{ width: bloqueado ? 0 : 96 }} />
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
            {!p.fases.length && <tr><td colSpan={5} className="crm-vacio">Sin fases: el presupuesto enseñará las líneas.{!bloqueado && ' Añade la primera con «Nueva fase».'}</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="crm-presupuesto-pie">
        {!bloqueado && <div className="crm-presupuesto-botones">
          <button type="button" className="btn pequeno" onClick={() => cambiar({ fases: [...p.fases, nuevaFase(p.fases.length)] })}><Plus size={14} /> Nueva fase</button>
          {p.fases.length > 0 && difFases !== 0 && base > 0 && (
            <button type="button" className="btn pequeno" title="Reparte la base imponible entre las fases manteniendo sus proporciones"
              onClick={() => { const r = cuadrarImportes(p.fases.map(f => f.importe), base); cambiar({ fases: p.fases.map((f, i) => ({ ...f, importe: r[i] })) }) }}>
              <Scale size={14} /> Cuadrar con la base imponible
            </button>
          )}
        </div>}
        {p.fases.length > 0 && <Cuadre etiqueta="Suma de las fases" suma={totalFases} base={base} dif={difFases} />}
      </div>

      <h3 className="tar-ficha-titulo">Forma de pago</h3>
      <div className="crm-lineas-marco">
        <table className="crm-lineas">
          <thead>
            <tr><th style={{ width: 200 }}>Hito</th><th>Vencimiento</th><th className="num" style={{ width: 130 }}>Importe</th><th style={{ width: bloqueado ? 0 : 96 }} /></tr>
          </thead>
          <tbody>
            {p.hitos.map((h, i) => (
              <tr key={i}>
                <td><input value={h.hito} onChange={e => cambiarHito(i, { hito: e.target.value })} disabled={bloqueado} aria-label="Hito" placeholder="Fase 0" /></td>
                <td><input value={h.vencimiento} onChange={e => cambiarHito(i, { vencimiento: e.target.value })} disabled={bloqueado} aria-label="Vencimiento" placeholder="A la firma del presupuesto" /></td>
                <td className="num"><Numero valor={h.importe} onCambio={n => cambiarHito(i, { importe: n })} step={0.01} min={0} disabled={bloqueado} aria-label="Importe" /></td>
                <td>{!bloqueado && (
                  <span className="crm-fila-acciones">
                    <button type="button" className="btn sutil icono pequeno" aria-label="Subir" disabled={i === 0} onClick={() => cambiar({ hitos: mover(p.hitos, i, -1) })}><ArrowUp size={14} /></button>
                    <button type="button" className="btn sutil icono pequeno" aria-label="Bajar" disabled={i === p.hitos.length - 1} onClick={() => cambiar({ hitos: mover(p.hitos, i, 1) })}><ArrowDown size={14} /></button>
                    <button type="button" className="btn sutil icono pequeno" aria-label="Quitar hito" onClick={() => cambiar({ hitos: p.hitos.filter((_, j) => j !== i) })}><X size={14} /></button>
                  </span>
                )}</td>
              </tr>
            ))}
            {!p.hitos.length && <tr><td colSpan={4} className="crm-vacio">Sin hitos: el presupuesto enseñará las condiciones y la forma de pago de «Detalles».</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="crm-presupuesto-pie">
        {!bloqueado && <div className="crm-presupuesto-botones">
          <button type="button" className="btn pequeno" onClick={() => cambiar({ hitos: [...p.hitos, nuevoHito()] })}><Plus size={14} /> Nuevo hito</button>
          {p.fases.length > 0 && !p.hitos.length && (
            <button type="button" className="btn pequeno" onClick={() => cambiar({ hitos: hitosPorFase(p.fases) })}><ListChecks size={14} /> Un hito por fase</button>
          )}
          {p.hitos.length > 0 && difHitos !== 0 && base > 0 && (
            <button type="button" className="btn pequeno" onClick={() => { const r = cuadrarImportes(p.hitos.map(h => h.importe), base); cambiar({ hitos: p.hitos.map((h, i) => ({ ...h, importe: r[i] })) }) }}>
              <Scale size={14} /> Cuadrar con la base imponible
            </button>
          )}
        </div>}
        {p.hitos.length > 0 && <Cuadre etiqueta="Suma de los hitos" suma={totalHitos} base={base} dif={difHitos} />}
      </div>

      <h3 className="tar-ficha-titulo">Condiciones</h3>
      <div className="crm-campos">
        <div className="crm-campo completo">
          <label htmlFor="pres-condiciones">Una por línea</label>
          {bloqueado
            ? <div className="crm-valor" style={{ whiteSpace: 'pre-line' }}>{p.condiciones || <span className="crm-apagado">—</span>}</div>
            : <textarea id="pres-condiciones" rows={5} value={p.condiciones} onChange={e => cambiar({ condiciones: e.target.value })}
                placeholder="Plazo de ejecución estimado: 14 semanas desde la firma." />}
        </div>
      </div>
      {!bloqueado && !p.condiciones.trim() && (
        <div className="crm-presupuesto-botones">
          <button type="button" className="btn pequeno" onClick={() => cambiar({ condiciones: condicionesHabituales(p.fases, cuota, eur) })}>
            <ListChecks size={14} /> Poner las condiciones habituales
          </button>
        </div>
      )}
    </div>
  )
}

function Cuadre({ etiqueta, suma, base, dif }: { etiqueta: string; suma: number; base: number; dif: number }) {
  return (
    <div className={`crm-cuadre ${dif === 0 ? 'ok' : 'aviso'}`}>
      {etiqueta}: <b>{eur(suma)}</b>
      {dif === 0 ? ' · cuadra con la base imponible' : ` · la base imponible es ${eur(base)} (${dif > 0 ? 'sobran' : 'faltan'} ${eur(Math.abs(dif))})`}
    </div>
  )
}
