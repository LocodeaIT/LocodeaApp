#!/usr/bin/env node
/**
 * Carga el banco de ideas de contenido (contenido-ideas.datos.mjs) en la tabla
 * loc_contenido de Dataverse y genera su documento en
 * «04 - Marketing/Contenidos/Banco de ideas de contenido.md».
 *
 * Necesita las columnas de contenido-esquema.mjs. Se autentica con Azure CLI.
 *
 * Uso (desde esta carpeta):
 *   node contenido-ideas.mjs               # inserta las que falten (por título) y guarda los ids
 *   node contenido-ideas.mjs --simular     # solo lista lo que insertaría
 *   node contenido-ideas.mjs --doc         # solo regenera el documento
 *   node contenido-ideas.mjs --borrar      # borra exactamente lo que insertó (contenido-ideas.ids.json)
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { IDEAS, REF, SERIES } from './contenido-ideas.datos.mjs'

const AQUI = dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const opcion = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined }
const SIMULAR = args.includes('--simular')
const BORRAR = args.includes('--borrar')
const SOLO_DOC = args.includes('--doc')
const ENTORNO = (opcion('--entorno') ?? 'https://org1d0382e8.crm17.dynamics.com').replace(/\/$/, '')
const API = `${ENTORNO}/api/data/v9.2/`
const ARCHIVO_IDS = join(AQUI, 'contenido-ideas.ids.json')
const DOC = resolve(AQUI, '../../../../../04 - Marketing/Contenidos/Banco de ideas de contenido.md')

// ─────────────────────────────────────────────── valores (iguales que app/src/data/dataverse.ts)

const CANAL = { youtube: 412000070, linkedin: 412000071, instagram: 412000072, tiktok: 412000073, blog: 412000074, newsletter: 412000075, x: 412000076 }
const FORMATO = { post: 412000100, carrusel: 412000101, corto: 412000102, largo: 412000103, directo: 412000104, webinar: 412000105, newsletter: 412000106 }
const ETQ_FORMATO = { post: 'Post', carrusel: 'Carrusel', corto: 'Vídeo corto', largo: 'Vídeo largo', directo: 'Directo', webinar: 'Webinar', newsletter: 'Newsletter' }
const ETQ_CANAL = { youtube: 'YouTube', linkedin: 'LinkedIn', newsletter: 'Newsletter' }
const IDEA = 412000080

/** Miembros y proyectos de Locodea PROD (loc_miembros, loc_proyectos). */
const MIEMBRO = { jesus: '16d697f2-11b4-f111-aaab-70a8a5068d0e', alejandro: '17d697f2-11b4-f111-aaab-70a8a5068d0e' }
const NOMBRE = { jesus: 'Jesús', alejandro: 'Alejandro' }
const PROYECTO = {
  codeapps: '30ceab75-6eb7-f111-aaae-70a8a5068d0e',
  powerbi: '5a92d7de-6eb7-f111-aaae-70a8a5068d0e',
  powerpages: 'd208cc33-70b7-f111-aaae-70a8a5068d0e',
}

// ─────────────────────────────────────────────── notas de cada idea

function notas(i) {
  const x = REF[i.x] ?? i.x
  return [
    `GANCHO: ${i.g}`,
    '',
    `QUÉ SE ENSEÑA: ${i.e}`,
    '',
    'ESTRUCTURA:',
    ...i.est.map((p, n) => `${n + 1}. ${p}`),
    '',
    `FORMATO Y DURACIÓN: ${i.d}`,
    `TECNOLOGÍA: ${i.tec}`,
    `SE BASA EN: ${i.o}`,
    '',
    `POR QUÉ PUEDE FUNCIONAR: ${x}.`,
    `QUÉ HAY QUE PREPARAR: ${i.pre}`,
  ].join('\n')
}

// ─────────────────────────────────────────────── documento

