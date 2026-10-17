/**
 * Calculadora de precios: perfil del cliente, alcance por apartados
 * (desarrollo Power Platform, migración y formación), mantenimiento y el
 * resumen con el precio. Solo pinta y avisa de los cambios; el cálculo es del
 * motor (../motor.ts). La usan la ventana de ofertas y pedidos y la prueba de
 * la pantalla Tarifas.
 */
import { Minus, Plus, X } from 'lucide-react'
import { eur0 } from '../../crm/formato'
import {
  SECCIONES, SIN_INTEGRACION, factorDe, type Calculo, type Factor, type HerramientaTarifa, type LineaCalculo, type Resultado, type Seccion, type Tarifas,
} from '../motor'
import '../tarifas.css'

const pct = (f: number) => { const d = Math.round((f - 1) * 100); return `${d > 0 ? '+' : d < 0 ? '−' : '±'}${Math.abs(d)} %` }

export function Contador({ valor, onCambio, min = 0, etiqueta, deshabilitado }: { valor: number; onCambio: (n: number) => void; min?: number; etiqueta: string; deshabilitado?: boolean }) {
  const fijar = (n: number) => onCambio(Math.max(min, Math.floor(Number.isFinite(n) ? n : min)))
  return (
    <div className="tar-contador">
      <button type="button" aria-label={`Menos: ${etiqueta}`} onClick={() => fijar(valor - 1)} disabled={deshabilitado || valor <= min}><Minus size={14} /></button>
      <input type="number" min={min} step={1} value={valor} aria-label={etiqueta} disabled={deshabilitado} onChange={e => fijar(Number(e.target.value))} />
      <button type="button" aria-label={`Más: ${etiqueta}`} onClick={() => fijar(valor + 1)} disabled={deshabilitado}><Plus size={14} /></button>
    </div>
  )
}

function Segmentos({ opciones, valor, onCambio, etiqueta }: { opciones: Factor[]; valor: string; onCambio: (id: string) => void; etiqueta: string }) {
  return (
    <div className="tar-seg" role="radiogroup" aria-label={etiqueta}>
      {opciones.map(o => (
        <button key={o.id} type="button" role="radio" aria-checked={o.id === valor} className={o.id === valor ? 'activo' : ''} onClick={() => onCambio(o.id)}>
          {o.etiqueta}<small>×{o.f}</small>
        </button>
      ))}
    </div>
  )
}

