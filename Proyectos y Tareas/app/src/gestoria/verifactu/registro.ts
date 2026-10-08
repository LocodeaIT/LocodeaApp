/**
 * Creación de los registros de facturación de alta y de anulación de una
 * factura de venta, encadenados con el último registro del mismo emisor y
 * entorno.
 *
 * Fuentes:
 *  - Orden HAC/1177/2024, art. 7.i (antes de generar un registro se comprueba
 *    el encadenamiento del anterior y que su fecha de generación no sea
 *    posterior en más de un minuto a la actual):
 *    https://www.boe.es/diario_boe/txt.php?id=BOE-A-2024-22138
 *  - FAQ para desarrolladores (04/12/2025), pregunta 15 (alcance de la comprobación de 7.i):
 *    https://www.agenciatributaria.es/static_files/AEAT_Desarrolladores/EEDD/IVA/VERI-FACTU/FAQs-Desarrolladores.pdf
 *  - Validaciones y errores v1.2.2, 15.4 y 15.7 (en N1/N2 y exentas no van
 *    TipoImpositivo ni CuotaRepercutida; en S2 van a cero):
 *    https://www.agenciatributaria.es/static_files/AEAT_Desarrolladores/EEDD/IVA/VERI-FACTU/Validaciones_Errores_Veri-Factu.pdf
 */
import type { Cuenta, FacturaVenta } from '../../crm/types'
import { importeLinea, totales } from '../../crm/documentos'
import type { ConfigVerifactu, EntornoVerifactu, RegistroFacturacion } from '../types'
import { fechaHoraHuso } from './fechas'
import { redondear2 } from './formato'
import { huellaAlta, huellaAnulacion } from './huella'
import { calificacion, destinatarioDe } from './mapeo'
import { sistemaDe, xmlRegistroAlta, xmlRegistroAnulacion } from './xml'
import type { AnteriorXml, DetalleDesglose } from './xml'

export type NuevoRegistro = Omit<RegistroFacturacion, 'id' | 'creadoEl'>

/** Margen del art. 7.i de la Orden: el registro nuevo no puede fecharse más de un minuto antes que el anterior. */
const MARGEN_RELOJ_MS = 60_000

/** Desglose por tipo de IVA a partir de las líneas de la factura. */
export function desgloseDe(f: Pick<FacturaVenta, 'lineas' | 'tipoOperacion'>): DetalleDesglose[] {
  const cal = calificacion(f.tipoOperacion)
  const grupos = new Map<number, number>()
  for (const l of f.lineas ?? []) {
    // Mismo tipo por defecto que `totales`. Fuera de S1 no hay tipo: todo va en una sola línea.
    const tipo = cal.calificacion === 'S1' ? Number(l.iva ?? 21) || 0 : 0
    grupos.set(tipo, (grupos.get(tipo) ?? 0) + importeLinea(l))
  }
  return [...grupos.entries()].sort((a, b) => b[0] - a[0]).map(([tipo, base]): DetalleDesglose => {
    const comun = { impuesto: '01' as const, claveRegimen: cal.claveRegimen, base: redondear2(base) }
    if (cal.exenta) return { ...comun, exenta: cal.exenta }
    if (cal.calificacion === 'S1') return { ...comun, calificacion: 'S1', tipoImpositivo: tipo, cuota: redondear2(base * tipo / 100) }
    if (cal.calificacion === 'S2') return { ...comun, calificacion: 'S2', tipoImpositivo: 0, cuota: 0 }
    // N1/N2: la base va como importe no sujeto, sin tipo ni cuota.
    return { ...comun, calificacion: cal.calificacion }
  })
}

/** Descripción de la operación (máx. 500): conceptos de las líneas y, en rectificativas, la factura y el motivo. */
export function descripcionDe(f: FacturaVenta, rectificada?: FacturaVenta): string {
  const conceptos = [...new Set((f.lineas ?? []).map(l => String(l.descripcion ?? '').trim()).filter(Boolean))]
  let d = conceptos.join('; ') || 'Prestación de servicios'
  if (f.tipoFactura.startsWith('R')) {
    const motivo = String(f.motivoRectificacion ?? '').trim()
    const de = rectificada?.no ? `Rectificación de la factura ${rectificada.no}` : 'Rectificación'
    d = `${de}${motivo ? `: ${motivo}` : ''}. ${d}`.replace(/\s+/g, ' ')
  }
  return d.length > 500 ? d.slice(0, 499) + '…' : d
}

/** Último registro de la cadena de un emisor en un entorno (el de mayor orden). */
export function ultimoDeLaCadena(registros: RegistroFacturacion[], nifEmisor: string, entorno: EntornoVerifactu): RegistroFacturacion | null {
  let ultimo: RegistroFacturacion | null = null
  for (const r of registros) {
    if (r.nifEmisor !== nifEmisor || r.entorno !== entorno) continue
    if (!ultimo || r.orden > ultimo.orden) ultimo = r
  }
  return ultimo
}

/** Comprueba que el anterior es de la misma cadena y que el reloj no ha ido hacia atrás (art. 7.i). */
function comprobarAnterior(config: ConfigVerifactu, anterior: RegistroFacturacion | null, ahora: Date) {
  if (!anterior) return
  if (anterior.nifEmisor !== config.nifEmisor || anterior.entorno !== config.entorno) {
    throw new Error(`El registro anterior es de otra cadena (${anterior.nifEmisor} · ${anterior.entorno}); usa ultimoDeLaCadena`)
  }
  const previo = Date.parse(anterior.fechaHoraGeneracion)
  if (Number.isFinite(previo) && previo - ahora.getTime() > MARGEN_RELOJ_MS) {
    throw new Error('La fecha y hora actuales son anteriores en más de un minuto a las del último registro: revisa el reloj del equipo antes de seguir')
  }
}

