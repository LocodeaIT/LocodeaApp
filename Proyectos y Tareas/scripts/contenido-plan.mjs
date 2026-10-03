#!/usr/bin/env node
/**
 * Carga el plan de trabajo de contenido (lo que sí vamos a hacer, 3-10-2026) en
 * la tabla loc_contenido de Dataverse, con su perfil (dónde sale), sus canales
 * (L = LinkedIn, Y = YouTube) y quién lo hace.
 *
 * Tres piezas ya existían en el banco de ideas con su guion: en vez de
 * duplicarlas, se pasan al plan con el título corto del plan, y el título del
 * banco queda al principio de las notas.
 *
 * Necesita las columnas de contenido-esquema.mjs. Se autentica con Azure CLI en
 * el inquilino de locodea. (az login --tenant 406c94c5-51ea-41d0-85db-630c9083922e --allow-no-subscriptions).
 *
 * Uso (desde esta carpeta):
 *   node contenido-plan.mjs              # crea o pasa al plan lo que falte (por título y perfil)
 *   node contenido-plan.mjs --simular    # solo lista lo que haría
 *   node contenido-plan.mjs --borrar     # deshace exactamente lo que hizo (contenido-plan.ids.json)
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const AQUI = dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const opcion = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined }
const SIMULAR = args.includes('--simular')
const BORRAR = args.includes('--borrar')
const ENTORNO = (opcion('--entorno') ?? 'https://org1d0382e8.crm17.dynamics.com').replace(/\/$/, '')
const INQUILINO = opcion('--inquilino') ?? '406c94c5-51ea-41d0-85db-630c9083922e'
const API = `${ENTORNO}/api/data/v9.2/`
const ARCHIVO_IDS = join(AQUI, 'contenido-plan.ids.json')

// ─────────────────────────────────────────────── valores (iguales que app/src/data/dataverse.ts)

const CANAL = { youtube: 412000070, linkedin: 412000071 }
const FORMATO = { post: 412000100, corto: 412000102, largo: 412000103 }
const IDEA = 412000080
const PERFIL_LOCODEA = 'locodea'

// ─────────────────────────────────────────────── el plan

const L = 'linkedin', Y = 'youtube'
/** t título · p perfil (locodea, jesus, alejandro) · c canales · a quién lo hace · f formato · banco: idea que ya existía */
const PLAN = [
  { t: 'Vídeo de presentación', p: 'locodea', c: [L], a: [], f: 'corto' },
  { t: 'Post de la página web', p: 'locodea', c: [L], a: [], f: 'post' },
  { t: 'Post sobre Power Pages', p: 'locodea', c: [L], a: [], f: 'post' },
  { t: 'Post sobre Power Apps', p: 'locodea', c: [L], a: [], f: 'post' },
  { t: 'Post sobre Power BI', p: 'locodea', c: [L], a: [], f: 'post' },
  { t: 'Post sobre Power Automate', p: 'locodea', c: [L], a: [], f: 'post' },
  { t: 'Post sobre Copilot Studio', p: 'locodea', c: [L], a: [], f: 'post' },
  { t: 'Post sobre Claudea', p: 'locodea', c: [L], a: [], f: 'post' },

  { t: 'Vídeo de presentación', p: 'jesus', c: [L, Y], a: ['jesus'] },
  { t: 'Almacén 3D de Power BI', p: 'jesus', c: [L], a: ['jesus'] },
  { t: 'Qué es Power Platform', p: 'jesus', c: [L, Y], a: ['jesus'], f: 'largo' },
  { t: 'Post sobre las inspecciones', p: 'jesus', c: [L], a: ['jesus'], f: 'post' },
  { t: 'Vídeo sobre el DeCA', p: 'jesus', c: [Y], a: ['jesus'], f: 'largo' },
  { t: 'Enseñar Power BI', p: 'jesus', c: [L, Y], a: ['jesus'], f: 'largo' },
  { t: 'Enseñar alguno de los paneles de Power BI', p: 'jesus', c: [L], a: ['jesus'] },

  { t: 'Vídeo de presentación', p: 'alejandro', c: [L, Y], a: ['alejandro'] },
  { t: 'Instrucciones de montaje en 3D', p: 'alejandro', c: [L, Y], a: ['alejandro'], f: 'largo', banco: 'La fábrica en una tablet: instrucciones de montaje en 3D' },
  { t: 'Estás tirando dinero cada mes con Microsoft 365', p: 'alejandro', c: [L, Y], a: ['alejandro'], f: 'largo' },
  { t: 'Seguimiento de pedidos', p: 'alejandro', c: [L], a: ['alejandro'], banco: 'Dónde está mi pedido: seguimiento para una empresa pequeña' },
  { t: 'Enseñar Power Automate', p: 'alejandro', c: [L, Y], a: ['alejandro'], f: 'largo' },
  { t: 'Power Pages frente a una web normal', p: 'alejandro', c: [L], a: ['alejandro'], banco: 'Power Pages o una web normal: cuándo compensa cada una' },
]

// ─────────────────────────────────────────────── API

