/**
 * Apuntes fiscales: las facturas de venta y de compra del CRM y los gastos de
 * Gestión pasados a una forma común, con el IVA desglosado por tipo, la cuota
 * deducible y la retención. Todos los modelos, libros y comprobaciones de la
 * Gestoría parten de aquí.
 *
 * Reglas:
 *  - Ventas registradas o pagadas (los borradores y las anuladas, no).
 *  - Compras registradas o pagadas; las pendientes de registrar no cuentan (las señala la revisión).
 *  - Fecha de devengo de la compra = fecha de recepción o, si no hay, la de la factura: decide el
 *    periodo en que se deduce el IVA (art. 99.Uno LIVA) y en que se anota en el libro (art. 69 RIVA).
 *  - Gastos sin `facturaCompraId` (si la tienen, ya cuentan como compra), tratados como compra interior.
 *    IVA deducible solo con factura completa y marcado como deducible (art. 97 LIVA: el ticket no da derecho).
 *  - Compras con inversión del sujeto pasivo (UE, fuera de la UE e ISP interior): la cuota es la
 *    autorrepercutida (tipo de la línea o 21 % si viene a 0), que se devenga y se deduce a la vez.
 *  - Ventas sin IVA (empresa UE, fuera de la UE, ISP interior, exenta): cuota 0.
 *
 * Fuentes:
 *  - Ley 37/1992 del IVA (arts. 69, 84, 97, 99, 108): https://www.boe.es/buscar/act.php?id=BOE-A-1992-28740
 *  - Reglamento del IVA (art. 69, plazos de anotación): https://www.boe.es/buscar/act.php?id=BOE-A-1992-28925
 */
import type {
  ClaveRetencion, CrmInstantanea, Cuenta, FacturaCompra, FacturaVenta, LineaDocumento, Producto, TipoFactura, TipoIdFiscal,
  TipoOperacionCompra, TipoOperacionVenta,
} from '../../crm/types'
import { importeLinea } from '../../crm/documentos'
import type { Gasto, GestionInstantanea } from '../../gestion/types'
import { enRango, r2 } from './periodos'

export interface LineaIva { tipo: number; base: number; cuota: number }

export interface ApunteFiscal {
  /** 'venta:<id>', 'compra:<id>' o 'gasto:<id>'. */
  id: string
  origen: 'venta' | 'compra' | 'gasto'
  /** Id del registro de origen (factura del CRM o gasto). */
  docId: string
  /** Número de la factura: el nuestro en ventas; el del proveedor en compras y gastos (o el interno si no hay). */
  numero: string
  fechaExpedicion: string
  /** Decide el periodo: fecha de la factura en ventas y gastos; de recepción en compras. */
  fechaDevengo: string
  terceroId: string | null
  terceroNombre: string
  terceroNif: string
  codigoPais: string
  tipoIdFiscal: TipoIdFiscal
  particular: boolean
  tipoOperacion: TipoOperacionVenta | TipoOperacionCompra
  tipoFactura: TipoFactura | null
  rectificadaId: string | null
  desglose: LineaIva[]
  base: number
  /** Cuota repercutida (ventas) o soportada / autorrepercutida (compras y gastos). */
  cuota: number
  cuotaDeducible: number
  retencionPct: number
  retencion: number
  claveRetencion: ClaveRetencion
  /** Total de la factura: base + IVA facturado − retención (en ISP el IVA no va en la factura). */
  total: number
  bienInversion: boolean
  vidaUtil: number
  estado: string
  // ── auxiliares
  /** Número interno del registro (FV-…, FC-…, G-…). */
  registro: string
  /** Parte de la base que son entregas de bienes (productos de tipo «producto»); el resto, servicios. */
  baseBienes: number
  /** El destinatario es el sujeto pasivo (art. 84.Uno.2.º LIVA): compras UE, fuera de la UE e ISP interior. */
  inversionSujetoPasivo: boolean
}

