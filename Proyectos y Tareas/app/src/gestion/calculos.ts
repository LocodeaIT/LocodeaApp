/**
 * Cálculos del módulo Gestión: importes de un gasto, resumen del trimestre
 * (IVA repercutido y soportado, retenciones, 347), previsión de caja y
 * calendario fiscal. Funciones puras sobre la instantánea del CRM y la de
 * Gestión.
 */
import type { CrmInstantanea, FacturaCompra, FacturaVenta, LineaDocumento } from '../crm/types'
import { importeLinea, totales } from '../crm/documentos'
import { hoy, sumarDias } from '../domain/fechas'
import type { DocumentoGestion, Gasto, GestionInstantanea } from './types'

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100

// ─────────────────────────────────────────────── gastos

/** Total desde la base: base + IVA − retención. */
export const totalDesdeBase = (base: number, iva: number, irpf: number) => r2(base * (1 + (Number(iva) || 0) / 100 - (Number(irpf) || 0) / 100))

/** Base desde el total del ticket. */
export const baseDesdeTotal = (total: number, iva: number, irpf: number) => {
  const f = 1 + (Number(iva) || 0) / 100 - (Number(irpf) || 0) / 100
  return f > 0 ? r2(total / f) : 0
}

export const cuotaIva = (g: Pick<Gasto, 'base' | 'iva'>) => r2(g.base * g.iva / 100)
export const cuotaIrpf = (g: Pick<Gasto, 'base' | 'irpf'>) => r2(g.base * g.irpf / 100)

// ─────────────────────────────────────────────── trimestres

export interface Trimestre { anio: number; t: 1 | 2 | 3 | 4 }

export function trimestreDe(dia: string): Trimestre {
  const anio = Number(dia.slice(0, 4)), mes = Number(dia.slice(5, 7))
  return { anio, t: (Math.floor((mes - 1) / 3) + 1) as Trimestre['t'] }
}

export const trimestreActual = (): Trimestre => trimestreDe(hoy())

export function rangoTrimestre({ anio, t }: Trimestre): { desde: string; hasta: string } {
  const m0 = (t - 1) * 3 + 1, m1 = m0 + 2
  const ultimo = new Date(anio, m1, 0).getDate()
  const dd = (m: number) => String(m).padStart(2, '0')
  return { desde: `${anio}-${dd(m0)}-01`, hasta: `${anio}-${dd(m1)}-${dd(ultimo)}` }
}

export const etiquetaTrimestre = ({ anio, t }: Trimestre) => `${t}T ${anio}`

export function trimestreAnterior({ anio, t }: Trimestre): Trimestre {
  return t === 1 ? { anio: anio - 1, t: 4 } : { anio, t: (t - 1) as Trimestre['t'] }
}

export function trimestreSiguiente({ anio, t }: Trimestre): Trimestre {
  return t === 4 ? { anio: anio + 1, t: 1 } : { anio, t: (t + 1) as Trimestre['t'] }
}

const enRango = (dia: string | null | undefined, desde: string, hasta: string) => !!dia && dia >= desde && dia <= hasta

/** Una factura cuenta para el trimestre si está registrada o pagada (los borradores y anuladas, no). */
const facturaCuenta = (f: FacturaVenta | FacturaCompra) => f.estado === 'registrada' || f.estado === 'pagada'

/** Base e IVA de un documento agrupados por tipo de IVA. */
function porTipoIva(lineas: LineaDocumento[]): Map<number, { base: number; cuota: number }> {
  const m = new Map<number, { base: number; cuota: number }>()
  for (const l of lineas) {
    const tipo = Number(l.iva ?? 21) || 0, base = importeLinea(l)
    const x = m.get(tipo) ?? { base: 0, cuota: 0 }
    x.base += base; x.cuota += base * tipo / 100
    m.set(tipo, x)
  }
  return m
}

export interface LineaResumen { tipo: number; base: number; cuota: number }

