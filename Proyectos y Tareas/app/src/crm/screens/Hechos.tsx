/**
 * Paneles laterales de las fichas (FactBoxes de Business Central): escala de
 * tiempo con notas y actividades, estadísticas, registros relacionados,
 * totales e historial del documento.
 */
import { useState, type ReactNode } from 'react'
import { Plus, StickyNote } from 'lucide-react'
import { useCrm } from '../contexto'
import type {
  ActividadCrm, ColEntidad, ColReferente, Contacto, Cuenta, Documento, Oportunidad, Potencial, Producto,
} from '../types'
import {
  CONDICIONES_PAGO, ESTADO_ACTIVIDAD, FASE, NOMBRE_REGISTRO, ORIGEN, PUNTUACION, TIPO_ACTIVIDAD, UNIDAD,
} from '../catalogos'
import {
  actividadVencida, cadenaDocumento, comprado, escalaTiempo, estadoVisible, etiquetaEstado, facturado, nombreCompleto, nombreCuenta,
  nombreRegistro, pendienteCobro, registroDe,
} from '../consultas'
import { estadoFactura, importeLinea, totalDoc, totales } from '../documentos'
import { diasDesdeHoy, eur, eur0, fecha, hora, pasada, pct, relativo } from '../formato'
import { ICONO_ACTIVIDAD, ICONO_COL } from '../iconos'
import { Enlace, Iniciales, Propietario } from '../ui'

/** Caja de un panel lateral con título y acción opcional. */
export function Hecho({ titulo, accion, children }: { titulo: string; accion?: ReactNode; children: ReactNode }) {
  return <section className="crm-hecho"><h3>{titulo}{accion}</h3>{children}</section>
}

function BotonNuevo({ col, prefill, titulo = 'Nuevo' }: { col: ColEntidad; prefill: Record<string, unknown>; titulo?: string }) {
  const { abrir } = useCrm()
  return <button type="button" className="btn sutil icono pequeno" title={titulo} aria-label={titulo} onClick={() => abrir(col, 'nuevo', prefill)}><Plus size={15} /></button>
}

/** Fila de un registro relacionado: clic para abrirlo. */
function Fila({ col, id, icono, titulo, sub, valor }: { col: ColEntidad; id: string; icono?: ReactNode; titulo: ReactNode; sub?: ReactNode; valor?: ReactNode }) {
  const { abrir } = useCrm()
  return (
    <button type="button" className="crm-fila" onClick={() => abrir(col, id)}>
      {icono}
      <span className="crece"><span className="t">{titulo}</span>{sub && <span className="s">{sub}</span>}</span>
      {valor !== undefined && <b className="num">{valor}</b>}
    </button>
  )
}

const Vacio = ({ texto }: { texto: string }) => <p className="crm-vacio">{texto}</p>

// ─────────────────────────────────────────────── escala de tiempo

