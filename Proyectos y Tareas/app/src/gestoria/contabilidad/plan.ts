/**
 * Plan de cuentas: subconjunto del PGC de pymes (RD 1515/2007) con las
 * cuentas que usa una SL de servicios como Locodea, y la elección de cuenta
 * para cada gasto y cada factura de compra del CRM.
 */
import type { FacturaCompra, LineaDocumento } from '../../crm/types'
import type { CategoriaGasto } from '../../gestion/types'

export interface CuentaContable {
  codigo: string
  nombre: string
  grupo: number
  naturaleza: 'activo' | 'pasivo' | 'patrimonio' | 'gasto' | 'ingreso'
}

type Naturaleza = CuentaContable['naturaleza']

const c = (codigo: string, nombre: string, naturaleza: Naturaleza): CuentaContable => ({ codigo, nombre, grupo: Number(codigo[0]), naturaleza })

export const PLAN: CuentaContable[] = [
  // ── grupo 1: financiación básica
  c('100', 'Capital social', 'patrimonio'),
  c('103', 'Socios por desembolsos no exigidos', 'patrimonio'),
  c('110', 'Prima de emisión o asunción', 'patrimonio'),
  c('112', 'Reserva legal', 'patrimonio'),
  c('113', 'Reservas voluntarias', 'patrimonio'),
  c('118', 'Aportaciones de socios o propietarios', 'patrimonio'),
  c('120', 'Remanente', 'patrimonio'),
  c('121', 'Resultados negativos de ejercicios anteriores', 'patrimonio'),
  c('129', 'Resultado del ejercicio', 'patrimonio'),
  c('130', 'Subvenciones oficiales de capital', 'patrimonio'),
  c('170', 'Deudas a largo plazo con entidades de crédito', 'pasivo'),
  c('171', 'Deudas a largo plazo', 'pasivo'),
  c('173', 'Proveedores de inmovilizado a largo plazo', 'pasivo'),
  // ── grupo 2: activo no corriente
  c('206', 'Aplicaciones informáticas', 'activo'),
  c('216', 'Mobiliario', 'activo'),
  c('217', 'Equipos para procesos de información', 'activo'),
  c('218', 'Elementos de transporte', 'activo'),
  c('260', 'Fianzas constituidas a largo plazo', 'activo'),
  c('280', 'Amortización acumulada del inmovilizado intangible', 'activo'),
  c('281', 'Amortización acumulada del inmovilizado material', 'activo'),
  // ── grupo 4: acreedores y deudores por operaciones comerciales
  c('400', 'Proveedores', 'pasivo'),
  c('410', 'Acreedores por prestaciones de servicios', 'pasivo'),
  c('430', 'Clientes', 'activo'),
  c('438', 'Anticipos de clientes', 'pasivo'),
  c('440', 'Deudores', 'activo'),
  c('460', 'Anticipos de remuneraciones', 'activo'),
  c('465', 'Remuneraciones pendientes de pago', 'pasivo'),
  c('470', 'Hacienda Pública, deudora por diversos conceptos', 'activo'),
  c('4700', 'Hacienda Pública, deudora por IVA', 'activo'),
  c('4709', 'Hacienda Pública, deudora por devolución de impuestos', 'activo'),
  c('472', 'Hacienda Pública, IVA soportado', 'activo'),
  c('473', 'Hacienda Pública, retenciones y pagos a cuenta', 'activo'),
  c('474', 'Activos por impuesto diferido', 'activo'),
  c('475', 'Hacienda Pública, acreedora por conceptos fiscales', 'pasivo'),
  c('4750', 'Hacienda Pública, acreedora por IVA', 'pasivo'),
  c('4751', 'Hacienda Pública, acreedora por retenciones practicadas', 'pasivo'),
  c('4752', 'Hacienda Pública, acreedora por impuesto sobre sociedades', 'pasivo'),
  c('476', 'Organismos de la Seguridad Social, acreedores', 'pasivo'),
  c('477', 'Hacienda Pública, IVA repercutido', 'pasivo'),
  // Subcuenta propia: IVA de otros Estados de la UE que se ingresa por la ventanilla única (369), no en el 303.
  c('4771', 'Hacienda Pública, IVA repercutido (ventanilla única OSS)', 'pasivo'),
  c('479', 'Pasivos por diferencias temporarias imponibles', 'pasivo'),
  c('480', 'Gastos anticipados', 'activo'),
  c('485', 'Ingresos anticipados', 'pasivo'),
  // ── grupo 5: cuentas financieras
  c('520', 'Deudas a corto plazo con entidades de crédito', 'pasivo'),
  c('523', 'Proveedores de inmovilizado a corto plazo', 'pasivo'),
  c('526', 'Dividendo activo a pagar', 'pasivo'),
  c('551', 'Cuenta corriente con socios y administradores', 'pasivo'),
  c('555', 'Partidas pendientes de aplicación', 'pasivo'),
  c('557', 'Dividendo activo a cuenta', 'patrimonio'),
  c('570', 'Caja, euros', 'activo'),
  c('572', 'Bancos e instituciones de crédito c/c vista, euros', 'activo'),
  // ── grupo 6: compras y gastos
  c('600', 'Compras de mercaderías', 'gasto'),
  c('607', 'Trabajos realizados por otras empresas', 'gasto'),
  c('621', 'Arrendamientos y cánones', 'gasto'),
  c('622', 'Reparaciones y conservación', 'gasto'),
  c('623', 'Servicios de profesionales independientes', 'gasto'),
  c('624', 'Transportes', 'gasto'),
  c('625', 'Primas de seguros', 'gasto'),
  c('626', 'Servicios bancarios y similares', 'gasto'),
  c('627', 'Publicidad, propaganda y relaciones públicas', 'gasto'),
  c('628', 'Suministros', 'gasto'),
  c('629', 'Otros servicios', 'gasto'),
  c('630', 'Impuesto sobre beneficios', 'gasto'),
  c('6300', 'Impuesto corriente', 'gasto'),
  c('6301', 'Impuesto diferido', 'gasto'),
  c('631', 'Otros tributos', 'gasto'),
  c('640', 'Sueldos y salarios', 'gasto'),
  c('642', 'Seguridad Social a cargo de la empresa', 'gasto'),
  c('662', 'Intereses de deudas', 'gasto'),
  c('668', 'Diferencias negativas de cambio', 'gasto'),
  c('669', 'Otros gastos financieros', 'gasto'),
  c('678', 'Gastos excepcionales', 'gasto'),
  c('680', 'Amortización del inmovilizado intangible', 'gasto'),
  c('681', 'Amortización del inmovilizado material', 'gasto'),
  // ── grupo 7: ventas e ingresos
  c('700', 'Ventas de mercaderías', 'ingreso'),
  c('705', 'Prestaciones de servicios', 'ingreso'),
  c('708', 'Devoluciones de ventas y operaciones similares', 'ingreso'),
  c('759', 'Ingresos por servicios diversos', 'ingreso'),
  c('768', 'Diferencias positivas de cambio', 'ingreso'),
  c('769', 'Otros ingresos financieros', 'ingreso'),
  c('778', 'Ingresos excepcionales', 'ingreso'),
]

