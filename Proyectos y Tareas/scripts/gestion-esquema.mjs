#!/usr/bin/env node
/**
 * Esquema del módulo Gestión en Dataverse, dentro de la solución LocodeaObjetivos:
 *   - tablas nuevas loc_gasto (gastos con ticket) y loc_documento (documentos con caducidad);
 *   - columnas nuevas en tablas del CRM: cobro/pago parcial en las facturas y régimen de IVA en la cuenta.
 *
 * Es idempotente, como crm-esquema.mjs: comprueba cada pieza antes de crearla.
 *
 * Uso (desde esta carpeta):
 *   node gestion-esquema.mjs                      # entorno del perfil activo del CLI de Dataverse
 *   node gestion-esquema.mjs --simular            # solo lista lo que falta
 *   node gestion-esquema.mjs --entorno https://orgXXXX.crm17.dynamics.com
 *
 * Los valores de las opciones (4120004xx) deben coincidir con app/src/gestion/dataverse.ts
 * y app/src/crm/dataverse.ts.
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
const IDIOMA = 3082
const API = 'api/data/v9.2/'

// ─────────────────────────────────────────────── acceso a la API (igual que crm-esquema.mjs)

const temporal = mkdtempSync(join(tmpdir(), 'gestion-esquema-'))
let n = 0

class ErrorHttp extends Error {
  constructor(mensaje, estado) { super(mensaje); this.estado = estado }
}

function peticion(ruta, { metodo = 'GET', cuerpo, cabeceras = [] } = {}) {
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
/** Texto largo. El máximo de Dataverse (1 048 576) sirve para guardar una foto pequeña en base64. */
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
  categoria: [
    [412000400, 'Viajes y transporte'], [412000401, 'Dietas y comidas'], [412000402, 'Software y licencias'], [412000403, 'Hosting e infraestructura'],
    [412000404, 'Material y equipos'], [412000405, 'Formación'], [412000406, 'Marketing'], [412000407, 'Asesoría y gestoría'],
    [412000408, 'Telefonía e internet'], [412000409, 'Suministros y oficina'], [412000410, 'Otros'],
  ],
  estadoGasto: [[412000415, 'Pendiente de pago'], [412000416, 'Pagado'], [412000417, 'Pendiente de reembolso'], [412000418, 'Reembolsado']],
  metodoGasto: [[412000420, 'Tarjeta'], [412000421, 'Transferencia'], [412000422, 'Domiciliación'], [412000423, 'Efectivo']],
  tipoDocumento: [
    [412000430, 'Contrato'], [412000431, 'NDA / confidencialidad'], [412000432, 'Mandato SEPA'], [412000433, 'Certificado digital'],
    [412000434, 'Escritura'], [412000435, 'CIF / NIF'], [412000436, 'LOPD / RGPD'], [412000437, 'Poder'], [412000438, 'Otro'],
  ],
  regimenIva: [[412000440, 'General'], [412000441, 'Intracomunitario'], [412000442, 'Exento'], [412000443, 'Recargo de equivalencia'], [412000444, 'Extracomunitario']],
}

// ─────────────────────────────────────────────── tablas nuevas

const TABLAS = [
  {
    esquema: 'loc_Gasto', nombre: 'Gasto', plural: 'Gastos', descripcion: 'Gestión: gastos con ticket, categoría y estado de pago',
    primaria: texto('loc_Concepto', 'Concepto', 300, true),
    columnas: [
      texto('loc_Numero', 'Número', 20), dia('loc_Fecha', 'Fecha'),
      decimal('loc_Base', 'Base imponible'), decimal('loc_Iva', 'IVA %'), decimal('loc_Irpf', 'IRPF %'), decimal('loc_Total', 'Total'),
      opciones('loc_Categoria', 'Categoría', O.categoria), opciones('loc_Estado', 'Estado', O.estadoGasto), opciones('loc_MetodoPago', 'Método de pago', O.metodoGasto),
      sino('loc_Recurrente', 'Gasto fijo mensual', false), entero('loc_DiaCargo', 'Día de cargo'), sino('loc_Deducible', 'Deducible', true),
      texto('loc_NoFactura', 'Nº de factura del proveedor', 100), texto('loc_Enlace', 'Enlace al documento', 500),
      memo('loc_Foto', 'Foto del ticket', 1048576), memo('loc_Notas', 'Notas'),
    ],
  },
  {
    esquema: 'loc_Documento', nombre: 'Documento', plural: 'Documentos', descripcion: 'Gestión: contratos, mandatos, certificados… con fecha de caducidad',
    primaria: texto('loc_Nombre', 'Nombre', 300, true),
    columnas: [
      opciones('loc_Tipo', 'Tipo', O.tipoDocumento), dia('loc_Caduca', 'Caduca el'), entero('loc_AvisoDias', 'Avisar con (días)'),
      texto('loc_Enlace', 'Enlace al archivo', 500), sino('loc_Firmado', 'Firmado', false), dia('loc_FirmadoEl', 'Firmado el'), memo('loc_Notas', 'Notas'),
    ],
  },
]

