/**
 * Importes contables de cada documento del CRM y de cada gasto: base, cuotas
 * de IVA (repercutido, soportado deducible, autorrepercutido), retención e
 * importe a cobrar o pagar, ya redondeados a céntimos y cuadrados.
 */
import type { FacturaCompra, FacturaVenta, TipoOperacionCompra, TipoOperacionVenta } from '../../crm/types'
import { importeLinea } from '../../crm/documentos'
import type { Gasto } from '../../gestion/types'
import { cuentaAcreedora, cuentaDeGasto, cuentaDeLineaCompra, esSancion } from './plan'

export const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100

/** Día YYYY-MM-DD de una fecha o instante ISO; vacío si no hay. */
export const dia = (s: string | null | undefined) => (s || '').slice(0, 10)

/** Año de un día YYYY-MM-DD. */
export const anioDe = (s: string | null | undefined) => Number(dia(s).slice(0, 4)) || 0

/** Facturas que cuentan en contabilidad: registradas o pagadas (ni borradores, ni pendientes, ni anuladas). */
export const facturaCuenta = (f: FacturaVenta | FacturaCompra) => f.estado === 'registrada' || f.estado === 'pagada'

/** Ventas sin IVA español en la factura (sin 477). */
export const VENTA_SIN_IVA: TipoOperacionVenta[] = ['ue-empresa', 'fuera-ue', 'isp-interior', 'exenta']
/** Compras con inversión del sujeto pasivo: Locodea se autorrepercute el IVA (477) y se lo deduce (472). */
export const COMPRA_ISP: TipoOperacionCompra[] = ['ue', 'fuera-ue', 'isp-interior']

const tipoIva = (iva: number | undefined) => Number(iva ?? 21) || 0

// ─────────────────────────────────────────────── ventas

export interface DesgloseVenta {
  base: number
  cuota: number
  total: number
  /** 477 (IVA español), 4771 (OSS) o null si la operación va sin IVA. */
  cuentaIva: '477' | '4771' | null
}

/** Base, cuota y total de una factura de venta. Las operaciones sin IVA no llevan cuota aunque la línea traiga un tipo. */
export function desgloseVenta(f: FacturaVenta): DesgloseVenta {
  const op = f.tipoOperacion ?? 'interior'
  const sinIva = VENTA_SIN_IVA.includes(op)
  const lineas = f.lineas ?? []
  const base = r2(lineas.reduce((s, l) => s + importeLinea(l), 0))
  const cuota = sinIva ? 0 : r2(lineas.reduce((s, l) => s + importeLinea(l) * tipoIva(l.iva) / 100, 0))
  return { base, cuota, total: r2(base + cuota), cuentaIva: sinIva ? null : op === 'ue-oss' ? '4771' : '477' }
}

// ─────────────────────────────────────────────── compras

export interface GrupoCompra {
  /** Cuenta de gasto o de inmovilizado. */
  cuenta: string
  base: number
  /** IVA no deducible que se suma al gasto o al valor del bien. */
  cuotaNoDeducible: number
  /** Importe al debe de la cuenta: base + IVA no deducible. */
  valor: number
  descripcion: string
}

export interface DesgloseCompra {
  grupos: GrupoCompra[]
  base: number
  /** IVA que figura en la factura (lo cobra el proveedor). */
  cuotaFactura: number
  /** IVA autorrepercutido por inversión del sujeto pasivo (477). */
  cuotaAutorrepercutida: number
  /** IVA soportado deducible (472). */
  cuotaDeducible: number
  retencion: number
  /** Lo que se debe al proveedor: base + IVA de la factura − retención. */
  aPagar: number
  cuentaAcreedora: string
}

/**
 * Desglose de una factura de compra por cuenta. Interior e importación: el
 * IVA de las líneas es el de la factura. Inversión del sujeto pasivo (UE,
 * fuera de la UE, ISP interior): la factura no lleva IVA y Locodea se
 * autorrepercute la cuota al tipo de la línea, o al 21 % si viene a 0.
 * Exenta: sin IVA.
 */