function documento() {
  const hoy = new Date().toISOString().slice(0, 10)
  const out = [
    '# Banco de ideas de contenido de locodea.',
    '',
    `Generado el ${hoy} con \`scripts/contenido-ideas.mjs\` de la app interna. Las mismas ${IDEAS.length} ideas están en la app (apartado Contenido → Banco de ideas), donde se valoran con la estrella, «me gusta», «no me convence» o «descartada».`,
    '',
    `Solo para Jesús (${IDEAS.filter(i => i.r === 'jesus').length}) y Alejandro (${IDEAS.filter(i => i.r === 'alejandro').length}). Cada idea sale de un desarrollo de la carpeta (Code Apps, Power Pages, Power BI) o de un flujo o agente que tiene sentido construir encima, y se apoya en lo que tiene tirada ahora en YouTube y LinkedIn (cifras vistas el 27–28 de septiembre de 2026).`,
    '',
    '| Serie | Ideas | De qué va |',
    '|---|---|---|',
    ...SERIES.map(([s, d]) => `| ${s} | ${IDEAS.filter(i => i.s === s).length} | ${d} |`),
    '',
  ]
  for (const [s, d] of SERIES) {
    out.push(`## ${s}`, '', d, '')
    for (const i of IDEAS.filter(x => x.s === s)) {
      out.push(`### ${i.t}`, '',
        `**${NOMBRE[i.r]}** · ${ETQ_CANAL[i.c] ?? i.c} · ${ETQ_FORMATO[i.f]} · ${i.tec}`, '',
        `- **Gancho:** ${i.g}`,
        `- **Qué se enseña:** ${i.e}`,
        `- **Estructura:** ${i.est.join(' → ')}`,
        `- **Formato y duración:** ${i.d}`,
        `- **Se basa en:** ${i.o}`,
        `- **Por qué puede funcionar:** ${REF[i.x] ?? i.x}.`,
        `- **Qué hay que preparar:** ${i.pre}`, '')
    }
  }
  writeFileSync(DOC, out.join('\n'), 'utf8')
  console.log('Documento:', DOC)
}

// ─────────────────────────────────────────────── API

function token() {
  return execFileSync(process.platform === 'win32' ? 'az.cmd' : 'az',
    ['account', 'get-access-token', '--resource', ENTORNO, '--query', 'accessToken', '-o', 'tsv'],
    { encoding: 'utf8', shell: process.platform === 'win32' }).trim()
}
let TOKEN = null
async function peticion(ruta, { metodo = 'GET', cuerpo, cabeceras = {} } = {}) {
  TOKEN ??= token()
  const r = await fetch(API + ruta, {
    method: metodo,
    headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/json', 'Content-Type': 'application/json; charset=utf-8', 'OData-Version': '4.0', ...cabeceras },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  })
  const t = await r.text()
  if (!r.ok) throw new Error(`${metodo} ${ruta} → ${r.status} ${t}`)
  return { datos: t ? JSON.parse(t) : null, cabeceras: r.headers }
}

const fila = i => ({
  loc_titulo: i.t,
  loc_canal: CANAL[i.c],
  loc_estado: IDEA,
  loc_formato: FORMATO[i.f],
  loc_serie: i.s,
  loc_tecnologias: i.tec === '—' ? '' : i.tec,
  loc_origen: i.o === '—' ? '' : i.o,
  loc_notas: notas(i),
  statecode: 0,
  'loc_Responsable@odata.bind': `/loc_miembros(${MIEMBRO[i.r]})`,
  ...(i.p ? { 'loc_Proyecto@odata.bind': `/loc_proyectos(${PROYECTO[i.p]})` } : {}),
})

// ─────────────────────────────────────────────── ejecución

try {
  if (SOLO_DOC) { documento(); process.exit(0) }

  if (BORRAR) {
    const ids = existsSync(ARCHIVO_IDS) ? JSON.parse(readFileSync(ARCHIVO_IDS, 'utf8')) : []
    for (const id of ids) {
      if (!SIMULAR) await peticion(`loc_contenidos(${id})`, { metodo: 'DELETE' })
    }
    if (!SIMULAR) writeFileSync(ARCHIVO_IDS, '[]')
    console.log(`${SIMULAR ? 'Borraría' : 'Borradas'} ${ids.length} ideas.`)
    process.exit(0)
  }

  const { datos } = await peticion('loc_contenidos?$select=loc_titulo&$top=5000')
  const existentes = new Set(datos.value.map(x => x.loc_titulo.trim().toLowerCase()))
  const nuevas = IDEAS.filter(i => !existentes.has(i.t.trim().toLowerCase()))
  console.log(`${IDEAS.length} ideas en el banco · ${IDEAS.length - nuevas.length} ya estaban · ${nuevas.length} nuevas${SIMULAR ? ' (simulación)' : ''}`)

  const ids = existsSync(ARCHIVO_IDS) ? JSON.parse(readFileSync(ARCHIVO_IDS, 'utf8')) : []
  for (const i of nuevas) {
    if (SIMULAR) { console.log(`  + [${i.s}] ${i.t}`); continue }
    const { cabeceras } = await peticion('loc_contenidos', { metodo: 'POST', cuerpo: fila(i) })
    const id = cabeceras.get('OData-EntityId')?.match(/\(([0-9a-f-]{36})\)/)?.[1]
    if (id) ids.push(id)
    process.stdout.write('.')
  }
  if (!SIMULAR) {
    writeFileSync(ARCHIVO_IDS, JSON.stringify(ids, null, 2))
    console.log(`\nInsertadas ${nuevas.length}. Ids en ${ARCHIVO_IDS}`)
  }
  documento()
} catch (e) {
  console.error('\nERROR:', e.message)
  process.exitCode = 1
}