/** Tipos de operación de compra en los que Locodea se autorrepercute el IVA. */
export const COMPRA_ISP: TipoOperacionCompra[] = ['ue', 'fuera-ue', 'isp-interior']
/** Ventas que no llevan IVA español en la factura. */
export const VENTA_SIN_IVA: TipoOperacionVenta[] = ['ue-empresa', 'fuera-ue', 'isp-interior', 'exenta']
/** Tipo que se autorrepercute cuando la línea de una compra con ISP viene sin tipo. */
export const TIPO_GENERAL = 21

const cuenta = (crm: CrmInstantanea, id: string | null) => (id ? crm.cuentas.find(c => c.id === id) ?? null : null)

const tercero = (c: Cuenta | null) => ({
  terceroId: c?.id ?? null,
  terceroNombre: c?.nombre ?? '',
  terceroNif: String(c?.cif ?? '').toUpperCase().replace(/[\s.-]/g, ''),
  codigoPais: String(c?.codigoPais || 'ES').toUpperCase(),
  tipoIdFiscal: (c?.tipoIdFiscal ?? 'nif') as TipoIdFiscal,
  particular: !!c?.particular,
})

/** Agrupa las líneas por tipo: base de cada línea con su descuento; cuota redondeada por tipo. */
function desglosar(lineas: LineaDocumento[], tipoDe: (l: LineaDocumento) => number): LineaIva[] {
  const m = new Map<number, number>()
  for (const l of lineas ?? []) {
    const tipo = tipoDe(l)
    m.set(tipo, (m.get(tipo) ?? 0) + importeLinea(l))
  }
  return [...m.entries()].sort((a, b) => b[0] - a[0]).map(([tipo, base]) => ({ tipo, base: r2(base), cuota: r2(base * tipo / 100) }))
}

const tipoLinea = (l: LineaDocumento) => Number(l.iva ?? TIPO_GENERAL) || 0
const suma = (d: LineaIva[], k: 'base' | 'cuota') => r2(d.reduce((s, x) => s + x[k], 0))

function baseBienes(lineas: LineaDocumento[], productos: Producto[]): number {
  const bienes = new Set(productos.filter(p => p.tipo === 'producto').map(p => p.id))
  return r2((lineas ?? []).filter(l => l.productoId && bienes.has(l.productoId)).reduce((s, l) => s + importeLinea(l), 0))
}

export function apunteVenta(f: FacturaVenta, crm: CrmInstantanea): ApunteFiscal {
  const op: TipoOperacionVenta = f.tipoOperacion || 'interior'
  const sinIva = VENTA_SIN_IVA.includes(op)
  const desglose = desglosar(f.lineas, l => (sinIva ? 0 : tipoLinea(l)))
  const base = suma(desglose, 'base'), cuota = suma(desglose, 'cuota')
  return {
    id: `venta:${f.id}`, origen: 'venta', docId: f.id, numero: f.no ?? '', registro: f.no ?? '',
    fechaExpedicion: f.fecha, fechaDevengo: f.fecha, ...tercero(cuenta(crm, f.cuentaId)),
    tipoOperacion: op, tipoFactura: f.tipoFactura || 'F1', rectificadaId: f.rectificadaId ?? null,
    desglose, base, cuota, cuotaDeducible: 0, retencionPct: 0, retencion: 0, claveRetencion: 'ninguna',
    total: r2(base + cuota), bienInversion: false, vidaUtil: 0, estado: f.estado,
    baseBienes: baseBienes(f.lineas, crm.productos), inversionSujetoPasivo: op === 'isp-interior',
  }
}

