/**
 * Repositorio del CRM sobre Dataverse (tablas loc_* del CRM, en la solución
 * LocodeaObjetivos; el esquema lo crea scripts/crm-esquema.mjs).
 *
 * Traduce entre el modelo de ./types.ts y las columnas, igual que
 * ../data/dataverse.ts:
 *  - `id` es el GUID de la fila. El CRM genera el id antes de guardar, así que
 *    al crear se manda como clave primaria y el repositorio recuerda qué ids
 *    existen para saber si toca crear o actualizar.
 *  - `creadoEl` / `actualizadoEl` son `createdon` / `modifiedon`.
 *  - Estados y catálogos van como columnas Choice (valores 4120001xx–2xx).
 *  - Las relaciones son búsquedas: se leen de `_loc_x_value` y se escriben
 *    con `loc_X@odata.bind`. Los propietarios apuntan a loc_miembro.
 *  - Las líneas de los documentos viven en su propia tabla
 *    (loc_lineadocumento), con una búsqueda a cada tipo de documento. Al
 *    guardar un documento se sustituyen sus líneas solo si han cambiado, y al
 *    borrarlo se borran antes sus líneas.
 *  - «Referente a» de actividades y notas se guarda como tipo + id en texto,
 *    como hace loc_actividad en el resto de la app.
 */
import type { CrmRepositorio } from './repo'
import type {
  ActividadCrm, ColDocumento, ColReferente, Coleccion, CondicionPago, Contacto, CrmInstantanea, Cuenta, Documento, DocumentoBase,
  EstadoActividad, EstadoActivo, EstadoFacturaCompra, EstadoFacturaVenta, EstadoOferta, EstadoOportunidad, EstadoPedidoCompra,
  EstadoPedidoVenta, EstadoPotencial, FacturaCompra, FacturaVenta, Fase, LineaDocumento, MetodoPago, Nota, Oferta, Oportunidad,
  OrigenPotencial, PedidoCompra, PedidoVenta, Potencial, PrioridadCrm, Producto, Puntuacion, RegistroBase, RegistroDe, TipoActividad,
  TipoCuenta, TipoProducto, Unidad,
} from './types'
import { COLECCIONES } from './types'

import { Loc_cuentasService } from '../generated/services/Loc_cuentasService'
import { Loc_contactosService } from '../generated/services/Loc_contactosService'
import { Loc_potencialsService } from '../generated/services/Loc_potencialsService'
import { Loc_oportunidadsService } from '../generated/services/Loc_oportunidadsService'
import { Loc_productosService } from '../generated/services/Loc_productosService'
import { Loc_ofertasService } from '../generated/services/Loc_ofertasService'
import { Loc_pedidoventasService } from '../generated/services/Loc_pedidoventasService'
import { Loc_facturaventasService } from '../generated/services/Loc_facturaventasService'
import { Loc_pedidocomprasService } from '../generated/services/Loc_pedidocomprasService'
import { Loc_facturacomprasService } from '../generated/services/Loc_facturacomprasService'
import { Loc_lineadocumentosService } from '../generated/services/Loc_lineadocumentosService'
import { Loc_actividadcrmsService } from '../generated/services/Loc_actividadcrmsService'
import { Loc_notacrmsService } from '../generated/services/Loc_notacrmsService'

// ─────────────────────────────────────────────── choices (mismos valores que scripts/crm-esquema.mjs)

function inverso<T extends string>(m: Record<T, number>): Record<number, T> {
  const r = {} as Record<number, T>
  for (const k of Object.keys(m) as T[]) r[m[k]] = k
  return r
}

