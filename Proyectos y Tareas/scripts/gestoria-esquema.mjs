#!/usr/bin/env node
/**
 * Esquema de la Gestoría en Dataverse, dentro de la solución LocodeaObjetivos:
 *   - tablas nuevas: loc_perfilfiscal, loc_presentacion, loc_asiento,
 *     loc_verifactuconfig, loc_envioverifactu y loc_registrofacturacion;
 *   - columnas fiscales nuevas en tablas del CRM y de Gestión: cuentas
 *     (país, identificación fiscal, particular, VIES), facturas de venta (tipo
 *     de operación, tipo de factura, rectificada, Verifactu), facturas de
 *     compra (tipo de operación, retención, recepción, bien de inversión,
 *     PDF) y gastos (factura completa, deducible en el Impuesto sobre Sociedades);
 *   - opciones nuevas en columnas existentes: tipos de documento del
 *     Expediente y el rol «Asesor» de los miembros;
 *   - privilegios: los roles de seguridad que ya pueden usar loc_documento
 *     reciben los mismos sobre las tablas nuevas.
 *
 * No borra ni renombra nada. Es idempotente, como gestion-esquema.mjs:
 * comprueba cada pieza antes de crearla.
 *
 * Uso (desde esta carpeta):
 *   node gestoria-esquema.mjs                      # entorno del perfil activo del CLI de Dataverse
 *   node gestoria-esquema.mjs --simular            # solo lista lo que falta
 *   node gestoria-esquema.mjs --entorno https://orgXXXX.crm17.dynamics.com
 *
 * Los valores de las opciones (4120004xx–4120005xx) deben coincidir con
 * app/src/gestoria/dataverse.ts, app/src/crm/dataverse.ts y app/src/gestion/dataverse.ts.
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const args = process.argv.slice(2)
const opcion = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined }
const SIMULAR = args.includes('--simular')
const ENTORNO = opcion('--entorno')
const SOLUCION = opcion('--solucion') ?? 'LocodeaObjetivos'
const IDIOMA = 3082
const API = 'api/data/v9.2/'

// ─────────────────────────────────────────────── acceso a la API (igual que gestion-esquema.mjs)

const temporal = mkdtempSync(join(tmpdir(), 'gestoria-esquema-'))
let n = 0

class ErrorHttp extends Error {
  constructor(mensaje, estado) { super(mensaje); this.estado = estado }
}

/**
 * Con `--token <archivo>` (un token de acceso de Dataverse guardado en un
 * archivo) llama a la API con curl en vez de con el CLI de Dataverse: sirve
 * cuando el inquilino no deja usar la aplicación del CLI.
 */
const TOKEN = opcion('--token')
const URL_ENTORNO = (ENTORNO ?? 'https://org1d0382e8.crm17.dynamics.com').replace(/\/$/, '')

