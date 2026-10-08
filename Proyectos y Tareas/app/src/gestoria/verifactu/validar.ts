/**
 * Validación de un registro antes de enviarlo: reproduce las comprobaciones
 * de la AEAT que provocan rechazo o «aceptado con errores» y añade alguna
 * propia (rectificativa sin factura rectificada).
 *
 * Fuentes:
 *  - Validaciones y errores v1.2.2 (apdos. 3.1.3, 3.1.4 y 3.1.5):
 *    https://www.agenciatributaria.es/static_files/AEAT_Desarrolladores/EEDD/IVA/VERI-FACTU/Validaciones_Errores_Veri-Factu.pdf
 *    (NumSerieFactura ASCII 32–126 sin " ' < > =; fecha no futura ni anterior al
 *    28/10/2024; Destinatarios obligatorio en F1/F3/R1–R4 y prohibido en F2/R5;
 *    IDType 07 solo con CodigoPais ES; IDType 02 solo en F1/F3/R1–R4; TipoRectificativa
 *    obligatorio en R1–R5; S2 con tipo y cuota 0; N1/N2 y exentas sin tipo ni cuota;
 *    CuotaTotal e ImporteTotal = suma del desglose; IdSistemaInformatico de dos
 *    caracteres en mayúsculas o dígitos; huella SHA-256 en hexadecimal y mayúsculas.)
 *  - SuministroInformacion.xsd (longitudes y máximo de 12 líneas de desglose).
 */
import type { RegistroFacturacion } from '../types'
import { diaMadrid, diaValido, esFechaHoraHuso } from './fechas'
import { redondear2 } from './formato'
import { esHuella } from './huella'
import { MAX_DETALLES_DESGLOSE, bloquesXml, valorXml } from './xml'

/** Entrada en vigor de la Orden HAC/1177/2024: no se admiten fechas de expedición anteriores. */
const FECHA_MINIMA = '2024-10-28'
/** Mayor importe que cabe en ImporteSgn12.2Type (12 enteros). */
const IMPORTE_MAXIMO = 999_999_999_999.99
/** Margen por redondeo de céntimos al comparar totales con el desglose. */
const MARGEN = 0.01

const LETRAS_DNI = 'TRWAGMYFPDXBNJZSQVHLCKE'

/** NIF español con su dígito o letra de control: DNI, NIE, NIF de personas jurídicas y K/L/M. */
export function nifValido(nif: string): boolean {
  const n = String(nif ?? '').toUpperCase().trim()
  if (/^\d{8}[A-Z]$/.test(n)) return LETRAS_DNI[+n.slice(0, 8) % 23] === n[8]
  if (/^[XYZ]\d{7}[A-Z]$/.test(n)) return LETRAS_DNI[+('XYZ'.indexOf(n[0]) + n.slice(1, 8)) % 23] === n[8]
  if (/^[KLM]\d{7}[A-Z]$/.test(n)) return LETRAS_DNI[+n.slice(1, 8) % 23] === n[8]
  const m = /^([ABCDEFGHJNPQRSUVW])(\d{7})([0-9A-J])$/.exec(n)
  if (!m) return false
  const digitos = m[2]
  let suma = 0
  for (let i = 0; i < 7; i++) {
    const d = +digitos[i]
    if (i % 2 === 0) { const x = d * 2; suma += Math.floor(x / 10) + (x % 10) } else suma += d
  }
  const control = (10 - (suma % 10)) % 10
  const letra = 'JABCDEFGHI'[control]
  if ('ABEH'.includes(m[1])) return m[3] === String(control)
  if ('KPQSNW'.includes(m[1])) return m[3] === letra
  return m[3] === String(control) || m[3] === letra
}

const num = (s: string | null) => (s === null || s.trim() === '' ? null : Number(s))

/**
 * Errores legibles de un registro (vacío si está bien). `ahora` sirve para
 * comprobar que la fecha de expedición no es futura.
 */