const TIPO_CUENTA: Record<TipoCuenta, number> = { cliente: 412000100, proveedor: 412000101, ambos: 412000102 }
const ACTIVO: Record<EstadoActivo, number> = { activo: 412000105, inactivo: 412000106 }
const CONDICIONES: Record<CondicionPago, number> = { contado: 412000110, '15': 412000111, '30': 412000112, '60': 412000113 }
const METODO: Record<MetodoPago, number> = { transferencia: 412000115, domiciliacion: 412000116, tarjeta: 412000117 }
const ORIGEN: Record<OrigenPotencial, number> = { web: 412000120, referido: 412000121, linkedin: 412000122, evento: 412000123, llamada: 412000124, partner: 412000125 }
const PUNTUACION: Record<Puntuacion, number> = { caliente: 412000130, templado: 412000131, frio: 412000132 }
const EST_POTENCIAL: Record<EstadoPotencial, number> = { abierto: 412000135, calificado: 412000136, descalificado: 412000137 }
const FASE: Record<Fase, number> = { calificar: 412000140, desarrollar: 412000141, proponer: 412000142, cerrar: 412000143 }
const EST_OPORTUNIDAD: Record<EstadoOportunidad, number> = { abierta: 412000145, ganada: 412000146, perdida: 412000147 }
const EST_OFERTA: Record<EstadoOferta, number> = { borrador: 412000150, enviada: 412000151, aceptada: 412000152, rechazada: 412000153, expirada: 412000154, convertida: 412000155 }
const EST_PEDIDO_VENTA: Record<EstadoPedidoVenta, number> = { abierto: 412000160, liberado: 412000161, enviado: 412000162, facturado: 412000163, cancelado: 412000164 }
const EST_FACTURA_VENTA: Record<EstadoFacturaVenta, number> = { borrador: 412000170, registrada: 412000171, pagada: 412000172, anulada: 412000173 }
const EST_PEDIDO_COMPRA: Record<EstadoPedidoCompra, number> = { abierto: 412000180, liberado: 412000181, recibido: 412000182, facturado: 412000183, cancelado: 412000184 }
const EST_FACTURA_COMPRA: Record<EstadoFacturaCompra, number> = { pendiente: 412000190, registrada: 412000191, pagada: 412000192, anulada: 412000193 }
const TIPO_PRODUCTO: Record<TipoProducto, number> = { servicio: 412000200, licencia: 412000201, producto: 412000202 }
const UNIDAD: Record<Unidad, number> = { hora: 412000205, dia: 412000206, mes: 412000207, ud: 412000208, proyecto: 412000209 }
const TIPO_ACTIVIDAD: Record<TipoActividad, number> = { tarea: 412000210, llamada: 412000211, correo: 412000212, cita: 412000213 }
const EST_ACTIVIDAD: Record<EstadoActividad, number> = { abierta: 412000215, completada: 412000216, cancelada: 412000217 }
const PRIORIDAD: Record<PrioridadCrm, number> = { baja: 412000220, normal: 412000221, alta: 412000222 }

const DE = {
  tipoCuenta: inverso(TIPO_CUENTA), activo: inverso(ACTIVO), condiciones: inverso(CONDICIONES), metodo: inverso(METODO), origen: inverso(ORIGEN),
  puntuacion: inverso(PUNTUACION), estPotencial: inverso(EST_POTENCIAL), fase: inverso(FASE), estOportunidad: inverso(EST_OPORTUNIDAD),
  estOferta: inverso(EST_OFERTA), estPedidoVenta: inverso(EST_PEDIDO_VENTA), estFacturaVenta: inverso(EST_FACTURA_VENTA),
  estPedidoCompra: inverso(EST_PEDIDO_COMPRA), estFacturaCompra: inverso(EST_FACTURA_COMPRA), tipoProducto: inverso(TIPO_PRODUCTO),
  unidad: inverso(UNIDAD), tipoActividad: inverso(TIPO_ACTIVIDAD), estActividad: inverso(EST_ACTIVIDAD), prioridad: inverso(PRIORIDAD),
}

// ─────────────────────────────────────────────── utilidades

/* eslint-disable @typescript-eslint/no-explicit-any */
type Fila = any
type Payload = Record<string, unknown>

interface Resultado { success?: boolean; data?: unknown; error?: unknown }

/** Los servicios generados no lanzan: devuelven { success, error }. Aquí se convierte en excepción. */
function comprobar<T extends Resultado>(r: T, donde: string): T {
  if (r && r.success === false) {
    const e = r.error
    throw e instanceof Error ? e : new Error(`Dataverse falló al ${donde}`)
  }
  return r
}

const lista = (r: Resultado): Fila[] => (Array.isArray(r?.data) ? r.data : [])

/** Referencia para escribir una búsqueda. `null` limpia el valor. */
const ref = (conjunto: string, id: string | null | undefined): string | null => (id ? `/${conjunto}(${id})` : null)

