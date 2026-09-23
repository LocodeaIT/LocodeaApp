/**
 * Consultas sobre la instantánea del CRM: nombres de registros, escala de
 * tiempo, estadísticas de cuenta y cadena de documentos. Funciones puras.
 */
import type {
  ActividadCrm, ColEntidad, ColReferente, CrmInstantanea, FacturaCompra, FacturaVenta, Nota, RegistroBase,
} from './types'
import {
  ESTADO_ACTIVIDAD, ESTADO_ACTIVO, ESTADO_FACTURA_COMPRA, ESTADO_FACTURA_VENTA, ESTADO_OFERTA, ESTADO_OPORTUNIDAD,
  ESTADO_PEDIDO_COMPRA, ESTADO_PEDIDO_VENTA, ESTADO_POTENCIAL,
} from './catalogos'
import { estadoFactura, totalDoc } from './documentos'
import { hoy } from '../domain/fechas'

export const nombreCompleto = (c: { nombre?: string; apellidos?: string } | null | undefined) =>
  c ? [c.nombre, c.apellidos].filter(Boolean).join(' ') : ''

export function registroDe(d: CrmInstantanea, col: ColEntidad, id: string | null | undefined): RegistroBase | undefined {
  if (!id) return undefined
  return (d[col] as RegistroBase[]).find(o => o.id === id)
}

export const nombreCuenta = (d: CrmInstantanea, id: string | null | undefined) => d.cuentas.find(a => a.id === id)?.nombre ?? ''
export const nombreContacto = (d: CrmInstantanea, id: string | null | undefined) => nombreCompleto(d.contactos.find(c => c.id === id))

/** Texto con el que se nombra un registro en enlaces y búsquedas. */
export function nombreRegistro(d: CrmInstantanea, col: ColEntidad, o: RegistroBase | undefined): string {
  if (!o) return ''
  const x = o as unknown as Record<string, unknown>
  switch (col) {
    case 'contactos': return nombreCompleto(x as { nombre: string; apellidos: string })
    case 'cuentas': case 'productos': return String(x.nombre ?? '')
    case 'potenciales': return String(x.tema ?? '')
    case 'oportunidades': return String(x.titulo ?? '')
    case 'actividades': return String(x.asunto ?? '')
    default: {
      const cuenta = nombreCuenta(d, x.cuentaId as string | null)
      return String(o.no ?? '') + (cuenta ? ' · ' + cuenta : '')
    }
  }
}

/** Cuenta a la que pertenece un registro (para colgar notas y actividades de la cuenta). */
export function cuentaDeReferente(d: CrmInstantanea, col: ColReferente | null, id: string | null): string | null {
  if (!col || !id) return null
  if (col === 'cuentas') return id
  const o = registroDe(d, col, id) as { cuentaId?: string | null } | undefined
  return o?.cuentaId ?? null
}

export const actividadVencida = (a: ActividadCrm) => a.estado === 'abierta' && !!a.fecha && a.fecha < hoy()

export type ItemEscala = { tipo: 'nota'; fecha: string; nota: Nota } | { tipo: 'actividad'; fecha: string; actividad: ActividadCrm }

/** Notas y actividades de un registro, de la más reciente a la más antigua. En una cuenta entra todo lo de sus registros. */
export function escalaTiempo(d: CrmInstantanea, col: ColReferente, id: string): ItemEscala[] {
  const toca = (x: { referenteTipo: ColReferente | null; referenteId: string | null; cuentaId: string | null }) =>
    (x.referenteTipo === col && x.referenteId === id) || (col === 'cuentas' && x.cuentaId === id)
  const items: ItemEscala[] = [
    ...d.notas.filter(toca).map(n => ({ tipo: 'nota' as const, fecha: n.fecha, nota: n })),
    ...d.actividades.filter(toca).map(a => ({ tipo: 'actividad' as const, fecha: a.fecha ? `${a.fecha}T${a.hora || '00:00'}` : a.creadoEl, actividad: a })),
  ]
  return items.sort((a, b) => b.fecha.localeCompare(a.fecha))
}

// ─────────────────────────────────────────────── estadísticas de cuenta

const suma = (xs: number[]) => xs.reduce((a, x) => a + (Number(x) || 0), 0)

export const pipelineAbierto = (d: CrmInstantanea, cuentaId: string) =>
  suma(d.oportunidades.filter(o => o.cuentaId === cuentaId && o.estado === 'abierta').map(o => o.importe))
