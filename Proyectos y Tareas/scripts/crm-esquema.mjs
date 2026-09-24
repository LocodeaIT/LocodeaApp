#!/usr/bin/env node
/**
 * Esquema del CRM en Dataverse: crea las tablas loc_* del módulo CRM dentro de
 * la solución LocodeaObjetivos y publica las personalizaciones.
 *
 * Es idempotente: comprueba cada tabla, columna y relación antes de crearla,
 * así que se puede volver a lanzar sin miedo (por ejemplo, contra el entorno
 * de producción futuro). NO crea filas y NO toca las tablas existentes: solo
 * añade relaciones desde las tablas nuevas hacia loc_miembro.
 *
 * Uso (desde esta carpeta o cualquier otra):
 *   node crm-esquema.mjs                      # entorno del perfil activo del CLI
 *   node crm-esquema.mjs --entorno https://orgXXXX.crm17.dynamics.com
 *   node crm-esquema.mjs --simular            # solo lista lo que falta
 *
 * Necesita el CLI de Dataverse (`npx -y @microsoft/dataverse`) con sesión
 * iniciada como administrador. Para ir más rápido se puede apuntar a su
 * ejecutable con la variable DATAVERSE_CLI=<ruta a bin/dataverse.js>.
 *
 * Los valores de las opciones (41200xxxx) deben coincidir con los de
 * app/src/crm/dataverse.ts.
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const args = process.argv.slice(2)
const opcion = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined }
const SIMULAR = args.includes('--simular')
const ENTORNO = opcion('--entorno')
const SOLUCION = opcion('--solucion') ?? 'LocodeaObjetivos'
const IDIOMA = 3082 // español; el entorno está en español
const API = 'api/data/v9.2/'

// ─────────────────────────────────────────────── acceso a la API

const temporal = mkdtempSync(join(tmpdir(), 'crm-esquema-'))
let n = 0

class ErrorHttp extends Error {
  constructor(mensaje, estado) { super(mensaje); this.estado = estado }
}

function peticion(ruta, { metodo = 'GET', cuerpo, cabeceras = [] } = {}) {
  const cli = process.env.DATAVERSE_CLI
  const base = cli ? ['node', [cli]] : [process.platform === 'win32' ? 'npx.cmd' : 'npx', ['-y', '@microsoft/dataverse']]
  // -i: la respuesta trae la línea de estado, así se distingue un 404 de un fallo real
  const resto = ['api', 'request', '--target', 'dataverse', '--path', API + ruta, '-X', metodo, '-i']
  if (ENTORNO) resto.push('--environment', ENTORNO)
  for (const c of cabeceras) resto.push('-H', c)
  if (cuerpo !== undefined) {
    const f = join(temporal, `cuerpo-${++n}.json`)
    writeFileSync(f, JSON.stringify(cuerpo))
    resto.push('--body-file', f)
  }
  let salida
  try {
    salida = execFileSync(base[0], [...base[1], ...resto], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32' && !cli, maxBuffer: 64 * 1024 * 1024 })
  } catch (e) {
    salida = `${e.stdout ?? ''}${e.stderr ?? ''}`
  }
  const estado = Number(salida.match(/^HTTP\/[\d.]+ (\d{3})/m)?.[1] ?? 0)
  const corte = salida.search(/\r?\n\r?\n/)
  const cuerpoRespuesta = corte >= 0 ? salida.slice(corte).trim() : ''
  if (estado < 200 || estado >= 300) throw new ErrorHttp(`${metodo} ${ruta} → ${estado || '?'} ${cuerpoRespuesta || salida.trim()}`, estado)
  return cuerpoRespuesta ? JSON.parse(cuerpoRespuesta) : null
}

/** GET que devuelve null si no existe (404). */
function existe(ruta) {
  try { return peticion(ruta) } catch (e) { if (e.estado === 404) return null; throw e }
}

const enSolucion = [`MSCRM.SolutionUniqueName:${SOLUCION}`]

// ─────────────────────────────────────────────── piezas de metadatos

const etiqueta = texto => ({
  '@odata.type': 'Microsoft.Dynamics.CRM.Label',
  LocalizedLabels: [{ '@odata.type': 'Microsoft.Dynamics.CRM.LocalizedLabel', Label: texto, LanguageCode: IDIOMA }],
})
const nivel = obligatorio => ({ Value: obligatorio ? 'ApplicationRequired' : 'None', CanBeChanged: true, ManagedPropertyLogicalName: 'canmodifyrequirementlevelsettings' })

