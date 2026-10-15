#!/usr/bin/env node
/**
 * Esquema de Propuestas en Dataverse, dentro de la solución LocodeaObjetivos:
 *   - loc_propuesta: apuntes y posibles proyectos de clientes, de la primera
 *     idea hasta que el cliente dice que sí (o que no). Cada fila lleva su
 *     estado, el importe y la probabilidad estimados, la fecha prevista, las
 *     tecnologías y el hilo de apuntes del equipo (JSON en loc_apuntes).
 *     Puede enlazar la cuenta del CRM y, cuando se acepta, el proyecto que nace.
 *   - loc_adjuntopropuesta: archivos e imágenes de cada propuesta, uno por fila,
 *     como data URL en loc_datos (las imágenes se comprimen en el navegador).
 *     Al pasar la propuesta a proyecto, el adjunto queda enlazado también a él.
 *
 * Es idempotente, como boveda-esquema.mjs: comprueba cada pieza antes de crearla.
 * Se autentica con la sesión de Azure CLI en el inquilino de locodea. (ver
 * contenido-esquema.mjs).
 *
 * Uso (desde esta carpeta):
 *   node propuestas-esquema.mjs                      # entorno Locodea PROD
 *   node propuestas-esquema.mjs --simular            # solo lista lo que falta
 *   node propuestas-esquema.mjs --entorno https://orgXXXX.crm17.dynamics.com
 *
 * Después, las tablas se añaden como fuentes de datos de la app (desde app/):
 *   npx pa app add data-source --connector dataverse --table loc_propuesta --non-interactive
 *   npx pa app add data-source --connector dataverse --table loc_adjuntopropuesta --non-interactive
 *
 * Los valores de las opciones (4120006xx) deben coincidir con app/src/propuestas/dataverse.ts.
 */
import { execFileSync } from 'node:child_process'

const args = process.argv.slice(2)
const opcion = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined }
const SIMULAR = args.includes('--simular')
const ENTORNO = (opcion('--entorno') ?? 'https://org1d0382e8.crm17.dynamics.com').replace(/\/$/, '')
const SOLUCION = opcion('--solucion') ?? 'LocodeaObjetivos'
const INQUILINO = opcion('--inquilino') ?? '406c94c5-51ea-41d0-85db-630c9083922e'
const IDIOMA = 3082
const API = `${ENTORNO}/api/data/v9.2/`

// ─────────────────────────────────────────────── acceso a la API con el token de Azure CLI (como contenido-esquema.mjs)

const token = execFileSync(process.platform === 'win32' ? 'az.cmd' : 'az',
  ['account', 'get-access-token', '--subscription', INQUILINO, '--resource', ENTORNO, '--query', 'accessToken', '-o', 'tsv'],
  { encoding: 'utf8', shell: process.platform === 'win32' }).trim()

class ErrorHttp extends Error {
  constructor(mensaje, estado) { super(mensaje); this.estado = estado }
}

