#!/usr/bin/env node
/**
 * Publica la app en Locodea PROD y deja GitHub al día en la misma operación:
 *
 *   1. npm run build                       (en Proyectos y Tareas/app)
 *   2. pa app push --non-interactive --solution-id …   (publica en PROD)
 *   3. git add -A && git commit && git push            (en la raíz del repo)
 *
 * Se detiene en el primer paso que falle: si el build o el push a PROD fallan,
 * no se commitea nada; si PROD se publica pero git falla, lo dice bien claro.
 *
 * Uso (desde Proyectos y Tareas/app):
 *   npm run publicar -- --mensaje "Qué cambia"
 *   npm run publicar -- --sin-build          # ya has hecho el build
 *   npm run publicar -- --solo-git           # no publica en PROD, solo commit y push
 */
import { execSync, spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const args = process.argv.slice(2)
const opcion = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined }
const SIN_BUILD = args.includes('--sin-build')
const SOLO_GIT = args.includes('--solo-git')
const SOLUCION = opcion('--solucion') ?? 'fad88cef-0fb4-f111-aaab-70a8a5068d0e'

const aqui = dirname(fileURLToPath(import.meta.url))
const app = resolve(aqui, '..', 'app')
const raiz = resolve(aqui, '..', '..')
const win = process.platform === 'win32'

const log = m => console.log(`\n▶ ${m}`)
function correr(cmd, cwd, etiqueta) {
  const r = spawnSync(cmd, { cwd, stdio: 'inherit', shell: true })
  if (r.status !== 0) { console.error(`\n✖ Falló: ${etiqueta}. No se ha seguido adelante.`); process.exit(r.status ?? 1) }
}
const salida = (cmd, cwd) => execSync(cmd, { cwd, encoding: 'utf8', shell: true }).trim()

// comprobaciones previas
const rama = salida('git rev-parse --abbrev-ref HEAD', raiz)
if (rama !== 'main') { console.error(`✖ Estás en la rama «${rama}». Se publica siempre desde main.`); process.exit(1) }
const mensaje = opcion('--mensaje') ?? `Publicación en Locodea PROD · ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`

if (!SOLO_GIT) {
  if (!SIN_BUILD) { log('Build'); correr(win ? 'npm.cmd run build' : 'npm run build', app, 'el build') }
  log('Publicando en Locodea PROD')
  correr(`${win ? 'npx.cmd' : 'npx'} --no-install pa app push --non-interactive --solution-id ${SOLUCION}`, app, 'la publicación en PROD')
}

// git: commit (si hay cambios) y push, siempre
log('GitHub')
correr('git add -A', raiz, 'git add')
const pendiente = salida('git status --porcelain', raiz)
if (pendiente) {
  correr(`git commit -m "${mensaje.replace(/"/g, '\\"')}"`, raiz, 'git commit')
} else {
  console.log('  (sin cambios que commitear)')
}
const porSubir = salida('git rev-list --count @{u}..HEAD', raiz)
if (porSubir !== '0') correr('git push', raiz, 'git push')
else console.log('  (GitHub ya estaba al día)')

console.log(`\n✔ Listo: ${SOLO_GIT ? 'GitHub al día' : 'PROD publicado y GitHub al día'} (${salida('git log --oneline -1', raiz)}).`)