const texto = (esquema, nombre, max = 200, obligatorio = false) => ({
  '@odata.type': 'Microsoft.Dynamics.CRM.StringAttributeMetadata', SchemaName: esquema, DisplayName: etiqueta(nombre),
  RequiredLevel: nivel(obligatorio), MaxLength: max, FormatName: { Value: 'Text' },
})
const memo = (esquema, nombre) => ({
  '@odata.type': 'Microsoft.Dynamics.CRM.MemoAttributeMetadata', SchemaName: esquema, DisplayName: etiqueta(nombre),
  RequiredLevel: nivel(false), MaxLength: 8000, Format: 'TextArea',
})
const decimal = (esquema, nombre) => ({
  '@odata.type': 'Microsoft.Dynamics.CRM.DecimalAttributeMetadata', SchemaName: esquema, DisplayName: etiqueta(nombre),
  RequiredLevel: nivel(false), Precision: 2, MinValue: -100000000000, MaxValue: 100000000000,
})
const entero = (esquema, nombre) => ({
  '@odata.type': 'Microsoft.Dynamics.CRM.IntegerAttributeMetadata', SchemaName: esquema, DisplayName: etiqueta(nombre),
  RequiredLevel: nivel(false), Format: 'None', MinValue: -2147483648, MaxValue: 2147483647,
})
/** Fecha de día (YYYY-MM-DD), sin zona horaria: como loc_tarea.loc_vence. */
const dia = (esquema, nombre) => ({
  '@odata.type': 'Microsoft.Dynamics.CRM.DateTimeAttributeMetadata', SchemaName: esquema, DisplayName: etiqueta(nombre),
  RequiredLevel: nivel(false), Format: 'DateOnly', DateTimeBehavior: { Value: 'DateOnly' },
})
/** Instante (fecha y hora). */
const instante = (esquema, nombre) => ({
  '@odata.type': 'Microsoft.Dynamics.CRM.DateTimeAttributeMetadata', SchemaName: esquema, DisplayName: etiqueta(nombre),
  RequiredLevel: nivel(false), Format: 'DateAndTime', DateTimeBehavior: { Value: 'UserLocal' },
})
const sino = (esquema, nombre, porDefecto = true) => ({
  '@odata.type': 'Microsoft.Dynamics.CRM.BooleanAttributeMetadata', SchemaName: esquema, DisplayName: etiqueta(nombre),
  RequiredLevel: nivel(false), DefaultValue: porDefecto,
  OptionSet: {
    '@odata.type': 'Microsoft.Dynamics.CRM.BooleanOptionSetMetadata',
    TrueOption: { Value: 1, Label: etiqueta('Sí') }, FalseOption: { Value: 0, Label: etiqueta('No') },
  },
})
/** Opción local, como las de las tablas existentes (valores 41200xxxx). */
const opciones = (esquema, nombre, valores) => ({
  '@odata.type': 'Microsoft.Dynamics.CRM.PicklistAttributeMetadata', SchemaName: esquema, DisplayName: etiqueta(nombre),
  RequiredLevel: nivel(false),
  OptionSet: {
    '@odata.type': 'Microsoft.Dynamics.CRM.OptionSetMetadata', IsGlobal: false, OptionSetType: 'Picklist',
    Options: valores.map(([Value, l]) => ({ Value, Label: etiqueta(l) })),
  },
})

// ─────────────────────────────────────────────── catálogos (mismos valores en la app)