export function Calculadora({ tarifas: t, calculo: c, resultado: r, onCambio }: { tarifas: Tarifas; calculo: Calculo; resultado: Resultado; onCambio: (c: Calculo) => void }) {
  const cambiar = (x: Partial<Calculo>) => onCambio({ ...c, ...x })
  const cambiarLinea = (i: number, x: Partial<LineaCalculo>) => cambiar({ lineas: c.lineas.map((l, j) => (j === i ? { ...l, ...x } : l)) })
  const anadir = (h: HerramientaTarifa) => cambiar({ lineas: [...c.lineas, { herramientaId: h.id, cantidad: 1, complejidad: 'media', integracion: SIN_INTEGRACION }] })
  const quitar = (i: number) => cambiar({ lineas: c.lineas.filter((_, j) => j !== i) })
  const m = c.mantenimiento

  const bloque = (h: HerramientaTarifa) => {
    const indices = c.lineas.map((l, i) => (l.herramientaId === h.id ? i : -1)).filter(i => i >= 0)
    const subtotal = indices.reduce((s, i) => s + (r.lineas[i]?.total ?? 0), 0)
    return (
      <div key={h.id} className={`tar-herramienta ${indices.length ? '' : 'vacia'}`}>
        <div className="tar-herramienta-cab">
          <i className="tar-punto" style={{ background: h.color }} />
          <div className="tar-herramienta-nombre"><b>{h.nombre}</b><span>{eur0(h.precio)} / {h.unidad}</span></div>
          {indices.length > 0 && <span className="tar-num">{eur0(subtotal)}</span>}
          <button type="button" className="btn pequeno sutil" onClick={() => anadir(h)}><Plus size={14} /> Añadir</button>
        </div>
        {indices.map(i => {
          const l = c.lineas[i]
          const x = r.lineas[i]
          return (
            <div key={i} className={`tar-linea ${h.seccion === 'desarrollo' ? '' : 'sin-integracion'}`}>
              <Contador valor={l.cantidad} min={0} etiqueta={`${h.nombre}: ${h.seccion === 'formacion' ? 'horas' : 'cantidad'}`} onCambio={n => cambiarLinea(i, { cantidad: n })} />
              <select value={l.complejidad} aria-label={`Complejidad de ${h.nombre}`} onChange={e => cambiarLinea(i, { complejidad: e.target.value })}>
                {t.complejidad.map(o => <option key={o.id} value={o.id}>Complejidad {o.etiqueta.toLowerCase()} ×{o.f}</option>)}
              </select>
              {h.seccion === 'desarrollo' && (
                <select value={l.integracion} aria-label={`Integración de ${h.nombre}`} className={l.integracion !== SIN_INTEGRACION ? 'con-integracion' : ''} onChange={e => cambiarLinea(i, { integracion: e.target.value })}>
                  {t.integracion.map(o => <option key={o.id} value={o.id}>{o.etiqueta}{o.f ? ` +${Math.round(o.f * 100)} %` : ''}</option>)}
                </select>
              )}
              <span className="tar-num tar-linea-importe">
                {eur0(x?.total ?? 0)}
                {!!x?.integracion && <small>+{eur0(x.integracion)} integr.</small>}
              </span>
              <button type="button" className="btn sutil icono pequeno" aria-label="Quitar línea" onClick={() => quitar(i)}><X size={14} /></button>
            </div>
          )
        })}
      </div>
    )
  }

  const textoSeccion: Record<Seccion, string> = {
    desarrollo: 'Cada línea lleva su cantidad, su complejidad y si se conecta a un programa que el cliente ya usa.',
    migracion: 'Datos que se traen de los programas que el cliente usa hoy. Cada línea es una migración con su complejidad; sin recargo de integración.',
    formacion: 'Horas de formación al equipo del cliente, con su complejidad. Se cobra por hora.',
  }

  return (
    <div className="tar-calculadora">
      <section className="tar-bloque">
        <h3>Cliente</h3>
        <div className="tar-campos">
          <div className="campo completo"><label>Trabajadores</label><Segmentos etiqueta="Trabajadores" opciones={t.empleados} valor={c.empleados} onCambio={v => cambiar({ empleados: v })} /></div>
          <div className="campo completo"><label>Facturación anual</label><Segmentos etiqueta="Facturación anual" opciones={t.facturacion} valor={c.facturacion} onCambio={v => cambiar({ facturacion: v })} /></div>
          <div className="campo">
            <label htmlFor="tar-pais">País</label>
            <select id="tar-pais" value={c.pais} onChange={e => cambiar({ pais: e.target.value })}>
              {t.paises.map(o => <option key={o.id} value={o.id}>{o.etiqueta} (×{o.f})</option>)}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="tar-plazo">Plazo</label>
            <select id="tar-plazo" value={c.plazo} onChange={e => cambiar({ plazo: e.target.value })}>
              {t.plazo.map(o => <option key={o.id} value={o.id}>{o.etiqueta}{o.f !== 1 ? ` (${pct(o.f)})` : ''}</option>)}
            </select>
          </div>
          <div className="campo completo">
            <label>Relación</label>
            <div className="tar-tarjetas" role="radiogroup" aria-label="Relación">
              {t.relacion.map(o => (
                <button key={o.id} type="button" role="radio" aria-checked={o.id === c.relacion} className={o.id === c.relacion ? 'activo' : ''} onClick={() => cambiar({ relacion: o.id })}>
                  <b>{o.etiqueta}</b>{o.detalle && <span>{o.detalle}</span>}<em>{o.f < 1 ? `−${Math.round((1 - o.f) * 100)} % dto.` : 'Tarifa completa'}</em>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {SECCIONES.map(s => {
        const hs = t.herramientas.filter(h => h.seccion === s.id)
        if (!hs.length) return null
        return (
          <section key={s.id} className="tar-bloque">
            <h3>{s.titulo}</h3>
            <p className="tar-ayuda">{textoSeccion[s.id]}</p>
            <div className="tar-herramientas">{hs.map(bloque)}</div>
            {s.id === 'desarrollo' && r.piezasIntegradas > 0 && (
              <div className="tar-programas">
                <div>
                  <b>Programas distintos a conectar</b>
                  <span>{r.piezasIntegradas} {r.piezasIntegradas === 1 ? 'pieza' : 'piezas'} con integración · {eur0(t.puestaEnMarcha)} de puesta en marcha por programa</span>
                </div>
                <Contador valor={Math.max(1, c.programas)} min={1} etiqueta="Programas distintos a conectar" onCambio={n => cambiar({ programas: n })} />
              </div>
            )}
          </section>
        )
      })}

      <section className="tar-bloque">
        <h3>Mantenimiento</h3>
        <p className="tar-ayuda">Cuota mensual después de la entrega. Va aparte del precio del proyecto. Sale sola con el % y el mínimo de Tarifas, o se pone la que se pacte.</p>
        <label className="tar-check">
          <input type="checkbox" checked={m.incluido} onChange={e => cambiar({ mantenimiento: { ...m, incluido: e.target.checked } })} />
          Incluir mantenimiento en la propuesta
        </label>
        <div className={`tar-campos ${m.incluido ? '' : 'apagado'}`}>
          <div className="campo">
            <label>Meses de contrato</label>
            <Contador valor={m.meses} min={1} etiqueta="Meses de mantenimiento" onCambio={n => cambiar({ mantenimiento: { ...m, meses: n } })} />
          </div>
          <div className="campo">
            <label htmlFor="tar-cuota">Cuota mensual pactada (€)</label>
            <input id="tar-cuota" type="number" min={0} step={10} placeholder={`Automática: ${eur0(r.mantenimiento.automatica)}`}
              value={m.cuotaPactada ?? ''} onChange={e => cambiar({ mantenimiento: { ...m, cuotaPactada: e.target.value === '' ? null : Math.max(0, Number(e.target.value) || 0) } })} />
          </div>
        </div>
        <p className="tar-ayuda">
          Cuota automática: {eur0(r.mantenimiento.automatica)}/mes ({+(t.mantenimiento * 100).toFixed(2)} % del proyecto, mínimo {eur0(t.mantenimientoMinimo)}).
          {r.mantenimiento.pactada && ' Ahora se usa la pactada; borra el campo para volver a la automática.'}
        </p>
      </section>
    </div>
  )
}

export function ResumenPrecio({ tarifas: t, calculo: c, resultado: r }: { tarifas: Tarifas; calculo: Calculo; resultado: Resultado }) {
  const tono = (f: number) => (f < 1 ? 'baja' : f > 1 ? 'sube' : '')
  const ajuste = (etiqueta: string, f: number, importe: number) => (
    <div className="tar-fila"><span>{etiqueta} <em className={`tar-tag ${tono(f)}`}>{pct(f)}</em></span><span className="tar-num">{importe < 0 ? '−' : '+'}{eur0(Math.abs(importe))}</span></div>
  )
  const activas = SECCIONES.flatMap(s => t.herramientas.filter(h => h.seccion === s.id))
    .map(h => ({ h, total: r.lineas.filter(l => l.herramienta?.id === h.id).reduce((a, l) => a + l.total, 0), n: r.lineas.filter(l => l.herramienta?.id === h.id).reduce((a, l) => a + l.cantidad, 0) }))
    .filter(x => x.total > 0)
  const m = r.mantenimiento
  const rel = factorDe(t.relacion, c.relacion)
  return (
    <div className="tar-resumen">
      <div className="tar-resumen-cab">
        <span>Precio recomendado</span>
        <b className="tar-precio">{eur0(r.precio)}</b>
        <small>{factorDe(t.paises, c.pais).etiqueta} · {rel.etiqueta} · sin IVA</small>
      </div>
      <div className="tar-resumen-cuerpo">
        {activas.length > 0 && (
          <div>
            <div className="tar-mezcla">{activas.map(x => <i key={x.h.id} style={{ width: `${(x.total / r.base) * 100}%`, background: x.h.color }} title={x.h.nombre} />)}</div>
            <div className="tar-leyenda">{activas.map(x => <span key={x.h.id}><i style={{ background: x.h.color }} />{x.h.nombre} {x.n}{x.h.seccion === 'formacion' ? ' h' : ''}</span>)}</div>
          </div>
        )}
        <div className="tar-filas">
          <div className="tar-fila"><span>Desarrollo Power Platform</span><span className="tar-num">{eur0(r.desarrollo)}</span></div>
          {r.migracion > 0 && <div className="tar-fila"><span>Migración</span><span className="tar-num">{eur0(r.migracion)}</span></div>}
          <div className="tar-fila"><span>Integración{r.programas ? ` (${r.programas} ${r.programas === 1 ? 'programa' : 'programas'})` : ''}</span><span className="tar-num">{eur0(r.integracion)}</span></div>
          {r.formacion > 0 && <div className="tar-fila"><span>Formación ({r.horasFormacion} h)</span><span className="tar-num">{eur0(r.formacion)}</span></div>}
          <div className="tar-fila total"><span>Alcance base</span><span className="tar-num">{eur0(r.base)}</span></div>
          {ajuste('Tamaño empresa', r.fTamano, r.base * (r.fTamano - 1))}
          {ajuste('País', r.fPais, r.base * r.fTamano * (r.fPais - 1))}
          {r.fPlazo !== 1 && ajuste('Plazo', r.fPlazo, r.base * r.fTamano * r.fPais * (r.fPlazo - 1))}
          {ajuste(rel.etiqueta, r.fRelacion, -r.descuento)}
          {r.minimoAplicado && <div className="tar-fila"><span>Ajustado al precio mínimo</span><span className="tar-num">{eur0(t.precioMinimo)}</span></div>}
          <div className="tar-fila total"><span>Total proyecto</span><span className="tar-num">{eur0(r.precio)}</span></div>
        </div>
        <div className="tar-rango">
          <div><b>{eur0(r.minimoNegociable)}</b><span>Mínimo negociable</span></div>
          <div className="medio"><b>{eur0(r.precio)}</b><span>Recomendado</span></div>
          <div><b>{eur0(r.techo)}</b><span>Techo</span></div>
        </div>
        <div className="tar-filas">
          {m.total > 0 ? <>
            <div className="tar-fila"><span>Mantenimiento{m.pactada ? ' (pactado)' : ''}</span><span className="tar-num">{eur0(m.cuota)}/mes × {m.meses}</span></div>
            <div className="tar-fila"><span>Total mantenimiento</span><span className="tar-num">{eur0(m.total)}</span></div>
            <div className="tar-fila total"><span>Proyecto + mantenimiento</span><span className="tar-num">{eur0(r.precio + m.total)}</span></div>
          </> : <div className="tar-fila"><span>Mantenimiento opcional (no incluido)</span><span className="tar-num">{eur0(m.cuota)}/mes</span></div>}
        </div>
      </div>
    </div>
  )
}
