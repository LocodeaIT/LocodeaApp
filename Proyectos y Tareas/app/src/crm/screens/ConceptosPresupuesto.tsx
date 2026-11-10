/**
 * Conceptos del presupuesto de ofertas y pedidos de venta: cómo se desglosa
 * (por fases, solo el concepto o por líneas), el concepto, las filas de cada
 * modo con su importe (las fases llevan además semanas y pago), la forma de
 * pago, las condiciones y qué apartados salen en el impreso. El soporte y
 * mantenimiento opcional se decide en la calculadora. Es lo que la
 * calculadora no sabe y el presupuesto impreso necesita.
 */
import { useMemo } from 'react'
import { ArrowDown, ArrowUp, CalendarClock, Calculator, ListChecks, Plus, Scale, X } from 'lucide-react'
import type { FasePresupuesto, LineaDocumento, Presupuesto } from '../types'
import type { CalculoGuardado } from '../../tarifas/motor'
import { totales } from '../documentos'
import { eur } from '../formato'
import {
  APARTADOS, CLAVE_FILAS, MODOS_PRESUPUESTO, condicionesHabituales, cuadrarImportes, filasDe, filasDesdeLineas, formaPagoHabitual,
  normalizarPresupuesto, nuevaFase, pagosPorFase, sumaFilas,
} from '../presupuesto'
import { useMantenimientoCalculadora } from '../cuotaCalculadora'
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

/** Textos de la tabla de filas según el modo. */
const TEXTOS = {
  fases: { titulo: 'Fases del proyecto', nueva: 'Nueva fase', suma: 'Suma de las fases', vacio: 'Sin fases: mientras no las haya, el presupuesto enseña las líneas de la calculadora.' },
  concepto: { titulo: 'Conceptos', nueva: 'Nuevo concepto', suma: 'Suma de los conceptos', vacio: 'Sin conceptos: el presupuesto enseña el texto del concepto y debajo el total.' },
  lineas: { titulo: 'Líneas del presupuesto', nueva: 'Nueva línea', suma: 'Suma de las líneas', vacio: 'Sin líneas propias: el presupuesto enseña las de la calculadora, sin descuentos.' },
} as const