const POR_CODIGO = new Map(PLAN.map(x => [x.codigo, x]))

/** Cuenta del plan, o la más cercana por prefijo (4751 → 4751; 57200001 → 572). */
export function cuentaDelPlan(codigo: string): CuentaContable | null {
  for (let n = codigo.length; n >= 3; n--) {
    const x = POR_CODIGO.get(codigo.slice(0, n))
    if (x) return x
  }
  return null
}

/** Nombre de la cuenta; si no está en el plan, el de su cuenta de 3 dígitos o vacío. */
export const nombreCuenta = (codigo: string) => cuentaDelPlan(codigo)?.nombre ?? ''

/** Sanciones, multas y recargos: van a 678 y no son deducibles en el IS (art. 15.c LIS). */
const RE_SANCION = /\b(sanci[oó]n|sanciones|multas?|recargos?)\b/i

export const esSancion = (concepto: string) => RE_SANCION.test(concepto || '')

/**
 * Cuenta de gasto de un gasto con ticket del módulo Gestión, por categoría.
 * `bienInversion`: material o software que se activa (217 o 206) en lugar de ir a gasto.
 */
export function cuentaDeGasto(categoria: CategoriaGasto | 'sanciones', bienInversion = false): string {
  if (categoria === 'sanciones') return '678'
  if (bienInversion && categoria === 'software') return '206'
  if (bienInversion && categoria === 'material') return '217'
  switch (categoria) {
    case 'marketing': return '627'
    case 'asesoria': return '623'
    case 'suministros': return '628'
    // viajes, dietas, software, hosting, material, formación, telefonía y otros
    default: return '629'
  }
}

/** Una línea (o el concepto) es software: va a 206 Aplicaciones informáticas en lugar de a 217. */
const RE_SOFTWARE = /\b(software|licencias?|aplicaci[oó]n(es)?|programas?)\b/i

/** Cuenta de una línea de una factura de compra. */
export function cuentaDeLineaCompra(f: FacturaCompra, l: Pick<LineaDocumento, 'descripcion'> | null): string {
  if (f.bienInversion) return RE_SOFTWARE.test(l?.descripcion || f.referencia || '') ? '206' : '217'
  if (f.claveRetencion === 'arrendamiento') return '621'
  if (f.claveRetencion === 'profesional') return '623'
  return '629'
}

/**
 * Cuenta de gasto o de inmovilizado de una factura de compra: bien de
 * inversión → 217 (206 si es software); arrendamiento → 621; profesional →
 * 623; resto → 629. Si las líneas van a cuentas distintas, la de más importe.
 */
export function cuentaDeCompra(f: FacturaCompra): string {
  const lineas = f.lineas ?? []
  if (!lineas.length) return cuentaDeLineaCompra(f, null)
  const importe = (l: LineaDocumento) => Math.abs((Number(l.cantidad) || 0) * (Number(l.precio) || 0))
  const mayor = lineas.reduce((a, b) => importe(b) > importe(a) ? b : a)
  return cuentaDeLineaCompra(f, mayor)
}

/** Cuenta acreedora de una compra: proveedores de inmovilizado (523) o acreedores por servicios (410). */
export const cuentaAcreedora = (f: FacturaCompra) => f.bienInversion ? '523' : '410'
