/**
 * Impuestos previstos para la Caja del CRM: lo que habrá que pagar a la AEAT
 * (303, 111, 115, 123, 202…) en los próximos días, calculado con los modelos
 * de la Gestoría. Cada pago cae el último día de su plazo, que es cuando se
 * carga la domiciliación. Los ya presentados con su importe usan ese importe;
 * los pendientes, el cálculo de hoy.
 */
import type { CrmInstantanea } from '../crm/types'
import type { GestionInstantanea } from '../gestion/types'
import type { Movimiento } from '../gestion/calculos'
import { hoy, sumarDias } from '../domain/fechas'
import type { GestoriaInstantanea, PerfilFiscal } from './types'
import { apuntesFiscales, calcularModelo, obligaciones } from './fiscal'
import { cuotaUltimoIS } from './impuesto'

const CON_PAGO = new Set(['303', '111', '115', '123', '202', '200', '369'])

export function impuestosPrevistos(e: { crm: CrmInstantanea; gestion: GestionInstantanea; gestoria: GestoriaInstantanea; perfil: PerfilFiscal; dias: number }): Movimiento[] {
  const h = hoy(), limite = sumarDias(h, e.dias)
  const apuntes = apuntesFiscales(e.crm, e.gestion)
  const lista = obligaciones({ perfil: e.perfil, desde: h, hasta: limite, apuntes, cuotaUltimoIS: cuotaUltimoIS(e.gestoria, Number(h.slice(0, 4))) })
  const mov: Movimiento[] = []
  for (const o of lista) {
    if (!o.aplica || !CON_PAGO.has(o.modelo)) continue
    const p = e.gestoria.presentaciones.find(x => x.modelo === o.modelo && x.periodo === o.periodo)
    if (p && (p.estado === 'pagada' || p.estado === 'no-procede')) continue
    const importe = p && p.estado !== 'pendiente' ? p.importe : calcularModelo(o.modelo, o.periodo, { apuntes, presentaciones: e.gestoria.presentaciones })?.resultado ?? 0
    if (!(importe > 0)) continue
    mov.push({
      fecha: o.hasta, tipo: 'impuesto', concepto: `Modelo ${o.modelo} · ${o.etiquetaPeriodo}`, tercero: 'Agencia Tributaria', importe: -importe, vencido: false,
      ref: { col: 'gestoria', id: `${o.modelo}:${o.periodo}` },
    })
  }
  return mov
}
