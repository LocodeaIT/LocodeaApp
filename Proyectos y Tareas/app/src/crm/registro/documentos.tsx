/**
 * Documentos de venta (ofertas, pedidos, facturas) y de compra (pedidos,
 * facturas). Comparten estructura: cabecera, líneas con totales, detalles de
 * pago, historial del documento y escala de tiempo.
 */
import {
  Ban, Check, Euro, Lock, LockOpen, PackageCheck, Phone, Receipt, ReceiptText, RotateCcw, Send, ShoppingCart, Truck,
} from 'lucide-react'
import type { Opcion } from '../../ui/Select'
import type { CrmCtx } from '../contexto'
import type {
  ColDocumento, Documento, DocumentoBase, FacturaCompra, FacturaVenta, Oferta, PedidoCompra, PedidoVenta,
} from '../types'
import {
  CONDICIONES_PAGO, DIAS_PAGO, ESTADO_FACTURA_COMPRA, ESTADO_FACTURA_VENTA, ESTADO_OFERTA, ESTADO_PEDIDO_COMPRA, ESTADO_PEDIDO_VENTA,
  METODO_PAGO, opcionesDe,
} from '../catalogos'
import { estadoVisible, nombreCuenta } from '../consultas'
import { estadoFactura, totalDoc, totales } from '../documentos'
import { eur, fecha } from '../formato'
import { hoy, sumarDias } from '../../domain/fechas'
import { ICONO_COL } from '../iconos'
import { ChipEstado, Enlace, Fecha } from '../ui'
import { EscalaTiempo, HistorialDoc, Parte, TotalesDoc } from '../screens/Hechos'
import {
  colPropietario, cuentasFiltro, filtroPropietario, opcionesContactos, opcionesCuentas, opcionesOportunidades, opcionesPropietario, ordenTexto,
} from './comunes'
import type { Campo, Columna, Comando, Entidad, Vista } from './tipos'

type Base = Omit<DocumentoBase, 'id'> & { id: string }

interface Config<T extends Documento> {
  col: ColDocumento
  uno: string
  muchos: string
  fem?: boolean
  compra?: boolean
  etiquetas: Record<string, string | undefined>
  /** Estados en los que el documento ya no se edita. */
  bloqueados: string[]
  vistas: Vista<T>[]
  /** Segunda columna de fecha (validez, entrega, vencimiento…). */
  colFecha: Columna<T>
  campos: Campo<T>[]
  tituloDetalles?: string
  nuevo: (base: Base, c: CrmCtx) => T
  antesDeGuardar?: (o: T) => T
  comandos: (d: T, c: CrmCtx) => (Comando | null | false)[]
}

/** Campo de cliente o proveedor: al cambiarlo se ajustan contacto y condiciones de pago de la cuenta. */
function campoCuenta<T extends Documento>(compra: boolean): Campo<T> {
  return {
    clave: 'cuentaId', titulo: compra ? 'Proveedor' : 'Cliente', tipo: 'opciones', req: true,
    opciones: (_, c) => opcionesCuentas(c, compra ? 'proveedor' : 'cliente'),
    alCambiar: (d, c) => {
      const a = c.datos.cuentas.find(x => x.id === d.cuentaId)
      const contactoValido = !d.contactoId || c.datos.contactos.find(x => x.id === d.contactoId)?.cuentaId === d.cuentaId
      return { ...d, contactoId: contactoValido ? d.contactoId : null, condicionesPago: a?.condicionesPago ?? d.condicionesPago, metodoPago: a?.metodoPago ?? d.metodoPago }
    },
  }
}

const campoContacto = <T extends Documento>(): Campo<T> => ({ clave: 'contactoId', titulo: 'Contacto', tipo: 'opciones', opciones: (d, c) => opcionesContactos(c, d.cuentaId) })
const campoPropietario = <T extends Documento>(): Campo<T> => ({ clave: 'propietarioId', titulo: 'Propietario', tipo: 'opciones', opciones: (_, c) => opcionesPropietario(c) })
const campoNo = <T extends Documento>(): Campo<T> => ({ clave: 'no', titulo: 'Nº', soloLectura: true })

