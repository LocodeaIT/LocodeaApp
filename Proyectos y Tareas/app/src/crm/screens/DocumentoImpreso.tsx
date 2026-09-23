/**
 * Versión imprimible de ofertas, pedidos y facturas: cabecera de Locodea,
 * datos del cliente o proveedor, fechas y condiciones, líneas y totales. En
 * pantalla no se ve; al imprimir la ficha (crm.css, @media print) sustituye
 * al resto de la página.
 */
import { Logo } from '../../ui/Logo'
import { useCrm } from '../contexto'
import type { ColEntidad, Documento } from '../types'
import { CONDICIONES_PAGO, METODO_PAGO, NOMBRE_REGISTRO, UNIDAD } from '../catalogos'
import { estadoVisible, etiquetaEstado, nombreCompleto } from '../consultas'
import { importeLinea, totales } from '../documentos'
import { eur, fecha } from '../formato'

/** Segunda fecha de cada tipo de documento. */
const OTRA_FECHA: Partial<Record<ColEntidad, [string, string]>> = {
  ofertas: ['validaHasta', 'Válida hasta'],
  pedidosVenta: ['fechaEntrega', 'Fecha de entrega'],
  facturasVenta: ['vencimiento', 'Vencimiento'],
  pedidosCompra: ['recepcionPrevista', 'Recepción prevista'],
  facturasCompra: ['vencimiento', 'Vencimiento'],
}

export function DocumentoImpreso({ col, doc, compra }: { col: ColEntidad; doc: Documento; compra: boolean }) {
  const { datos } = useCrm()
  const cuenta = datos.cuentas.find(a => a.id === doc.cuentaId)
  const contacto = datos.contactos.find(x => x.id === doc.contactoId)
  const t = totales(doc)
  const x = doc as unknown as Record<string, string | null | undefined>
  const otra = OTRA_FECHA[col]
  const refExterna = x.refCliente || x.refProveedor || x.noProveedor
  const esFactura = col === 'facturasVenta' || col === 'facturasCompra'

  return (
    <article className="crm-impreso" aria-hidden>
      <header className="crm-impreso-cabecera">
        <div className="crm-impreso-marca"><Logo tamano={38} /><span><b>Locodea</b><small>Power Platform · IA · Business Central</small></span></div>
        <div className="crm-impreso-titulo">
          <h1>{NOMBRE_REGISTRO[col]}</h1>
          <p>{doc.no}</p>
          <small>{etiquetaEstado(col, estadoVisible(col, doc))}</small>
        </div>
      </header>

      <section className="crm-impreso-partes">
        <div>
          <h2>{compra ? 'Proveedor' : 'Cliente'}</h2>
          <p><b>{cuenta?.nombre ?? '—'}</b></p>
          {cuenta?.cif && <p>CIF/NIF: {cuenta.cif}</p>}
          {cuenta?.direccion && <p>{cuenta.direccion}</p>}
          {(cuenta?.cp || cuenta?.ciudad) && <p>{[cuenta?.cp, cuenta?.ciudad, cuenta?.provincia !== cuenta?.ciudad && cuenta?.provincia && `(${cuenta.provincia})`].filter(Boolean).join(' ')}</p>}
          {cuenta?.pais && <p>{cuenta.pais}</p>}
          {contacto && <p>A la atención de {nombreCompleto(contacto)}</p>}
          {cuenta?.email && <p>{cuenta.email}</p>}
        </div>
        <dl>
          <dt>Fecha</dt><dd>{fecha(doc.fecha)}</dd>
          {otra && x[otra[0]] && <><dt>{otra[1]}</dt><dd>{fecha(x[otra[0]])}</dd></>}
          <dt>Condiciones de pago</dt><dd>{CONDICIONES_PAGO[doc.condicionesPago] ?? '—'}</dd>
          <dt>Forma de pago</dt><dd>{METODO_PAGO[doc.metodoPago] ?? '—'}</dd>
          {refExterna && <><dt>{compra ? 'Referencia del proveedor' : 'Su referencia'}</dt><dd>{refExterna}</dd></>}
          {doc.referencia && <><dt>Referencia</dt><dd>{doc.referencia}</dd></>}
        </dl>
      </section>

      <table className="crm-impreso-lineas">
        <thead>
          <tr><th>Descripción</th><th className="num">Cantidad</th><th>Ud.</th><th className="num">Precio</th><th className="num">Dto.</th><th className="num">IVA</th><th className="num">Importe</th></tr>
        </thead>
        <tbody>
          {doc.lineas.map((l, i) => (
            <tr key={i}>
              <td>{l.descripcion}</td><td className="num">{l.cantidad}</td><td>{l.unidad ? UNIDAD[l.unidad] : ''}</td>
              <td className="num">{eur(l.precio)}</td><td className="num">{l.dto ? `${l.dto} %` : ''}</td><td className="num">{l.iva} %</td>
              <td className="num">{eur(importeLinea(l))}</td>
            </tr>
          ))}
          {!doc.lineas.length && <tr><td colSpan={7}>Sin líneas.</td></tr>}
        </tbody>
      </table>

      <dl className="crm-impreso-totales">
        <dt>Subtotal</dt><dd>{eur(t.subtotal)}</dd>
        {t.descuento > 0 && <><dt>Descuento</dt><dd>−{eur(t.descuento)}</dd></>}
        <dt>Base imponible</dt><dd>{eur(t.base)}</dd>
        <dt>IVA</dt><dd>{eur(t.iva)}</dd>
        <dt className="total">Total</dt><dd className="total">{eur(t.total)}</dd>
      </dl>

      {doc.notas && <section className="crm-impreso-notas"><h2>Observaciones</h2><p>{doc.notas}</p></section>}
      <footer className="crm-impreso-pie">
        {esFactura && !compra ? 'Documento comercial generado desde el CRM de Locodea. La factura oficial (Verifactu/SII) se emite desde el ERP.' : 'Documento generado desde el CRM de Locodea.'}
      </footer>
    </article>
  )
}
