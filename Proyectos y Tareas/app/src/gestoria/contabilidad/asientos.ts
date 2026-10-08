/**
 * Libro diario automático: los asientos del ejercicio salen solos de las
 * facturas del CRM, los gastos con ticket, las amortizaciones, la
 * liquidación del IVA y los pagos de los modelos presentados, más los
 * asientos manuales de la gestoría (capital, ajustes, impuesto…).
 *
 * Funciones puras sobre las instantáneas; nada se guarda.
 */
import type { CrmInstantanea } from '../../crm/types'
import type { GestionInstantanea } from '../../gestion/types'
import type { GestoriaInstantanea, LineaAsiento, ModeloFiscal, PerfilFiscal, Presentacion } from '../types'
import { cuadroAmortizacion } from './amortizaciones'
import { alDebe, alHaber, nuevoAsiento, ordenarYNumerar, regularizacion, saldos, sumas } from './apuntes'
import { anioDe, desgloseCompra, desgloseGasto, desgloseVenta, dia, facturaCuenta, fechaCompra, r2 } from './desglose'

export interface Asiento {
  /** Estable entre cálculos: `fv:<id>`, `fc-pago:<id>`, `iva:2026-4T`, `man:<id>`… */
  id: string
  numero: number
  fecha: string
  concepto: string
  /** Un `TipoAsiento` de la gestoría o: venta, cobro, compra, pago, gasto, reembolso, liquidacion-iva, modelo. */
  tipo: string
  origen: { col: 'facturasVenta' | 'facturasCompra' | 'gastos' | 'asientos' | 'presentaciones' | null; id: string | null }
  lineas: LineaAsiento[]
  automatico: boolean
}

export interface EntradaContabilidad {
  crm: CrmInstantanea
  gestion: GestionInstantanea
  gestoria: GestoriaInstantanea
  ejercicio: number
  perfil: PerfilFiscal | null
}

/** El asiento cuadra: tiene apuntes y el debe es igual al haber (al céntimo). */
export function cuadra(a: Asiento): boolean {
  if (!a.lineas.length) return false
  const s = sumas(a)
  return Math.abs(s.debe - s.haber) < 0.005
}

// ─────────────────────────────────────────────── modelos

/** Cuenta que se paga con cada modelo (y la que se cobra si sale a devolver). */
const CUENTA_MODELO: Partial<Record<ModeloFiscal, { pago: string; devolucion?: string }>> = {
  '303': { pago: '4750', devolucion: '4700' },
  '111': { pago: '4751' },
  '115': { pago: '4751' },
  '200': { pago: '4752', devolucion: '4709' },
  '202': { pago: '473' },
  '369': { pago: '4771' },
}

/**
 * Último día del plazo de un modelo y periodo ('2026-3T', '2026-09',
 * '2026-2P', '2026'): es cuando se carga la domiciliación.
 */
export function finDePlazo(modelo: ModeloFiscal, periodo: string): string {
  const anio = Number(periodo.slice(0, 4)) || 0
  const t = /^\d{4}-([1-4])T$/.exec(periodo)?.[1]
  const p = /^\d{4}-([1-3])P$/.exec(periodo)?.[1]
  const mes = /^\d{4}-(\d{2})$/.exec(periodo)?.[1]
  if (modelo === '200') return `${anio + 1}-07-25`
  if (modelo === '202' && p) return `${anio}-${['04', '10', '12'][Number(p) - 1]}-20`
  if (modelo === '369' && t) return Number(t) === 4 ? `${anio + 1}-01-31` : `${anio}-${['04-30', '07-31', '10-31'][Number(t) - 1]}`
  if (t) return Number(t) === 4 ? `${anio + 1}-01-30` : `${anio}-${['04', '07', '10'][Number(t) - 1]}-20`
  if (mes) return Number(mes) === 12 ? `${anio + 1}-01-30` : `${anio}-${String(Number(mes) + 1).padStart(2, '0')}-20`
  return `${anio + 1}-01-30`
}

/** Fecha del cargo o pago de una presentación: el último día del plazo si está domiciliada; si no, la de presentación. */
export function fechaPagoPresentacion(p: Presentacion): string {
  if (p.estado === 'domiciliada') return finDePlazo(p.modelo, p.periodo)
  return dia(p.presentadaEl) || finDePlazo(p.modelo, p.periodo)
}