export interface ResumenTrimestre {
  trimestre: Trimestre
  desde: string
  hasta: string
  ventas: { facturas: number; base: number; iva: number; porTipo: LineaResumen[] }
  compras: { facturas: number; gastos: number; base: number; iva: number; irpf: number; porTipo: LineaResumen[]; noDeducible: number }
  /** IVA a ingresar (positivo) o a compensar (negativo): modelo 303. */
  resultado303: number
  /** Retenciones de IRPF practicadas en gastos: modelo 111. */
  retenciones111: number
  /** Facturas de venta cobradas en el trimestre (caja, no devengo). */
  cobrado: number
  pagado: number
}

function acumular(m: Map<number, { base: number; cuota: number }>, otro: Map<number, { base: number; cuota: number }>) {
  for (const [tipo, x] of otro) {
    const y = m.get(tipo) ?? { base: 0, cuota: 0 }
    y.base += x.base; y.cuota += x.cuota
    m.set(tipo, y)
  }
}

const aLineas = (m: Map<number, { base: number; cuota: number }>): LineaResumen[] =>
  [...m.entries()].sort((a, b) => b[0] - a[0]).map(([tipo, x]) => ({ tipo, base: r2(x.base), cuota: r2(x.cuota) }))

export function resumenTrimestre(crm: CrmInstantanea, gestion: GestionInstantanea, trimestre: Trimestre): ResumenTrimestre {
  const { desde, hasta } = rangoTrimestre(trimestre)
  const fv = crm.facturasVenta.filter(f => facturaCuenta(f) && enRango(f.fecha, desde, hasta))
  const fc = crm.facturasCompra.filter(f => facturaCuenta(f) && enRango(f.fecha, desde, hasta))
  // gastos deducibles del trimestre que no sean ya una factura de compra del CRM
  const gastos = gestion.gastos.filter(g => enRango(g.fecha, desde, hasta) && !g.facturaCompraId)
  const deducibles = gastos.filter(g => g.deducible)

  const ventasTipo = new Map<number, { base: number; cuota: number }>()
  for (const f of fv) acumular(ventasTipo, porTipoIva(f.lineas))
  const comprasTipo = new Map<number, { base: number; cuota: number }>()
  for (const f of fc) acumular(comprasTipo, porTipoIva(f.lineas))
  for (const g of deducibles) acumular(comprasTipo, new Map([[g.iva, { base: g.base, cuota: cuotaIva(g) }]]))

  const suma = (m: Map<number, { base: number; cuota: number }>, k: 'base' | 'cuota') => r2([...m.values()].reduce((s, x) => s + x[k], 0))
  const ivaVentas = suma(ventasTipo, 'cuota'), ivaCompras = suma(comprasTipo, 'cuota')
  const irpf = r2(deducibles.reduce((s, g) => s + cuotaIrpf(g), 0))

  return {
    trimestre, desde, hasta,
    ventas: { facturas: fv.length, base: suma(ventasTipo, 'base'), iva: ivaVentas, porTipo: aLineas(ventasTipo) },
    compras: {
      facturas: fc.length, gastos: deducibles.length, base: suma(comprasTipo, 'base'), iva: ivaCompras, irpf, porTipo: aLineas(comprasTipo),
      noDeducible: r2(gastos.filter(g => !g.deducible).reduce((s, g) => s + g.total, 0)),
    },
    resultado303: r2(ivaVentas - ivaCompras),
    retenciones111: irpf,
    cobrado: r2(crm.facturasVenta.filter(f => f.estado === 'pagada' && enRango(f.pagadaEl?.slice(0, 10), desde, hasta)).reduce((s, f) => s + totales(f).total, 0)),
    pagado: r2(crm.facturasCompra.filter(f => f.estado === 'pagada' && enRango(f.pagadaEl?.slice(0, 10), desde, hasta)).reduce((s, f) => s + totales(f).total, 0)
      + gestion.gastos.filter(g => (g.estado === 'pagado' || g.estado === 'reembolsado') && enRango(g.fecha, desde, hasta)).reduce((s, g) => s + g.total, 0)),
  }
}

/** Umbral del modelo 347: operaciones con un mismo tercero por encima de 3.005,06 € en el año. */
export const UMBRAL_347 = 3005.06

