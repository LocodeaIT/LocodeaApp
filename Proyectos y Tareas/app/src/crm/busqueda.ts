/** Coincidencias del CRM para el buscador global de la app. */
import type { ColDocumento, ColEntidad, CrmInstantanea } from './types'
import { NOMBRE_REGISTRO } from './catalogos'
import { nombreCompleto, nombreCuenta } from './consultas'
import { totalDoc } from './documentos'
import { eur0, normalizar } from './formato'

export interface ResultadoCrm { col: ColEntidad; id: string; titulo: string; detalle: string }

/** Pocos resultados a propósito: el desplegable del buscador no tiene scroll. */
const MAXIMO = 8

export function buscarEnCrm(d: CrmInstantanea, texto: string): ResultadoCrm[] {
  const q = normalizar(texto)
  if (!q) return []
  const hay = (...campos: unknown[]) => normalizar(campos.join(' ')).includes(q)
  const docs: ColDocumento[] = ['ofertas', 'pedidosVenta', 'facturasVenta', 'pedidosCompra', 'facturasCompra']
  return [
    ...d.cuentas.filter(a => hay(a.no, a.nombre, a.cif)).slice(0, 3).map(a => ({ col: 'cuentas' as const, id: a.id, titulo: a.nombre, detalle: `Cuenta · ${a.no}` })),
    ...d.contactos.filter(c => hay(c.no, nombreCompleto(c), c.email)).slice(0, 3).map(c => ({ col: 'contactos' as const, id: c.id, titulo: nombreCompleto(c), detalle: nombreCuenta(d, c.cuentaId) || 'Contacto' })),
    ...d.potenciales.filter(l => hay(l.no, l.tema, l.empresa, nombreCompleto(l))).slice(0, 2).map(l => ({ col: 'potenciales' as const, id: l.id, titulo: l.tema, detalle: `Cliente potencial · ${l.empresa}` })),
    ...d.oportunidades.filter(o => hay(o.no, o.titulo, nombreCuenta(d, o.cuentaId))).slice(0, 3).map(o => ({ col: 'oportunidades' as const, id: o.id, titulo: o.titulo, detalle: `Oportunidad · ${eur0(o.importe)}` })),
    ...docs.flatMap(col => d[col].filter(o => hay(o.no, nombreCuenta(d, o.cuentaId), o.referencia)).slice(0, 2)
      .map(o => ({ col, id: o.id, titulo: `${o.no} · ${nombreCuenta(d, o.cuentaId)}`, detalle: `${NOMBRE_REGISTRO[col]} · ${eur0(totalDoc(o))}` }))),
  ].slice(0, MAXIMO)
}