/** Botón de cambio de estado del documento. */
function estadoCmd<T extends Documento>(c: CrmCtx, col: ColDocumento, d: T, estado: string, texto: string, icono: Comando['icono'], tono?: Comando['tono']): Comando {
  return { texto, icono, tono, accion: () => c.cambiarEstadoDocumento(col, d, estado) }
}

function entidadDocumento<T extends Documento>(cfg: Config<T>): Entidad<T> {
  const compra = !!cfg.compra
  const parte = compra ? 'Proveedor' : 'Cliente'
  const estadoDe = (o: T) => estadoVisible(cfg.col, o)
  const opcionesEstado: Opcion[] = Object.entries(cfg.etiquetas).map(([valor, etiqueta]) => ({ valor, etiqueta: etiqueta ?? valor }))
  return {
    col: cfg.col, uno: cfg.uno, muchos: cfg.muchos, fem: cfg.fem, icono: ICONO_COL[cfg.col], compra, imprimir: true,
    vistas: cfg.vistas,
    buscar: (o, c) => {
      const x = o as { noProveedor?: string; refCliente?: string }
      return [o.no, nombreCuenta(c.datos, o.cuentaId), o.referencia, x.noProveedor, x.refCliente]
    },
    filtros: [
      { clave: 'estado', titulo: 'Estado', opciones: () => opcionesEstado, valor: estadoDe },
      { clave: 'cuentaId', titulo: parte, opciones: c => cuentasFiltro(c, compra ? 'proveedor' : 'cliente') },
      filtroPropietario(),
    ],
    columnas: [
      { clave: 'no', titulo: 'Nº', enlace: true, ancho: 110, texto: o => o.no },
      { clave: 'cuentaId', titulo: parte, orden: (o, c) => ordenTexto(nombreCuenta(c.datos, o.cuentaId)), texto: (o, c) => nombreCuenta(c.datos, o.cuentaId), celda: o => <Enlace col="cuentas" id={o.cuentaId} /> },
      { clave: 'fecha', titulo: 'Fecha', orden: o => o.fecha, texto: o => fecha(o.fecha) },
      cfg.colFecha,
      { clave: 'estado', titulo: 'Estado', orden: estadoDe, texto: o => cfg.etiquetas[estadoDe(o)] ?? estadoDe(o), celda: o => <ChipEstado estado={estadoDe(o)} etiqueta={cfg.etiquetas[estadoDe(o)]} /> },
      { clave: 'base', titulo: 'Base imponible', num: true, orden: o => totales(o).base, texto: o => eur(totales(o).base) },
      { clave: 'total', titulo: 'Total', num: true, orden: o => totalDoc(o), texto: o => eur(totalDoc(o)) },
      colPropietario(),
    ],
    ordenInicial: { clave: 'fecha', dir: -1 },
    nuevo: c => cfg.nuevo({
      id: '', no: '', cuentaId: null, contactoId: null, fecha: hoy(), propietarioId: c.yoId, lineas: [], condicionesPago: '30',
      metodoPago: 'transferencia', referencia: '', notas: '', creadoEl: '',
    }, c),
    titulo: (o, c) => `${o.no || 'Borrador'} · ${nombreCuenta(c.datos, o.cuentaId) || `sin ${parte.toLowerCase()}`}`,
    validar: d => !d.cuentaId ? `Elige ${compra ? 'el proveedor' : 'el cliente'}.` : d.lineas.some(l => !String(l.descripcion || '').trim()) ? 'Hay líneas sin descripción.' : null,
    antesDeGuardar: cfg.antesDeGuardar,
    bloqueado: o => cfg.bloqueados.includes(o.estado),
    etiquetas: o => <ChipEstado estado={estadoDe(o)} etiqueta={cfg.etiquetas[estadoDe(o)]} solido />,
    pestanas: [
      { clave: 'general', titulo: 'General', campos: cfg.campos },
      { clave: 'lineas', titulo: 'Líneas', lineas: true },
      {
        clave: 'detalles', titulo: cfg.tituloDetalles ?? 'Detalles', abierta: false, campos: [
          { clave: 'condicionesPago', titulo: 'Condiciones de pago', tipo: 'opciones', opciones: opcionesDe(CONDICIONES_PAGO) },
          { clave: 'metodoPago', titulo: 'Método de pago', tipo: 'opciones', opciones: opcionesDe(METODO_PAGO) },
          { clave: 'referencia', titulo: 'Referencia' },
          { clave: 'notas', titulo: 'Notas', tipo: 'area', completo: true },
        ],
      },
    ],
    comandos: (d, c) => cfg.comandos(d, c),
    hechos: o => <>
      <Parte doc={o} compra={compra} />
      <TotalesDoc doc={o} />
      <HistorialDoc col={cfg.col} doc={o} />
      <EscalaTiempo col={cfg.col} id={o.id} />
    </>,
  }
}