export interface Tercero347 { cuentaId: string; nombre: string; cif: string; ventas: number; compras: number }

export function terceros347(crm: CrmInstantanea, gestion: GestionInstantanea, anio: number): Tercero347[] {
  const desde = `${anio}-01-01`, hasta = `${anio}-12-31`
  const m = new Map<string, Tercero347>()
  const t = (id: string | null) => {
    if (!id) return null
    const c = crm.cuentas.find(a => a.id === id)
    if (!m.has(id)) m.set(id, { cuentaId: id, nombre: c?.nombre ?? '(sin cuenta)', cif: c?.cif ?? '', ventas: 0, compras: 0 })
    return m.get(id)!
  }
  for (const f of crm.facturasVenta) if (facturaCuenta(f) && enRango(f.fecha, desde, hasta)) { const x = t(f.cuentaId); if (x) x.ventas += totales(f).total }
  for (const f of crm.facturasCompra) if (facturaCuenta(f) && enRango(f.fecha, desde, hasta)) { const x = t(f.cuentaId); if (x) x.compras += totales(f).total }
  for (const g of gestion.gastos) if (!g.facturaCompraId && enRango(g.fecha, desde, hasta)) { const x = t(g.proveedorId); if (x) x.compras += g.total }
  return [...m.values()].map(x => ({ ...x, ventas: r2(x.ventas), compras: r2(x.compras) }))
    .filter(x => x.ventas > UMBRAL_347 || x.compras > UMBRAL_347)
    .sort((a, b) => (b.ventas + b.compras) - (a.ventas + a.compras))
}

// ─────────────────────────────────────────────── exportación para la gestoría

export interface FilaExport {
  tipo: 'Venta' | 'Compra' | 'Gasto'
  fecha: string
  numero: string
  tercero: string
  cif: string
  concepto: string
  base: number
  iva: number
  cuotaIva: number
  irpf: number
  cuotaIrpf: number
  total: number
  estado: string
}

export function filasTrimestre(crm: CrmInstantanea, gestion: GestionInstantanea, trimestre: Trimestre): FilaExport[] {
  const { desde, hasta } = rangoTrimestre(trimestre)
  const cuenta = (id: string | null) => crm.cuentas.find(a => a.id === id)
  const filas: FilaExport[] = []
  const deFactura = (tipo: 'Venta' | 'Compra', f: FacturaVenta | FacturaCompra) => {
    const c = cuenta(f.cuentaId), tot = totales(f)
    // una fila por tipo de IVA, como pide la gestoría
    for (const [tipoIva, x] of porTipoIva(f.lineas)) {
      filas.push({
        tipo, fecha: f.fecha, numero: f.no, tercero: c?.nombre ?? '', cif: c?.cif ?? '', concepto: f.referencia || (tipo === 'Compra' ? (f as FacturaCompra).noProveedor : ''),
        base: r2(x.base), iva: tipoIva, cuotaIva: r2(x.cuota), irpf: 0, cuotaIrpf: 0, total: r2(x.base + x.cuota), estado: f.estado,
      })
    }
    if (!f.lineas.length) filas.push({ tipo, fecha: f.fecha, numero: f.no, tercero: c?.nombre ?? '', cif: c?.cif ?? '', concepto: f.referencia, base: 0, iva: 0, cuotaIva: 0, irpf: 0, cuotaIrpf: 0, total: tot.total, estado: f.estado })
  }
  for (const f of crm.facturasVenta) if (facturaCuenta(f) && enRango(f.fecha, desde, hasta)) deFactura('Venta', f)
  for (const f of crm.facturasCompra) if (facturaCuenta(f) && enRango(f.fecha, desde, hasta)) deFactura('Compra', f)
  for (const g of gestion.gastos) {
    if (g.facturaCompraId || !enRango(g.fecha, desde, hasta)) continue
    const c = cuenta(g.proveedorId)
    filas.push({
      tipo: 'Gasto', fecha: g.fecha, numero: g.no, tercero: c?.nombre ?? '', cif: c?.cif ?? '', concepto: g.concepto + (g.noFactura ? ` (${g.noFactura})` : '') + (g.deducible ? '' : ' [no deducible]'),
      base: g.base, iva: g.iva, cuotaIva: cuotaIva(g), irpf: g.irpf, cuotaIrpf: cuotaIrpf(g), total: g.total, estado: g.estado,
    })
  }
  return filas.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.tipo.localeCompare(b.tipo))
}