export const facturado = (d: CrmInstantanea, cuentaId: string) =>
  suma(d.facturasVenta.filter(f => f.cuentaId === cuentaId && (f.estado === 'registrada' || f.estado === 'pagada')).map(totalDoc))
export const pendienteCobro = (d: CrmInstantanea, cuentaId: string) =>
  suma(d.facturasVenta.filter(f => f.cuentaId === cuentaId && f.estado === 'registrada').map(totalDoc))
export const comprado = (d: CrmInstantanea, cuentaId: string) =>
  suma(d.facturasCompra.filter(f => f.cuentaId === cuentaId && (f.estado === 'registrada' || f.estado === 'pagada')).map(totalDoc))

// ─────────────────────────────────────────────── estados

/** Estado que se enseña: en facturas incluye «vencida». */
export function estadoVisible(col: ColEntidad, o: RegistroBase): string {
  if (col === 'facturasVenta' || col === 'facturasCompra') return estadoFactura(o as FacturaVenta | FacturaCompra)
  return String((o as unknown as { estado?: string }).estado ?? '')
}

const ETIQUETAS_ESTADO: Partial<Record<ColEntidad, Record<string, string | undefined>>> = {
  cuentas: ESTADO_ACTIVO, contactos: ESTADO_ACTIVO, potenciales: ESTADO_POTENCIAL, oportunidades: ESTADO_OPORTUNIDAD,
  ofertas: ESTADO_OFERTA, pedidosVenta: ESTADO_PEDIDO_VENTA, pedidosCompra: ESTADO_PEDIDO_COMPRA,
  facturasVenta: ESTADO_FACTURA_VENTA, facturasCompra: ESTADO_FACTURA_COMPRA, actividades: ESTADO_ACTIVIDAD,
}
export const etiquetaEstado = (col: ColEntidad, estado: string) => ETIQUETAS_ESTADO[col]?.[estado] ?? estado

// ─────────────────────────────────────────────── cadena de documentos

/**
 * Cadena oportunidad → oferta → pedido → factura de un documento. Se sigue por
 * los ids que enlazan cada documento con el anterior y el siguiente.
 */
export function cadenaDocumento(d: CrmInstantanea, col: ColEntidad, o: RegistroBase): { col: ColEntidad; reg: RegistroBase }[] {
  const x = o as unknown as Record<string, string | null | undefined>
  const compra = col === 'pedidosCompra' || col === 'facturasCompra'
  let opp = x.oportunidadId ?? null
  let oferta = col === 'ofertas' ? o.id : x.ofertaId ?? null
  let pedido = col === 'pedidosVenta' || col === 'pedidosCompra' ? o.id : x.pedidoId ?? null
  let factura = col === 'facturasVenta' || col === 'facturasCompra' ? o.id : x.facturaId ?? null
  if (!compra) {
    if (!oferta && pedido) oferta = d.pedidosVenta.find(p => p.id === pedido)?.ofertaId ?? null
    if (!factura && pedido) factura = d.pedidosVenta.find(p => p.id === pedido)?.facturaId ?? null
    if (!pedido && factura) pedido = d.facturasVenta.find(f => f.id === factura)?.pedidoId ?? null
    if (!pedido && oferta) pedido = d.ofertas.find(q => q.id === oferta)?.pedidoId ?? null
    if (!factura && pedido) factura = d.pedidosVenta.find(p => p.id === pedido)?.facturaId ?? null
    if (!opp && oferta) opp = d.ofertas.find(q => q.id === oferta)?.oportunidadId ?? null
    if (!opp && pedido) opp = d.pedidosVenta.find(p => p.id === pedido)?.oportunidadId ?? null
  } else {
    if (!factura && pedido) factura = d.pedidosCompra.find(p => p.id === pedido)?.facturaId ?? null
    if (!pedido && factura) pedido = d.facturasCompra.find(f => f.id === factura)?.pedidoId ?? null
  }
  const pasos: [ColEntidad, string | null][] = compra
    ? [['pedidosCompra', pedido], ['facturasCompra', factura]]
    : [['oportunidades', opp], ['ofertas', oferta], ['pedidosVenta', pedido], ['facturasVenta', factura]]
  return pasos.flatMap(([c, id]) => { const reg = registroDe(d, c, id); return reg ? [{ col: c, reg }] : [] })
}