const txt = (v: unknown): string => (v === undefined || v === null ? '' : String(v))
const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v) || 0)
const nulo = (v: unknown): string | null => (v ? String(v) : null)
/** Las columnas DateOnly pueden volver como fecha completa. */
const dia = (v: unknown): string => (v ? String(v).slice(0, 10) : '')
const diaONulo = (v: unknown): string | null => (v ? String(v).slice(0, 10) : null)
/** Texto vacío → null en columnas de fecha. */
const fechaONulo = (v: string | null | undefined): string | null => (v ? v : null)

// ─────────────────────────────────────────────── tablas

interface Servicio {
  create(r: any): Promise<Resultado>
  update(id: string, r: any): Promise<Resultado>
  delete(id: string): Promise<void>
  getAll(o?: any): Promise<Resultado>
}

interface Tabla<K extends Coleccion> {
  conjunto: string
  clave: string
  servicio: Servicio
  leer: (f: Fila) => RegistroDe<K>
  escribir: (o: RegistroDe<K>) => Payload
}

const base = (f: Fila, clave: string) => ({ id: f[clave] as string, creadoEl: txt(f.createdon), actualizadoEl: nulo(f.modifiedon) })

const cuentas: Tabla<'cuentas'> = {
  conjunto: 'loc_cuentas', clave: 'loc_cuentaid', servicio: Loc_cuentasService,
  leer: (f): Cuenta => ({
    ...base(f, 'loc_cuentaid'), no: txt(f.loc_numero), nombre: txt(f.loc_nombre), tipo: DE.tipoCuenta[f.loc_tipo] ?? 'cliente',
    estado: DE.activo[f.loc_estado] ?? 'activo', cif: txt(f.loc_cif), sector: txt(f.loc_sector), direccion: txt(f.loc_direccion), cp: txt(f.loc_cp),
    ciudad: txt(f.loc_ciudad), provincia: txt(f.loc_provincia), pais: txt(f.loc_pais), web: txt(f.loc_web), telefono: txt(f.loc_telefono),
    email: txt(f.loc_email), empleados: txt(f.loc_empleados), propietarioId: f._loc_propietario_value ?? null,
    condicionesPago: DE.condiciones[f.loc_condicionespago] ?? '30', metodoPago: DE.metodo[f.loc_metodopago] ?? 'transferencia',
    iva: f.loc_iva ?? 21, iban: txt(f.loc_iban), notas: txt(f.loc_notas),
  }),
  escribir: a => ({
    loc_numero: a.no, loc_nombre: a.nombre, loc_tipo: TIPO_CUENTA[a.tipo], loc_estado: ACTIVO[a.estado], loc_cif: a.cif, loc_sector: a.sector,
    loc_direccion: a.direccion, loc_cp: a.cp, loc_ciudad: a.ciudad, loc_provincia: a.provincia, loc_pais: a.pais, loc_web: a.web,
    loc_telefono: a.telefono, loc_email: a.email, loc_empleados: a.empleados, loc_condicionespago: CONDICIONES[a.condicionesPago],
    loc_metodopago: METODO[a.metodoPago], loc_iva: num(a.iva), loc_iban: a.iban, loc_notas: a.notas,
    'loc_Propietario@odata.bind': ref('loc_miembros', a.propietarioId),
  }),
}

const contactos: Tabla<'contactos'> = {
  conjunto: 'loc_contactos', clave: 'loc_contactoid', servicio: Loc_contactosService,
  leer: (f): Contacto => ({
    ...base(f, 'loc_contactoid'), no: txt(f.loc_numero), nombre: txt(f.loc_nombre), apellidos: txt(f.loc_apellidos), cuentaId: f._loc_cuenta_value ?? null,
    cargo: txt(f.loc_cargo), email: txt(f.loc_email), telefono: txt(f.loc_telefono), movil: txt(f.loc_movil), ciudad: txt(f.loc_ciudad),
    linkedin: txt(f.loc_linkedin), propietarioId: f._loc_propietario_value ?? null, estado: DE.activo[f.loc_estado] ?? 'activo', notas: txt(f.loc_notas),
  }),
  escribir: c => ({
    loc_numero: c.no, loc_nombre: c.nombre, loc_apellidos: c.apellidos, loc_cargo: c.cargo, loc_email: c.email, loc_telefono: c.telefono,
    loc_movil: c.movil, loc_ciudad: c.ciudad, loc_linkedin: c.linkedin, loc_estado: ACTIVO[c.estado], loc_notas: c.notas,
    'loc_Cuenta@odata.bind': ref('loc_cuentas', c.cuentaId), 'loc_Propietario@odata.bind': ref('loc_miembros', c.propietarioId),
  }),
}