const O = {
  tipoCuenta: [[412000100, 'Cliente'], [412000101, 'Proveedor'], [412000102, 'Cliente y proveedor']],
  activo: [[412000105, 'Activo'], [412000106, 'Inactivo']],
  condiciones: [[412000110, 'Al contado'], [412000111, '15 días'], [412000112, '30 días'], [412000113, '60 días']],
  metodo: [[412000115, 'Transferencia'], [412000116, 'Domiciliación'], [412000117, 'Tarjeta']],
  origen: [[412000120, 'Sitio web'], [412000121, 'Referido'], [412000122, 'LinkedIn'], [412000123, 'Evento'], [412000124, 'Llamada en frío'], [412000125, 'Partner']],
  puntuacion: [[412000130, 'Caliente'], [412000131, 'Templado'], [412000132, 'Frío']],
  estadoPotencial: [[412000135, 'Abierto'], [412000136, 'Calificado'], [412000137, 'Descalificado']],
  fase: [[412000140, 'Calificar'], [412000141, 'Desarrollar'], [412000142, 'Proponer'], [412000143, 'Cerrar']],
  estadoOportunidad: [[412000145, 'Abierta'], [412000146, 'Ganada'], [412000147, 'Perdida']],
  estadoOferta: [[412000150, 'Borrador'], [412000151, 'Enviada'], [412000152, 'Aceptada'], [412000153, 'Rechazada'], [412000154, 'Expirada'], [412000155, 'Convertida en pedido']],
  estadoPedidoVenta: [[412000160, 'Abierto'], [412000161, 'Liberado'], [412000162, 'Enviado'], [412000163, 'Facturado'], [412000164, 'Cancelado']],
  estadoFacturaVenta: [[412000170, 'Borrador'], [412000171, 'Registrada'], [412000172, 'Pagada'], [412000173, 'Anulada']],
  estadoPedidoCompra: [[412000180, 'Abierto'], [412000181, 'Liberado'], [412000182, 'Recibido'], [412000183, 'Facturado'], [412000184, 'Cancelado']],
  estadoFacturaCompra: [[412000190, 'Pendiente'], [412000191, 'Registrada'], [412000192, 'Pagada'], [412000193, 'Anulada']],
  tipoProducto: [[412000200, 'Servicio'], [412000201, 'Licencia'], [412000202, 'Producto']],
  unidad: [[412000205, 'Hora'], [412000206, 'Día'], [412000207, 'Mes'], [412000208, 'Unidad'], [412000209, 'Proyecto']],
  tipoActividad: [[412000210, 'Tarea'], [412000211, 'Llamada de teléfono'], [412000212, 'Correo electrónico'], [412000213, 'Cita']],
  estadoActividad: [[412000215, 'Abierta'], [412000216, 'Completada'], [412000217, 'Cancelada']],
  prioridad: [[412000220, 'Baja'], [412000221, 'Normal'], [412000222, 'Alta']],
}

// ─────────────────────────────────────────────── tablas

/** Columnas comunes de los documentos de venta y compra. */
const columnasDocumento = estados => [
  dia('loc_Fecha', 'Fecha'),
  opciones('loc_Estado', 'Estado', estados),
  opciones('loc_CondicionesPago', 'Condiciones de pago', O.condiciones),
  opciones('loc_MetodoPago', 'Método de pago', O.metodo),
  texto('loc_Referencia', 'Referencia', 200),
  memo('loc_Notas', 'Notas'),
]

