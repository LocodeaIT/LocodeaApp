/**
 * La calculadora de precios dentro de una oferta o un pedido de venta. Arranca
 * con el cálculo guardado en el documento o, si no tiene, con el país y el
 * tramo de empleados de la cuenta. «Aplicar» sustituye las líneas del
 * documento por las del cálculo y lo guarda con él.
 */
import { useMemo, useState } from 'react'
import { Calculator, Copy } from 'lucide-react'
import { useApp } from '../../store'
import { Modal } from '../../ui/basicos'
import type { CrmCtx } from '../../crm/contexto'
import type { Oferta, PedidoVenta } from '../../crm/types'
import { eur0 } from '../../crm/formato'
import { calcular, calculoNuevo, lineasDocumento, normalizarCalculo, resumenTexto, type Calculo } from '../motor'
import { useTarifas } from '../store'
import { Calculadora, ResumenPrecio } from './Calculadora'

type Doc = { col: 'ofertas'; doc: Oferta } | { col: 'pedidosVenta'; doc: PedidoVenta }

export function ModalCalculadora({ destino, c, cerrar }: { destino: Doc; c: CrmCtx; cerrar: () => void }) {
  const { avisar } = useApp()
  const { tarifas, disponible } = useTarifas()
  const { doc } = destino
  const cuenta = c.datos.cuentas.find(a => a.id === doc.cuentaId)
  const potencial = destino.col === 'ofertas' && destino.doc.potencialId ? c.datos.potenciales.find(p => p.id === destino.doc.potencialId) : undefined
  const cliente = cuenta?.nombre || potencial?.empresa || ''

  const [calculo, setCalculo] = useState<Calculo>(() => doc.calculo?.entrada
    ? normalizarCalculo(doc.calculo.entrada, tarifas)
    : calculoNuevo(tarifas, { pais: cuenta?.codigoPais, empleados: cuenta?.empleados || potencial?.empleados }))
  const r = useMemo(() => calcular(tarifas, calculo), [tarifas, calculo])
  const [guardando, setGuardando] = useState(false)

  // si las tarifas han cambiado desde que se aplicó, el mismo cálculo da otro precio
  const precioAnterior = doc.calculo?.precio
  const cambioDeTarifas = precioAnterior !== undefined && doc.calculo?.entrada && JSON.stringify(normalizarCalculo(doc.calculo.entrada, tarifas)) === JSON.stringify(calculo) && precioAnterior !== r.precio

  const aplicar = async () => {
    setGuardando(true)
    try {
      const iva = doc.lineas[0]?.iva ?? cuenta?.iva ?? 21
      const cambios = { lineas: lineasDocumento(tarifas, calculo, r, iva), calculo: { entrada: calculo, precio: r.precio, aplicadoEl: new Date().toISOString() } }
      if (destino.col === 'ofertas') await c.guardar('ofertas', { ...destino.doc, ...cambios })
      else await c.guardar('pedidosVenta', { ...destino.doc, ...cambios })
      avisar(`Precio aplicado: ${eur0(r.precio)}${r.mantenimiento.total ? ` + ${eur0(r.mantenimiento.total)} de mantenimiento` : ''}`)
      cerrar()
    } catch {
      setGuardando(false)  // el CRM ya ha avisado del error
    }
  }

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(resumenTexto(tarifas, calculo, r, cliente))
      avisar('Resumen copiado')
    } catch {
      avisar('No se pudo copiar: el navegador no deja usar el portapapeles aquí', 'error')
    }
  }

  return (
    <Modal titulo={`Calcular precio · ${doc.no || 'borrador'}${cliente ? ` · ${cliente}` : ''}`} ancho onCerrar={cerrar} pie={<>
      {doc.lineas.length > 0 && <span className="tar-aviso-pie">Se sustituyen las {doc.lineas.length} líneas actuales.</span>}
      <button className="btn" onClick={cerrar}>Cancelar</button>
      <button className="btn" onClick={() => void copiar()}><Copy size={15} /> Copiar resumen</button>
      <button className="btn primario" disabled={guardando || r.precio <= 0} onClick={() => void aplicar()}><Calculator size={15} /> Aplicar al documento</button>
    </>}>
      <div className="tar-modal">
        {!disponible && <div className="tar-nota aviso">Las tarifas de Dataverse no están disponibles todavía: se calcula con las tarifas de partida.</div>}
        {cambioDeTarifas && <div className="tar-nota aviso">Las tarifas han cambiado desde que se aplicó este cálculo: entonces salía {eur0(precioAnterior)} y ahora sale {eur0(r.precio)}.</div>}
        <div className="tar-modal-columnas">
          <Calculadora tarifas={tarifas} calculo={calculo} resultado={r} onCambio={setCalculo} />
          <ResumenPrecio tarifas={tarifas} calculo={calculo} resultado={r} />
        </div>
      </div>
    </Modal>
  )
}
