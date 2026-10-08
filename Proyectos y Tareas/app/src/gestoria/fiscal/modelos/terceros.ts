/**
 * Modelo 347: operaciones con terceras personas por encima de 3.005,06 € en el
 * año, separando compras (clave A) y ventas (clave B), IVA incluido y con el
 * desglose por trimestres.
 *
 * Reglas (Reglamento general de gestión e inspección, RD 1065/2007, arts. 33 a 35):
 *  - Umbral por tercero, computando por separado entregas y adquisiciones (art. 33.1).
 *  - Fuera: lo que va al 349 y las rentas sujetas a retención (van al 190/180) (art. 33.2.i); importaciones y
 *    exportaciones de mercancías (art. 33.2.g); operaciones sin obligación de identificar al destinatario, como
 *    las facturas simplificadas y los tickets (art. 33.2.a).
 *  - Importe: contraprestación total con las cuotas de IVA repercutidas o soportadas (art. 34.2.a). Las operaciones
 *    con inversión del sujeto pasivo se declaran aparte (art. 34.1.k).
 *  - Imputación: periodo en que se anota la factura (art. 35.1): devengo en ventas, recepción en compras.
 *  https://www.boe.es/buscar/act.php?id=BOE-A-2007-15984
 *  Diseño de registro (claves A y B, importes trimestrales, NIF comunitario, código país 99/XX de no residentes):
 *  https://sede.agenciatributaria.gob.es/static_files/Sede/Disenyo_registro/DR_300_399/archivos/347.pdf
 */
import { UMBRAL_347 } from '../../../gestion/calculos'
import type { ApunteFiscal } from '../apuntes'
import { apuntesDelPeriodo, esIntracomunitaria } from '../apuntes'
import { r2 } from '../periodos'
import { type ResultadoModelo, euros, unicos } from './comun'

export interface Tercero347 {
  terceroId: string | null
  nif: string
  nombre: string
  codigoPais: string
  /** A adquisiciones, B entregas. */
  clave: 'A' | 'B'
  /** Operaciones en las que Locodea es sujeto pasivo por inversión (se declaran en un registro aparte). */
  inversionSujetoPasivo: boolean
  importe: number
  trimestres: [number, number, number, number]
  documentos: string[]
}
export type Resultado347 = ResultadoModelo & { terceros: Tercero347[] }

/** Motivo por el que un apunte no va al 347, o null si va. */
export function exclusion347(a: ApunteFiscal): string | null {
  if (esIntracomunitaria(a)) return 'va al 349'
  if (a.retencion !== 0 || (a.origen !== 'venta' && a.claveRetencion !== 'ninguna')) return 'tiene retención (190/180)'
  if (a.tipoOperacion === 'importacion') return 'importación'
  if (a.tipoFactura === 'F2' || a.tipoFactura === 'R5') return 'factura simplificada o ticket'
  return null
}

export function modelo347(apuntes: ApunteFiscal[], anio: number): Resultado347 {
  const del = apuntesDelPeriodo(apuntes, `${anio}-01-01`, `${anio}-12-31`)
  const grupos = new Map<string, Tercero347>()
  const sinTercero: ApunteFiscal[] = []
  for (const a of del) {
    if (exclusion347(a)) continue
    // exportaciones de bienes fuera; los servicios a clientes de fuera de la UE sí cuentan
    const base = a.origen === 'venta' && a.tipoOperacion === 'fuera-ue' ? a.base - a.baseBienes : a.base
    if (!base) continue
    if (!a.terceroId && !a.terceroNif) { sinTercero.push(a); continue }
    const clave: 'A' | 'B' = a.origen === 'venta' ? 'B' : 'A'
    const isp = a.origen !== 'venta' && a.inversionSujetoPasivo
    const importe = base === a.base ? a.base + a.cuota : base
    const k = `${a.terceroId ?? a.terceroNif}|${clave}|${isp ? 'isp' : ''}`
    const t = grupos.get(k) ?? {
      terceroId: a.terceroId, nif: a.terceroNif, nombre: a.terceroNombre, codigoPais: a.codigoPais, clave, inversionSujetoPasivo: isp,
      importe: 0, trimestres: [0, 0, 0, 0] as Tercero347['trimestres'], documentos: [],
    }
    t.importe += importe
    t.trimestres[Math.floor((Number(a.fechaDevengo.slice(5, 7)) - 1) / 3)] += importe
    t.documentos.push(a.docId)
    grupos.set(k, t)
  }
  // umbral por tercero y clave (sumando lo normal y lo de inversión del sujeto pasivo)
  const totalPor = new Map<string, number>()
  for (const t of grupos.values()) { const k = `${t.terceroId ?? t.nif}|${t.clave}`; totalPor.set(k, (totalPor.get(k) ?? 0) + t.importe) }
  const terceros = [...grupos.values()]
    .filter(t => r2(totalPor.get(`${t.terceroId ?? t.nif}|${t.clave}`) ?? 0) > UMBRAL_347)
    .map(t => ({ ...t, importe: r2(t.importe), trimestres: t.trimestres.map(r2) as Tercero347['trimestres'] }))
    .sort((a, b) => a.clave.localeCompare(b.clave) || b.importe - a.importe)

  const avisos: string[] = []
  if (sinTercero.length) avisos.push(`${sinTercero.length} documento(s) sin proveedor ni cliente asignado no se han podido sumar: ${sinTercero.map(a => a.numero).join(', ')}.`)
  const sinNif = terceros.filter(t => !t.nif)
  if (sinNif.length) avisos.push(`Terceros sin NIF: ${sinNif.map(t => t.nombre).join(', ')}. El 347 necesita el NIF (o el NIF-IVA, o el país si no es residente).`)
  // Comprobar: si los servicios a clientes y de proveedores de fuera de la UE con inversión del sujeto pasivo deben
  // ir en el 347 (aquí se incluyen, con código de país; la AEAT no tiene una respuesta única publicada).
  if (terceros.some(t => t.codigoPais !== 'ES')) avisos.push('Hay terceros no residentes: se declaran con su código de país; revisa si procede incluirlos.')
  if (terceros.some(t => t.inversionSujetoPasivo)) avisos.push('Las operaciones con inversión del sujeto pasivo se declaran marcadas aparte, con la cuota autorrepercutida incluida.')
  const total = r2(terceros.reduce((s, t) => s + t.importe, 0))
  const personas = new Set(terceros.map(t => t.terceroId ?? t.nif)).size
  // Comprobar: número de las casillas del resumen en el formulario (el diseño de registro las nombra sin número).
  return {
    modelo: '347', periodo: String(anio), casillas: terceros.length ? { '01': personas, '02': total } : {},
    lineas: [
      { casilla: '01', descripcion: 'Número total de personas y entidades', importe: personas },
      { casilla: '02', descripcion: 'Importe total anual de las operaciones', importe: total },
      ...terceros.map(t => ({ casilla: t.clave, descripcion: `${t.nombre} (${t.nif || 'sin NIF'})${t.inversionSujetoPasivo ? ' · ISP' : ''}`, importe: t.importe })),
    ],
    resultado: 0, sinActividad: terceros.length === 0, incluidos: unicos(terceros.flatMap(t => t.documentos)),
    avisos: terceros.length ? avisos : [...avisos, `Ningún tercero supera ${euros(UMBRAL_347)} en el año: no hay que presentar el 347.`], terceros,
  }
}