export function validarRegistro(r: Omit<RegistroFacturacion, 'id' | 'creadoEl'>, ahora: Date = new Date()): string[] {
  const errores: string[] = []
  const xml = r.xml ?? ''
  const alta = r.tipo === 'alta'

  // Emisor
  if (!String(r.nifEmisor ?? '').trim()) errores.push('Falta el NIF del emisor: complétalo en la configuración de Verifactu.')
  else if (!nifValido(r.nifEmisor)) errores.push(`El NIF del emisor «${r.nifEmisor}» no es un NIF español válido.`)

  // Número de factura
  const numero = String(r.serieNumero ?? '')
  if (!numero.trim()) errores.push('La factura no tiene número.')
  else {
    if (numero.length > 60) errores.push('El número de factura (serie + número) no puede pasar de 60 caracteres.')
    if (/[^\x20-\x7E]/.test(numero)) errores.push('El número de factura solo puede llevar caracteres ASCII imprimibles (sin tildes ni eñes).')
    if (/["'<>=]/.test(numero)) errores.push('El número de factura no puede contener comillas, < , > ni =.')
  }

  // Fecha de expedición
  if (!diaValido(r.fechaExpedicion)) errores.push(`La fecha de expedición «${r.fechaExpedicion}» no es válida.`)
  else {
    if (r.fechaExpedicion > diaMadrid(ahora)) errores.push('La fecha de expedición no puede ser futura.')
    if (r.fechaExpedicion < FECHA_MINIMA) errores.push('La fecha de expedición no puede ser anterior al 28/10/2024.')
  }

  // Encadenamiento y huella
  if (!esHuella(r.huella)) errores.push('La huella no es un SHA-256 en hexadecimal y mayúsculas.')
  if (r.orden === 1 && r.huellaAnterior) errores.push('El primer registro de la cadena no puede llevar huella anterior.')
  if (r.orden > 1 && !esHuella(r.huellaAnterior)) errores.push('Falta la huella del registro anterior o no tiene el formato correcto.')
  if (!esFechaHoraHuso(r.fechaHoraGeneracion)) errores.push('La fecha y hora de generación debe llevar el huso horario (p. ej. 2027-01-04T10:15:00+01:00).')

  // Sistema informático
  const idSistema = valorXml(xml, 'IdSistemaInformatico')
  if (idSistema !== null && !/^[A-MO-Z0-9]{2}$/.test(idSistema)) {
    errores.push('El identificador del sistema debe tener dos caracteres: letras mayúsculas (sin Ñ) o dígitos.')
  }
  if (valorXml(xml, 'NombreSistemaInformatico') === '') errores.push('Falta el nombre del sistema informático.')

  if (!alta) return errores

  // Importes
  for (const [nombre, v] of [['cuota total', r.cuotaTotal], ['importe total', r.importeTotal]] as const) {
    if (!Number.isFinite(v)) errores.push(`El ${nombre} no es un número.`)
    else if (Math.abs(v) > IMPORTE_MAXIMO) errores.push(`El ${nombre} supera el máximo admitido.`)
  }

  // Rectificativas
  const rectificativa = r.tipoFactura.startsWith('R')
  if (rectificativa) {
    if (!bloquesXml(xml, 'IDFacturaRectificada').length) errores.push('La factura rectificativa no indica qué factura rectifica.')
    if (!valorXml(xml, 'TipoRectificativa')) errores.push('Falta el tipo de rectificativa (por sustitución o por diferencias).')
  }

  // Destinatarios
  const destinatarios = bloquesXml(xml, 'IDDestinatario')
  const simplificada = r.tipoFactura === 'F2' || r.tipoFactura === 'R5'
  if (simplificada && destinatarios.length) errores.push('Las facturas simplificadas (F2, R5) no llevan destinatario.')
  if (!simplificada && !destinatarios.length) errores.push(`Una factura ${r.tipoFactura} tiene que llevar destinatario: asigna un cliente a la factura.`)
  for (const d of destinatarios) {
    const nombre = valorXml(d, 'NombreRazon') || 'El destinatario'
    if (!valorXml(d, 'NombreRazon')) errores.push('Falta el nombre o razón social del destinatario.')
    const otro = bloquesXml(d, 'IDOtro')[0]
    if (otro === undefined) {
      const nif = valorXml(d, 'NIF') ?? ''
      if (!nif) errores.push(`${nombre} no tiene NIF.`)
      else if (!nifValido(nif)) errores.push(`El NIF de ${nombre} («${nif}») no es un NIF español válido.`)
      continue
    }
    const pais = valorXml(otro, 'CodigoPais') ?? ''
    const idType = valorXml(otro, 'IDType') ?? ''
    const id = valorXml(otro, 'ID') ?? ''
    if (!idType) errores.push(`${nombre} es extranjero (${pais || 'sin país'}) y no tiene tipo de identificación (IDType): indica si es NIF-IVA, pasaporte, documento oficial…`)
    else {
      if (!['02', '03', '04', '05', '06', '07'].includes(idType)) errores.push(`Tipo de identificación «${idType}» desconocido para ${nombre}.`)
      if (idType !== '02' && !pais) errores.push(`Falta el país de ${nombre}.`)
      if (idType === '07' && pais !== 'ES') errores.push(`«No censado» (07) solo se admite con país ES (${nombre}).`)
      if (pais === 'ES' && idType !== '03' && idType !== '07') errores.push(`${nombre} es de España: usa su NIF (o pasaporte/no censado).`)
      if (idType === '02' && !['F1', 'F3', 'R1', 'R2', 'R3', 'R4'].includes(r.tipoFactura)) errores.push('El NIF-IVA (02) solo se admite en facturas F1, F3 y R1–R4.')
    }
    if (!id) errores.push(`Falta el número de identificación de ${nombre}.`)
    else if (id.length > 20) errores.push(`La identificación de ${nombre} no puede pasar de 20 caracteres.`)
  }

  // Desglose y totales
  const detalles = bloquesXml(xml, 'DetalleDesglose')
  if (!detalles.length) errores.push('La factura no tiene líneas: el desglose está vacío.')
  if (detalles.length > MAX_DETALLES_DESGLOSE) errores.push(`El desglose no puede tener más de ${MAX_DETALLES_DESGLOSE} líneas (tipos de IVA distintos).`)
  let base = 0, cuota = 0
  const claves = new Set<string>()
  for (const d of detalles) {
    const cal = valorXml(d, 'CalificacionOperacion')
    const exenta = valorXml(d, 'OperacionExenta')
    const tipo = num(valorXml(d, 'TipoImpositivo'))
    const c = num(valorXml(d, 'CuotaRepercutida'))
    claves.add(valorXml(d, 'ClaveRegimen') ?? '')
    base += num(valorXml(d, 'BaseImponibleOimporteNoSujeto')) ?? 0
    cuota += c ?? 0
    if (!cal && !exenta) errores.push('Una línea del desglose no tiene calificación ni causa de exención.')
    if (cal === 'S1' && (tipo === null || c === null)) errores.push('Las operaciones sujetas (S1) necesitan tipo impositivo y cuota.')
    if (cal === 'S2' && (tipo !== 0 || c !== 0)) errores.push('Con inversión del sujeto pasivo (S2) el tipo y la cuota van a cero.')
    if (cal === 'S2' && simplificada) errores.push('La inversión del sujeto pasivo (S2) no se admite en facturas simplificadas.')
    if ((cal === 'N1' || cal === 'N2' || exenta) && (tipo !== null || c !== null)) errores.push('Las operaciones no sujetas o exentas no llevan tipo impositivo ni cuota.')
  }
  const cuotaTotalXml = num(valorXml(xml, 'CuotaTotal'))
  const importeTotalXml = num(valorXml(xml, 'ImporteTotal'))
  if (cuotaTotalXml !== null && redondear2(cuotaTotalXml) !== redondear2(r.cuotaTotal)) errores.push('La cuota total del XML no coincide con la del registro.')
  if (importeTotalXml !== null && redondear2(importeTotalXml) !== redondear2(r.importeTotal)) errores.push('El importe total del XML no coincide con el del registro.')
  const margen = MARGEN * Math.max(1, detalles.length)
  if (detalles.length && Math.abs(r.cuotaTotal - cuota) > margen) {
    errores.push(`La cuota total (${r.cuotaTotal.toFixed(2)}) no coincide con la suma de cuotas del desglose (${cuota.toFixed(2)}).`)
  }
  // En OSS (clave 17) el importe total lleva el IVA del Estado del cliente, que no está en el desglose.
  if (detalles.length && !claves.has('17') && Math.abs(r.importeTotal - (base + cuota)) > margen) {
    errores.push(`El importe total (${r.importeTotal.toFixed(2)}) no coincide con base + cuota del desglose (${(base + cuota).toFixed(2)}).`)
  }
  if (!valorXml(xml, 'DescripcionOperacion')) errores.push('Falta la descripción de la operación.')
  return errores
}