/** Las facturas calculan el vencimiento con las condiciones de pago si no se ha indicado. */
function conVencimiento<T extends FacturaVenta | FacturaCompra>(o: T): T {
  return o.vencimiento ? o : { ...o, vencimiento: sumarDias(o.fecha || hoy(), DIAS_PAGO[o.condicionesPago] ?? 30) }
}

// ─────────────────────────────────────────────── ventas

export const ofertas = entidadDocumento<Oferta>({
  col: 'ofertas', uno: 'Oferta', muchos: 'Ofertas', fem: true, etiquetas: ESTADO_OFERTA, bloqueados: ['convertida'],
  vistas: [
    { clave: 'activas', titulo: 'Ofertas activas', filtro: q => q.estado === 'borrador' || q.estado === 'enviada' },
    { clave: 'enviadas', titulo: 'Enviadas', filtro: q => q.estado === 'enviada' },
    { clave: 'aceptadas', titulo: 'Aceptadas y convertidas', filtro: q => q.estado === 'aceptada' || q.estado === 'convertida' },
    { clave: 'todas', titulo: 'Todas las ofertas', filtro: () => true },
  ],
  colFecha: { clave: 'validaHasta', titulo: 'Válida hasta', orden: q => q.validaHasta, texto: q => fecha(q.validaHasta), celda: q => <Fecha dia={q.validaHasta} avisar={q.estado === 'borrador' || q.estado === 'enviada'} /> },
  campos: [
    campoNo(), campoCuenta(false), campoContacto(),
    { clave: 'oportunidadId', titulo: 'Oportunidad', tipo: 'opciones', opciones: (d, c) => opcionesOportunidades(c, d.cuentaId) },
    { clave: 'fecha', titulo: 'Fecha de documento', tipo: 'fecha' },
    { clave: 'validaHasta', titulo: 'Válida hasta', tipo: 'fecha' },
    { clave: 'estado', titulo: 'Estado', mostrar: d => <ChipEstado estado={d.estado} etiqueta={ESTADO_OFERTA[d.estado]} />, resumen: d => ESTADO_OFERTA[d.estado] },
    campoPropietario(),
  ],
  nuevo: b => ({ ...b, estado: 'borrador', oportunidadId: null, validaHasta: sumarDias(hoy(), 30), pedidoId: null }),
  comandos: (q, c) => [
    q.estado === 'borrador' && estadoCmd(c, 'ofertas', q, 'enviada', 'Enviar', Send),
    (q.estado === 'borrador' || q.estado === 'enviada') && estadoCmd(c, 'ofertas', q, 'aceptada', 'Aceptar', Check),
    (q.estado === 'borrador' || q.estado === 'enviada') && estadoCmd(c, 'ofertas', q, 'rechazada', 'Rechazar', Ban),
    q.estado === 'aceptada' && { texto: 'Convertir en pedido', icono: ShoppingCart, tono: 'acento', accion: () => c.ofertaAPedido(q) },
    ['rechazada', 'expirada', 'aceptada'].includes(q.estado) && estadoCmd(c, 'ofertas', q, 'borrador', 'Reabrir', RotateCcw),
    q.estado === 'convertida' && !!q.pedidoId && { texto: 'Ver pedido', icono: ShoppingCart, accion: () => c.abrir('pedidosVenta', q.pedidoId!) },
  ],
})