const potenciales: Tabla<'potenciales'> = {
  conjunto: 'loc_potencials', clave: 'loc_potencialid', servicio: Loc_potencialsService,
  leer: (f): Potencial => ({
    ...base(f, 'loc_potencialid'), no: txt(f.loc_numero), tema: txt(f.loc_tema), nombre: txt(f.loc_nombre), apellidos: txt(f.loc_apellidos),
    empresa: txt(f.loc_empresa), cargo: txt(f.loc_cargo), email: txt(f.loc_email), telefono: txt(f.loc_telefono), ciudad: txt(f.loc_ciudad),
    sector: txt(f.loc_sector), origen: DE.origen[f.loc_origen] ?? 'web', puntuacion: DE.puntuacion[f.loc_puntuacion] ?? 'templado',
    estado: DE.estPotencial[f.loc_estado] ?? 'abierto', fase: DE.fase[f.loc_fase] ?? 'calificar', importeEst: num(f.loc_importeest),
    propietarioId: f._loc_propietario_value ?? null, descripcion: txt(f.loc_descripcion), calificadoEl: nulo(f.loc_calificadoel),
    descalificadoEl: nulo(f.loc_descalificadoel), motivo: txt(f.loc_motivo), cuentaId: f._loc_cuenta_value ?? null,
    contactoId: f._loc_contacto_value ?? null, oportunidadId: f._loc_oportunidad_value ?? null,
  }),
  escribir: l => ({
    loc_numero: l.no, loc_tema: l.tema, loc_nombre: l.nombre, loc_apellidos: l.apellidos, loc_empresa: l.empresa, loc_cargo: l.cargo,
    loc_email: l.email, loc_telefono: l.telefono, loc_ciudad: l.ciudad, loc_sector: l.sector, loc_origen: ORIGEN[l.origen],
    loc_puntuacion: PUNTUACION[l.puntuacion], loc_estado: EST_POTENCIAL[l.estado], loc_fase: FASE[l.fase], loc_importeest: num(l.importeEst),
    loc_descripcion: l.descripcion, loc_calificadoel: fechaONulo(l.calificadoEl), loc_descalificadoel: fechaONulo(l.descalificadoEl),
    loc_motivo: l.motivo.slice(0, 500),
    'loc_Propietario@odata.bind': ref('loc_miembros', l.propietarioId), 'loc_Cuenta@odata.bind': ref('loc_cuentas', l.cuentaId),
    'loc_Contacto@odata.bind': ref('loc_contactos', l.contactoId), 'loc_Oportunidad@odata.bind': ref('loc_oportunidads', l.oportunidadId),
  }),
}

const oportunidades: Tabla<'oportunidades'> = {
  conjunto: 'loc_oportunidads', clave: 'loc_oportunidadid', servicio: Loc_oportunidadsService,
  leer: (f): Oportunidad => ({
    ...base(f, 'loc_oportunidadid'), no: txt(f.loc_numero), titulo: txt(f.loc_titulo), cuentaId: f._loc_cuenta_value ?? null,
    contactoId: f._loc_contacto_value ?? null, importe: num(f.loc_importe), fase: DE.fase[f.loc_fase] ?? 'calificar',
    estado: DE.estOportunidad[f.loc_estado] ?? 'abierta', probabilidad: num(f.loc_probabilidad), cierrePrevisto: dia(f.loc_cierreprevisto),
    propietarioId: f._loc_propietario_value ?? null, notas: txt(f.loc_notas), cerradaEl: nulo(f.loc_cerradael), motivoPerdida: txt(f.loc_motivoperdida),
    potencialId: f._loc_potencial_value ?? null,
  }),
  escribir: o => ({
    loc_numero: o.no, loc_titulo: o.titulo, loc_importe: num(o.importe), loc_fase: FASE[o.fase], loc_estado: EST_OPORTUNIDAD[o.estado],
    loc_probabilidad: Math.round(num(o.probabilidad)), loc_cierreprevisto: fechaONulo(o.cierrePrevisto), loc_notas: o.notas,
    loc_cerradael: fechaONulo(o.cerradaEl), loc_motivoperdida: o.motivoPerdida.slice(0, 500),
    'loc_Cuenta@odata.bind': ref('loc_cuentas', o.cuentaId), 'loc_Contacto@odata.bind': ref('loc_contactos', o.contactoId),
    'loc_Propietario@odata.bind': ref('loc_miembros', o.propietarioId), 'loc_Potencial@odata.bind': ref('loc_potencials', o.potencialId),
  }),
}