function token() {
  return execFileSync(process.platform === 'win32' ? 'az.cmd' : 'az',
    ['account', 'get-access-token', '--subscription', INQUILINO, '--resource', ENTORNO, '--query', 'accessToken', '-o', 'tsv'],
    { encoding: 'utf8', shell: process.platform === 'win32' }).trim()
}
let TOKEN = null
async function peticion(ruta, { metodo = 'GET', cuerpo } = {}) {
  TOKEN ??= token()
  const r = await fetch(API + ruta, {
    method: metodo,
    headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/json', 'Content-Type': 'application/json; charset=utf-8', 'OData-Version': '4.0' },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  })
  const t = await r.text()
  if (!r.ok) throw new Error(`${metodo} ${ruta} → ${r.status} ${t}`)
  return { datos: t ? JSON.parse(t) : null, cabeceras: r.headers }
}

const clave = t => t.trim().toLowerCase()

// ─────────────────────────────────────────────── ejecución

try {
  if (BORRAR) {
    const hecho = existsSync(ARCHIVO_IDS) ? JSON.parse(readFileSync(ARCHIVO_IDS, 'utf8')) : { creadas: [], pasadas: [] }
    for (const id of hecho.creadas) if (!SIMULAR) await peticion(`loc_contenidos(${id})`, { metodo: 'DELETE' })
    // Las ideas del banco vuelven a como estaban.
    for (const x of hecho.pasadas) if (!SIMULAR) await peticion(`loc_contenidos(${x.id})`, { metodo: 'PATCH', cuerpo: x.antes })
    if (!SIMULAR) writeFileSync(ARCHIVO_IDS, JSON.stringify({ creadas: [], pasadas: [] }, null, 2))
    console.log(`${SIMULAR ? 'Borraría' : 'Borradas'} ${hecho.creadas.length} y ${SIMULAR ? 'devolvería' : 'devueltas'} ${hecho.pasadas.length} al banco.`)
    process.exit(0)
  }

  // Miembros por nombre: «Jesús Alonso» → jesus.
  const { datos: dm } = await peticion('loc_miembros?$select=loc_nombre')
  const sinTilde = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const MIEMBRO = {}
  for (const m of dm.value) MIEMBRO[sinTilde(m.loc_nombre).split(' ')[0]] = m.loc_miembroid
  for (const n of ['jesus', 'alejandro']) if (!MIEMBRO[n]) throw new Error(`No encuentro a ${n} en loc_miembro`)
  const perfil = p => (p === PERFIL_LOCODEA ? PERFIL_LOCODEA : MIEMBRO[p])

  const { datos } = await peticion('loc_contenidos?$select=loc_titulo,loc_perfil,loc_enplan,loc_notas,loc_canal,loc_formato,loc_canales,loc_asignados,_loc_responsable_value&$top=5000')
  const filas = datos.value

  const hecho = existsSync(ARCHIVO_IDS) ? JSON.parse(readFileSync(ARCHIVO_IDS, 'utf8')) : { creadas: [], pasadas: [] }
  let creadas = 0, pasadas = 0, estaban = 0

  for (const i of PLAN) {
    const per = perfil(i.p)
    const asignados = i.a.map(n => MIEMBRO[n])
    const ya = filas.find(f => f.loc_enplan && clave(f.loc_titulo) === clave(i.t) && f.loc_perfil === per)
    if (ya) { estaban++; continue }

    const campos = {
      loc_titulo: i.t,
      loc_canal: CANAL[i.c[0]],
      loc_canales: JSON.stringify(i.c),
      loc_asignados: JSON.stringify(asignados),
      loc_perfil: per,
      loc_enplan: true,
      ...(i.f ? { loc_formato: FORMATO[i.f] } : {}),
      'loc_Responsable@odata.bind': asignados[0] ? `/loc_miembros(${asignados[0]})` : null,
    }

    const delBanco = i.banco && filas.find(f => clave(f.loc_titulo) === clave(i.banco))
    if (delBanco) {
      console.log(`  → al plan [${i.p}] ${i.t}  (era «${i.banco}»)`)
      pasadas++
      if (SIMULAR) continue
      const antes = {
        loc_titulo: delBanco.loc_titulo, loc_notas: delBanco.loc_notas ?? '', loc_enplan: false,
        loc_perfil: delBanco.loc_perfil ?? '', loc_canales: delBanco.loc_canales ?? '', loc_asignados: delBanco.loc_asignados ?? '',
        loc_canal: delBanco.loc_canal, loc_formato: delBanco.loc_formato ?? null,
        'loc_Responsable@odata.bind': delBanco._loc_responsable_value ? `/loc_miembros(${delBanco._loc_responsable_value})` : null,
      }
      await peticion(`loc_contenidos(${delBanco.loc_contenidoid})`, {
        metodo: 'PATCH',
        cuerpo: { ...campos, loc_notas: `IDEA DEL BANCO: ${delBanco.loc_titulo}\n\n${delBanco.loc_notas ?? ''}`.trim() },
      })
      hecho.pasadas.push({ id: delBanco.loc_contenidoid, antes })
      continue
    }

    console.log(`  + [${i.p}] ${i.t}  (${i.c.join(' + ')})`)
    creadas++
    if (SIMULAR) continue
    const { cabeceras } = await peticion('loc_contenidos', { metodo: 'POST', cuerpo: { ...campos, loc_estado: IDEA, loc_notas: '', statecode: 0 } })
    const id = cabeceras.get('OData-EntityId')?.match(/\(([0-9a-f-]{36})\)/)?.[1]
    if (id) hecho.creadas.push(id)
  }

  if (!SIMULAR) writeFileSync(ARCHIVO_IDS, JSON.stringify(hecho, null, 2))
  console.log(`\n${PLAN.length} piezas en el plan · ${estaban} ya estaban · ${creadas} ${SIMULAR ? 'por crear' : 'creadas'} · ${pasadas} ${SIMULAR ? 'por pasar' : 'pasadas'} desde el banco`)
} catch (e) {
  console.error('\nERROR:', e.message)
  process.exitCode = 1
}