// ─────────────────────────────────────────────── generación

/** Primer año con algún dato contable: de ahí arranca la cadena de aperturas. */
function primerAnio(e: EntradaContabilidad): number {
  const anios: number[] = []
  for (const f of e.crm.facturasVenta) if (facturaCuenta(f)) anios.push(anioDe(f.fecha))
  for (const f of e.crm.facturasCompra) if (facturaCuenta(f)) anios.push(anioDe(fechaCompra(f)))
  for (const g of e.gestion.gastos) if (!g.facturaCompraId) anios.push(anioDe(g.fecha))
  for (const a of e.gestoria.asientos) anios.push(anioDe(a.fecha) || a.ejercicio)
  for (const p of e.gestoria.presentaciones) if (p.estado === 'pagada' || p.estado === 'domiciliada') anios.push(anioDe(fechaPagoPresentacion(p)))
  const validos = anios.filter(a => a > 1900)
  return validos.length ? Math.min(...validos) : e.ejercicio
}

/** Asiento de apertura del año: saldos de los grupos 1 a 5 al cierre del anterior (ya regularizado). */
function asientoApertura(anteriores: Asiento[], anio: number): Asiento | null {
  const s = [...saldos(anteriores).entries()].filter(([c, v]) => '12345'.includes(c[0]) && v).sort((a, b) => a[0].localeCompare(b[0]))
  return nuevoAsiento(
    { id: `apertura:${anio}`, fecha: `${anio}-01-01`, concepto: `Asiento de apertura del ejercicio ${anio}`, tipo: 'apertura', origen: { col: null, id: null } },
    s.map(([c, v]) => alDebe(c, v)),
  )
}

/** Periodos de liquidación del IVA del año: trimestres o meses, con su último día. */
function periodosIva(anio: number, mensual: boolean): { clave: string; etiqueta: string; fin: string }[] {
  const ultimo = (m: number) => `${anio}-${String(m).padStart(2, '0')}-${String(new Date(Date.UTC(anio, m, 0)).getUTCDate()).padStart(2, '0')}`
  if (mensual) return Array.from({ length: 12 }, (_, i) => ({ clave: `${anio}-${String(i + 1).padStart(2, '0')}`, etiqueta: `${String(i + 1).padStart(2, '0')}/${anio}`, fin: ultimo(i + 1) }))
  return [1, 2, 3, 4].map(t => ({ clave: `${anio}-${t}T`, etiqueta: `${t}T ${anio}`, fin: ultimo(t * 3) }))
}

/**
 * Liquidación del IVA de un periodo: 477 al debe y 472 al haber por sus
 * saldos; la diferencia a 4750 (a ingresar) o a 4700 (a compensar). Si hay
 * cuotas a compensar de periodos anteriores (saldo deudor de 4700), se
 * compensan primero.
 */
// Comprobar: compensar las cuotas pendientes es opcional en el 303; aquí se compensan siempre que haya resultado a ingresar.
function liquidacionIva(previos: Asiento[], periodo: { clave: string; etiqueta: string; fin: string }): Asiento | null {
  const s = saldos(previos.filter(a => a.fecha <= periodo.fin))
  const repercutido = r2(-(s.get('477') ?? 0)), soportado = r2(s.get('472') ?? 0)
  if (!repercutido && !soportado) return null
  const dif = r2(repercutido - soportado)
  const compensable = Math.max(0, s.get('4700') ?? 0)
  const compensa = dif > 0 ? Math.min(compensable, dif) : 0
  return nuevoAsiento(
    { id: `iva:${periodo.clave}`, fecha: periodo.fin, concepto: `Liquidación del IVA ${periodo.etiqueta}`, tipo: 'liquidacion-iva', origen: { col: null, id: null } },
    [
      alDebe('477', repercutido), alHaber('472', soportado),
      dif < 0 ? alDebe('4700', -dif, 'IVA a compensar') : null,
      alHaber('4700', compensa, 'Cuotas a compensar de periodos anteriores'),
      dif > 0 ? alHaber('4750', r2(dif - compensa), 'IVA a ingresar') : null,
    ],
  )
}