const productos: Tabla<'productos'> = {
  conjunto: 'loc_productos', clave: 'loc_productoid', servicio: Loc_productosService,
  leer: (f): Producto => ({
    ...base(f, 'loc_productoid'), no: txt(f.loc_numero), nombre: txt(f.loc_nombre), tipo: DE.tipoProducto[f.loc_tipo] ?? 'servicio',
    categoria: txt(f.loc_categoria), unidad: DE.unidad[f.loc_unidad] ?? 'hora', precio: num(f.loc_precio), coste: num(f.loc_coste),
    iva: f.loc_iva ?? 21, activo: f.loc_activo !== false, descripcion: txt(f.loc_descripcion),
  }),
  escribir: p => ({
    loc_numero: p.no, loc_nombre: p.nombre, loc_tipo: TIPO_PRODUCTO[p.tipo], loc_categoria: p.categoria, loc_unidad: UNIDAD[p.unidad],
    loc_precio: num(p.precio), loc_coste: num(p.coste), loc_iva: num(p.iva), loc_activo: p.activo, loc_descripcion: p.descripcion,
  }),
}

// Documentos: cabecera común + lo propio de cada tipo. Las líneas van aparte.

const leerDocumento = (f: Fila, clave: string): Omit<DocumentoBase, 'lineas'> => ({
  ...base(f, clave), no: txt(f.loc_numero), cuentaId: f._loc_cuenta_value ?? null, contactoId: f._loc_contacto_value ?? null, fecha: dia(f.loc_fecha),
  propietarioId: f._loc_propietario_value ?? null, condicionesPago: DE.condiciones[f.loc_condicionespago] ?? '30',
  metodoPago: DE.metodo[f.loc_metodopago] ?? 'transferencia', referencia: txt(f.loc_referencia), notas: txt(f.loc_notas),
})
const escribirDocumento = (d: DocumentoBase): Payload => ({
  loc_numero: d.no, loc_fecha: fechaONulo(d.fecha), loc_condicionespago: CONDICIONES[d.condicionesPago], loc_metodopago: METODO[d.metodoPago],
  loc_referencia: d.referencia.slice(0, 200), loc_notas: d.notas,
  'loc_Cuenta@odata.bind': ref('loc_cuentas', d.cuentaId), 'loc_Contacto@odata.bind': ref('loc_contactos', d.contactoId),
  'loc_Propietario@odata.bind': ref('loc_miembros', d.propietarioId),
})

const ofertas: Tabla<'ofertas'> = {
  conjunto: 'loc_ofertas', clave: 'loc_ofertaid', servicio: Loc_ofertasService,
  leer: (f): Oferta => ({
    ...leerDocumento(f, 'loc_ofertaid'), lineas: [], estado: DE.estOferta[f.loc_estado] ?? 'borrador', oportunidadId: f._loc_oportunidad_value ?? null,
    validaHasta: dia(f.loc_validahasta), pedidoId: f._loc_pedido_value ?? null,
  }),
  escribir: q => ({
    ...escribirDocumento(q), loc_estado: EST_OFERTA[q.estado], loc_validahasta: fechaONulo(q.validaHasta),
    'loc_Oportunidad@odata.bind': ref('loc_oportunidads', q.oportunidadId), 'loc_Pedido@odata.bind': ref('loc_pedidoventas', q.pedidoId),
  }),
}

const pedidosVenta: Tabla<'pedidosVenta'> = {
  conjunto: 'loc_pedidoventas', clave: 'loc_pedidoventaid', servicio: Loc_pedidoventasService,
  leer: (f): PedidoVenta => ({
    ...leerDocumento(f, 'loc_pedidoventaid'), lineas: [], estado: DE.estPedidoVenta[f.loc_estado] ?? 'abierto', ofertaId: f._loc_oferta_value ?? null,
    oportunidadId: f._loc_oportunidad_value ?? null, fechaEntrega: dia(f.loc_fechaentrega), refCliente: txt(f.loc_refcliente),
    facturaId: f._loc_factura_value ?? null,
  }),
  escribir: p => ({
    ...escribirDocumento(p), loc_estado: EST_PEDIDO_VENTA[p.estado], loc_fechaentrega: fechaONulo(p.fechaEntrega), loc_refcliente: p.refCliente,
    'loc_Oferta@odata.bind': ref('loc_ofertas', p.ofertaId), 'loc_Oportunidad@odata.bind': ref('loc_oportunidads', p.oportunidadId),
    'loc_Factura@odata.bind': ref('loc_facturaventas', p.facturaId),
  }),
}