const TABLAS = [
  {
    esquema: 'loc_Cuenta', nombre: 'Cuenta', plural: 'Cuentas', descripcion: 'CRM: clientes y proveedores',
    primaria: texto('loc_Nombre', 'Nombre', 200, true),
    columnas: [
      texto('loc_Numero', 'Número', 20), opciones('loc_Tipo', 'Tipo', O.tipoCuenta), opciones('loc_Estado', 'Estado', O.activo),
      texto('loc_Cif', 'CIF / NIF', 20), texto('loc_Sector', 'Sector', 100), texto('loc_Direccion', 'Dirección', 250), texto('loc_Cp', 'Código postal', 10),
      texto('loc_Ciudad', 'Ciudad', 100), texto('loc_Provincia', 'Provincia', 100), texto('loc_Pais', 'País', 100), texto('loc_Web', 'Sitio web', 200),
      texto('loc_Telefono', 'Teléfono', 50), texto('loc_Email', 'Correo electrónico', 200), texto('loc_Empleados', 'Empleados', 20),
      opciones('loc_CondicionesPago', 'Condiciones de pago', O.condiciones), opciones('loc_MetodoPago', 'Método de pago', O.metodo),
      decimal('loc_Iva', 'IVA %'), texto('loc_Iban', 'IBAN', 40), memo('loc_Notas', 'Notas'),
    ],
  },
  {
    esquema: 'loc_Contacto', nombre: 'Contacto', plural: 'Contactos', descripcion: 'CRM: personas de las cuentas',
    primaria: texto('loc_Nombre', 'Nombre', 100, false),
    columnas: [
      texto('loc_Numero', 'Número', 20), texto('loc_Apellidos', 'Apellidos', 150), texto('loc_Cargo', 'Cargo', 150),
      texto('loc_Email', 'Correo electrónico', 200), texto('loc_Telefono', 'Teléfono', 50), texto('loc_Movil', 'Móvil', 50),
      texto('loc_Ciudad', 'Ciudad', 100), texto('loc_Linkedin', 'LinkedIn', 300), opciones('loc_Estado', 'Estado', O.activo), memo('loc_Notas', 'Notas'),
    ],
  },
  {
    esquema: 'loc_Potencial', nombre: 'Cliente potencial', plural: 'Clientes potenciales', descripcion: 'CRM: clientes potenciales (leads)',
    primaria: texto('loc_Tema', 'Tema', 300, true),
    columnas: [
      texto('loc_Numero', 'Número', 20), texto('loc_Nombre', 'Nombre', 100), texto('loc_Apellidos', 'Apellidos', 150), texto('loc_Empresa', 'Empresa', 200),
      texto('loc_Cargo', 'Cargo', 150), texto('loc_Email', 'Correo electrónico', 200), texto('loc_Telefono', 'Teléfono', 50), texto('loc_Ciudad', 'Ciudad', 100),
      texto('loc_Sector', 'Sector', 100), opciones('loc_Origen', 'Origen', O.origen), opciones('loc_Puntuacion', 'Puntuación', O.puntuacion),
      opciones('loc_Estado', 'Estado', O.estadoPotencial), opciones('loc_Fase', 'Fase', O.fase), decimal('loc_ImporteEst', 'Ingresos estimados'),
      memo('loc_Descripcion', 'Descripción'), instante('loc_CalificadoEl', 'Calificado el'), instante('loc_DescalificadoEl', 'Descalificado el'),
      texto('loc_Motivo', 'Motivo de descalificación', 500),
    ],
  },
  {
    esquema: 'loc_Oportunidad', nombre: 'Oportunidad', plural: 'Oportunidades', descripcion: 'CRM: oportunidades de venta',
    primaria: texto('loc_Titulo', 'Tema', 300, true),
    columnas: [
      texto('loc_Numero', 'Número', 20), decimal('loc_Importe', 'Ingresos estimados'), opciones('loc_Fase', 'Fase', O.fase),
      opciones('loc_Estado', 'Estado', O.estadoOportunidad), entero('loc_Probabilidad', 'Probabilidad (%)'), dia('loc_CierrePrevisto', 'Cierre previsto'),
      memo('loc_Notas', 'Notas'), instante('loc_CerradaEl', 'Cerrada el'), texto('loc_MotivoPerdida', 'Motivo de pérdida', 500),
    ],
  },
  {
    esquema: 'loc_Producto', nombre: 'Producto', plural: 'Productos', descripcion: 'CRM: catálogo de productos y servicios',
    primaria: texto('loc_Nombre', 'Nombre', 200, true),
    columnas: [
      texto('loc_Numero', 'Número', 20), opciones('loc_Tipo', 'Tipo', O.tipoProducto), texto('loc_Categoria', 'Categoría', 100),
      opciones('loc_Unidad', 'Unidad', O.unidad), decimal('loc_Precio', 'Precio de venta'), decimal('loc_Coste', 'Coste'), decimal('loc_Iva', 'IVA %'),
      sino('loc_Activo', 'Activo', true), memo('loc_Descripcion', 'Descripción'),
    ],
  },
  {
    esquema: 'loc_Oferta', nombre: 'Oferta', plural: 'Ofertas', descripcion: 'CRM: ofertas de venta',
    primaria: texto('loc_Numero', 'Número', 20, true),
    columnas: [...columnasDocumento(O.estadoOferta), dia('loc_ValidaHasta', 'Válida hasta')],
  },
  {
    esquema: 'loc_PedidoVenta', nombre: 'Pedido de venta', plural: 'Pedidos de venta', descripcion: 'CRM: pedidos de venta',
    primaria: texto('loc_Numero', 'Número', 20, true),
    columnas: [...columnasDocumento(O.estadoPedidoVenta), dia('loc_FechaEntrega', 'Fecha de entrega'), texto('loc_RefCliente', 'Nº pedido del cliente', 100)],
  },
  {
    esquema: 'loc_FacturaVenta', nombre: 'Factura de venta', plural: 'Facturas de venta', descripcion: 'CRM: facturas de venta (documento comercial; la factura oficial va en el ERP)',
    primaria: texto('loc_Numero', 'Número', 20, true),
    columnas: [...columnasDocumento(O.estadoFacturaVenta), dia('loc_Vencimiento', 'Vencimiento'), instante('loc_RegistradaEl', 'Registrada el'), instante('loc_PagadaEl', 'Pagada el')],
  },
  {
    esquema: 'loc_PedidoCompra', nombre: 'Pedido de compra', plural: 'Pedidos de compra', descripcion: 'CRM: pedidos de compra',
    primaria: texto('loc_Numero', 'Número', 20, true),
    columnas: [...columnasDocumento(O.estadoPedidoCompra), dia('loc_RecepcionPrevista', 'Recepción prevista'), texto('loc_RefProveedor', 'Nº pedido del proveedor', 100)],
  },
  {
    esquema: 'loc_FacturaCompra', nombre: 'Factura de compra', plural: 'Facturas de compra', descripcion: 'CRM: facturas de proveedores',
    primaria: texto('loc_Numero', 'Número', 20, true),
    columnas: [
      ...columnasDocumento(O.estadoFacturaCompra), texto('loc_NoProveedor', 'Nº factura del proveedor', 100), dia('loc_Vencimiento', 'Vencimiento'),
      instante('loc_RegistradaEl', 'Registrada el'), instante('loc_PagadaEl', 'Pagada el'),
    ],
  },
  {
    esquema: 'loc_LineaDocumento', nombre: 'Línea de documento', plural: 'Líneas de documento', descripcion: 'CRM: líneas de ofertas, pedidos y facturas',
    primaria: texto('loc_Descripcion', 'Descripción', 500, true),
    columnas: [
      entero('loc_Orden', 'Orden'), decimal('loc_Cantidad', 'Cantidad'), opciones('loc_Unidad', 'Unidad', O.unidad),
      decimal('loc_Precio', 'Precio'), decimal('loc_Dto', 'Descuento %'), decimal('loc_Iva', 'IVA %'),
    ],
  },
  {
    esquema: 'loc_ActividadCrm', nombre: 'Actividad CRM', plural: 'Actividades CRM', descripcion: 'CRM: tareas, llamadas, correos y citas referentes a un registro',
    primaria: texto('loc_Asunto', 'Asunto', 300, true),
    columnas: [
      opciones('loc_Tipo', 'Tipo', O.tipoActividad), dia('loc_Fecha', 'Fecha de vencimiento'), texto('loc_Hora', 'Hora', 5),
      texto('loc_ReferenteTipo', 'Referente a (tipo)', 50), texto('loc_ReferenteId', 'Referente a (id)', 50),
      opciones('loc_Prioridad', 'Prioridad', O.prioridad), opciones('loc_Estado', 'Estado', O.estadoActividad),
      instante('loc_CompletadaEl', 'Completada el'), memo('loc_Descripcion', 'Descripción'),
    ],
  },
  {
    esquema: 'loc_NotaCrm', nombre: 'Nota CRM', plural: 'Notas CRM', descripcion: 'CRM: notas de la escala de tiempo',
    // la columna principal no admite textos largos: lleva el principio de la nota y loc_Texto la nota entera
    primaria: texto('loc_Resumen', 'Resumen', 200, true),
    columnas: [memo('loc_Texto', 'Texto'), texto('loc_ReferenteTipo', 'Referente a (tipo)', 50), texto('loc_ReferenteId', 'Referente a (id)', 50), instante('loc_Fecha', 'Fecha')],
  },
]