function asientosDelAnio(e: EntradaContabilidad, anio: number, apertura: Asiento | null): Asiento[] {
  const { crm, gestion, gestoria } = e
  const enAnio = (d: string | null | undefined) => anioDe(d) === anio
  const tercero = (id: string | null) => crm.cuentas.find(c => c.id === id)?.nombre ?? ''
  const con = (...partes: (string | null | undefined)[]) => partes.filter(Boolean).join(' · ')
  const out: (Asiento | null)[] = []

  const manuales = gestoria.asientos.filter(a => (a.fecha ? enAnio(a.fecha) : a.ejercicio === anio))
  // una apertura escrita a mano (p. ej. al migrar de otro programa) sustituye a la automática
  if (apertura && !manuales.some(a => a.tipo === 'apertura')) out.push(apertura)

  // ── ventas y cobros
  for (const f of crm.facturasVenta) {
    if (!facturaCuenta(f)) continue
    const d = desgloseVenta(f), nombre = tercero(f.cuentaId)
    if (enAnio(f.fecha)) {
      out.push(nuevoAsiento(
        { id: `fv:${f.id}`, fecha: dia(f.fecha), concepto: con(`Factura ${f.no}`, nombre), tipo: 'venta', origen: { col: 'facturasVenta', id: f.id } },
        [alDebe('430', d.total), alHaber('705', d.base), d.cuentaIva ? alHaber(d.cuentaIva, d.cuota) : null],
      ))
    }
    // Comprobar: los cobros parciales (importeCobrado de una factura registrada) no tienen fecha y no se contabilizan.
    const cobro = dia(f.pagadaEl) || dia(f.fecha)
    if (f.estado === 'pagada' && enAnio(cobro)) {
      out.push(nuevoAsiento(
        { id: `fv-cobro:${f.id}`, fecha: cobro, concepto: con(`Cobro factura ${f.no}`, nombre), tipo: 'cobro', origen: { col: 'facturasVenta', id: f.id } },
        [alDebe('572', d.total), alHaber('430', d.total)],
      ))
    }
  }

  // ── compras y pagos
  for (const f of crm.facturasCompra) {
    if (!facturaCuenta(f)) continue
    const d = desgloseCompra(f), nombre = tercero(f.cuentaId), no = f.noProveedor || f.no
    const fecha = fechaCompra(f)
    if (enAnio(fecha)) {
      out.push(nuevoAsiento(
        { id: `fc:${f.id}`, fecha, concepto: con(`Factura ${no}`, nombre), tipo: 'compra', origen: { col: 'facturasCompra', id: f.id } },
        [
          ...d.grupos.map(g => alDebe(g.cuenta, g.valor)),
          alDebe('472', d.cuotaDeducible),
          alHaber('477', d.cuotaAutorrepercutida, 'IVA autorrepercutido (inversión del sujeto pasivo)'),
          alHaber('4751', d.retencion, 'Retención de IRPF'),
          alHaber(d.cuentaAcreedora, d.aPagar),
        ],
      ))
    }
    const pago = dia(f.pagadaEl) || fecha
    if (f.estado === 'pagada' && enAnio(pago)) {
      out.push(nuevoAsiento(
        { id: `fc-pago:${f.id}`, fecha: pago, concepto: con(`Pago factura ${no}`, nombre), tipo: 'pago', origen: { col: 'facturasCompra', id: f.id } },
        [alDebe(d.cuentaAcreedora, d.aPagar), alHaber('572', d.aPagar)],
      ))
    }
  }

  // ── gastos con ticket (los que ya son una factura de compra del CRM no se cuentan dos veces)
  for (const g of gestion.gastos) {
    if (g.facturaCompraId) continue
    const d = desgloseGasto(g)
    // Comprobar: todos los pagos van al banco (572), también los de tarjeta o efectivo de la sociedad.
    const contra = g.estado === 'pagado' ? '572' : g.estado === 'pendiente' ? '410' : '551'
    if (enAnio(g.fecha)) {
      out.push(nuevoAsiento(
        {
          id: `g:${g.id}`, fecha: dia(g.fecha), concepto: con(g.no, g.concepto, contra === '551' ? 'adelantado por un socio' : ''),
          tipo: 'gasto', origen: { col: 'gastos', id: g.id },
        },
        [alDebe(d.cuenta, d.gasto), alDebe('472', d.cuotaDeducible), alHaber('4751', d.retencion, 'Retención de IRPF'), alHaber(contra, d.total)],
      ))
    }
    // Comprobar: el gasto no guarda la fecha del reembolso; se toma la de su última modificación.
    const reembolso = dia(g.actualizadoEl) > dia(g.fecha) ? dia(g.actualizadoEl) : dia(g.fecha)
    if (g.estado === 'reembolsado' && enAnio(reembolso)) {
      out.push(nuevoAsiento(
        { id: `g-reembolso:${g.id}`, fecha: reembolso, concepto: con(`Reembolso ${g.no}`, g.concepto), tipo: 'reembolso', origen: { col: 'gastos', id: g.id } },
        [alDebe('551', d.total), alHaber('572', d.total)],
      ))
    }
  }

  // ── amortizaciones al cierre
  for (const x of cuadroAmortizacion(crm, anio)) {
    if (!x.cuotaEjercicio) continue
    out.push(nuevoAsiento(
      {
        id: `amort:${anio}:${x.facturaId}:${x.cuenta}`, fecha: `${anio}-12-31`, concepto: `Amortización ${anio} · ${x.descripcion}`,
        tipo: 'amortizacion', origen: { col: 'facturasCompra', id: x.facturaId },
      },
      [alDebe(x.cuentaDotacion, x.cuotaEjercicio), alHaber(x.cuentaAcumulada, x.cuotaEjercicio)],
    ))
  }

  // ── pagos (y devoluciones) de los modelos presentados
  for (const p of gestoria.presentaciones) {
    const cuentas = CUENTA_MODELO[p.modelo]
    if (!cuentas || !(p.estado === 'pagada' || p.estado === 'domiciliada')) continue
    const fecha = fechaPagoPresentacion(p), importe = r2(p.importe)
    if (!enAnio(fecha) || !importe) continue
    const datos = { id: `pres:${p.id}`, fecha, tipo: 'modelo', origen: { col: 'presentaciones' as const, id: p.id } }
    if (importe > 0) {
      out.push(nuevoAsiento({ ...datos, concepto: `Pago modelo ${p.modelo} ${p.periodo}` }, [alDebe(cuentas.pago, importe), alHaber('572', importe)]))
    } else if (cuentas.devolucion && p.estado === 'pagada') {
      // Comprobar: un resultado negativo «pagado» se toma como devolución cobrada.
      out.push(nuevoAsiento({ ...datos, concepto: `Devolución modelo ${p.modelo} ${p.periodo}` }, [alDebe('572', -importe), alHaber(cuentas.devolucion, -importe)]))
    }
  }

  // ── asientos manuales, tal cual
  for (const a of manuales) {
    out.push(nuevoAsiento(
      { id: `man:${a.id}`, fecha: dia(a.fecha) || `${anio}-12-31`, concepto: a.concepto, tipo: a.tipo, origen: { col: 'asientos', id: a.id }, automatico: false },
      a.lineas.map(l => ({ cuenta: String(l.cuenta), debe: r2(l.debe), haber: r2(l.haber), ...(l.concepto ? { concepto: l.concepto } : {}) })),
    ))
  }

  // ── liquidación del IVA al final de cada periodo, con los saldos hasta ese día
  const asientos = out.filter((a): a is Asiento => !!a)
  for (const periodo of periodosIva(anio, e.perfil?.periodicidadIva === 'mensual')) {
    const liq = liquidacionIva(asientos, periodo)
    if (liq) asientos.push(liq)
  }
  return ordenarYNumerar(asientos)
}

/**
 * Asientos del ejercicio natural: apertura (saldos del ejercicio anterior,
 * ya regularizado), operaciones del CRM y de Gestión, amortizaciones,
 * liquidaciones del IVA, pagos de modelos y asientos manuales. Ordenados por
 * fecha y numerados desde 1. No incluye la regularización (ver
 * `asientoRegularizacion`).
 */
export function asientosDelEjercicio(e: EntradaContabilidad): Asiento[] {
  const desde = Math.min(primerAnio(e), e.ejercicio)
  let apertura: Asiento | null = null
  let lista: Asiento[] = []
  for (let anio = desde; anio <= e.ejercicio; anio++) {
    lista = asientosDelAnio(e, anio, apertura)
    if (anio < e.ejercicio) {
      // si ya hay una regularización escrita a mano, no se repite
      const regularizado = lista.some(a => a.tipo === 'regularizacion') ? lista : [...lista, regularizacion(lista, anio)]
      apertura = asientoApertura(regularizado.filter(a => a.tipo !== 'cierre'), anio + 1)
    }
  }
  return lista
}
