#!/usr/bin/env node
/**
 * Esquema de la calculadora de precios en Dataverse, dentro de la solución
 * LocodeaObjetivos:
 *   - loc_tarifaprecio: tarifas y coeficientes de la calculadora (JSON en
 *     loc_datos). Cada vez que se guardan se crea una fila nueva con su autor,
 *     así queda el histórico; la app usa la última.
 *   - loc_calculoprecio en loc_oferta y loc_pedidoventa: lo que se eligió en la
 *     calculadora y el precio aplicado (JSON), para reabrirlo y retocarlo.
 *
 * Es idempotente, como propuestas-esquema.mjs: comprueba cada pieza antes de
 * crearla. No borra ni cambia nada que ya exista. Como crm-esquema.mjs, usa el
 * CLI de Dataverse (`npx -y @microsoft/dataverse`, o DATAVERSE_CLI=<ruta a
 * bin/dataverse.js>) con sesión iniciada; con --az, el token de Azure CLI.
 *
 * Uso (desde esta carpeta):
 *   node tarifas-esquema.mjs                      # entorno Locodea PROD
 *   node tarifas-esquema.mjs --simular            # solo lista lo que falta
 *   node tarifas-esquema.mjs --entorno https://orgXXXX.crm17.dynamics.com
 *   node tarifas-esquema.mjs --az                 # con el token de Azure CLI
 *
 * Después, la tabla se añade como fuente de datos de la app (desde app/):
 *   npx pa app add data-source --connector dataverse --table loc_tarifaprecio --non-interactive
 *
 * Hay que pasarlo ANTES de publicar la app con la calculadora: sin la columna
 * loc_calculoprecio falla el guardado de las ofertas y pedidos que la usen.
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const args = process.argv.slice(2)
const opcion = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined }
const SIMULAR = args.includes('--simular')
const CON_AZ = args.includes('--az')
const ENTORNO = (opcion('--entorno') ?? 'https://org1d0382e8.crm17.dynamics.com').replace(/\/$/, '')
const SOLUCION = opcion('--solucion') ?? 'LocodeaObjetivos'
const INQUILINO = opcion('--inquilino') ?? '406c94c5-51ea-41d0-85db-630c9083922e'
const IDIOMA = 3082
const API = `${ENTORNO}/api/data/v9.2/`

// ─────────────────────────────────────────────── acceso a la API: CLI de Dataverse o, con --az, token de Azure CLI

const token = CON_AZ
  ? execFileSync(process.platform === 'win32' ? 'az.cmd' : 'az',
    ['account', 'get-access-token', '--subscription', INQUILINO, '--resource', ENTORNO, '--query', 'accessToken', '-o', 'tsv'],
    { encoding: 'utf8', shell: process.platform === 'win32' }).trim()
  : null

class ErrorHttp extends Error {
  constructor(mensaje, estado) { super(mensaje); this.estado = estado }
}

const temporal = mkdtempSync(join(tmpdir(), 'tarifas-esquema-'))
let n = 0

/** Como en crm-esquema.mjs: `api request` del CLI de Dataverse con -i para leer el estado HTTP. */
function peticionCli(ruta, metodo, cuerpo, cabeceras) {
  const cli = process.env.DATAVERSE_CLI
  const [ejecutable, base] = cli ? ['node', [cli]] : [process.platform === 'win32' ? 'npx.cmd' : 'npx', ['-y', '@microsoft/dataverse']]
  const resto = ['api', 'request', '--target', 'dataverse', '--path', `api/data/v9.2/${ruta}`, '-X', metodo, '-i', '--environment', ENTORNO]
  for (const [k, v] of Object.entries(cabeceras)) resto.push('-H', `${k}:${v}`)
  if (cuerpo !== undefined) {
    const f = join(temporal, `cuerpo-${++n}.json`)
    writeFileSync(f, JSON.stringify(cuerpo))
    resto.push('--body-file', f)
  }
  let salida
  try {
    salida = execFileSync(ejecutable, [...base, ...resto], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32' && !cli, maxBuffer: 64 * 1024 * 1024 })
  } catch (e) {
    salida = `${e.stdout ?? ''}${e.stderr ?? ''}`
  }
  const estado = Number(salida.match(/^HTTP\/[\d.]+ (\d{3})/m)?.[1] ?? 0)
  const corte = salida.search(/\r?\n\r?\n/)
  const texto = corte >= 0 ? salida.slice(corte).trim() : ''
  if (estado < 200 || estado >= 300) throw new ErrorHttp(`${metodo} ${ruta} → ${estado || '?'} ${texto || salida.trim()}`, estado)
  return texto ? JSON.parse(texto) : null
}

async function peticion(ruta, { metodo = 'GET', cuerpo, cabeceras = {} } = {}) {
  if (!CON_AZ) return peticionCli(ruta, metodo, cuerpo, cabeceras)
  const r = await fetch(API + ruta, {
    method: metodo,
    headers: {
      Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json; charset=utf-8',
      'OData-MaxVersion': '4.0', 'OData-Version': '4.0', ...cabeceras,
    },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  })
  const texto = await r.text()
  if (!r.ok) throw new ErrorHttp(`${metodo} ${ruta} → ${r.status} ${texto}`, r.status)
  return texto ? JSON.parse(texto) : null
}

async function existe(ruta) {
  try { return await peticion(ruta) } catch (e) { if (e.estado === 404) return null; throw e }
}

const enSolucion = { 'MSCRM.SolutionUniqueName': SOLUCION }

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

// ─────────────────────────────────────────────── tabla nueva

const TABLAS = [
  {
    esquema: 'loc_TarifaPrecio', nombre: 'Tarifa de precios', plural: 'Tarifas de precios',
    descripcion: 'Tarifas y coeficientes de la calculadora de precios (JSON). Una fila por versión; la app usa la última',
    primaria: texto('loc_Nombre', 'Nombre', 200, true),
    columnas: [memo('loc_Datos', 'Tarifas (JSON)', 100000)],
  },
]

/** Columnas nuevas en tablas que ya existen. */
const COLUMNAS_EXISTENTES = [
  ['loc_Oferta', memo('loc_CalculoPrecio', 'Cálculo de precio (JSON)', 20000)],
  ['loc_PedidoVenta', memo('loc_CalculoPrecio', 'Cálculo de precio (JSON)', 20000)],
]

/** [tabla que referencia, columna, tabla referenciada, nombre visible]. Sin borrado en cascada. */
const BUSQUEDAS = [
  ['loc_tarifaprecio', 'loc_Autor', 'loc_miembro', 'Autor'],
]

// ─────────────────────────────────────────────── ejecución

const log = (...m) => console.log(...m)
const faltan = []

async function asegurarTabla(t) {
  const ln = t.esquema.toLowerCase()
  if (await existe(`EntityDefinitions(LogicalName='${ln}')?$select=LogicalName`)) { log(`= tabla ${ln}`); return }
  faltan.push(`tabla ${ln}`)
  if (SIMULAR) return
  await peticion('EntityDefinitions', {
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

async function asegurarColumna(esquemaTabla, c) {
  const ln = esquemaTabla.toLowerCase(), col = c.SchemaName.toLowerCase()
  if (await existe(`EntityDefinitions(LogicalName='${ln}')/Attributes(LogicalName='${col}')?$select=LogicalName`)) return
  faltan.push(`columna ${ln}.${col}`)
  if (SIMULAR) return
  await peticion(`EntityDefinitions(LogicalName='${ln}')/Attributes`, { metodo: 'POST', cabeceras: enSolucion, cuerpo: c })
  log(`+ columna ${ln}.${col}`)
}

async function asegurarBusqueda([origen, esquema, destino, nombre]) {
  const relacion = `${destino}_${origen.replace(/^loc_/, '')}_${esquema.replace(/^loc_/, '').toLowerCase()}`
  if (await existe(`RelationshipDefinitions(SchemaName='${relacion}')`)) return
  faltan.push(`relación ${relacion}`)
  if (SIMULAR) return
  await peticion('RelationshipDefinitions', {
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
  const sol = await peticion(`solutions?$filter=uniquename%20eq%20%27${SOLUCION}%27`)
  if (!sol?.value?.length) throw new Error(`No existe la solución ${SOLUCION} en el entorno`)

  for (const t of TABLAS) await asegurarTabla(t)
  const tablasFaltan = faltan.length > 0
  if (!SIMULAR || !tablasFaltan) {
    for (const t of TABLAS) for (const c of t.columnas) await asegurarColumna(t.esquema, c)
    for (const b of BUSQUEDAS) await asegurarBusqueda(b)
  }
  for (const [tabla, c] of COLUMNAS_EXISTENTES) await asegurarColumna(tabla, c)

  if (!SIMULAR) {
    for (const t of TABLAS) {
      const meta = await peticion(`EntityDefinitions(LogicalName='${t.esquema.toLowerCase()}')?$select=MetadataId`)
      await peticion('AddSolutionComponent', {
        metodo: 'POST',
        cuerpo: { ComponentId: meta.MetadataId, ComponentType: 1, SolutionUniqueName: SOLUCION, AddRequiredComponents: false, DoNotIncludeSubcomponents: false },
      })
    }
    const entidades = [...TABLAS.map(t => t.esquema), ...COLUMNAS_EXISTENTES.map(([t]) => t)]
      .map(e => `<entity>${e.toLowerCase()}</entity>`).join('')
    await peticion('PublishXml', { metodo: 'POST', cuerpo: { ParameterXml: `<importexportxml><entities>${entidades}</entities></importexportxml>` } })
    log('Personalizaciones publicadas.')
  }
  log(faltan.length ? `${SIMULAR ? 'Faltan' : 'Creados'}: ${faltan.length} elementos.` : 'Todo estaba ya creado.')
} catch (e) {
  console.error('\nERROR:', e.message)
  process.exitCode = 1
}