/** CSV con separador «;» y decimales con coma: se abre en Excel en español sin tocar nada. */
export function csvTrimestre(filas: FilaExport[]): string {
  const num = (n: number) => n.toFixed(2).replace('.', ',')
  const txt = (s: string) => `"${String(s ?? '').replace(/"/g, '""')}"`
  const cab = ['Tipo', 'Fecha', 'Número', 'Tercero', 'CIF', 'Concepto', 'Base', 'IVA %', 'Cuota IVA', 'IRPF %', 'Cuota IRPF', 'Total', 'Estado']
  const lineas = filas.map(f => [txt(f.tipo), f.fecha, txt(f.numero), txt(f.tercero), txt(f.cif), txt(f.concepto), num(f.base), num(f.iva), num(f.cuotaIva), num(f.irpf), num(f.cuotaIrpf), num(f.total), txt(f.estado)].join(';'))
  return '﻿' + [cab.join(';'), ...lineas].join('\r\n')
}

// ─────────────────────────────────────────────── calendario fiscal

export interface PlazoFiscal {
  modelo: string
  nombre: string
  periodo: string
  desde: string
  hasta: string
}

/** Plazos de una SL con IVA trimestral. Los de enero cierran el año anterior. */
export function calendarioFiscal(anio: number): PlazoFiscal[] {
  const p: PlazoFiscal[] = []
  const tri = (t: number, desde: string, hasta: string, periodo: string) => {
    p.push({ modelo: '303', nombre: 'IVA trimestral', periodo, desde, hasta })
    p.push({ modelo: '111', nombre: 'Retenciones de IRPF (nóminas y profesionales)', periodo, desde, hasta })
    void t
  }
  tri(4, `${anio}-01-01`, `${anio}-01-30`, `4T ${anio - 1}`)
  p.push({ modelo: '390', nombre: 'Resumen anual de IVA', periodo: `${anio - 1}`, desde: `${anio}-01-01`, hasta: `${anio}-01-30` })
  p.push({ modelo: '190', nombre: 'Resumen anual de retenciones', periodo: `${anio - 1}`, desde: `${anio}-01-01`, hasta: `${anio}-01-31` })
  p.push({ modelo: '347', nombre: 'Operaciones con terceros (> 3.005,06 €)', periodo: `${anio - 1}`, desde: `${anio}-02-01`, hasta: `${anio}-02-28` })
  tri(1, `${anio}-04-01`, `${anio}-04-20`, `1T ${anio}`)
  p.push({ modelo: '202', nombre: 'Pago fraccionado del Impuesto de Sociedades', periodo: `1P ${anio}`, desde: `${anio}-04-01`, hasta: `${anio}-04-20` })
  tri(2, `${anio}-07-01`, `${anio}-07-20`, `2T ${anio}`)
  p.push({ modelo: '200', nombre: 'Impuesto de Sociedades', periodo: `${anio - 1}`, desde: `${anio}-07-01`, hasta: `${anio}-07-25` })
  tri(3, `${anio}-10-01`, `${anio}-10-20`, `3T ${anio}`)
  p.push({ modelo: '202', nombre: 'Pago fraccionado del Impuesto de Sociedades', periodo: `2P ${anio}`, desde: `${anio}-10-01`, hasta: `${anio}-10-20` })
  p.push({ modelo: '202', nombre: 'Pago fraccionado del Impuesto de Sociedades', periodo: `3P ${anio}`, desde: `${anio}-12-01`, hasta: `${anio}-12-20` })
  return p.sort((a, b) => a.desde.localeCompare(b.desde) || a.modelo.localeCompare(b.modelo))
}