export const pedidosVenta = entidadDocumento<PedidoVenta>({
  col: 'pedidosVenta', uno: 'Pedido de venta', muchos: 'Pedidos de venta', etiquetas: ESTADO_PEDIDO_VENTA, bloqueados: ['facturado', 'cancelado'],
  vistas: [
    { clave: 'abiertos', titulo: 'Pedidos de venta abiertos', filtro: o => ['abierto', 'liberado', 'enviado'].includes(o.estado) },
    { clave: 'facturar', titulo: 'Pendientes de facturar', filtro: o => o.estado === 'enviado' },
    { clave: 'facturados', titulo: 'Facturados', filtro: o => o.estado === 'facturado' },
    { clave: 'todos', titulo: 'Todos los pedidos de venta', filtro: () => true },
  ],
  colFecha: { clave: 'fechaEntrega', titulo: 'Fecha de entrega', orden: o => o.fechaEntrega, texto: o => fecha(o.fechaEntrega), celda: o => <Fecha dia={o.fechaEntrega} avisar={o.estado === 'abierto' || o.estado === 'liberado'} /> },
  campos: [
    campoNo(), campoCuenta(false), campoContacto(),
    { clave: 'fecha', titulo: 'Fecha de pedido', tipo: 'fecha' },
    { clave: 'fechaEntrega', titulo: 'Fecha de entrega', tipo: 'fecha' },
    { clave: 'refCliente', titulo: 'Nº pedido del cliente' },
    { clave: 'estado', titulo: 'Estado', mostrar: d => <ChipEstado estado={d.estado} etiqueta={ESTADO_PEDIDO_VENTA[d.estado]} />, resumen: d => ESTADO_PEDIDO_VENTA[d.estado] },
    campoPropietario(),
    { clave: 'ofertaId', titulo: 'Oferta de origen', mostrar: (d, c) => <Enlace col="ofertas" id={d.ofertaId} texto={c.datos.ofertas.find(q => q.id === d.ofertaId)?.no} /> },
  ],
  nuevo: b => ({ ...b, estado: 'abierto', ofertaId: null, oportunidadId: null, fechaEntrega: sumarDias(hoy(), 14), refCliente: '', facturaId: null }),
  comandos: (o, c) => [
    o.estado === 'abierto' && estadoCmd(c, 'pedidosVenta', o, 'liberado', 'Liberar', LockOpen),
    o.estado === 'liberado' && estadoCmd(c, 'pedidosVenta', o, 'enviado', 'Enviar', Truck),
    o.estado === 'enviado' && { texto: 'Crear factura', icono: Receipt, tono: 'acento', accion: () => c.pedidoAFactura(o) },
    ['abierto', 'liberado', 'enviado'].includes(o.estado) && estadoCmd(c, 'pedidosVenta', o, 'cancelado', 'Cancelar pedido', Ban),
    (o.estado === 'liberado' || o.estado === 'cancelado') && estadoCmd(c, 'pedidosVenta', o, 'abierto', 'Reabrir', RotateCcw),
    o.estado === 'facturado' && !!o.facturaId && { texto: 'Ver factura', icono: Receipt, accion: () => c.abrir('facturasVenta', o.facturaId!) },
  ],
})