const facturasVenta: Tabla<'facturasVenta'> = {
  conjunto: 'loc_facturaventas', clave: 'loc_facturaventaid', servicio: Loc_facturaventasService,
  leer: (f): FacturaVenta => ({
    ...leerDocumento(f, 'loc_facturaventaid'), lineas: [], estado: DE.estFacturaVenta[f.loc_estado] ?? 'borrador', pedidoId: f._loc_pedido_value ?? null,
    vencimiento: dia(f.loc_vencimiento), registradaEl: nulo(f.loc_registradael), pagadaEl: nulo(f.loc_pagadael),
  }),
  escribir: x => ({
    ...escribirDocumento(x), loc_estado: EST_FACTURA_VENTA[x.estado], loc_vencimiento: fechaONulo(x.vencimiento),
    loc_registradael: fechaONulo(x.registradaEl), loc_pagadael: fechaONulo(x.pagadaEl),
    'loc_Pedido@odata.bind': ref('loc_pedidoventas', x.pedidoId),
  }),
}

const pedidosCompra: Tabla<'pedidosCompra'> = {
  conjunto: 'loc_pedidocompras', clave: 'loc_pedidocompraid', servicio: Loc_pedidocomprasService,
  leer: (f): PedidoCompra => ({
    ...leerDocumento(f, 'loc_pedidocompraid'), lineas: [], estado: DE.estPedidoCompra[f.loc_estado] ?? 'abierto',
    recepcionPrevista: dia(f.loc_recepcionprevista), refProveedor: txt(f.loc_refproveedor), facturaId: f._loc_factura_value ?? null,
  }),
  escribir: p => ({
    ...escribirDocumento(p), loc_estado: EST_PEDIDO_COMPRA[p.estado], loc_recepcionprevista: fechaONulo(p.recepcionPrevista),
    loc_refproveedor: p.refProveedor, 'loc_Factura@odata.bind': ref('loc_facturacompras', p.facturaId),
  }),
}

const facturasCompra: Tabla<'facturasCompra'> = {
  conjunto: 'loc_facturacompras', clave: 'loc_facturacompraid', servicio: Loc_facturacomprasService,
  leer: (f): FacturaCompra => ({
    ...leerDocumento(f, 'loc_facturacompraid'), lineas: [], estado: DE.estFacturaCompra[f.loc_estado] ?? 'pendiente', pedidoId: f._loc_pedido_value ?? null,
    noProveedor: txt(f.loc_noproveedor), vencimiento: dia(f.loc_vencimiento), registradaEl: nulo(f.loc_registradael), pagadaEl: nulo(f.loc_pagadael),
  }),
  escribir: x => ({
    ...escribirDocumento(x), loc_estado: EST_FACTURA_COMPRA[x.estado], loc_noproveedor: x.noProveedor, loc_vencimiento: fechaONulo(x.vencimiento),
    loc_registradael: fechaONulo(x.registradaEl), loc_pagadael: fechaONulo(x.pagadaEl),
    'loc_Pedido@odata.bind': ref('loc_pedidocompras', x.pedidoId),
  }),
}