function peticionCurl(ruta, { metodo, cuerpo, cabeceras }) {
  const token = readFileSync(TOKEN, 'utf8').trim()
  const resto = ['-s', '-i', '-X', metodo, `${URL_ENTORNO}/${API}${ruta}`, '-H', `Authorization: Bearer ${token}`, '-H', 'Accept: application/json',
    '-H', 'OData-MaxVersion: 4.0', '-H', 'OData-Version: 4.0', '-H', 'Content-Type: application/json; charset=utf-8']
  for (const c of cabeceras) resto.push('-H', c.replace(/^([^:]+):/, '$1: '))
  if (cuerpo !== undefined) {
    const f = join(temporal, `cuerpo-${++n}.json`)
    writeFileSync(f, JSON.stringify(cuerpo))
    resto.push('--data-binary', `@${f}`)
  }
  return execFileSync('curl', resto, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
}

function peticion(ruta, { metodo = 'GET', cuerpo, cabeceras = [] } = {}) {
  if (TOKEN) {
    const salida = peticionCurl(ruta, { metodo, cuerpo, cabeceras })
    // curl -i puede traer varias cabeceras (100 Continue): vale la última
    const bloques = salida.split(/\r?\n\r?\n/)
    let i = 0
    while (i < bloques.length - 1 && /^HTTP\/[\d.]+ 100/.test(bloques[i])) i++
    const estado = Number(bloques[i]?.match(/^HTTP\/[\d.]+ (\d{3})/)?.[1] ?? 0)
    const cuerpoRespuesta = bloques.slice(i + 1).join('\n\n').trim()
    if (estado < 200 || estado >= 300) throw new ErrorHttp(`${metodo} ${ruta} → ${estado || '?'} ${cuerpoRespuesta}`, estado)
    return cuerpoRespuesta ? JSON.parse(cuerpoRespuesta) : null
  }
  const cli = process.env.DATAVERSE_CLI
  const base = cli ? ['node', [cli]] : [process.platform === 'win32' ? 'npx.cmd' : 'npx', ['-y', '@microsoft/dataverse']]
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
const memo = (esquema, nombre, max = 8000) => ({
  '@odata.type': 'Microsoft.Dynamics.CRM.MemoAttributeMetadata', SchemaName: esquema, DisplayName: etiqueta(nombre),
  RequiredLevel: nivel(false), MaxLength: max, Format: 'TextArea',
})
const decimal = (esquema, nombre) => ({
  '@odata.type': 'Microsoft.Dynamics.CRM.DecimalAttributeMetadata', SchemaName: esquema, DisplayName: etiqueta(nombre),
  RequiredLevel: nivel(false), Precision: 2, MinValue: -100000000000, MaxValue: 100000000000,
})
const entero = (esquema, nombre) => ({
  '@odata.type': 'Microsoft.Dynamics.CRM.IntegerAttributeMetadata', SchemaName: esquema, DisplayName: etiqueta(nombre),
  RequiredLevel: nivel(false), Format: 'None', MinValue: -2147483648, MaxValue: 2147483647,
})
const dia = (esquema, nombre) => ({
  '@odata.type': 'Microsoft.Dynamics.CRM.DateTimeAttributeMetadata', SchemaName: esquema, DisplayName: etiqueta(nombre),
  RequiredLevel: nivel(false), Format: 'DateOnly', DateTimeBehavior: { Value: 'DateOnly' },
})
const sino = (esquema, nombre, porDefecto = true) => ({
  '@odata.type': 'Microsoft.Dynamics.CRM.BooleanAttributeMetadata', SchemaName: esquema, DisplayName: etiqueta(nombre),
  RequiredLevel: nivel(false), DefaultValue: porDefecto,
  OptionSet: {
    '@odata.type': 'Microsoft.Dynamics.CRM.BooleanOptionSetMetadata',
    TrueOption: { Value: 1, Label: etiqueta('Sí') }, FalseOption: { Value: 0, Label: etiqueta('No') },
  },
})
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
  tipoIdFiscal: [
    [412000450, 'NIF español'], [412000451, 'NIF-IVA (UE)'], [412000452, 'Pasaporte'], [412000453, 'Documento oficial del país'],
    [412000454, 'Certificado de residencia'], [412000455, 'Otro documento'], [412000456, 'No censado'],
  ],
  vies: [[412000460, 'Sin comprobar'], [412000461, 'Válido'], [412000462, 'No válido']],
  operacionVenta: [
    [412000470, 'Interior (IVA español)'], [412000471, 'Empresa de la UE (inversión del sujeto pasivo)'], [412000472, 'Particular de la UE'],
    [412000473, 'Ventanilla única (OSS)'], [412000474, 'Fuera de la UE'], [412000475, 'Inversión del sujeto pasivo interior'], [412000476, 'Exenta'],
  ],
  tipoFactura: [
    [412000480, 'F1 · Completa'], [412000481, 'F2 · Simplificada'], [412000482, 'F3 · En sustitución de simplificadas'], [412000483, 'R1 · Rectificativa (error fundado en derecho)'],
    [412000484, 'R2 · Rectificativa (concurso)'], [412000485, 'R3 · Rectificativa (deudas incobrables)'], [412000486, 'R4 · Rectificativa (resto)'], [412000487, 'R5 · Rectificativa de simplificada'],
  ],
  estadoVerifactu: [
    [412000490, 'Sin registro'], [412000491, 'Preparado (sin enviar)'], [412000492, 'Pendiente de envío'], [412000493, 'Correcto'],
    [412000494, 'Aceptado con errores'], [412000495, 'Rechazado'], [412000496, 'Anulado'],
  ],
  operacionCompra: [
    [412000500, 'Interior (IVA español)'], [412000501, 'Adquisición en la UE'], [412000502, 'Servicios de fuera de la UE'], [412000503, 'Importación'],
    [412000504, 'Inversión del sujeto pasivo interior'], [412000505, 'Exenta o sin IVA'],
  ],
  claveRetencion: [[412000510, 'Sin retención'], [412000511, 'Profesional'], [412000512, 'Arrendamiento'], [412000513, 'Otras']],
  tipoDocumentoNuevos: [[412000520, 'Censal (036)'], [412000521, 'Notificación de la AEAT'], [412000522, 'Justificante de presentación'], [412000523, 'Cuentas anuales'], [412000524, 'Acta de junta']],
  periodicidadIva: [[412000530, 'Trimestral'], [412000531, 'Mensual']],
  estadoPresentacion: [[412000540, 'Pendiente'], [412000541, 'Preparada'], [412000542, 'Presentada'], [412000543, 'Pagada'], [412000544, 'Domiciliada'], [412000545, 'No procede']],
  tipoAsiento: [
    [412000550, 'Apertura'], [412000551, 'Capital'], [412000552, 'Ajuste'], [412000553, 'Amortización'], [412000554, 'Periodificación'],
    [412000555, 'Impuesto'], [412000556, 'Regularización'], [412000557, 'Cierre'], [412000558, 'Otro'],
  ],
  entorno: [[412000560, 'Preparación (sin envío)'], [412000561, 'Pruebas de la AEAT'], [412000562, 'Producción']],
  tipoRegistro: [[412000570, 'Alta'], [412000571, 'Anulación']],
  estadoRegistro: [[412000575, 'Simulado'], [412000576, 'Pendiente'], [412000577, 'Correcto'], [412000578, 'Aceptado con errores'], [412000579, 'Rechazado']],
  estadoEnvio: [[412000585, 'Correcto'], [412000586, 'Parcialmente correcto'], [412000587, 'Incorrecto'], [412000588, 'Error de comunicación']],
  rolNuevo: [[412000002, 'Asesor (solo lectura)']],
}

// ─────────────────────────────────────────────── tablas nuevas (en orden: las referenciadas primero)

const TABLAS = [
  {
    esquema: 'loc_PerfilFiscal', nombre: 'Perfil fiscal', plural: 'Perfiles fiscales', descripcion: 'Gestoría: datos fiscales de la sociedad que deciden qué modelos aplican',
    primaria: texto('loc_RazonSocial', 'Razón social', 200, true),
    columnas: [
      texto('loc_Nif', 'NIF', 20), texto('loc_Domicilio', 'Domicilio fiscal', 300), dia('loc_FechaConstitucion', 'Fecha de constitución'),
      entero('loc_MesCierre', 'Mes de cierre'), opciones('loc_PeriodicidadIva', 'Periodicidad del IVA', O.periodicidadIva),
      sino('loc_CriterioCaja', 'Criterio de caja', false), sino('loc_Roi', 'Operador intracomunitario (ROI)', true), sino('loc_Oss', 'Ventanilla única (OSS)', false),
      sino('loc_NuevaCreacion', 'Entidad de nueva creación', true), entero('loc_PrimerEjercicioPositivo', 'Primer ejercicio con base positiva'),
      decimal('loc_CifraNegocios', 'Cifra de negocios del último ejercicio'), sino('loc_AdministradoresRetribuidos', 'Administradores retribuidos', false),
      decimal('loc_RetencionAdministradores', 'Retención de administradores %'), sino('loc_Empleados', 'Tiene empleados', false),
      sino('loc_AlquilerLocal', 'Alquila local u oficina', false), sino('loc_DividendosPrestamos', 'Dividendos o préstamos de socios', false),
      sino('loc_OperacionesVinculadas', 'Operaciones vinculadas (232)', false), texto('loc_IbanDomiciliacion', 'IBAN de domiciliación', 40),
      decimal('loc_SaldoBanco', 'Saldo del banco'), dia('loc_SaldoBancoFecha', 'Saldo del banco a'), memo('loc_BasesNegativas', 'Bases imponibles negativas', 4000),
      memo('loc_Notas', 'Notas'),
    ],
  },
  {
    esquema: 'loc_Presentacion', nombre: 'Presentación', plural: 'Presentaciones', descripcion: 'Gestoría: estado de cada modelo y periodo, con la foto de las casillas y el justificante',
    primaria: texto('loc_Nombre', 'Nombre', 100, true),
    columnas: [
      texto('loc_Modelo', 'Modelo', 20), texto('loc_Periodo', 'Periodo', 20), opciones('loc_Estado', 'Estado', O.estadoPresentacion),
      decimal('loc_Importe', 'Importe'), dia('loc_PresentadaEl', 'Presentada el'), texto('loc_Csv', 'Código seguro de verificación', 40),
      texto('loc_Nrc', 'NRC del pago', 40), texto('loc_Justificante', 'Enlace al justificante', 500), memo('loc_Casillas', 'Casillas', 100000),
      memo('loc_Incluidos', 'Documentos incluidos', 100000), texto('loc_ComplementariaDe', 'Complementaria de', 50), memo('loc_Notas', 'Notas'),
    ],
  },
  {
    esquema: 'loc_Asiento', nombre: 'Asiento', plural: 'Asientos', descripcion: 'Gestoría: asientos contables escritos a mano (capital, ajustes, cierre)',
    primaria: texto('loc_Concepto', 'Concepto', 300, true),
    columnas: [dia('loc_Fecha', 'Fecha'), entero('loc_Ejercicio', 'Ejercicio'), opciones('loc_Tipo', 'Tipo', O.tipoAsiento), memo('loc_Lineas', 'Líneas', 100000)],
  },
  {
    esquema: 'loc_VerifactuConfig', nombre: 'Configuración de Verifactu', plural: 'Configuraciones de Verifactu', descripcion: 'Gestoría: entorno, emisor y sistema informático de facturación',
    primaria: texto('loc_RazonSocial', 'Razón social', 200, true),
    columnas: [
      opciones('loc_Entorno', 'Entorno', O.entorno), texto('loc_NifEmisor', 'NIF del emisor', 20), texto('loc_CertificadoRef', 'Certificado en Key Vault', 200),
      dia('loc_CertificadoCaduca', 'Caducidad del certificado'), texto('loc_ServicioUrl', 'URL del servicio', 500), texto('loc_SistemaNombre', 'Nombre del sistema', 100),
      texto('loc_SistemaId', 'Identificador del sistema', 10), texto('loc_SistemaVersion', 'Versión del sistema', 20), texto('loc_NumeroInstalacion', 'Número de instalación', 50),
      dia('loc_AltaEl', 'En producción desde'), dia('loc_DeclaracionFirmadaEl', 'Declaración responsable firmada el'), texto('loc_DeclaracionFirmante', 'Firmante de la declaración', 200),
    ],
  },
  {
    esquema: 'loc_EnvioVerifactu', nombre: 'Envío a Verifactu', plural: 'Envíos a Verifactu', descripcion: 'Gestoría: cada envío de registros de facturación a la AEAT',
    primaria: texto('loc_Nombre', 'Nombre', 100, true),
    columnas: [
      texto('loc_Fecha', 'Fecha y hora', 40), opciones('loc_Entorno', 'Entorno', O.entorno), entero('loc_Registros', 'Registros'),
      opciones('loc_Estado', 'Estado', O.estadoEnvio), texto('loc_Csv', 'Código seguro de verificación', 40), memo('loc_Respuesta', 'Respuesta', 100000),
      entero('loc_EsperaSegundos', 'Espera (segundos)'),
    ],
  },
  {
    esquema: 'loc_RegistroFacturacion', nombre: 'Registro de facturación', plural: 'Registros de facturación', descripcion: 'Gestoría: registros de alta y anulación de Verifactu, encadenados por su huella',
    primaria: texto('loc_SerieNumero', 'Serie y número', 60, true),
    columnas: [
      opciones('loc_Tipo', 'Tipo', O.tipoRegistro), texto('loc_NifEmisor', 'NIF del emisor', 20), dia('loc_FechaExpedicion', 'Fecha de expedición'),
      opciones('loc_TipoFactura', 'Tipo de factura', O.tipoFactura), decimal('loc_CuotaTotal', 'Cuota total'), decimal('loc_ImporteTotal', 'Importe total'),
      texto('loc_Huella', 'Huella', 100), texto('loc_HuellaAnterior', 'Huella anterior', 100), texto('loc_FechaHoraGeneracion', 'Fecha y hora de generación', 40),
      memo('loc_Xml', 'XML del registro', 1048576), opciones('loc_Estado', 'Estado', O.estadoRegistro), opciones('loc_Entorno', 'Entorno', O.entorno),
      texto('loc_CodigoError', 'Código de error', 20), memo('loc_DescripcionError', 'Descripción del error', 4000), texto('loc_Csv', 'Código seguro de verificación', 40),
      entero('loc_Orden', 'Orden en la cadena'),
    ],
  },
]

/** Columnas que se añaden a tablas ya existentes. */
const COLUMNAS_EXTRA = [
  {
    esquema: 'loc_Cuenta', columnas: [
      texto('loc_CodigoPais', 'Código de país', 2), opciones('loc_TipoIdFiscal', 'Tipo de identificación fiscal', O.tipoIdFiscal),
      sino('loc_Particular', 'Particular', false), opciones('loc_Vies', 'NIF-IVA en VIES', O.vies), dia('loc_ViesComprobadoEl', 'VIES comprobado el'),
    ],
  },
  {
    esquema: 'loc_FacturaVenta', columnas: [
      opciones('loc_TipoOperacion', 'Tipo de operación', O.operacionVenta), opciones('loc_TipoFactura', 'Tipo de factura', O.tipoFactura),
      texto('loc_MotivoRectificacion', 'Motivo de la rectificación', 500), opciones('loc_EstadoVerifactu', 'Estado Verifactu', O.estadoVerifactu),
      texto('loc_Huella', 'Huella Verifactu', 100),
    ],
  },
  {
    esquema: 'loc_FacturaCompra', columnas: [
      opciones('loc_TipoOperacion', 'Tipo de operación', O.operacionCompra), decimal('loc_Irpf', 'Retención IRPF %'),
      opciones('loc_ClaveRetencion', 'Clave de retención', O.claveRetencion), dia('loc_FechaRecepcion', 'Fecha de recepción'),
      sino('loc_BienInversion', 'Bien de inversión', false), entero('loc_VidaUtil', 'Vida útil (años)'), sino('loc_IvaDeducible', 'IVA deducible', true),
      texto('loc_Enlace', 'Enlace al PDF', 500),
    ],
  },
  { esquema: 'loc_Gasto', columnas: [sino('loc_FacturaCompleta', 'Factura completa', true), sino('loc_DeducibleIs', 'Deducible en Sociedades', true)] },
]

/** Opciones nuevas en columnas Choice existentes: [tabla, columna, opciones]. */
const OPCIONES_EXTRA = [
  ['loc_documento', 'loc_tipo', O.tipoDocumentoNuevos],
  ['loc_miembro', 'loc_rol', O.rolNuevo],
]

/** [tabla que referencia, columna, tabla referenciada, nombre visible]. Sin borrado en cascada. */
const BUSQUEDAS = [
  ['loc_registrofacturacion', 'loc_FacturaVenta', 'loc_facturaventa', 'Factura de venta'],
  ['loc_registrofacturacion', 'loc_Envio', 'loc_envioverifactu', 'Envío'],
  ['loc_facturaventa', 'loc_Rectificada', 'loc_facturaventa', 'Factura rectificada'],
]

/** Los roles que pueden usar esta tabla reciben los mismos privilegios sobre las nuevas. */
const TABLA_MODELO_PRIVILEGIOS = 'loc_documento'

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

function asegurarColumna(esquemaTabla, c) {
  const ln = esquemaTabla.toLowerCase(), col = c.SchemaName.toLowerCase()
  if (existe(`EntityDefinitions(LogicalName='${ln}')/Attributes(LogicalName='${col}')?$select=LogicalName`)) return
  faltan.push(`columna ${ln}.${col}`)
  if (SIMULAR) return
  peticion(`EntityDefinitions(LogicalName='${ln}')/Attributes`, { metodo: 'POST', cabeceras: enSolucion, cuerpo: c })
  log(`+ columna ${ln}.${col}`)
}

function asegurarOpciones([tabla, columna, valores]) {
  const meta = existe(`EntityDefinitions(LogicalName='${tabla}')/Attributes(LogicalName='${columna}')/Microsoft.Dynamics.CRM.PicklistAttributeMetadata?$select=LogicalName&$expand=OptionSet($select=Options)`)
  if (!meta) throw new Error(`No existe la columna ${tabla}.${columna}`)
  const hay = new Set((meta.OptionSet?.Options ?? []).map(o => o.Value))
  for (const [valor, texto] of valores) {
    if (hay.has(valor)) continue
    faltan.push(`opción ${tabla}.${columna} = ${valor} (${texto})`)
    if (SIMULAR) continue
    peticion('InsertOptionValue', {
      metodo: 'POST',
      cuerpo: { EntityLogicalName: tabla, AttributeLogicalName: columna, Value: valor, Label: etiqueta(texto), SolutionUniqueName: SOLUCION },
    })
    log(`+ opción ${tabla}.${columna} = ${valor} (${texto})`)
  }
}

function asegurarBusqueda([origen, esquema, destino, nombre]) {
  const relacion = `${destino}_${origen.replace(/^loc_/, '')}_${esquema.replace(/^loc_/, '').toLowerCase()}`
  if (existe(`RelationshipDefinitions(SchemaName='${relacion}')`)) return
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

/** Profundidad del privilegio en roleprivileges → nombre que espera AddPrivilegesRole. */
const PROFUNDIDAD = { 1: 'Basic', 2: 'Local', 4: 'Deep', 8: 'Global' }

/**
 * Copia los privilegios que cada rol de seguridad tiene sobre la tabla modelo
 * (crear, leer, escribir…) a las tablas nuevas, con la misma profundidad.
 * Los administradores del sistema ya los tienen todos: solo cambia algo en
 * los roles propios de la solución.
 */
function copiarPrivilegios(nuevas) {
  const sufijo = TABLA_MODELO_PRIVILEGIOS
  const modelo = peticion(`privileges?$select=privilegeid,name&$filter=endswith(name,%27${sufijo}%27)`)?.value ?? []
  if (!modelo.length) { log(`(sin privilegios de ${sufijo}: nada que copiar)`); return }
  const verbo = p => p.name.slice(3, p.name.length - sufijo.length) // prvReadloc_documento → Read
  const porRol = new Map()
  for (const p of modelo) {
    const filas = peticion(`roleprivilegescollection?$select=roleid,privilegedepthmask&$filter=privilegeid%20eq%20${p.privilegeid}`)?.value ?? []
    for (const f of filas) {
      const lista = porRol.get(f.roleid) ?? []
      lista.push({ verbo: verbo(p), profundidad: PROFUNDIDAD[f.privilegedepthmask] ?? 'Global' })
      porRol.set(f.roleid, lista)
    }
  }
  for (const [rol, privilegios] of porRol) {
    const r = peticion(`roles(${rol})?$select=name,ismanaged`)
    // los roles gestionados (de Microsoft o de otras soluciones) no se pueden cambiar; los administradores ya lo tienen todo
    if (r.ismanaged || /administrador del sistema|system administrator|personalizador|system customizer/i.test(r.name)) continue
    const anadir = []
    for (const tabla of nuevas) {
      for (const { verbo: v, profundidad } of privilegios) {
        const nombre = `prv${v}${tabla}`
        const p = peticion(`privileges?$select=privilegeid&$filter=name%20eq%20%27${nombre}%27`)?.value?.[0]
        if (p) anadir.push({ PrivilegeId: p.privilegeid, Depth: profundidad })
      }
    }
    if (!anadir.length) continue
    faltan.push(`privilegios del rol «${r.name}» (${anadir.length})`)
    if (SIMULAR) continue
    try {
      peticion(`roles(${rol})/Microsoft.Dynamics.CRM.AddPrivilegesRole`, {
        metodo: 'POST',
        cuerpo: { Privileges: anadir.map(x => ({ '@odata.type': 'Microsoft.Dynamics.CRM.RolePrivilege', PrivilegeId: x.PrivilegeId, Depth: x.Depth })) },
      })
      log(`+ privilegios del rol «${r.name}» sobre ${nuevas.length} tablas`)
    } catch (e) {
      log(`! no se pudieron dar privilegios al rol «${r.name}»: ${e.message.slice(0, 200)}`)
    }
  }
}

try {
  log(`Solución: ${SOLUCION}${ENTORNO ? ` · entorno ${ENTORNO}` : ''}${SIMULAR ? ' · SIMULACIÓN' : ''}`)
  const sol = peticion(`solutions?$filter=uniquename%20eq%20%27${SOLUCION}%27`)
  if (!sol?.value?.length) throw new Error(`No existe la solución ${SOLUCION} en el entorno`)

  for (const t of TABLAS) asegurarTabla(t)
  const tablasFaltan = faltan.length > 0
  if (!SIMULAR || !tablasFaltan) {
    for (const t of TABLAS) for (const c of t.columnas) asegurarColumna(t.esquema, c)
    for (const b of BUSQUEDAS) asegurarBusqueda(b)
  }
  for (const x of COLUMNAS_EXTRA) for (const c of x.columnas) asegurarColumna(x.esquema, c)
  for (const o of OPCIONES_EXTRA) asegurarOpciones(o)

  if (!SIMULAR) {
    for (const t of TABLAS) {
      const meta = peticion(`EntityDefinitions(LogicalName='${t.esquema.toLowerCase()}')?$select=MetadataId`)
      peticion('AddSolutionComponent', {
        metodo: 'POST',
        cuerpo: { ComponentId: meta.MetadataId, ComponentType: 1, SolutionUniqueName: SOLUCION, AddRequiredComponents: false, DoNotIncludeSubcomponents: false },
      })
    }
    const entidades = [...TABLAS.map(t => t.esquema), ...COLUMNAS_EXTRA.map(x => x.esquema), ...OPCIONES_EXTRA.map(o => o[0])]
      .map(e => e.toLowerCase()).filter((e, i, a) => a.indexOf(e) === i).map(e => `<entity>${e}</entity>`).join('')
    peticion('PublishXml', { metodo: 'POST', cuerpo: { ParameterXml: `<importexportxml><entities>${entidades}</entities></importexportxml>` } })
    log('Personalizaciones publicadas.')
  }
  if (!SIMULAR || !tablasFaltan) copiarPrivilegios(TABLAS.map(t => t.esquema.toLowerCase()))
  log(faltan.length ? `${SIMULAR ? 'Faltan' : 'Creados'}: ${faltan.length} elementos.` : 'Todo estaba ya creado.')
  if (SIMULAR) for (const f of faltan) log(`  · ${f}`)
} catch (e) {
  console.error('\nERROR:', e.message)
  process.exitCode = 1
} finally {
  rmSync(temporal, { recursive: true, force: true })
}