export const facturasVenta = entidadDocumento<FacturaVenta>({
  col: 'facturasVenta', uno: 'Factura de venta', muchos: 'Facturas de venta', fem: true, etiquetas: ESTADO_FACTURA_VENTA,
  bloqueados: ['registrada', 'pagada', 'anulada'], tituloDetalles: 'Detalles de la factura',
  vistas: [
    { clave: 'pendientes', titulo: 'Pendientes de cobro', filtro: f => f.estado === 'registrada' },
    { clave: 'vencidas', titulo: 'Vencidas', filtro: f => estadoFactura(f) === 'vencida' },
    { clave: 'borradores', titulo: 'Borradores', filtro: f => f.estado === 'borrador' },
    { clave: 'pagadas', titulo: 'Pagadas', filtro: f => f.estado === 'pagada' },
    { clave: 'todas', titulo: 'Todas las facturas de venta', filtro: () => true },
  ],
  colFecha: { clave: 'vencimiento', titulo: 'Vencimiento', orden: f => f.vencimiento, texto: f => fecha(f.vencimiento), celda: f => <Fecha dia={f.vencimiento} avisar={f.estado === 'registrada'} /> },
  campos: [
    campoNo(), campoCuenta(false), campoContacto(),
    { clave: 'fecha', titulo: 'Fecha de factura', tipo: 'fecha' },
    { clave: 'vencimiento', titulo: 'Fecha de vencimiento', tipo: 'fecha' },
    { clave: 'estado', titulo: 'Estado', mostrar: d => <ChipEstado estado={estadoFactura(d)} etiqueta={ESTADO_FACTURA_VENTA[estadoFactura(d)]} />, resumen: d => ESTADO_FACTURA_VENTA[estadoFactura(d)] ?? '' },
    campoPropietario(),
    { clave: 'pedidoId', titulo: 'Pedido de origen', mostrar: (d, c) => <Enlace col="pedidosVenta" id={d.pedidoId} texto={c.datos.pedidosVenta.find(p => p.id === d.pedidoId)?.no} /> },
    { clave: 'pagadaEl', titulo: 'Cobrada el', mostrar: d => (d.pagadaEl ? fecha(d.pagadaEl) : '—') },
    { clave: 'importeCobrado', titulo: 'Cobrado a cuenta', tipo: 'numero', min: 0, paso: 0.01 },
  ],
  nuevo: b => ({ ...b, estado: 'borrador', pedidoId: null, vencimiento: '', registradaEl: null, pagadaEl: null, importeCobrado: 0 }),
  antesDeGuardar: conVencimiento,
  comandos: (f, c) => [
    f.estado === 'borrador' && estadoCmd(c, 'facturasVenta', f, 'registrada', 'Registrar', Lock, 'acento'),
    f.estado === 'registrada' && estadoCmd(c, 'facturasVenta', f, 'pagada', 'Marcar como cobrada', Euro, 'acento'),
    f.estado === 'registrada' && estadoCmd(c, 'facturasVenta', f, 'anulada', 'Anular', Ban),
    estadoFactura(f) === 'vencida' && {
      texto: 'Reclamar', icono: Phone,
      accion: () => c.abrir('actividades', 'nuevo', { referenteTipo: 'facturasVenta', referenteId: f.id, asunto: 'Reclamar la factura ' + f.no, tipo: 'llamada', prioridad: 'alta' }),
    },
  ],
})

// ─────────────────────────────────────────────── compras

export const pedidosCompra = entidadDocumento<PedidoCompra>({
  col: 'pedidosCompra', uno: 'Pedido de compra', muchos: 'Pedidos de compra', compra: true, etiquetas: ESTADO_PEDIDO_COMPRA, bloqueados: ['facturado', 'cancelado'],
  vistas: [
    { clave: 'abiertos', titulo: 'Pedidos de compra abiertos', filtro: o => ['abierto', 'liberado', 'recibido'].includes(o.estado) },
    { clave: 'recibir', titulo: 'Pendientes de recibir', filtro: o => o.estado === 'abierto' || o.estado === 'liberado' },
    { clave: 'facturados', titulo: 'Facturados', filtro: o => o.estado === 'facturado' },
    { clave: 'todos', titulo: 'Todos los pedidos de compra', filtro: () => true },
  ],
  colFecha: { clave: 'recepcionPrevista', titulo: 'Recepción prevista', orden: o => o.recepcionPrevista, texto: o => fecha(o.recepcionPrevista), celda: o => <Fecha dia={o.recepcionPrevista} avisar={o.estado === 'abierto' || o.estado === 'liberado'} /> },
  campos: [
    campoNo(), campoCuenta(true), campoContacto(),
    { clave: 'fecha', titulo: 'Fecha de pedido', tipo: 'fecha' },
    { clave: 'recepcionPrevista', titulo: 'Recepción prevista', tipo: 'fecha' },
    { clave: 'refProveedor', titulo: 'Nº pedido del proveedor' },
    { clave: 'estado', titulo: 'Estado', mostrar: d => <ChipEstado estado={d.estado} etiqueta={ESTADO_PEDIDO_COMPRA[d.estado]} />, resumen: d => ESTADO_PEDIDO_COMPRA[d.estado] },
    campoPropietario(),
  ],
  nuevo: b => ({ ...b, estado: 'abierto', recepcionPrevista: sumarDias(hoy(), 7), refProveedor: '', facturaId: null }),
  comandos: (o, c) => [
    o.estado === 'abierto' && estadoCmd(c, 'pedidosCompra', o, 'liberado', 'Liberar', LockOpen),
    o.estado === 'liberado' && estadoCmd(c, 'pedidosCompra', o, 'recibido', 'Recibir', PackageCheck),
    o.estado === 'recibido' && { texto: 'Crear factura de compra', icono: ReceiptText, tono: 'acento', accion: () => c.pedidoCompraAFactura(o) },
    (o.estado === 'abierto' || o.estado === 'liberado') && estadoCmd(c, 'pedidosCompra', o, 'cancelado', 'Cancelar pedido', Ban),
    o.estado === 'cancelado' && estadoCmd(c, 'pedidosCompra', o, 'abierto', 'Reabrir', RotateCcw),
    o.estado === 'facturado' && !!o.facturaId && { texto: 'Ver factura', icono: ReceiptText, accion: () => c.abrir('facturasCompra', o.facturaId!) },
  ],
})

