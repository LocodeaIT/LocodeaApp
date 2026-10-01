#!/usr/bin/env node
/**
 * Esquema de la Bóveda en Dataverse, dentro de la solución LocodeaObjetivos:
 *   - loc_boveda: una fila por bóveda (la del equipo y una personal por miembro)
 *     con la sal, las iteraciones y la clave de la bóveda ENVUELTA. Nada de eso
 *     sirve sin la contraseña maestra, que no se guarda en ningún sitio.
 *   - loc_secreto: cada elemento (contraseña, clave API, nota), CIFRADO entero
 *     en el navegador con AES-256-GCM. La columna loc_datos es texto ilegible.
 *
 * Es idempotente, como gestion-esquema.mjs: comprueba cada pieza antes de crearla.
 *
 * Uso (desde esta carpeta):
 *   node boveda-esquema.mjs                      # entorno del perfil activo del CLI de Dataverse
 *   node boveda-esquema.mjs --simular            # solo lista lo que falta
 *   node boveda-esquema.mjs --entorno https://orgXXXX.crm17.dynamics.com
 *
 * Los valores de las opciones (4120005xx) deben coincidir con app/src/boveda/dataverse.ts.
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

// ─────────────────────────────────────────────── acceso a la API (igual que gestion-esquema.mjs)

const temporal = mkdtempSync(join(tmpdir(), 'boveda-esquema-'))
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
const memo = (esquema, nombre, max = 8000) => ({
  '@odata.type': 'Microsoft.Dynamics.CRM.MemoAttributeMetadata', SchemaName: esquema, DisplayName: etiqueta(nombre),
  RequiredLevel: nivel(false), MaxLength: max, Format: 'TextArea',
})
const entero = (esquema, nombre) => ({
  '@odata.type': 'Microsoft.Dynamics.CRM.IntegerAttributeMetadata', SchemaName: esquema, DisplayName: etiqueta(nombre),
  RequiredLevel: nivel(false), Format: 'None', MinValue: -2147483648, MaxValue: 2147483647,
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
  tipoBoveda: [[412000500, 'Equipo'], [412000501, 'Personal']],
}

// ─────────────────────────────────────────────── tablas nuevas

const TABLAS = [
  {
    esquema: 'loc_Boveda', nombre: 'Bóveda', plural: 'Bóvedas', descripcion: 'Bóveda: sal y clave envuelta de cada bóveda cifrada (sin la contraseña maestra no sirven de nada)',
    primaria: texto('loc_Nombre', 'Nombre', 200, true),
    columnas: [
      opciones('loc_Tipo', 'Tipo', O.tipoBoveda), texto('loc_Sal', 'Sal (base64)', 100), entero('loc_Iteraciones', 'Iteraciones PBKDF2'),
      texto('loc_ClaveEnvuelta', 'Clave envuelta (base64)', 500), texto('loc_Algoritmo', 'Algoritmo', 100),
    ],
  },
  {
    esquema: 'loc_Secreto', nombre: 'Secreto', plural: 'Secretos', descripcion: 'Bóveda: contraseñas, claves API y notas, cifradas en el navegador con AES-256-GCM',
    primaria: texto('loc_Referencia', 'Referencia', 100, true),
    columnas: [memo('loc_Datos', 'Datos cifrados', 1048576)],
  },
]

/** [tabla que referencia, columna, tabla referenciada, nombre visible]. Sin borrado en cascada. */
const BUSQUEDAS = [
  ['loc_boveda', 'loc_Propietario', 'loc_miembro', 'Propietario'],
  ['loc_secreto', 'loc_Boveda', 'loc_boveda', 'Bóveda'],
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