// ─────────────────────────────────────────────── relaciones (búsquedas)

/** [tabla que referencia, columna, tabla referenciada, nombre visible]. Al borrar la referenciada, la búsqueda se vacía. */
const DOCS = ['loc_oferta', 'loc_pedidoventa', 'loc_facturaventa', 'loc_pedidocompra', 'loc_facturacompra']
const BUSQUEDAS = [
  ...['loc_cuenta', 'loc_contacto', 'loc_potencial', 'loc_oportunidad', ...DOCS, 'loc_actividadcrm'].map(t => [t, 'loc_Propietario', 'loc_miembro', 'Propietario']),
  ['loc_notacrm', 'loc_Autor', 'loc_miembro', 'Autor'],
  ['loc_contacto', 'loc_Cuenta', 'loc_cuenta', 'Cuenta'],
  ['loc_potencial', 'loc_Cuenta', 'loc_cuenta', 'Cuenta creada'],
  ['loc_potencial', 'loc_Contacto', 'loc_contacto', 'Contacto creado'],
  ['loc_potencial', 'loc_Oportunidad', 'loc_oportunidad', 'Oportunidad creada'],
  ['loc_oportunidad', 'loc_Cuenta', 'loc_cuenta', 'Cuenta'],
  ['loc_oportunidad', 'loc_Contacto', 'loc_contacto', 'Contacto'],
  ['loc_oportunidad', 'loc_Potencial', 'loc_potencial', 'Cliente potencial de origen'],
  ...DOCS.flatMap(t => [[t, 'loc_Cuenta', 'loc_cuenta', t.includes('compra') ? 'Proveedor' : 'Cliente'], [t, 'loc_Contacto', 'loc_contacto', 'Contacto']]),
  ['loc_oferta', 'loc_Oportunidad', 'loc_oportunidad', 'Oportunidad'],
  ['loc_oferta', 'loc_Pedido', 'loc_pedidoventa', 'Pedido'],
  ['loc_pedidoventa', 'loc_Oferta', 'loc_oferta', 'Oferta de origen'],
  ['loc_pedidoventa', 'loc_Oportunidad', 'loc_oportunidad', 'Oportunidad'],
  ['loc_pedidoventa', 'loc_Factura', 'loc_facturaventa', 'Factura'],
  ['loc_facturaventa', 'loc_Pedido', 'loc_pedidoventa', 'Pedido de origen'],
  ['loc_pedidocompra', 'loc_Factura', 'loc_facturacompra', 'Factura'],
  ['loc_facturacompra', 'loc_Pedido', 'loc_pedidocompra', 'Pedido de origen'],
  // Cada línea cuelga de uno de los cinco documentos. Dataverse solo admite una
  // relación «padre» (borrado en cascada) por tabla, así que ninguna cascada:
  // la app borra las líneas antes que el documento.
  ['loc_lineadocumento', 'loc_Oferta', 'loc_oferta', 'Oferta'],
  ['loc_lineadocumento', 'loc_PedidoVenta', 'loc_pedidoventa', 'Pedido de venta'],
  ['loc_lineadocumento', 'loc_FacturaVenta', 'loc_facturaventa', 'Factura de venta'],
  ['loc_lineadocumento', 'loc_PedidoCompra', 'loc_pedidocompra', 'Pedido de compra'],
  ['loc_lineadocumento', 'loc_FacturaCompra', 'loc_facturacompra', 'Factura de compra'],
  ['loc_lineadocumento', 'loc_Producto', 'loc_producto', 'Producto'],
  ['loc_actividadcrm', 'loc_Cuenta', 'loc_cuenta', 'Cuenta'],
  ['loc_notacrm', 'loc_Cuenta', 'loc_cuenta', 'Cuenta'],
]