export const facturasCompra = entidadDocumento<FacturaCompra>({
  col: 'facturasCompra', uno: 'Factura de compra', muchos: 'Facturas de compra', fem: true, compra: true, etiquetas: ESTADO_FACTURA_COMPRA,
  bloqueados: ['registrada', 'pagada', 'anulada'], tituloDetalles: 'Detalles de la factura',
  vistas: [
    { clave: 'pendientes', titulo: 'Pendientes de pago', filtro: f => f.estado === 'pendiente' || f.estado === 'registrada' },
    { clave: 'vencidas', titulo: 'Vencidas', filtro: f => estadoFactura(f) === 'vencida' },
    { clave: 'pagadas', titulo: 'Pagadas', filtro: f => f.estado === 'pagada' },
    { clave: 'todas', titulo: 'Todas las facturas de compra', filtro: () => true },
  ],
  colFecha: { clave: 'vencimiento', titulo: 'Vencimiento', orden: f => f.vencimiento, texto: f => fecha(f.vencimiento), celda: f => <Fecha dia={f.vencimiento} avisar={f.estado === 'pendiente' || f.estado === 'registrada'} /> },
  campos: [
    campoNo(), campoCuenta(true),
    { clave: 'noProveedor', titulo: 'Nº factura del proveedor' },
    campoContacto(),
    { clave: 'fecha', titulo: 'Fecha de factura', tipo: 'fecha' },
    { clave: 'vencimiento', titulo: 'Fecha de vencimiento', tipo: 'fecha' },
    { clave: 'estado', titulo: 'Estado', mostrar: d => <ChipEstado estado={estadoFactura(d)} etiqueta={ESTADO_FACTURA_COMPRA[estadoFactura(d)]} />, resumen: d => ESTADO_FACTURA_COMPRA[estadoFactura(d)] ?? '' },
    campoPropietario(),
    { clave: 'pedidoId', titulo: 'Pedido de origen', mostrar: (d, c) => <Enlace col="pedidosCompra" id={d.pedidoId} texto={c.datos.pedidosCompra.find(p => p.id === d.pedidoId)?.no} /> },
    { clave: 'pagadaEl', titulo: 'Pagada el', mostrar: d => (d.pagadaEl ? fecha(d.pagadaEl) : '—') },
    { clave: 'importePagado', titulo: 'Pagado a cuenta', tipo: 'numero', min: 0, paso: 0.01 },
  ],
  nuevo: b => ({ ...b, estado: 'pendiente', pedidoId: null, noProveedor: '', vencimiento: '', registradaEl: null, pagadaEl: null, importePagado: 0 }),
  antesDeGuardar: conVencimiento,
  comandos: (f, c) => [
    f.estado === 'pendiente' && estadoCmd(c, 'facturasCompra', f, 'registrada', 'Registrar', Lock, 'acento'),
    f.estado === 'registrada' && estadoCmd(c, 'facturasCompra', f, 'pagada', 'Marcar como pagada', Euro, 'acento'),
    f.estado === 'registrada' && estadoCmd(c, 'facturasCompra', f, 'anulada', 'Anular', Ban),
  ],
})