/** Los próximos plazos desde hoy (los abiertos primero), de este año y el que viene. */
export function proximosPlazos(n = 6): (PlazoFiscal & { abierto: boolean; dias: number })[] {
  const h = hoy(), anio = Number(h.slice(0, 4))
  const dias = (d: string) => Math.round((Date.parse(d) - Date.parse(h)) / 86400000)
  return [...calendarioFiscal(anio), ...calendarioFiscal(anio + 1)]
    .filter(p => p.hasta >= h)
    .map(p => ({ ...p, abierto: p.desde <= h, dias: dias(p.hasta) }))
    .slice(0, n)
}

// ─────────────────────────────────────────────── caja

export interface Movimiento {
  fecha: string
  tipo: 'cobro' | 'pago' | 'gasto' | 'fijo'
  concepto: string
  tercero: string
  importe: number
  /** Ya debería haber ocurrido. */
  vencido: boolean
  /** Enlace al registro de origen. */
  ref: { col: 'facturasVenta' | 'facturasCompra' | 'gastos'; id: string }
}

export interface PrevisionCaja {
  movimientos: Movimiento[]
  aCobrar: number
  aPagar: number
  vencidoCobro: number
  vencidoPago: number
  /** Saldo estimado al final del horizonte, partiendo de `saldoInicial`. */
  saldoFinal: number
  /** Saldo mínimo previsto y cuándo. */
  minimo: { saldo: number; fecha: string } | null
  semanas: { desde: string; cobros: number; pagos: number; saldo: number }[]
}

export const pendienteCobro = (f: FacturaVenta) => r2(Math.max(0, totales(f).total - (Number(f.importeCobrado) || 0)))
export const pendientePago = (f: FacturaCompra) => r2(Math.max(0, totales(f).total - (Number(f.importePagado) || 0)))

export function previsionCaja(crm: CrmInstantanea, gestion: GestionInstantanea, saldoInicial: number, dias = 90): PrevisionCaja {
  const h = hoy(), limite = sumarDias(h, dias)
  const nombre = (id: string | null) => crm.cuentas.find(a => a.id === id)?.nombre ?? ''
  const mov: Movimiento[] = []

  for (const f of crm.facturasVenta) {
    if (f.estado !== 'registrada') continue
    const p = pendienteCobro(f); if (!p) continue
    const v = f.vencimiento || f.fecha
    mov.push({ fecha: v < h ? h : v, tipo: 'cobro', concepto: f.no + (f.referencia ? ' · ' + f.referencia : ''), tercero: nombre(f.cuentaId), importe: p, vencido: v < h, ref: { col: 'facturasVenta', id: f.id } })
  }
  for (const f of crm.facturasCompra) {
    if (f.estado !== 'registrada' && f.estado !== 'pendiente') continue
    const p = pendientePago(f); if (!p) continue
    const v = f.vencimiento || f.fecha
    mov.push({ fecha: v < h ? h : v, tipo: 'pago', concepto: f.no + (f.referencia ? ' · ' + f.referencia : ''), tercero: nombre(f.cuentaId), importe: -p, vencido: v < h, ref: { col: 'facturasCompra', id: f.id } })
  }
  for (const g of gestion.gastos) {
    if (g.facturaCompraId) continue
    if (g.estado === 'pendiente' || g.estado === 'reembolsar') {
      mov.push({ fecha: g.fecha < h ? h : g.fecha, tipo: 'gasto', concepto: g.concepto, tercero: nombre(g.proveedorId), importe: -g.total, vencido: g.fecha < h, ref: { col: 'gastos', id: g.id } })
    }
    if (g.recurrente) {
      // se proyecta cada mes del horizonte, a partir del mes siguiente al del gasto
      const inicio = new Date(Number(g.fecha.slice(0, 4)), Number(g.fecha.slice(5, 7)), 1)
      for (let i = 0; i < 4; i++) {
        const d = new Date(inicio.getFullYear(), inicio.getMonth() + i, Math.min(Math.max(1, g.diaCargo || 1), 28))
        const f = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        if (f <= h || f > limite) continue
        mov.push({ fecha: f, tipo: 'fijo', concepto: g.concepto + ' (fijo)', tercero: nombre(g.proveedorId), importe: -g.total, vencido: false, ref: { col: 'gastos', id: g.id } })
      }
    }
  }

  mov.sort((a, b) => a.fecha.localeCompare(b.fecha) || b.importe - a.importe)
  const dentro = mov.filter(m => m.fecha <= limite)
  const aCobrar = r2(dentro.filter(m => m.importe > 0).reduce((s, m) => s + m.importe, 0))
  const aPagar = r2(-dentro.filter(m => m.importe < 0).reduce((s, m) => s + m.importe, 0))
  const vencidoCobro = r2(mov.filter(m => m.vencido && m.importe > 0).reduce((s, m) => s + m.importe, 0))
  const vencidoPago = r2(-mov.filter(m => m.vencido && m.importe < 0).reduce((s, m) => s + m.importe, 0))

  let saldo = saldoInicial, minimo: PrevisionCaja['minimo'] = null
  const semanas: PrevisionCaja['semanas'] = []
  for (let d = h; d <= limite; d = sumarDias(d, 7)) {
    const fin = sumarDias(d, 6)
    const del = dentro.filter(m => m.fecha >= d && m.fecha <= fin)
    const cobros = r2(del.filter(m => m.importe > 0).reduce((s, m) => s + m.importe, 0))
    const pagos = r2(-del.filter(m => m.importe < 0).reduce((s, m) => s + m.importe, 0))
    saldo = r2(saldo + cobros - pagos)
    if (!minimo || saldo < minimo.saldo) minimo = { saldo, fecha: fin }
    semanas.push({ desde: d, cobros, pagos, saldo })
  }
  return { movimientos: dentro, aCobrar, aPagar, vencidoCobro, vencidoPago, saldoFinal: saldo, minimo, semanas }
}