// ─────────────────────────────────────────────── ejecución

const log = (...m) => console.log(...m)
const faltan = []

function asegurarTabla(t) {
  const ln = t.esquema.toLowerCase()
  if (existe(`EntityDefinitions(LogicalName='${ln}')?$select=LogicalName`)) { log(`= tabla ${ln}`); return }
  faltan.push(`tabla ${ln}`)
  if (SIMULAR) return
  peticion('EntityDefinitions', {
    metodo: 'POST', cabeceras: enSolucion,
    cuerpo: {
      '@odata.type': 'Microsoft.Dynamics.CRM.EntityMetadata',
      SchemaName: t.esquema, DisplayName: etiqueta(t.nombre), DisplayCollectionName: etiqueta(t.plural), Description: etiqueta(t.descripcion),
      OwnershipType: 'UserOwned', IsActivity: false, HasNotes: false, HasActivities: false,
      PrimaryNameAttribute: t.primaria.SchemaName.toLowerCase(),
      Attributes: [{ ...t.primaria, IsPrimaryName: true }],
    },
  })
  log(`+ tabla ${ln}`)
}

function asegurarColumna(t, c) {
  const ln = t.esquema.toLowerCase(), col = c.SchemaName.toLowerCase()
  if (existe(`EntityDefinitions(LogicalName='${ln}')/Attributes(LogicalName='${col}')?$select=LogicalName`)) return
  faltan.push(`columna ${ln}.${col}`)
  if (SIMULAR) return
  peticion(`EntityDefinitions(LogicalName='${ln}')/Attributes`, { metodo: 'POST', cabeceras: enSolucion, cuerpo: c })
  log(`+ columna ${ln}.${col}`)
}

