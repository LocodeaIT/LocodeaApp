#!/usr/bin/env node
/**
 * Columnas nuevas de la tabla loc_contenido (apartado Contenido), dentro de la
 * solución LocodeaObjetivos:
 *   - loc_valoracion   (opciones)  Favorita · Me gusta · No me convence · Descartada  (vacía = sin valorar)
 *   - loc_formato      (opciones)  Post · Carrusel · Vídeo corto · Vídeo largo · Directo · Webinar · Newsletter
 *   - loc_serie        (texto)     serie o bloque al que pertenece la idea
 *   - loc_tecnologias  (texto)     tecnologías con las que se hace, separadas por comas
 *   - loc_origen       (texto)     desarrollo de la carpeta en el que se basa
 *
 * Es idempotente: comprueba cada columna antes de crearla.
 * Se autentica con la sesión de Azure CLI (az login con la cuenta de locodea.).
 *
 * Uso (desde esta carpeta):
 *   node contenido-esquema.mjs                 # entorno Locodea PROD
 *   node contenido-esquema.mjs --simular       # solo lista lo que falta
 *   node contenido-esquema.mjs --entorno https://orgXXXX.crm17.dynamics.com
 *
 * Los valores de las opciones (4120000xx / 4120001xx) deben coincidir con app/src/data/dataverse.ts.
 */
import { execFileSync } from 'node:child_process'

const args = process.argv.slice(2)
const opcion = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined }
const SIMULAR = args.includes('--simular')
const ENTORNO = (opcion('--entorno') ?? 'https://org1d0382e8.crm17.dynamics.com').replace(/\/$/, '')
const SOLUCION = opcion('--solucion') ?? 'LocodeaObjetivos'
const IDIOMA = 3082
const API = `${ENTORNO}/api/data/v9.2/`

// ─────────────────────────────────────────────── acceso a la API con el token de Azure CLI

const token = execFileSync(process.platform === 'win32' ? 'az.cmd' : 'az',
  ['account', 'get-access-token', '--resource', ENTORNO, '--query', 'accessToken', '-o', 'tsv'],
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

// ─────────────────────────────────────────────── piezas de metadatos (como gestion-esquema.mjs)

const etiqueta = texto => ({
  '@odata.type': 'Microsoft.Dynamics.CRM.Label',
  LocalizedLabels: [{ '@odata.type': 'Microsoft.Dynamics.CRM.LocalizedLabel', Label: texto, LanguageCode: IDIOMA }],
})
const nivel = () => ({ Value: 'None', CanBeChanged: true, ManagedPropertyLogicalName: 'canmodifyrequirementlevelsettings' })
const texto = (esquema, nombre, max = 200) => ({
  '@odata.type': 'Microsoft.Dynamics.CRM.StringAttributeMetadata', SchemaName: esquema, DisplayName: etiqueta(nombre),
  RequiredLevel: nivel(), MaxLength: max, FormatName: { Value: 'Text' },
})
const opciones = (esquema, nombre, valores) => ({
  '@odata.type': 'Microsoft.Dynamics.CRM.PicklistAttributeMetadata', SchemaName: esquema, DisplayName: etiqueta(nombre),
  RequiredLevel: nivel(),
  OptionSet: {
    '@odata.type': 'Microsoft.Dynamics.CRM.OptionSetMetadata', IsGlobal: false, OptionSetType: 'Picklist',
    Options: valores.map(([Value, l]) => ({ Value, Label: etiqueta(l) })),
  },
})

// ─────────────────────────────────────────────── columnas

const COLUMNAS = [
  opciones('loc_Valoracion', 'Valoración', [[412000090, 'Favorita'], [412000091, 'Me gusta'], [412000092, 'No me convence'], [412000093, 'Descartada']]),
  opciones('loc_Formato', 'Formato', [
    [412000100, 'Post'], [412000101, 'Carrusel'], [412000102, 'Vídeo corto'], [412000103, 'Vídeo largo'],
    [412000104, 'Directo'], [412000105, 'Webinar'], [412000106, 'Newsletter'],
  ]),
  texto('loc_Serie', 'Serie', 150),
  texto('loc_Tecnologias', 'Tecnologías', 400),
  texto('loc_Origen', 'Desarrollo en el que se basa', 200),
]

// ─────────────────────────────────────────────── ejecución

const log = (...m) => console.log(...m)
const faltan = []

try {
  log(`Entorno ${ENTORNO} · solución ${SOLUCION}${SIMULAR ? ' · SIMULACIÓN' : ''}`)
  const sol = await peticion(`solutions?$filter=uniquename eq '${SOLUCION}'&$select=solutionid`)
  if (!sol?.value?.length) throw new Error(`No existe la solución ${SOLUCION} en el entorno`)

  for (const c of COLUMNAS) {
    const col = c.SchemaName.toLowerCase()
    if (await existe(`EntityDefinitions(LogicalName='loc_contenido')/Attributes(LogicalName='${col}')?$select=LogicalName`)) { log(`= ${col}`); continue }
    faltan.push(col)
    if (SIMULAR) continue
    await peticion(`EntityDefinitions(LogicalName='loc_contenido')/Attributes`, { metodo: 'POST', cabeceras: enSolucion, cuerpo: c })
    log(`+ ${col}`)
  }

  if (!SIMULAR && faltan.length) {
    await peticion('PublishXml', { metodo: 'POST', cuerpo: { ParameterXml: '<importexportxml><entities><entity>loc_contenido</entity></entities></importexportxml>' } })
    log('Personalizaciones publicadas.')
  }
  log(faltan.length ? `${SIMULAR ? 'Faltan' : 'Creadas'}: ${faltan.join(', ')}` : 'Todo estaba ya creado.')
} catch (e) {
  console.error('\nERROR:', e.message)
  process.exitCode = 1
}