export function desgloseCompra(f: FacturaCompra): DesgloseCompra {
  const op = f.tipoOperacion ?? 'interior'
  const isp = COMPRA_ISP.includes(op)
  // Comprobar: en la importación el IVA lo cobra la aduana con el DUA, no el proveedor; aquí se trata como interior.
  const exenta = op === 'exenta'
  const m = new Map<string, { base: number; noDed: number; desc: string[] }>()
  let base = 0, cuotaFactura = 0, cuotaAuto = 0, cuotaDed = 0
  for (const l of f.lineas ?? []) {
    const b = importeLinea(l), t = tipoIva(l.iva)
    const enFactura = isp || exenta ? 0 : b * t / 100
    const auto = isp ? b * (t || 21) / 100 : 0
    const cuenta = cuentaDeLineaCompra(f, l)
    const g = m.get(cuenta) ?? { base: 0, noDed: 0, desc: [] }
    g.base += b
    if (l.descripcion) g.desc.push(l.descripcion)
    if (f.ivaDeducible) cuotaDed += enFactura + auto
    else g.noDed += enFactura + auto
    m.set(cuenta, g)
    base += b; cuotaFactura += enFactura; cuotaAuto += auto
  }
  base = r2(base); cuotaFactura = r2(cuotaFactura); cuotaAuto = r2(cuotaAuto); cuotaDed = r2(cuotaDed)
  const retencion = (Number(f.irpf) || 0) > 0 ? r2(base * Number(f.irpf) / 100) : 0
  const aPagar = r2(base + cuotaFactura - retencion)
  const grupos: GrupoCompra[] = [...m.entries()].map(([cuenta, g]) => ({
    cuenta, base: r2(g.base), cuotaNoDeducible: r2(g.noDed), valor: r2(g.base + g.noDed), descripcion: g.desc.join(' · ') || f.referencia || f.no,
  }))
  // los céntimos de redondeo van a la cuenta de más importe para que el asiento cuadre
  const objetivo = r2(aPagar + cuotaAuto + retencion - cuotaDed)
  const suma = r2(grupos.reduce((s, g) => s + g.valor, 0))
  if (grupos.length && suma !== objetivo) {
    const g = grupos.reduce((a, b) => Math.abs(b.valor) > Math.abs(a.valor) ? b : a)
    g.valor = r2(g.valor + objetivo - suma)
    g.cuotaNoDeducible = r2(g.valor - g.base)
  }
  return { grupos, base, cuotaFactura, cuotaAutorrepercutida: cuotaAuto, cuotaDeducible: cuotaDed, retencion, aPagar, cuentaAcreedora: cuentaAcreedora(f) }
}

/** Fecha contable de una compra: la de recepción (decide el trimestre del IVA) o, si está vacía, la de la factura. */
export const fechaCompra = (f: FacturaCompra) => dia(f.fechaRecepcion) || dia(f.fecha)

// ─────────────────────────────────────────────── gastos

export interface DesgloseGasto {
  cuenta: string
  /** Importe al debe de la cuenta de gasto: base + IVA no deducible (+ céntimos de redondeo del ticket). */
  gasto: number
  cuota: number
  /** IVA deducible (472): solo con factura completa y gasto afecto. */
  cuotaDeducible: number
  retencion: number
  /** Total del ticket. */
  total: number
}

/** Importes de un gasto con ticket. Manda el total del ticket; los céntimos de diferencia van al gasto. */
export function desgloseGasto(g: Gasto): DesgloseGasto {
  const base = Number(g.base) || 0
  const cuota = r2(base * (Number(g.iva) || 0) / 100)
  const retencion = r2(base * (Number(g.irpf) || 0) / 100)
  const total = Number(g.total) ? r2(g.total) : r2(base + cuota - retencion)
  const cuotaDeducible = g.deducible && g.facturaCompleta ? cuota : 0
  const cuenta = esSancion(g.concepto) ? cuentaDeGasto('sanciones') : cuentaDeGasto(g.categoria)
  return { cuenta, gasto: r2(total + retencion - cuotaDeducible), cuota, cuotaDeducible, retencion, total }
}
