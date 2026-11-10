/**
 * Presupuesto imprimible de ofertas y pedidos de venta, con la plantilla de
 * Locodea: cabecera con número, fecha y moneda; emisor y cliente; concepto;
 * fases del proyecto con semanas, pago e importe (o los conceptos, o las
 * líneas, con su importe); base, impuestos y total, sin descuentos a la vista;
 * forma de pago; condiciones junto al soporte y mantenimiento opcional si se
 * incluye en la calculadora (con «Sí / No» para marcar al firmar); y firmas. Cada apartado se puede quitar desde «Conceptos del presupuesto».
 * En pantalla no se ve; al imprimir la ficha (crm.css, @media print)
 * sustituye al resto de la página y desde el diálogo se guarda como PDF.
 */
import { useMemo } from 'react'
import { Logo } from '../../ui/Logo'
import { useCrm } from '../contexto'
import type { ColEntidad, LineaDocumento, Oferta, PedidoVenta } from '../types'
import { useGestoria } from '../../gestoria/store'
import { CONDICIONES_PAGO, METODO_PAGO, UNIDAD } from '../catalogos'
import { nombreCompleto } from '../consultas'
import { importeLinea, totales } from '../documentos'
import { fecha } from '../formato'
import { filasDe, lineasCondiciones, normalizarPresupuesto, tituloPresupuesto } from '../presupuesto'
import { useMantenimientoCalculadora } from '../cuotaCalculadora'

/** Formato de importes en la moneda del presupuesto: 3.200,00 €. */
function formatoMoneda(moneda: string): (n: number) => string {
  const opciones: Intl.NumberFormatOptions = { style: 'currency', currency: moneda || 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }
  let f: Intl.NumberFormat
  try { f = new Intl.NumberFormat('es-ES', { ...opciones, useGrouping: 'always' }) } catch {
    try { f = new Intl.NumberFormat('es-ES', opciones) } catch { f = new Intl.NumberFormat('es-ES', { ...opciones, currency: 'EUR' }) }
  }
  return n => f.format(Number(n) || 0)
}

/** Precio unitario con el descuento ya aplicado (el impreso no enseña descuentos). */
const precioNeto = (l: LineaDocumento) => (Number(l.precio) || 0) * (1 - (Number(l.dto) || 0) / 100)