const anteriorXml = (a: RegistroFacturacion | null): AnteriorXml | null =>
  a ? { nifEmisor: a.nifEmisor, serieNumero: a.serieNumero, fechaExpedicion: a.fechaExpedicion, huella: a.huella } : null

/** Campos comunes del registro nuevo. */
function base(config: ConfigVerifactu, anterior: RegistroFacturacion | null) {
  return {
    nifEmisor: config.nifEmisor,
    huellaAnterior: anterior?.huella ?? '',
    estado: config.entorno === 'preparacion' ? 'simulado' as const : 'pendiente' as const,
    entorno: config.entorno,
    codigoError: '', descripcionError: '', csv: '', envioId: null,
    orden: anterior ? anterior.orden + 1 : 1,
  }
}

/**
 * Registro de alta de una factura de venta, con su huella y su XML. En
 * preparación queda «simulado» (no se enviará); en pruebas y producción,
 * «pendiente» de envío.
 */
export async function crearRegistroAlta(e: {
  factura: FacturaVenta
  cuenta?: Cuenta
  config: ConfigVerifactu
  anterior: RegistroFacturacion | null
  ahora: Date
  rectificada?: FacturaVenta
}): Promise<NuevoRegistro> {
  const { factura: f, cuenta, config, anterior, ahora, rectificada } = e
  comprobarAnterior(config, anterior, ahora)
  const fechaHoraGeneracion = fechaHoraHuso(ahora)
  const desglose = desgloseDe(f)
  const cuotaTotal = redondear2(desglose.reduce((s, d) => s + (d.cuota ?? 0), 0))
  // El importe total es el de la factura (el que lleva el QR). Coincide con base + cuota del
  // desglose salvo en OSS, donde la factura lleva el IVA del Estado del cliente (ver mapeo.ts).
  const importeTotal = redondear2(totales(f).total)
  const serieNumero = String(f.no ?? '').trim()
  const huella = await huellaAlta({
    nifEmisor: config.nifEmisor, serieNumero, fechaExpedicion: f.fecha, tipoFactura: f.tipoFactura,
    cuotaTotal, importeTotal, huellaAnterior: anterior?.huella ?? '', fechaHoraGeneracion,
  })
  const rectificativa = f.tipoFactura.startsWith('R')
  // Las F2 y R5 (simplificadas) no llevan destinatario.
  const conDestinatario = !['F2', 'R5'].includes(f.tipoFactura) && !!cuenta
  const xml = xmlRegistroAlta({
    idFactura: { nifEmisor: config.nifEmisor, serieNumero, fechaExpedicion: f.fecha },
    nombreRazonEmisor: config.razonSocial,
    tipoFactura: f.tipoFactura,
    // Las rectificativas del CRM llevan solo la diferencia (líneas en negativo o de ajuste): «por diferencias».
    // La sustitutiva (S) necesitaría además ImporteRectificacion; no se usa.
    tipoRectificativa: rectificativa ? 'I' : undefined,
    facturasRectificadas: rectificativa && rectificada
      ? [{ nifEmisor: config.nifEmisor, serieNumero: String(rectificada.no ?? '').trim(), fechaExpedicion: rectificada.fecha }]
      : undefined,
    descripcionOperacion: descripcionDe(f, rectificada),
    destinatarios: conDestinatario && cuenta ? [destinatarioDe(cuenta)] : [],
    desglose, cuotaTotal, importeTotal,
    anterior: anteriorXml(anterior),
    sistema: sistemaDe(config),
    fechaHoraGeneracion, huella,
  })
  return {
    ...base(config, anterior),
    tipo: 'alta', facturaId: f.id, serieNumero, fechaExpedicion: f.fecha, tipoFactura: f.tipoFactura,
    cuotaTotal, importeTotal, huella, fechaHoraGeneracion, xml,
  }
}

/**
 * Registro de anulación de una factura ya registrada. No lleva importes: los
 * campos cuotaTotal e importeTotal quedan a cero.
 */
export async function crearRegistroAnulacion(e: {
  factura: FacturaVenta
  config: ConfigVerifactu
  anterior: RegistroFacturacion | null
  ahora: Date
}): Promise<NuevoRegistro> {
  const { factura: f, config, anterior, ahora } = e
  comprobarAnterior(config, anterior, ahora)
  const fechaHoraGeneracion = fechaHoraHuso(ahora)
  const serieNumero = String(f.no ?? '').trim()
  const huella = await huellaAnulacion({
    nifEmisor: config.nifEmisor, serieNumero, fechaExpedicion: f.fecha, huellaAnterior: anterior?.huella ?? '', fechaHoraGeneracion,
  })
  const xml = xmlRegistroAnulacion({
    idFactura: { nifEmisor: config.nifEmisor, serieNumero, fechaExpedicion: f.fecha },
    anterior: anteriorXml(anterior),
    sistema: sistemaDe(config),
    fechaHoraGeneracion, huella,
  })
  return {
    ...base(config, anterior),
    tipo: 'anulacion', facturaId: f.id, serieNumero, fechaExpedicion: f.fecha, tipoFactura: f.tipoFactura,
    cuotaTotal: 0, importeTotal: 0, huella, fechaHoraGeneracion, xml,
  }
}