export function apunteCompra(f: FacturaCompra, crm: CrmInstantanea): ApunteFiscal {
  const op: TipoOperacionCompra = f.tipoOperacion || 'interior'
  const isp = COMPRA_ISP.includes(op)
  const desglose = desglosar(f.lineas, l => (op === 'exenta' ? 0 : isp ? tipoLinea(l) || TIPO_GENERAL : tipoLinea(l)))
  const base = suma(desglose, 'base'), cuota = suma(desglose, 'cuota')
  const retencionPct = Number(f.irpf) || 0, retencion = r2(base * retencionPct / 100)
  return {
    id: `compra:${f.id}`, origen: 'compra', docId: f.id, numero: f.noProveedor || f.no || '', registro: f.no ?? '',
    fechaExpedicion: f.fecha, fechaDevengo: f.fechaRecepcion || f.fecha, ...tercero(cuenta(crm, f.cuentaId)),
    tipoOperacion: op, tipoFactura: null, rectificadaId: null,
    desglose, base, cuota, cuotaDeducible: f.ivaDeducible !== false ? cuota : 0,
    retencionPct, retencion, claveRetencion: f.claveRetencion || 'ninguna',
    total: r2(base + (isp ? 0 : cuota) - retencion), bienInversion: !!f.bienInversion, vidaUtil: Number(f.vidaUtil) || 0, estado: f.estado,
    baseBienes: baseBienes(f.lineas, crm.productos), inversionSujetoPasivo: isp,
  }
}

export function apunteGasto(g: Gasto, crm: CrmInstantanea): ApunteFiscal {
  const tipo = Number(g.iva) || 0, base = r2(Number(g.base) || 0)
  const cuota = r2(base * tipo / 100)
  const retencionPct = Number(g.irpf) || 0, retencion = r2(base * retencionPct / 100)
  return {
    id: `gasto:${g.id}`, origen: 'gasto', docId: g.id, numero: g.noFactura || g.no || '', registro: g.no ?? '',
    fechaExpedicion: g.fecha, fechaDevengo: g.fecha, ...tercero(cuenta(crm, g.proveedorId)),
    tipoOperacion: 'interior', tipoFactura: g.facturaCompleta ? 'F1' : 'F2', rectificadaId: null,
    desglose: [{ tipo, base, cuota }], base, cuota, cuotaDeducible: g.deducible && g.facturaCompleta ? cuota : 0,
    retencionPct, retencion, claveRetencion: retencionPct > 0 ? 'profesional' : 'ninguna',
    total: r2(Number(g.total) || base + cuota - retencion), bienInversion: false, vidaUtil: 0, estado: g.estado,
    baseBienes: 0, inversionSujetoPasivo: false,
  }
}

const cuenta2 = (estado: string) => estado === 'registrada' || estado === 'pagada'

/** Todos los apuntes fiscales del CRM y de Gestión, ordenados por fecha de devengo. */
export function apuntesFiscales(crm: CrmInstantanea, gestion: GestionInstantanea): ApunteFiscal[] {
  const a: ApunteFiscal[] = []
  for (const f of crm.facturasVenta) if (cuenta2(f.estado)) a.push(apunteVenta(f, crm))
  for (const f of crm.facturasCompra) if (cuenta2(f.estado)) a.push(apunteCompra(f, crm))
  for (const g of gestion.gastos) if (!g.facturaCompraId) a.push(apunteGasto(g, crm))
  return a.sort((x, y) => x.fechaDevengo.localeCompare(y.fechaDevengo) || x.origen.localeCompare(y.origen) || x.numero.localeCompare(y.numero))
}

/** Apuntes cuya fecha de devengo cae entre `desde` y `hasta` (ambos incluidos). */
export const apuntesDelPeriodo = (apuntes: ApunteFiscal[], desde: string, hasta: string) => apuntes.filter(a => enRango(a.fechaDevengo, desde, hasta))

/** Es rectificativa (R1–R5). */
export const esRectificativa = (a: Pick<ApunteFiscal, 'tipoFactura'>) => !!a.tipoFactura && a.tipoFactura.startsWith('R')

/** Ventas que van al 349 (ue-empresa) y compras que van al 349 (ue). */
export const esIntracomunitaria = (a: ApunteFiscal) => (a.origen === 'venta' && a.tipoOperacion === 'ue-empresa') || (a.origen !== 'venta' && a.tipoOperacion === 'ue')
