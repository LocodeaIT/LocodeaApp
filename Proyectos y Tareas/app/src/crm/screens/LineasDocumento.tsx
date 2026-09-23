/**
 * Editor de líneas de un documento con selector de producto y totales
 * (subtotal, descuento, base imponible, IVA y total). En venta la línea toma
 * el precio del producto; en compra, el coste.
 */
import { Plus, X } from 'lucide-react'
import { Select } from '../../ui/Select'
import { useCrm } from '../contexto'
import type { LineaDocumento } from '../types'
import { UNIDAD } from '../catalogos'
import { importeLinea, nuevaLinea, totales } from '../documentos'
import { eur } from '../formato'
import { Numero } from './Campos'

export function LineasDocumento({ lineas, compra, bloqueado, onCambio }: { lineas: LineaDocumento[]; compra: boolean; bloqueado: boolean; onCambio: (l: LineaDocumento[]) => void }) {
  const { datos } = useCrm()
  const productos = datos.productos.filter(p => p.activo).sort((a, b) => a.no.localeCompare(b.no))
  const opciones = [{ valor: '', etiqueta: '—' }, ...productos.map(p => ({ valor: p.id, etiqueta: `${p.no} · ${p.nombre}` }))]
  const cambiar = (i: number, cambio: Partial<LineaDocumento>) => onCambio(lineas.map((l, j) => (j === i ? { ...l, ...cambio } : l)))
  const elegirProducto = (i: number, productoId: string) => {
    const p = datos.productos.find(x => x.id === productoId)
    cambiar(i, p ? { productoId, descripcion: p.nombre, unidad: p.unidad, iva: p.iva ?? 21, precio: compra ? p.coste : p.precio } : { productoId })
  }
  const t = totales({ lineas })

  return (
    <div>
      <div className="crm-lineas-marco">
        <table className="crm-lineas">
          <thead>
            <tr>
              <th style={{ width: 230 }}>Producto</th><th>Descripción</th><th className="num" style={{ width: 90 }}>Cantidad</th><th style={{ width: 70 }}>Ud.</th>
              <th className="num" style={{ width: 110 }}>{compra ? 'Coste' : 'Precio'}</th><th className="num" style={{ width: 76 }}>Dto. %</th><th className="num" style={{ width: 70 }}>IVA %</th>
              <th className="num" style={{ width: 120 }}>Importe</th><th style={{ width: 40 }} />
            </tr>
          </thead>
          <tbody>
            {lineas.map((l, i) => (
              <tr key={i}>
                <td><Select valor={l.productoId} opciones={opciones} onCambio={v => elegirProducto(i, v)} sutil pequeno ancho="100%" deshabilitado={bloqueado} /></td>
                <td><input value={l.descripcion} onChange={e => cambiar(i, { descripcion: e.target.value })} disabled={bloqueado} aria-label="Descripción" /></td>
                <td className="num"><Numero valor={l.cantidad} onCambio={n => cambiar(i, { cantidad: n })} step={0.5} min={0} disabled={bloqueado} aria-label="Cantidad" /></td>
                <td><span className="crm-apagado">{l.unidad ? UNIDAD[l.unidad] : ''}</span></td>
                <td className="num"><Numero valor={l.precio} onCambio={n => cambiar(i, { precio: n })} step={0.01} disabled={bloqueado} aria-label="Precio" /></td>
                <td className="num"><Numero valor={l.dto} onCambio={n => cambiar(i, { dto: n })} step={1} min={0} max={100} disabled={bloqueado} aria-label="Descuento" /></td>
                <td className="num"><Numero valor={l.iva} onCambio={n => cambiar(i, { iva: n })} step={1} min={0} disabled={bloqueado} aria-label="IVA" /></td>
                <td className="num importe">{eur(importeLinea(l))}</td>
                <td>{!bloqueado && <button type="button" className="btn sutil icono pequeno" aria-label="Quitar línea" onClick={() => onCambio(lineas.filter((_, j) => j !== i))}><X size={14} /></button>}</td>
              </tr>
            ))}
            {!lineas.length && <tr><td colSpan={9} className="crm-vacio">Sin líneas.{!bloqueado && ' Añade la primera con «Nueva línea».'}</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="crm-lineas-pie">
        {bloqueado ? <span /> : <button type="button" className="btn pequeno" onClick={() => onCambio([...lineas, nuevaLinea()])}><Plus size={14} /> Nueva línea</button>}
        <dl className="crm-totales">
          <dt>Subtotal</dt><dd>{eur(t.subtotal)}</dd>
          {t.descuento > 0 && <><dt>Descuento</dt><dd>−{eur(t.descuento)}</dd></>}
          <dt>Base imponible</dt><dd>{eur(t.base)}</dd>
          <dt>IVA</dt><dd>{eur(t.iva)}</dd>
          <dt className="grande">Total</dt><dd className="grande">{eur(t.total)}</dd>
        </dl>
      </div>
    </div>
  )
}