const actividades: Tabla<'actividades'> = {
  conjunto: 'loc_actividadcrms', clave: 'loc_actividadcrmid', servicio: Loc_actividadcrmsService,
  leer: (f): ActividadCrm => ({
    ...base(f, 'loc_actividadcrmid'), asunto: txt(f.loc_asunto), tipo: DE.tipoActividad[f.loc_tipo] ?? 'tarea', fecha: diaONulo(f.loc_fecha),
    hora: txt(f.loc_hora), referenteTipo: (txt(f.loc_referentetipo) || null) as ColReferente | null, referenteId: nulo(f.loc_referenteid),
    cuentaId: f._loc_cuenta_value ?? null, propietarioId: f._loc_propietario_value ?? null, prioridad: DE.prioridad[f.loc_prioridad] ?? 'normal',
    estado: DE.estActividad[f.loc_estado] ?? 'abierta', completadaEl: nulo(f.loc_completadael), descripcion: txt(f.loc_descripcion),
  }),
  escribir: a => ({
    loc_asunto: a.asunto, loc_tipo: TIPO_ACTIVIDAD[a.tipo], loc_fecha: fechaONulo(a.fecha), loc_hora: a.hora.slice(0, 5),
    loc_referentetipo: a.referenteTipo ?? '', loc_referenteid: a.referenteId ?? '', loc_prioridad: PRIORIDAD[a.prioridad],
    loc_estado: EST_ACTIVIDAD[a.estado], loc_completadael: fechaONulo(a.completadaEl), loc_descripcion: a.descripcion,
    'loc_Cuenta@odata.bind': ref('loc_cuentas', a.cuentaId), 'loc_Propietario@odata.bind': ref('loc_miembros', a.propietarioId),
  }),
}

const notas: Tabla<'notas'> = {
  conjunto: 'loc_notacrms', clave: 'loc_notacrmid', servicio: Loc_notacrmsService,
  leer: (f): Nota => ({
    ...base(f, 'loc_notacrmid'), texto: txt(f.loc_texto), referenteTipo: txt(f.loc_referentetipo) as ColReferente, referenteId: txt(f.loc_referenteid),
    cuentaId: f._loc_cuenta_value ?? null, autorId: f._loc_autor_value ?? null, fecha: txt(f.loc_fecha) || txt(f.createdon),
  }),
  escribir: n => ({
    loc_resumen: n.texto.slice(0, 200), loc_texto: n.texto, loc_referentetipo: n.referenteTipo, loc_referenteid: n.referenteId, loc_fecha: fechaONulo(n.fecha),
    'loc_Cuenta@odata.bind': ref('loc_cuentas', n.cuentaId), 'loc_Autor@odata.bind': ref('loc_miembros', n.autorId),
  }),
}

const TABLAS: { [K in Coleccion]: Tabla<K> } = {
  cuentas, contactos, potenciales, oportunidades, ofertas, pedidosVenta, facturasVenta, pedidosCompra, facturasCompra, productos, actividades, notas,
}

// ─────────────────────────────────────────────── líneas de documento

/** Búsqueda de la línea hacia cada tipo de documento. */
const LINEA_DE: Record<ColDocumento, { campo: string; navegacion: string }> = {
  ofertas: { campo: '_loc_oferta_value', navegacion: 'loc_Oferta' },
  pedidosVenta: { campo: '_loc_pedidoventa_value', navegacion: 'loc_PedidoVenta' },
  facturasVenta: { campo: '_loc_facturaventa_value', navegacion: 'loc_FacturaVenta' },
  pedidosCompra: { campo: '_loc_pedidocompra_value', navegacion: 'loc_PedidoCompra' },
  facturasCompra: { campo: '_loc_facturacompra_value', navegacion: 'loc_FacturaCompra' },
}
const COLS_DOC = Object.keys(LINEA_DE) as ColDocumento[]
const esDocumento = (col: Coleccion): col is ColDocumento => col in LINEA_DE

const leerLinea = (f: Fila): LineaDocumento => ({
  productoId: f._loc_producto_value ?? '', descripcion: txt(f.loc_descripcion), cantidad: num(f.loc_cantidad),
  unidad: DE.unidad[f.loc_unidad] ?? '', precio: num(f.loc_precio), dto: num(f.loc_dto), iva: f.loc_iva ?? 21,
})

const escribirLinea = (col: ColDocumento, docId: string, l: LineaDocumento, orden: number): Payload => ({
  loc_descripcion: (l.descripcion || '—').slice(0, 500), loc_orden: orden, loc_cantidad: num(l.cantidad), loc_unidad: l.unidad ? UNIDAD[l.unidad] : null,
  loc_precio: num(l.precio), loc_dto: num(l.dto), loc_iva: num(l.iva),
  [`${LINEA_DE[col].navegacion}@odata.bind`]: ref(TABLAS[col].conjunto, docId),
  'loc_Producto@odata.bind': ref('loc_productos', l.productoId || null),
  statecode: 0,
})

// ─────────────────────────────────────────────── repositorio

const TOPE = 5000