function asegurarBusqueda([origen, esquema, destino, nombre]) {
  const relacion = `${destino}_${origen.replace(/^loc_/, '')}_${esquema.replace(/^loc_/, '').toLowerCase()}`
  const ya = existe(`RelationshipDefinitions(SchemaName='${relacion}')`)
  if (ya) {
    // una versión anterior del script creó alguna con borrado en cascada: se alinea
    if (ya.CascadeConfiguration?.Delete !== 'RemoveLink' && !SIMULAR) {
      const { '@odata.context': _, ...meta } = ya
      meta['@odata.type'] = 'Microsoft.Dynamics.CRM.OneToManyRelationshipMetadata'
      meta.CascadeConfiguration = { ...meta.CascadeConfiguration, Delete: 'RemoveLink' }
      peticion(`RelationshipDefinitions(${ya.MetadataId})`, { metodo: 'PUT', cuerpo: meta, cabeceras: [...enSolucion, 'MSCRM.MergeLabels:true'] })
      log(`~ relación ${relacion}: borrado sin cascada`)
    }
    return
  }
  faltan.push(`relación ${relacion}`)
  if (SIMULAR) return
  peticion('RelationshipDefinitions', {
    metodo: 'POST', cabeceras: enSolucion,
    cuerpo: {
      '@odata.type': 'Microsoft.Dynamics.CRM.OneToManyRelationshipMetadata',
      SchemaName: relacion, ReferencedEntity: destino, ReferencingEntity: origen, ReferencedAttribute: `${destino}id`,
      CascadeConfiguration: {
        Assign: 'NoCascade', Delete: 'RemoveLink', Merge: 'NoCascade', Reparent: 'NoCascade',
        Share: 'NoCascade', Unshare: 'NoCascade', RollupView: 'NoCascade',
      },
      Lookup: { '@odata.type': 'Microsoft.Dynamics.CRM.LookupAttributeMetadata', SchemaName: esquema, DisplayName: etiqueta(nombre), RequiredLevel: nivel(false) },
    },
  })
  log(`+ relación ${relacion}`)
}

try {
  log(`Solución: ${SOLUCION}${ENTORNO ? ` · entorno ${ENTORNO}` : ''}${SIMULAR ? ' · SIMULACIÓN' : ''}`)
  const sol = peticion(`solutions?$select=solutionid&$filter=uniquename eq '${SOLUCION}'`)
  if (!sol?.value?.length) throw new Error(`No existe la solución ${SOLUCION} en el entorno`)

  // 1) tablas con su columna principal; 2) columnas; 3) búsquedas (necesitan todas las tablas)
  for (const t of TABLAS) asegurarTabla(t)
  const tablasFaltan = faltan.length > 0
  // en simulación, si faltan tablas no se pueden consultar sus columnas
  if (!SIMULAR || !tablasFaltan) for (const t of TABLAS) for (const c of t.columnas) asegurarColumna(t, c)
  if (!SIMULAR || !tablasFaltan) for (const b of BUSQUEDAS) asegurarBusqueda(b)

  if (!SIMULAR) {
    // Por si alguna tabla se creó fuera de la solución: añadirla es idempotente.
    for (const t of TABLAS) {
      const meta = peticion(`EntityDefinitions(LogicalName='${t.esquema.toLowerCase()}')?$select=MetadataId`)
      peticion('AddSolutionComponent', {
        metodo: 'POST',
        cuerpo: { ComponentId: meta.MetadataId, ComponentType: 1, SolutionUniqueName: SOLUCION, AddRequiredComponents: false, DoNotIncludeSubcomponents: false },
      })
    }
    const entidades = TABLAS.map(t => `<entity>${t.esquema.toLowerCase()}</entity>`).join('')
    peticion('PublishXml', { metodo: 'POST', cuerpo: { ParameterXml: `<importexportxml><entities>${entidades}</entities></importexportxml>` } })
    log('Personalizaciones publicadas.')
  }
  log(faltan.length ? `${SIMULAR ? 'Faltan' : 'Creados'}: ${faltan.length} elementos.` : 'Todo estaba ya creado.')
} catch (e) {
  console.error('\nERROR:', e.message)
  process.exitCode = 1
} finally {
  rmSync(temporal, { recursive: true, force: true })
}