async function peticion(ruta, { metodo = 'GET', cuerpo, cabeceras = {} } = {}) {
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
const entero = (esquema, nombre, min = -2147483648, max = 2147483647) => ({
  '@odata.type': 'Microsoft.Dynamics.CRM.IntegerAttributeMetadata', SchemaName: esquema, DisplayName: etiqueta(nombre),
  RequiredLevel: nivel(false), Format: 'None', MinValue: min, MaxValue: max,
})
const decimal = (esquema, nombre) => ({
  '@odata.type': 'Microsoft.Dynamics.CRM.DecimalAttributeMetadata', SchemaName: esquema, DisplayName: etiqueta(nombre),
  RequiredLevel: nivel(false), Precision: 2, MinValue: 0, MaxValue: 100000000000,
})
const fecha = (esquema, nombre) => ({
  '@odata.type': 'Microsoft.Dynamics.CRM.DateTimeAttributeMetadata', SchemaName: esquema, DisplayName: etiqueta(nombre),
  RequiredLevel: nivel(false), Format: 'DateOnly', DateTimeBehavior: { Value: 'DateOnly' },
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
  estado: [
    [412000600, 'Apunte'], [412000601, 'En conversación'], [412000602, 'Planificación'],
    [412000603, 'Propuesta enviada'], [412000604, 'Aceptado'], [412000605, 'Descartado'],
  ],
  prioridad: [[412000610, 'Alta'], [412000611, 'Media'], [412000612, 'Baja']],
}

// ─────────────────────────────────────────────── tabla nueva

const TABLAS = [
  {
    esquema: 'loc_Propuesta', nombre: 'Propuesta', plural: 'Propuestas', descripcion: 'Apuntes y posibles proyectos de clientes, con su estado, del primer apunte al proyecto aceptado',
    primaria: texto('loc_Titulo', 'Título', 200, true),
    columnas: [
      texto('loc_Cliente', 'Cliente', 200), texto('loc_Contacto', 'Contacto', 200),
      opciones('loc_Estado', 'Estado', O.estado), opciones('loc_Prioridad', 'Prioridad', O.prioridad),
      memo('loc_Descripcion', 'Descripción', 8000), memo('loc_Apuntes', 'Apuntes (JSON)', 200000),
      decimal('loc_Importe', 'Importe estimado'), entero('loc_Probabilidad', 'Probabilidad (%)', 0, 100),
      fecha('loc_FechaPrevista', 'Fecha prevista de decisión'), texto('loc_Tecnologias', 'Tecnologías', 400),
      entero('loc_Orden', 'Orden en el tablero'),
    ],
  },
  {
    esquema: 'loc_AdjuntoPropuesta', nombre: 'Adjunto de propuesta', plural: 'Adjuntos de propuesta', descripcion: 'Archivos e imágenes de una propuesta (data URL en loc_datos, hasta 1 MB por archivo)',
    primaria: texto('loc_Nombre', 'Nombre del archivo', 200, true),
    columnas: [texto('loc_Tipo', 'Tipo (MIME)', 100), entero('loc_Tamano', 'Tamaño (bytes)', 0), memo('loc_Datos', 'Datos (data URL)', 1048576)],
  },
]

/** [tabla que referencia, columna, tabla referenciada, nombre visible]. Sin borrado en cascada. */
const BUSQUEDAS = [
  ['loc_propuesta', 'loc_Responsable', 'loc_miembro', 'Responsable'],
  ['loc_propuesta', 'loc_Cuenta', 'loc_cuenta', 'Cuenta del CRM'],
  ['loc_propuesta', 'loc_Proyecto', 'loc_proyecto', 'Proyecto'],
  ['loc_adjuntopropuesta', 'loc_Propuesta', 'loc_propuesta', 'Propuesta'],
  ['loc_adjuntopropuesta', 'loc_Proyecto', 'loc_proyecto', 'Proyecto'],
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

  if (!SIMULAR) {
    for (const t of TABLAS) {
      const meta = await peticion(`EntityDefinitions(LogicalName='${t.esquema.toLowerCase()}')?$select=MetadataId`)
      await peticion('AddSolutionComponent', {
        metodo: 'POST',
        cuerpo: { ComponentId: meta.MetadataId, ComponentType: 1, SolutionUniqueName: SOLUCION, AddRequiredComponents: false, DoNotIncludeSubcomponents: false },
      })
    }
    const entidades = TABLAS.map(t => `<entity>${t.esquema.toLowerCase()}</entity>`).join('')
    await peticion('PublishXml', { metodo: 'POST', cuerpo: { ParameterXml: `<importexportxml><entities>${entidades}</entities></importexportxml>` } })
    log('Personalizaciones publicadas.')
  }
  log(faltan.length ? `${SIMULAR ? 'Faltan' : 'Creados'}: ${faltan.length} elementos.` : 'Todo estaba ya creado.')
} catch (e) {
  console.error('\nERROR:', e.message)
  process.exitCode = 1
}