/** Ids que ya existen, por colección: decide entre crear y actualizar. */
const conocidos = new Map<Coleccion, Set<string>>()
/** Líneas guardadas de cada documento (ids y contenido), para no reescribirlas si no cambian. */
const lineasGuardadas = new Map<string, { ids: string[]; firma: string }>()

const firma = (lineas: LineaDocumento[]) => JSON.stringify(lineas.map(l => [l.productoId, l.descripcion, l.cantidad, l.unidad, l.precio, l.dto, l.iva]))

async function guardarLineas(col: ColDocumento, doc: Documento): Promise<void> {
  const previas = lineasGuardadas.get(doc.id)
  const nueva = firma(doc.lineas)
  if (previas?.firma === nueva) return
  // Las líneas no tienen identidad en el modelo: se sustituyen enteras.
  await Promise.all((previas?.ids ?? []).map(id => Loc_lineadocumentosService.delete(id)))
  const ids: string[] = []
  for (const [i, l] of doc.lineas.entries()) {
    const r = comprobar(await Loc_lineadocumentosService.create(escribirLinea(col, doc.id, l, i) as never), 'crear una línea')
    const creada = r.data as Fila
    if (creada?.loc_lineadocumentoid) ids.push(creada.loc_lineadocumentoid)
  }
  lineasGuardadas.set(doc.id, { ids, firma: nueva })
}

export const crmRepoDataverse: CrmRepositorio = {
  disponible: true,

  async cargar() {
    const [filas, lineas] = await Promise.all([
      Promise.all(COLECCIONES.map(c => TABLAS[c].servicio.getAll({ top: TOPE }).then(r => comprobar(r, `leer ${c}`)))),
      Loc_lineadocumentosService.getAll({ top: TOPE }).then(r => comprobar(r, 'leer las líneas')),
    ])
    const d = Object.fromEntries(COLECCIONES.map((c, i) => [c, lista(filas[i]).map(f => TABLAS[c].leer(f))])) as unknown as CrmInstantanea
    for (const c of COLECCIONES) conocidos.set(c, new Set((d[c] as RegistroBase[]).map(o => o.id)))

    // cada línea se engancha a su documento por la búsqueda que tenga rellena
    lineasGuardadas.clear()
    const porDoc = new Map<string, { ids: string[]; lineas: LineaDocumento[] }>()
    for (const f of lista(lineas).sort((a, b) => num(a.loc_orden) - num(b.loc_orden))) {
      const col = COLS_DOC.find(c => f[LINEA_DE[c].campo])
      if (!col) continue
      const docId = f[LINEA_DE[col].campo] as string
      const g = porDoc.get(docId) ?? { ids: [], lineas: [] }
      g.ids.push(f.loc_lineadocumentoid)
      g.lineas.push(leerLinea(f))
      porDoc.set(docId, g)
    }
    for (const c of COLS_DOC) {
      for (const doc of d[c] as Documento[]) {
        const g = porDoc.get(doc.id)
        doc.lineas = g?.lineas ?? []
        lineasGuardadas.set(doc.id, { ids: g?.ids ?? [], firma: firma(doc.lineas) })
      }
    }
    return d
  },

  async guardar(col, obj) {
    const t = TABLAS[col] as unknown as Tabla<typeof col>
    const ids = conocidos.get(col) ?? new Set<string>()
    conocidos.set(col, ids)
    const cuerpo = t.escribir(obj)
    if (ids.has(obj.id)) {
      comprobar(await t.servicio.update(obj.id, cuerpo), `actualizar ${col}`)
    } else {
      // el id lo pone el CRM: va como clave primaria
      comprobar(await t.servicio.create({ ...cuerpo, [t.clave]: obj.id, statecode: 0 }), `crear en ${col}`)
      ids.add(obj.id)
    }
    if (esDocumento(col)) await guardarLineas(col, obj as Documento)
    return obj
  },

  async borrar(col, id) {
    // Dataverse no borra las líneas en cascada (solo admite una relación padre
    // por tabla y la línea tiene cinco): se borran antes que el documento.
    if (esDocumento(col)) await Promise.all((lineasGuardadas.get(id)?.ids ?? []).map(l => Loc_lineadocumentosService.delete(l)))
    await TABLAS[col].servicio.delete(id)
    conocidos.get(col)?.delete(id)
    lineasGuardadas.delete(id)
  },
}
