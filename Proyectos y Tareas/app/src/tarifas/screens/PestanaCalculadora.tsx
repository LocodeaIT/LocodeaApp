/**
 * La calculadora como «carrito» de ofertas y pedidos de venta: va en la ficha
 * en lugar del editor de líneas, también en documentos nuevos. Cada cambio en
 * la calculadora regenera las líneas del documento y guarda el cálculo con él,
 * así que lo que se ve abajo es exactamente lo que se envía y se factura.
 *
 * Los documentos antiguos con líneas hechas a mano las conservan (y se pueden
 * seguir editando) hasta que se pasa a la calculadora.
 */
import { useMemo, useState } from 'react'
import { Calculator, Copy, RefreshCw } from 'lucide-react'
import { useApp } from '../../store'
import type { CrmCtx } from '../../crm/contexto'
import type { LineaDocumento } from '../../crm/types'
import { eur0 } from '../../crm/formato'
import { LineasDocumento } from '../../crm/screens/LineasDocumento'
import { calcular, calculoNuevo, lineasDocumento, normalizarCalculo, resumenTexto, type Calculo, type CalculoGuardado } from '../motor'
import { useTarifas } from '../store'
import { Calculadora, ResumenPrecio } from './Calculadora'

/** Lo que la pestaña necesita del documento (oferta o pedido de venta). */
export interface DocConCalculo {
  cuentaId: string | null
  potencialId?: string | null
  lineas: LineaDocumento[]
  calculo?: CalculoGuardado | null
}

export function PestanaCalculadora({ doc, c, bloqueado, onCambio }: {
  doc: DocConCalculo; c: CrmCtx; bloqueado: boolean
  onCambio: (cambios: { calculo?: CalculoGuardado; lineas: LineaDocumento[] }) => void
}) {
  const { avisar } = useApp()
  const { tarifas, disponible } = useTarifas()
  const cuenta = c.datos.cuentas.find(a => a.id === doc.cuentaId)
  const potencial = doc.potencialId ? c.datos.potenciales.find(p => p.id === doc.potencialId) : undefined
  const cliente = cuenta?.nombre || potencial?.empresa || ''

  // un documento antiguo con líneas a mano sigue con ellas hasta que se elige la calculadora
  const conLineasAMano = !doc.calculo && doc.lineas.length > 0
  const [usarCalculadora, setUsarCalculadora] = useState(!conLineasAMano)

  // sin cálculo guardado, la calculadora arranca con el país y los empleados de la cuenta (y los sigue si cambia)
  const calculo = useMemo<Calculo>(() => (doc.calculo?.entrada
    ? normalizarCalculo(doc.calculo.entrada, tarifas)
    : calculoNuevo(tarifas, { pais: cuenta?.codigoPais, empleados: cuenta?.empleados || potencial?.empleados })), [doc.calculo, tarifas, cuenta, potencial])
  const r = useMemo(() => calcular(tarifas, calculo), [tarifas, calculo])

  const aplicar = (nuevo: Calculo) => {
    const res = calcular(tarifas, nuevo)
    const iva = doc.lineas[0]?.iva ?? cuenta?.iva ?? 21
    onCambio({ calculo: { entrada: nuevo, precio: res.precio, aplicadoEl: new Date().toISOString() }, lineas: lineasDocumento(tarifas, nuevo, res, iva) })
  }

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(resumenTexto(tarifas, calculo, r, cliente))
      avisar('Resumen copiado')
    } catch {
      avisar('No se pudo copiar: el navegador no deja usar el portapapeles aquí', 'error')
    }
  }

  if (!usarCalculadora) {
    return (
      <div className="tar-ficha">
        <div className="tar-nota">
          Este documento tiene líneas hechas a mano, de antes de la calculadora.
          {!bloqueado && <> <button type="button" className="btn pequeno" onClick={() => { setUsarCalculadora(true); aplicar(calculo) }}><Calculator size={14} /> Pasar a la calculadora</button> <span>(se sustituyen estas líneas)</span></>}
        </div>
        <LineasDocumento lineas={doc.lineas} compra={false} bloqueado={bloqueado} onCambio={lineas => onCambio({ lineas })} />
      </div>
    )
  }

  // si las tarifas han cambiado desde que se calculó, el mismo cálculo da otro precio
  const desfase = !!doc.calculo && doc.calculo.precio !== r.precio

  return (
    <div className="tar-ficha">
      {!disponible && <div className="tar-nota aviso">Las tarifas de Dataverse no están disponibles: se calcula con las tarifas de partida.</div>}
      {desfase && (
        <div className="tar-nota aviso">
          Las tarifas han cambiado desde que se calculó: el documento está a {eur0(doc.calculo!.precio)} y con las tarifas actuales sale {eur0(r.precio)}.
          {!bloqueado && <> <button type="button" className="btn pequeno" onClick={() => aplicar(calculo)}><RefreshCw size={14} /> Recalcular</button></>}
        </div>
      )}
      <div className="tar-ficha-columnas">
        <Calculadora tarifas={tarifas} calculo={calculo} resultado={r} onCambio={aplicar} soloLectura={bloqueado} />
        <div className="tar-ficha-lateral">
          <ResumenPrecio tarifas={tarifas} calculo={calculo} resultado={r} />
          <button type="button" className="btn" onClick={() => void copiar()}><Copy size={15} /> Copiar resumen</button>
        </div>
      </div>
      <h3 className="tar-ficha-titulo">Líneas del documento</h3>
      <p className="tar-ayuda">Salen solas de la calculadora: es lo que verá el cliente y lo que se factura.</p>
      <LineasDocumento lineas={doc.lineas} compra={false} bloqueado onCambio={() => { /* las genera la calculadora */ }} />
    </div>
  )
}