// ─────────────────────────────────────────────── documentos

export function diasParaCaducar(d: DocumentoGestion): number | null {
  if (!d.caduca) return null
  return Math.round((Date.parse(d.caduca) - Date.parse(hoy())) / 86400000)
}

export type EstadoCaducidad = 'caducado' | 'pronto' | 'vigente' | 'sin-fecha'

export function estadoCaducidad(d: DocumentoGestion): EstadoCaducidad {
  const n = diasParaCaducar(d)
  if (n === null) return 'sin-fecha'
  if (n < 0) return 'caducado'
  if (n <= (d.avisoDias || 30)) return 'pronto'
  return 'vigente'
}

// ─────────────────────────────────────────────── NIF / CIF / NIE

/** Valida NIF, NIE y CIF españoles. Devuelve null si es correcto o el motivo si no. */
export function validarNif(valor: string): string | null {
  const v = String(valor || '').toUpperCase().replace(/[\s-]/g, '')
  if (!v) return null
  const letras = 'TRWAGMYFPDXBNJZSQVHLCKE'
  if (/^\d{8}[A-Z]$/.test(v)) return letras[Number(v.slice(0, 8)) % 23] === v[8] ? null : 'La letra del NIF no coincide.'
  if (/^[XYZ]\d{7}[A-Z]$/.test(v)) {
    const n = Number({ X: '0', Y: '1', Z: '2' }[v[0]] + v.slice(1, 8))
    return letras[n % 23] === v[8] ? null : 'La letra del NIE no coincide.'
  }
  if (/^[ABCDEFGHJKLMNPQRSUVW]\d{7}[0-9A-J]$/.test(v)) {
    const digitos = v.slice(1, 8)
    let suma = 0
    for (let i = 0; i < 7; i++) {
      const d = Number(digitos[i])
      if (i % 2 === 0) { const x = d * 2; suma += Math.floor(x / 10) + (x % 10) } else suma += d
    }
    const control = (10 - (suma % 10)) % 10
    const esperadoLetra = 'JABCDEFGHI'[control]
    const ok = v[8] === String(control) || v[8] === esperadoLetra
    return ok ? null : 'El dígito de control del CIF no coincide.'
  }
  if (/^[A-Z]{2}[A-Z0-9]{2,13}$/.test(v)) return null // NIF-IVA de otro país de la UE: no se comprueba aquí
  return 'No tiene formato de NIF, NIE o CIF.'
}