export function ConceptosPresupuesto({ doc, bloqueado, onCambio }: { doc: DocConPresupuesto; bloqueado: boolean; onCambio: (p: Presupuesto) => void }) {
  const p = useMemo(() => normalizarPresupuesto(doc.presupuesto), [doc.presupuesto])
  const mant = useMantenimientoCalculadora(doc.calculo)
  const base = Math.round(totales(doc).base * 100) / 100

  const cambiar = (cambio: Partial<Presupuesto>) => onCambio({ ...p, ...cambio })
  const clave = CLAVE_FILAS[p.modo]
  const filas = filasDe(p)
  const fijarFilas = (nuevas: FasePresupuesto[]) => cambiar({ [clave]: nuevas })
  const cambiarFila = (i: number, c: Partial<FasePresupuesto>) => fijarFilas(filas.map((f, j) => (j === i ? { ...f, ...c } : f)))

  const porFases = p.modo === 'fases'
  const textos = TEXTOS[p.modo]
  const total = sumaFilas(filas)
  const dif = Math.round((total - base) * 100) / 100
  const columnas = porFases ? 6 : 3

  return (
    <div className="crm-presupuesto">
      <p className="tar-ayuda">
        Lo que sale en el presupuesto impreso además de los totales. Elige cómo se desglosa y qué apartados se imprimen.
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

      <h3 className="tar-ficha-titulo">{textos.titulo}</h3>
      <div className="crm-lineas-marco">
        <table className={`crm-lineas crm-fases ${porFases ? '' : 'estrecha'}`}>
          <thead>
            <tr>
              {porFases && <th style={{ width: 60 }}>Fase</th>}
              <th>{porFases ? 'Título y descripción' : 'Concepto y descripción'}</th>
              {porFases && <><th style={{ width: 96 }}>Semanas</th><th style={{ width: 150 }}>Pago</th></>}
              <th className="num" style={{ width: 130 }}>Importe</th><th style={{ width: bloqueado ? 0 : 96 }} />
            </tr>
          </thead>
          <tbody>
            {filas.map((f, i) => (
              <tr key={i}>
                {porFases && <td><input value={f.fase} onChange={e => cambiarFila(i, { fase: e.target.value })} disabled={bloqueado} aria-label="Fase" /></td>}
                <td>
                  <input className="titulo" value={f.titulo} onChange={e => cambiarFila(i, { titulo: e.target.value })} disabled={bloqueado} aria-label="Título" placeholder="Título" />
                  <input value={f.descripcion} onChange={e => cambiarFila(i, { descripcion: e.target.value })} disabled={bloqueado} aria-label="Descripción" placeholder="Descripción (opcional)" />
                </td>
                {porFases && <>
                  <td><input value={f.semanas} onChange={e => cambiarFila(i, { semanas: e.target.value })} disabled={bloqueado} aria-label="Semanas" placeholder="1 - 3" /></td>
                  <td><input value={f.pago} onChange={e => cambiarFila(i, { pago: e.target.value })} disabled={bloqueado} aria-label="Pago" placeholder={i === 0 ? 'A la firma' : 'Antes de sem. 4'} /></td>
                </>}
                <td className="num"><Numero valor={f.importe} onCambio={n => cambiarFila(i, { importe: n })} step={0.01} min={0} disabled={bloqueado} aria-label="Importe" /></td>
                <td>{!bloqueado && (
                  <span className="crm-fila-acciones">
                    <button type="button" className="btn sutil icono pequeno" aria-label="Subir" disabled={i === 0} onClick={() => fijarFilas(mover(filas, i, -1))}><ArrowUp size={14} /></button>
                    <button type="button" className="btn sutil icono pequeno" aria-label="Bajar" disabled={i === filas.length - 1} onClick={() => fijarFilas(mover(filas, i, 1))}><ArrowDown size={14} /></button>
                    <button type="button" className="btn sutil icono pequeno" aria-label="Quitar" onClick={() => fijarFilas(filas.filter((_, j) => j !== i))}><X size={14} /></button>
                  </span>
                )}</td>
              </tr>
            ))}
            {!filas.length && <tr><td colSpan={columnas} className="crm-vacio">{textos.vacio}</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="crm-presupuesto-pie">
        {!bloqueado && <div className="crm-presupuesto-botones">
          <button type="button" className="btn pequeno" onClick={() => fijarFilas([...filas, porFases ? nuevaFase(filas.length) : { ...nuevaFase(0), fase: '' }])}>
            <Plus size={14} /> {textos.nueva}
          </button>
          {p.modo === 'lineas' && doc.lineas.length > 0 && (
            <button type="button" className="btn pequeno" title="Copia las líneas de la calculadora con su importe neto (sustituye las de aquí)"
              onClick={() => fijarFilas(filasDesdeLineas(doc.lineas))}>
              <Calculator size={14} /> Traer las de la calculadora
            </button>
          )}
          {p.modo === 'concepto' && !filas.length && base > 0 && (
            <button type="button" className="btn pequeno" onClick={() => fijarFilas([{ ...nuevaFase(0), fase: '', titulo: 'Proyecto', importe: base }])}>
              <ListChecks size={14} /> Un concepto por la base imponible
            </button>
          )}
          {porFases && filas.length > 0 && (
            <button type="button" className="btn pequeno" title="La primera a la firma y el resto antes de su primera semana" onClick={() => fijarFilas(pagosPorFase(filas))}>
              <CalendarClock size={14} /> Rellenar pagos
            </button>
          )}
          {filas.length > 0 && dif !== 0 && base > 0 && (
            <button type="button" className="btn pequeno" title="Reparte la base imponible entre las filas manteniendo sus proporciones"
              onClick={() => { const r = cuadrarImportes(filas.map(f => f.importe), base); fijarFilas(filas.map((f, i) => ({ ...f, importe: r[i] }))) }}>
              <Scale size={14} /> Cuadrar con la base imponible
            </button>
          )}
        </div>}
        {filas.length > 0 && (
          <div className={`crm-cuadre ${dif === 0 ? 'ok' : 'aviso'}`}>
            {textos.suma}: <b>{eur(total)}</b>
            {dif === 0 ? ' · cuadra con la base imponible' : ` · la base imponible es ${eur(base)} (${dif > 0 ? 'sobran' : 'faltan'} ${eur(Math.abs(dif))})`}
          </div>
        )}
      </div>

      <div className="crm-campos">
        <TextoConPartida id="pres-formapago" titulo="Forma de pago" valor={p.formaPago} bloqueado={bloqueado}
          onCambio={v => cambiar({ formaPago: v })} partida={() => formaPagoHabitual(p.modo)} textoPartida="Poner la habitual" />
        <TextoConPartida id="pres-condiciones" titulo="Condiciones (una por línea)" valor={p.condiciones} bloqueado={bloqueado}
          onCambio={v => cambiar({ condiciones: v })} partida={() => condicionesHabituales(porFases ? p.fases : [])} textoPartida="Poner las habituales" />
      </div>

      <h3 className="tar-ficha-titulo">Soporte y mantenimiento (opcional)</h3>
      <div className="tar-nota">
        {mant.incluido
          ? <>Sale en el presupuesto como opcional, con «Sí / No» para que el cliente marque al firmar: <b>{eur(mant.cuota)}/mes</b> con permanencia mínima de {mant.meses} meses. No suma al total. La cuota y los meses se cambian en la calculadora.</>
          : <>No se ofrece. Para que salga en el presupuesto, marca «Incluir el soporte y mantenimiento opcional» en la calculadora.</>}
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