/** Columnas que se añaden a tablas del CRM ya existentes. */
const COLUMNAS_EXTRA = [
  { esquema: 'loc_FacturaVenta', columnas: [decimal('loc_ImporteCobrado', 'Importe cobrado')] },
  { esquema: 'loc_FacturaCompra', columnas: [decimal('loc_ImportePagado', 'Importe pagado')] },
  { esquema: 'loc_Cuenta', columnas: [opciones('loc_RegimenIva', 'Régimen de IVA', O.regimenIva)] },
]

/** [tabla que referencia, columna, tabla referenciada, nombre visible]. Sin borrado en cascada. */
const BUSQUEDAS = [
  ['loc_gasto', 'loc_Proveedor', 'loc_cuenta', 'Proveedor'],
  ['loc_gasto', 'loc_Proyecto', 'loc_proyecto', 'Proyecto'],
  ['loc_gasto', 'loc_Pagador', 'loc_miembro', 'Pagado por'],
  ['loc_gasto', 'loc_FacturaCompra', 'loc_facturacompra', 'Factura de compra'],
  ['loc_documento', 'loc_Cuenta', 'loc_cuenta', 'Cuenta'],
  ['loc_documento', 'loc_Responsable', 'loc_miembro', 'Responsable'],
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

function asegurarColumna(esquemaTabla, c) {
  const ln = esquemaTabla.toLowerCase(), col = c.SchemaName.toLowerCase()
  if (existe(`EntityDefinitions(LogicalName='${ln}')/Attributes(LogicalName='${col}')?$select=LogicalName`)) return
  faltan.push(`columna ${ln}.${col}`)
  if (SIMULAR) return
  peticion(`EntityDefinitions(LogicalName='${ln}')/Attributes`, { metodo: 'POST', cabeceras: enSolucion, cuerpo: c })
  log(`+ columna ${ln}.${col}`)
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

try {
  log(`Solución: ${SOLUCION}${ENTORNO ? ` · entorno ${ENTORNO}` : ''}${SIMULAR ? ' · SIMULACIÓN' : ''}`)
  // sin «&» ni espacios en la ruta: en Windows, si la petición pasa por el shell, los rompe
  const sol = peticion(`solutions?$filter=uniquename%20eq%20%27${SOLUCION}%27`)
  if (!sol?.value?.length) throw new Error(`No existe la solución ${SOLUCION} en el entorno`)

  for (const t of TABLAS) asegurarTabla(t)
  const tablasFaltan = faltan.length > 0
  if (!SIMULAR || !tablasFaltan) {
    for (const t of TABLAS) for (const c of t.columnas) asegurarColumna(t.esquema, c)
    for (const x of COLUMNAS_EXTRA) for (const c of x.columnas) asegurarColumna(x.esquema, c)
    for (const b of BUSQUEDAS) asegurarBusqueda(b)
  }

  if (!SIMULAR) {
    for (const t of TABLAS) {
      const meta = peticion(`EntityDefinitions(LogicalName='${t.esquema.toLowerCase()}')?$select=MetadataId`)
      peticion('AddSolutionComponent', {
        metodo: 'POST',
        cuerpo: { ComponentId: meta.MetadataId, ComponentType: 1, SolutionUniqueName: SOLUCION, AddRequiredComponents: false, DoNotIncludeSubcomponents: false },
      })
    }
    const entidades = [...TABLAS.map(t => t.esquema), ...COLUMNAS_EXTRA.map(x => x.esquema)].map(e => `<entity>${e.toLowerCase()}</entity>`).join('')
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