/** Texto seguro dentro de un `content: "…"` de CSS. */
const textoCss = (s: string) => s.replace(/[\\"]/g, '\\$&').replace(/[\r\n]+/g, ' ')

export function PresupuestoImpreso({ col, doc }: { col: ColEntidad; doc: Oferta | PedidoVenta }) {
  const { datos } = useCrm()
  const { perfil } = useGestoria()
  const p = useMemo(() => normalizarPresupuesto(doc.presupuesto), [doc.presupuesto])
  const dinero = useMemo(() => formatoMoneda(p.moneda), [p.moneda])
  const mant = useMantenimientoCalculadora(doc.calculo)
  const inc = p.incluir
  const oferta = col === 'ofertas' ? doc as Oferta : null
  const cuenta = datos.cuentas.find(a => a.id === doc.cuentaId)
  const contacto = datos.contactos.find(x => x.id === doc.contactoId)
  const potencial = oferta?.potencialId ? datos.potenciales.find(x => x.id === oferta.potencialId) : undefined
  const cliente = cuenta?.nombre || potencial?.empresa || '—'
  const atencion = contacto ? nombreCompleto(contacto) : potencial ? [potencial.nombre, potencial.apellidos].filter(Boolean).join(' ') : ''
  const t = totales(doc)
  const concepto = p.concepto.trim() || oferta?.alcance?.trim() || ''
  const condiciones = inc.condiciones ? lineasCondiciones(p) : []
  const conMantenimiento = mant.incluido
  const { cuota, meses } = mant
  const titulo = tituloPresupuesto(col)
  const numero = doc.no || 'Borrador'
  const ubicacion = cuenta ? [[cuenta.cp, cuenta.ciudad].filter(Boolean).join(' '), cuenta.pais].filter(Boolean).join(' · ') : potencial ? [potencial.ciudad, potencial.pais].filter(Boolean).join(' · ') : ''
  // filas propias del modo; sin ellas, por fases o por líneas se enseñan las de la calculadora y «solo el concepto», solo el total
  const filas = filasDe(p)
  const desglose = filas.length ? p.modo : p.modo === 'concepto' ? 'nada' : 'calculadora'
  const formaPago = p.formaPago.trim() || [CONDICIONES_PAGO[doc.condicionesPago], METODO_PAGO[doc.metodoPago]].filter(Boolean).join(' · ')

  return (
    <article className="crm-impreso crm-pres" aria-hidden>
      {/* pie de página en cada hoja, con el número de página */}
      <style>{`@media print { @page {
        size: A4; margin: 16mm 15mm 18mm;
        @bottom-left { content: "locodea. · ${textoCss(`${titulo} ${numero}`)}"; font: 400 8.5px 'DM Sans', Arial, sans-serif; color: #8d8d89; }
        @bottom-right { content: "Página " counter(page) " de " counter(pages); font: 400 8.5px 'DM Sans', Arial, sans-serif; color: #8d8d89; }
      } }`}</style>

      <header className="crm-pres-cabecera">
        <div className="crm-pres-marca">
          <span className="crm-pres-logo"><Logo tamano={34} /><b>locodea<i>.</i></b></span>
          <small>Consultoría Power Platform</small>
        </div>
        <div className="crm-pres-titulo">
          <h1>{titulo}</h1>
          <dl>
            <dt>N.º</dt><dd>{numero}</dd>
            <dt>Fecha</dt><dd>{fecha(doc.fecha)}</dd>
            {oferta?.validaHasta && <><dt>Válido hasta</dt><dd>{fecha(oferta.validaHasta)}</dd></>}
            {doc.referencia && <><dt>Referencia</dt><dd>{doc.referencia}</dd></>}
            <dt>Moneda</dt><dd>{p.moneda}</dd>
          </dl>
        </div>
      </header>

      <section className="crm-pres-partes">
        <div>
          <h2>Emisor</h2>
          <p><b>locodea<i className="crm-pres-punto">.</i></b></p>
          <p className="suave">Consultoría Power Platform para la industria</p>
          {perfil.nif && <p className="suave">{[perfil.razonSocial, `NIF ${perfil.nif}`].filter(Boolean).join(' · ')}</p>}
          {perfil.domicilio && <p className="suave">{perfil.domicilio}</p>}
        </div>
        <div>
          <h2>Cliente</h2>
          <p><b>{cliente}</b></p>
          {cuenta?.cif && <p className="suave">CIF/NIF: {cuenta.cif}</p>}
          {cuenta?.direccion && <p className="suave">{cuenta.direccion}</p>}
          {ubicacion && <p className="suave">{ubicacion}</p>}
          {atencion && <p className="suave">A la atención de: {atencion}</p>}
        </div>
      </section>

      {/* en «solo el concepto» sin filas, el texto del concepto es el desglose y se imprime siempre */}
      {concepto && (inc.concepto || desglose === 'nada') && (
        <section className="crm-pres-bloque">
          <h2>Concepto</h2>
          <p className="crm-pres-texto">{concepto}</p>
        </section>
      )}

      <section className="crm-pres-bloque">
        {desglose === 'fases' && (
          <table className="crm-pres-tabla">
            <thead>
              <tr>
                <th style={{ width: '7%' }}>Fase</th><th>Descripción</th>
                {inc.semanas && <th style={{ width: '10%' }}>Semanas</th>}
                {inc.pago && <th style={{ width: '16%' }}>Pago</th>}
                <th className="num" style={{ width: '15%' }}>Importe</th>
              </tr>
            </thead>
            <tbody>
              {p.fases.map((f, i) => (
                <tr key={i}>
                  <td className="fase">{f.fase}</td>
                  <td><b>{f.titulo}</b>{f.descripcion && <span>{f.descripcion}</span>}</td>
                  {inc.semanas && <td className="nw">{f.semanas}</td>}
                  {inc.pago && <td className="nw">{f.pago}</td>}
                  <td className="num">{dinero(f.importe)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {(desglose === 'concepto' || desglose === 'lineas') && (
          <table className="crm-pres-tabla">
            <thead><tr><th>{desglose === 'concepto' ? 'Concepto' : 'Descripción'}</th><th className="num" style={{ width: '17%' }}>Importe</th></tr></thead>
            <tbody>
              {filas.map((f, i) => (
                <tr key={i}>
                  <td><b>{f.titulo}</b>{f.descripcion && <span>{f.descripcion}</span>}</td>
                  <td className="num">{dinero(f.importe)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {/* las líneas de la calculadora, con el precio ya neto: el descuento no se enseña */}
        {desglose === 'calculadora' && (
          <table className="crm-pres-tabla">
            <thead><tr><th>Descripción</th><th className="num" style={{ width: '12%' }}>Cantidad</th><th className="num" style={{ width: '16%' }}>Precio</th><th className="num" style={{ width: '17%' }}>Importe</th></tr></thead>
            <tbody>
              {doc.lineas.map((l, i) => (
                <tr key={i}>
                  <td>{l.descripcion}</td>
                  <td className="num">{l.cantidad}{l.unidad ? ` ${UNIDAD[l.unidad] ?? ''}` : ''}</td>
                  <td className="num">{dinero(precioNeto(l))}</td>
                  <td className="num">{dinero(importeLinea(l))}</td>
                </tr>
              ))}
              {!doc.lineas.length && <tr><td colSpan={4}>Sin conceptos.</td></tr>}
            </tbody>
          </table>
        )}

        <dl className={`crm-pres-totales ${desglose === 'nada' ? 'sin-tabla' : ''}`}>
          <dt>Base imponible</dt><dd>{dinero(t.base)}</dd>
          <dt>Impuestos</dt><dd>{t.iva > 0 ? dinero(t.iva) : 'No incluidos'}</dd>
          <dt className="total">Total</dt><dd className="total">{dinero(t.total)}</dd>
        </dl>
      </section>

      {inc.formaPago && formaPago && (
        <section className="crm-pres-bloque">
          <h2>Forma de pago</h2>
          <p className="crm-pres-texto">{formaPago}</p>
        </section>
      )}

      {(condiciones.length > 0 || conMantenimiento) && (
        <section className={`crm-pres-dos ${condiciones.length > 0 && conMantenimiento ? '' : 'una'}`}>
          {condiciones.length > 0 && (
            <div>
              <h2>Condiciones</h2>
              <ul className="crm-pres-condiciones">{condiciones.map((x, i) => <li key={i}>{x}</li>)}</ul>
            </div>
          )}
          {conMantenimiento && (
            <div className="crm-pres-mant">
              <h2>Soporte y mantenimiento · opcional</h2>
              <p className="cuota"><b>{dinero(cuota)}</b> / mes · {t.iva > 0 ? 'más impuestos' : 'impuestos no incluidos'}</p>
              <p className="suave">
                Cuota mensual con permanencia mínima de {meses} {meses === 1 ? 'mes' : 'meses'}, que empiezan a contar desde el cierre del proyecto. Marque una opción al firmar.
              </p>
              <div className="crm-pres-opcion">
                <i />
                <div><b>Sí, contrato el mantenimiento</b><span>{dinero(cuota)} al mes durante un mínimo de {meses} {meses === 1 ? 'mes' : 'meses'} desde el cierre del proyecto.</span></div>
              </div>
              <div className="crm-pres-opcion">
                <i />
                <div><b>No, por ahora</b><span>Se podrá contratar más adelante, en condiciones a negociar.</span></div>
              </div>
            </div>
          )}
        </section>
      )}

      {inc.observaciones && doc.notas && (
        <section className="crm-pres-bloque">
          <h2>Observaciones</h2>
          <p className="crm-pres-texto">{doc.notas}</p>
        </section>
      )}

      {inc.firmas && (
        <section className="crm-pres-firmas">
          <div>Aceptado por {cliente} — nombre, firma y fecha</div>
          <div>Por locodea. — nombre, firma y fecha</div>
        </section>
      )}
    </article>
  )
}