export function EscalaTiempo({ col, id }: { col: ColReferente; id: string }) {
  const { datos, anadirNota, nombreMiembro, abrir } = useCrm()
  const [texto, setTexto] = useState('')
  const items = escalaTiempo(datos, col, id).slice(0, 10)
  const enviar = () => {
    const t = texto.trim()
    if (!t) return
    setTexto('')
    void anadirNota(t, col, id)
  }
  return (
    <Hecho titulo="Escala de tiempo" accion={<BotonNuevo col="actividades" prefill={{ referenteTipo: col, referenteId: id }} titulo="Nueva actividad" />}>
      <div className="crm-composer">
        <input value={texto} onChange={e => setTexto(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') enviar() }} placeholder="Escribe una nota…" aria-label="Nueva nota" />
        <button type="button" className="btn primario pequeno" onClick={enviar} disabled={!texto.trim()}>Añadir</button>
      </div>
      {!items.length && <Vacio texto="Sin actividad todavía." />}
      <div className="crm-escala">
        {items.map(it => it.tipo === 'nota' ? (
          <div key={it.nota.id} className="crm-escala-item">
            <span className="ico"><StickyNote size={14} /></span>
            <div><p>{it.nota.texto}</p><p className="por">{nombreMiembro(it.nota.autorId) || '—'} · {relativo(it.nota.fecha)}{hora(it.nota.fecha) && `, ${hora(it.nota.fecha)}`}</p></div>
          </div>
        ) : (
          <ItemActividad key={it.actividad.id} a={it.actividad} onAbrir={() => abrir('actividades', it.actividad.id)} />
        ))}
      </div>
    </Hecho>
  )
}

function ItemActividad({ a, onAbrir }: { a: ActividadCrm; onAbrir: () => void }) {
  const { nombreMiembro } = useCrm()
  const Ico = ICONO_ACTIVIDAD[a.tipo]
  return (
    <div className="crm-escala-item">
      <span className={`ico ${a.estado === 'completada' ? 'hecha' : ''}`}><Ico size={14} /></span>
      <div>
        <p><button type="button" className="crm-enlace" onClick={onAbrir}>{a.asunto}</button></p>
        <p className="por">
          {TIPO_ACTIVIDAD[a.tipo]} · {nombreMiembro(a.propietarioId) || '—'} · <span className={actividadVencida(a) ? 'crm-tarde' : undefined}>{relativo(a.fecha)}</span>
          {a.estado !== 'abierta' && ` · ${ESTADO_ACTIVIDAD[a.estado]}`}
        </p>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────── cuentas y contactos

export function EstadisticasCuenta({ cuenta: a }: { cuenta: Cuenta }) {
  const { datos } = useCrm()
  const abiertas = datos.oportunidades.filter(o => o.cuentaId === a.id && o.estado === 'abierta')
  const pendientes = datos.facturasVenta.filter(f => f.cuentaId === a.id && f.estado === 'registrada')
  const vencidas = pendientes.filter(f => estadoFactura(f) === 'vencida')
  return (
    <Hecho titulo="Estadísticas">
      <dl className="crm-kv">
        <dt>Ventas facturadas</dt><dd className="grande">{eur0(facturado(datos, a.id))}</dd>
        <dt>Pendiente de cobro</dt><dd className={vencidas.length ? 'crm-tarde' : undefined}>{eur0(pendienteCobro(datos, a.id))}{vencidas.length > 0 && ` · ${vencidas.length} venc.`}</dd>
        <dt>Pipeline abierto</dt><dd>{eur0(abiertas.reduce((s, o) => s + o.importe, 0))} · {abiertas.length}</dd>
        {a.tipo !== 'cliente' && <><dt>Compras</dt><dd>{eur0(comprado(datos, a.id))}</dd></>}
        <dt>Cliente desde</dt><dd>{fecha(a.creadoEl)}</dd>
      </dl>
    </Hecho>
  )
}

export function ContactosCuenta({ cuenta: a }: { cuenta: Cuenta }) {
  const { datos } = useCrm()
  const lista = datos.contactos.filter(c => c.cuentaId === a.id)
  return (
    <Hecho titulo="Contactos" accion={<BotonNuevo col="contactos" prefill={{ cuentaId: a.id }} titulo="Nuevo contacto" />}>
      {!lista.length && <Vacio texto="Sin contactos." />}
      {lista.map(c => <Fila key={c.id} col="contactos" id={c.id} icono={<Iniciales nombre={nombreCompleto(c)} />} titulo={nombreCompleto(c)} sub={c.cargo || c.email} />)}
    </Hecho>
  )
}

export function CuentaDelContacto({ contacto: c }: { contacto: Contacto }) {
  const { datos } = useCrm()
  const a = datos.cuentas.find(x => x.id === c.cuentaId)
  return (
    <Hecho titulo="Cuenta">
      {a ? <Fila col="cuentas" id={a.id} icono={<Iniciales nombre={a.nombre} cuadrado />} titulo={a.nombre} sub={a.sector} /> : <Vacio texto="Sin cuenta." />}
    </Hecho>
  )
}

const DOCS: ColEntidad[] = ['ofertas', 'pedidosVenta', 'facturasVenta', 'pedidosCompra', 'facturasCompra']

export function DocumentosCuenta({ cuenta: a }: { cuenta: Cuenta }) {
  const { datos } = useCrm()
  const docs = DOCS.flatMap(col => (datos[col] as Documento[]).filter(o => o.cuentaId === a.id).map(o => ({ col, o })))
    .sort((x, y) => y.o.fecha.localeCompare(x.o.fecha)).slice(0, 8)
  return (
    <Hecho titulo="Documentos">
      {!docs.length && <Vacio texto="Sin documentos." />}
      {docs.map(({ col, o }) => (
        <Fila key={o.id} col={col} id={o.id} titulo={<>{o.no} <span className="crm-apagado">· {NOMBRE_REGISTRO[col]}</span></>}
          sub={`${fecha(o.fecha)} · ${etiquetaEstado(col, estadoVisible(col, o))}`} valor={eur0(totalDoc(o))} />
      ))}
    </Hecho>
  )
}

export function OportunidadesDe({ filtro, prefill }: { filtro: (o: Oportunidad) => boolean; prefill: Record<string, unknown> }) {
  const { datos, nombreMiembro } = useCrm()
  const lista = datos.oportunidades.filter(filtro).sort((a, b) => b.creadoEl.localeCompare(a.creadoEl))
  return (
    <Hecho titulo="Oportunidades" accion={<BotonNuevo col="oportunidades" prefill={prefill} titulo="Nueva oportunidad" />}>
      {!lista.length && <Vacio texto="Sin oportunidades." />}
      {lista.map(o => (
        <Fila key={o.id} col="oportunidades" id={o.id} titulo={o.titulo}
          sub={`${o.estado === 'abierta' ? FASE[o.fase] : etiquetaEstado('oportunidades', o.estado)} · ${nombreMiembro(o.propietarioId) || '—'}`} valor={eur0(o.importe)} />
      ))}
    </Hecho>
  )
}

// ─────────────────────────────────────────────── ventas

export function ResumenPotencial({ p }: { p: Potencial }) {
  return (
    <Hecho titulo="Resumen">
      <dl className="crm-kv">
        <dt>Ingresos estimados</dt><dd className="grande">{eur0(p.importeEst)}</dd>
        <dt>Puntuación</dt><dd>{PUNTUACION[p.puntuacion] ?? '—'}</dd>
        <dt>Origen</dt><dd>{ORIGEN[p.origen] ?? '—'}</dd>
        <dt>Días abierto</dt><dd>{Math.max(0, -diasDesdeHoy(p.creadoEl))}</dd>
        {p.cuentaId && <><dt>Cuenta creada</dt><dd><Enlace col="cuentas" id={p.cuentaId} /></dd></>}
      </dl>
    </Hecho>
  )
}

export function ResumenOportunidad({ o }: { o: Oportunidad }) {
  const { datos } = useCrm()
  const ofertas = datos.ofertas.filter(q => q.oportunidadId === o.id)
  return (
    <>
      <Hecho titulo="Resumen">
        <dl className="crm-kv">
          <dt>Ingresos estimados</dt><dd className="grande">{eur0(o.importe)}</dd>
          <dt>Probabilidad</dt><dd>{pct(o.probabilidad)}</dd>
          <dt>Ponderado</dt><dd>{eur0(o.importe * (o.probabilidad || 0) / 100)}</dd>
          <dt>Cierre estimado</dt><dd className={o.estado === 'abierta' && pasada(o.cierrePrevisto) ? 'crm-tarde' : undefined}>{fecha(o.cierrePrevisto)}</dd>
          <dt>Días abierta</dt><dd>{Math.max(0, -diasDesdeHoy(o.creadoEl))}</dd>
        </dl>
      </Hecho>
      <Hecho titulo="Ofertas" accion={o.estado === 'abierta' && <BotonNuevo col="ofertas" prefill={{ cuentaId: o.cuentaId, contactoId: o.contactoId, oportunidadId: o.id }} titulo="Nueva oferta" />}>
        {!ofertas.length && <Vacio texto="Sin ofertas. Crea una desde «+»." />}
        {ofertas.map(q => <Fila key={q.id} col="ofertas" id={q.id} titulo={q.no} sub={`${fecha(q.fecha)} · ${etiquetaEstado('ofertas', q.estado)}`} valor={eur0(totalDoc(q))} />)}
      </Hecho>
    </>
  )
}

// ─────────────────────────────────────────────── documentos

export function Parte({ doc, compra }: { doc: Documento; compra?: boolean }) {
  const { datos } = useCrm()
  const a = datos.cuentas.find(x => x.id === doc.cuentaId)
  const c = datos.contactos.find(x => x.id === doc.contactoId)
  if (!a) return null
  return (
    <Hecho titulo={compra ? 'Proveedor' : 'Cliente'}>
      <Fila col="cuentas" id={a.id} icono={<Iniciales nombre={a.nombre} cuadrado />} titulo={a.nombre} sub={[a.cif, a.ciudad].filter(Boolean).join(' · ')} />
      <dl className="crm-kv">
        {c && <><dt>Contacto</dt><dd><Enlace col="contactos" id={c.id} /></dd></>}
        <dt>Teléfono</dt><dd>{a.telefono || '—'}</dd>
        <dt>Correo</dt><dd>{a.email || '—'}</dd>
        <dt>Condiciones</dt><dd>{CONDICIONES_PAGO[a.condicionesPago] ?? '—'}</dd>
        {!compra && <><dt>Pendiente de cobro</dt><dd>{eur0(pendienteCobro(datos, a.id))}</dd></>}
      </dl>
    </Hecho>
  )
}

export function TotalesDoc({ doc }: { doc: Documento }) {
  const t = totales(doc)
  const f = doc as { pagadaEl?: string | null; registradaEl?: string | null }
  return (
    <Hecho titulo="Totales">
      <dl className="crm-kv">
        <dt>Base imponible</dt><dd>{eur(t.base)}</dd>
        <dt>IVA</dt><dd>{eur(t.iva)}</dd>
        <dt>Total</dt><dd className="grande">{eur(t.total)}</dd>
        {f.pagadaEl && <><dt>Pagada el</dt><dd>{fecha(f.pagadaEl)}</dd></>}
        {f.registradaEl && <><dt>Registrada el</dt><dd>{fecha(f.registradaEl)}</dd></>}
      </dl>
    </Hecho>
  )
}

/** Cadena oportunidad → oferta → pedido → factura. */
export function HistorialDoc({ col, doc }: { col: ColEntidad; doc: Documento }) {
  const { datos } = useCrm()
  const cadena = cadenaDocumento(datos, col, doc)
  return (
    <Hecho titulo="Historial del documento">
      {cadena.map(({ col: c, reg }) => {
        const Ico = ICONO_COL[c]
        return (
          <Fila key={reg.id} col={c} id={reg.id} icono={<span className="crm-iniciales"><Ico size={14} /></span>}
            titulo={<>{c === 'oportunidades' ? (reg as Oportunidad).titulo : reg.no}{reg.id === doc.id && <span className="crm-apagado"> · este</span>}</>}
            sub={`${NOMBRE_REGISTRO[c]} · ${etiquetaEstado(c, estadoVisible(c, reg))}`} />
        )
      })}
    </Hecho>
  )
}

// ─────────────────────────────────────────────── actividades y productos

export function ReferenteA({ a }: { a: ActividadCrm }) {
  const { datos } = useCrm()
  const col = a.referenteTipo
  const o = col ? registroDe(datos, col, a.referenteId) : undefined
  if (!col || !o) return <Hecho titulo="Referente a"><Vacio texto="Sin registro asociado." /></Hecho>
  const Ico = ICONO_COL[col]
  const cuenta = (o as { cuentaId?: string | null }).cuentaId
  return (
    <Hecho titulo="Referente a">
      <Fila col={col} id={o.id} icono={<span className="crm-iniciales"><Ico size={14} /></span>} titulo={nombreRegistro(datos, col, o)}
        sub={NOMBRE_REGISTRO[col] + (cuenta && col !== 'cuentas' ? ' · ' + nombreCuenta(datos, cuenta) : '')} />
      <dl className="crm-kv"><dt>Propietario</dt><dd><Propietario id={a.propietarioId} /></dd></dl>
    </Hecho>
  )
}

export function EstadisticasProducto({ p }: { p: Producto }) {
  const { datos } = useCrm()
  const lineas = datos.facturasVenta.filter(f => f.estado === 'registrada' || f.estado === 'pagada').flatMap(f => f.lineas.filter(l => l.productoId === p.id))
  const cantidad = lineas.reduce((s, l) => s + (Number(l.cantidad) || 0), 0)
  const importe = lineas.reduce((s, l) => s + importeLinea(l), 0)
  const recientes = (['ofertas', 'pedidosVenta', 'facturasVenta'] as const)
    .flatMap(col => (datos[col] as Documento[]).filter(d => d.lineas.some(l => l.productoId === p.id)).map(o => ({ col, o })))
    .sort((a, b) => b.o.fecha.localeCompare(a.o.fecha)).slice(0, 6)
  return (
    <>
      <Hecho titulo="Estadísticas">
        <dl className="crm-kv">
          <dt>Facturado</dt><dd className="grande">{eur0(importe)}</dd>
          <dt>Cantidad facturada</dt><dd>{cantidad} {UNIDAD[p.unidad] ?? ''}</dd>
          <dt>Margen</dt><dd>{p.precio ? Math.round((1 - (Number(p.coste) || 0) / Number(p.precio)) * 100) : 0} %</dd>
        </dl>
      </Hecho>
      <Hecho titulo="Últimos documentos">
        {!recientes.length && <Vacio texto="Aún no se ha usado." />}
        {recientes.map(({ col, o }) => <Fila key={o.id} col={col} id={o.id} titulo={o.no} sub={`${nombreCuenta(datos, o.cuentaId)} · ${fecha(o.fecha)}`} />)}
      </Hecho>
    </>
  )
}
