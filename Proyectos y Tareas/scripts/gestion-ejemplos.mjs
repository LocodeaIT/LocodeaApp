#!/usr/bin/env node
/**
 * Datos de ejemplo del módulo Gestión en Dataverse: unos pocos gastos y
 * documentos realistas para que las pantallas de Gastos, Caja, Trimestre y
 * Documentos tengan algo que enseñar (7 gastos, 5 documentos). Enlazan con las
 * cuentas de crm-ejemplos.mjs si existen (se buscan por nombre).
 *
 * Uso (desde esta carpeta):
 *   node gestion-ejemplos.mjs                 # inserta y guarda los ids en gestion-ejemplos.ids.json
 *   node gestion-ejemplos.mjs --simular       # solo lista lo que insertaría
 *   node gestion-ejemplos.mjs --borrar        # borra exactamente lo que insertó
 *   node gestion-ejemplos.mjs --entorno https://orgXXXX.crm17.dynamics.com
 *
 * Con DATAVERSE_CLI=<ruta a bin/dataverse.js> se llama al CLI con node, sin shell.
 * Los valores de opción son los de app/src/gestion/dataverse.ts.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'

const args = process.argv.slice(2)
const opcion = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined }
const SIMULAR = args.includes('--simular')
const BORRAR = args.includes('--borrar')
const ENTORNO = opcion('--entorno')
const API = 'api/data/v9.2/'
const ARCHIVO_IDS = join(dirname(fileURLToPath(import.meta.url)), 'gestion-ejemplos.ids.json')

// ─────────────────────────────────────────────── acceso a la API (como en crm-ejemplos.mjs)

const temporal = mkdtempSync(join(tmpdir(), 'gestion-ejemplos-'))
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

// ─────────────────────────────────────────────── valores de opción (app/src/gestion/dataverse.ts)

const CATEGORIA = { viajes: 412000400, dietas: 412000401, software: 412000402, hosting: 412000403, material: 412000404, formacion: 412000405, marketing: 412000406, asesoria: 412000407, telefonia: 412000408, suministros: 412000409, otros: 412000410 }
const ESTADO = { pendiente: 412000415, pagado: 412000416, reembolsar: 412000417, reembolsado: 412000418 }
const METODO = { tarjeta: 412000420, transferencia: 412000421, domiciliacion: 412000422, efectivo: 412000423 }
const TIPO_DOC = { contrato: 412000430, nda: 412000431, sepa: 412000432, certificado: 412000433, escritura: 412000434, cif: 412000435, lopd: 412000436, poder: 412000437, otro: 412000438 }

// ─────────────────────────────────────────────── utilidades

const hoy = new Date(); hoy.setHours(10, 0, 0, 0)
const d = n => { const x = new Date(hoy); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10) }
const id = () => randomUUID()
const ref = (conjunto, guid) => (guid ? `/${conjunto}(${guid})` : null)
const r2 = v => Math.round(v * 100) / 100
const total = (base, iva, irpf = 0) => r2(base * (1 + iva / 100 - irpf / 100))
const log = (...m) => console.log(...m)

// ─────────────────────────────────────────────── borrar lo insertado antes

if (BORRAR) {
  if (!existsSync(ARCHIVO_IDS)) { console.error(`No existe ${ARCHIVO_IDS}: no hay nada que borrar.`); process.exit(1) }
  const ids = JSON.parse(readFileSync(ARCHIVO_IDS, 'utf8'))
  let borrados = 0
  for (const conjunto of ['loc_gastos', 'loc_documentos']) {
    for (const guid of ids[conjunto] ?? []) {
      try { peticion(`${conjunto}(${guid})`, { metodo: 'DELETE' }); borrados++; log(`- ${conjunto} ${guid}`) }
      catch (e) { if (e.estado === 404) log(`  (ya no existe) ${conjunto} ${guid}`); else throw e }
    }
  }
  log(`\nBorrados ${borrados} registros.`)
  process.exit(0)
}

// ─────────────────────────────────────────────── miembros y cuentas existentes

const miembros = peticion('loc_miembros?$select=loc_miembroid,loc_nombre')?.value ?? []
const miembro = nombre => {
  const m = miembros.find(x => (x.loc_nombre ?? '').toLowerCase().startsWith(nombre.toLowerCase()))
  if (!m) throw new Error(`No encuentro al miembro «${nombre}» en loc_miembro (hay: ${miembros.map(x => x.loc_nombre).join(', ')})`)
  return m.loc_miembroid
}
const ALEJANDRO = miembro('Alejandro'), JESUS = miembro('Jesús'), MARCO = miembro('Marco')

const cuentas = peticion('loc_cuentas?$select=loc_cuentaid,loc_nombre')?.value ?? []
/** Cuenta por el principio del nombre; null si no existe (los ejemplos no dependen de ella). */
const cuenta = nombre => cuentas.find(x => (x.loc_nombre ?? '').toLowerCase().startsWith(nombre.toLowerCase()))?.loc_cuentaid ?? null
const MICROSOFT = cuenta('Microsoft'), HETZNER = cuenta('Hetzner'), TALLERES = cuenta('Talleres Ruiz'), FRUTAS = cuenta('Frutas Damián')

// ─────────────────────────────────────────────── los ejemplos

const gasto = (no, concepto, fecha, base, iva, categoria, estado, metodo, extra = {}) => ({
  id: id(), no: `G-${26000 + no}`, concepto, fecha: d(fecha), base, iva, irpf: extra.irpf ?? 0, total: total(base, iva, extra.irpf ?? 0), categoria, estado, metodo,
  recurrente: false, diaCargo: 1, deducible: true, noFactura: '', enlace: '', notas: '', proveedor: null, pagador: null, ...extra,
})

const gastos = [
  gasto(1, 'Microsoft 365 Business Standard · 4 usuarios', -22, 50.4, 21, 'software', 'pagado', 'tarjeta', { recurrente: true, diaCargo: 3, proveedor: MICROSOFT, noFactura: 'E0200987123' }),
  gasto(2, 'Servidor n8n · Hetzner CX32', -24, 24, 21, 'hosting', 'pagado', 'tarjeta', { recurrente: true, diaCargo: 1, proveedor: HETZNER }),
  gasto(3, 'Gestoría · cuota mensual', -12, 120, 21, 'asesoria', 'pendiente', 'domiciliacion', { recurrente: true, diaCargo: 5, irpf: 15, notas: 'Factura de profesional: lleva retención.' }),
  gasto(4, 'Tren Madrid–Getafe y taxi · visita Talleres Ruiz', -9, 31.82, 10, 'viajes', 'reembolsar', 'tarjeta', { pagador: MARCO, notas: 'Visita para ver los partes de trabajo en la nave.' }),
  gasto(5, 'Comida con el equipo de Frutas Damián', -6, 84, 10, 'dietas', 'reembolsar', 'efectivo', { pagador: JESUS, notas: 'Cuatro personas. Ticket en papel.' }),
  gasto(6, 'Monitor 27" para el puesto de Marco', -30, 289, 21, 'material', 'pagado', 'transferencia', { noFactura: 'A-2026-4471' }),
  gasto(7, 'Curso PL-400 · Alejandro', -45, 495, 21, 'formacion', 'reembolsado', 'tarjeta', { pagador: ALEJANDRO }),
]

const documento = (nombre, tipo, caduca, cuentaId, responsable, extra = {}) => ({
  id: id(), nombre, tipo, caduca: caduca === null ? null : d(caduca), avisoDias: 30, enlace: '', firmado: true, firmadoEl: d(-120), notas: '', cuenta: cuentaId, responsable, ...extra,
})

const documentos = [
  documento('Certificado digital de la SL (FNMT)', 'certificado', 18, null, ALEJANDRO, { notas: 'Renovar en la sede de la FNMT con el certificado vigente.' }),
  documento('Escritura de constitución', 'escritura', null, null, ALEJANDRO),
  documento('Contrato de soporte · Talleres Ruiz', 'contrato', 55, TALLERES, ALEJANDRO),
  documento('Mandato SEPA · Frutas Damián', 'sepa', null, FRUTAS, JESUS),
  documento('Seguro de responsabilidad civil', 'otro', 95, null, MARCO, { avisoDias: 45 }),
]

const PASOS = [
  ['loc_gastos', 'loc_gastoid', gastos, g => ({
    loc_numero: g.no, loc_concepto: g.concepto, loc_fecha: g.fecha, loc_base: g.base, loc_iva: g.iva, loc_irpf: g.irpf, loc_total: g.total,
    loc_categoria: CATEGORIA[g.categoria], loc_estado: ESTADO[g.estado], loc_metodopago: METODO[g.metodo], loc_recurrente: g.recurrente, loc_diacargo: g.diaCargo,
    loc_deducible: g.deducible, loc_nofactura: g.noFactura, loc_enlace: g.enlace, loc_foto: '', loc_notas: g.notas,
    'loc_Proveedor@odata.bind': ref('loc_cuentas', g.proveedor), 'loc_Pagador@odata.bind': ref('loc_miembros', g.pagador),
  })],
  ['loc_documentos', 'loc_documentoid', documentos, x => ({
    loc_nombre: x.nombre, loc_tipo: TIPO_DOC[x.tipo], loc_caduca: x.caduca, loc_avisodias: x.avisoDias, loc_enlace: x.enlace, loc_firmado: x.firmado,
    loc_firmadoel: x.firmadoEl, loc_notas: x.notas, 'loc_Cuenta@odata.bind': ref('loc_cuentas', x.cuenta), 'loc_Responsable@odata.bind': ref('loc_miembros', x.responsable),
  })],
]

// ─────────────────────────────────────────────── ejecución

const cuantos = gastos.length + documentos.length
log(`${SIMULAR ? 'Simulación: se insertarían' : 'Insertando'} ${cuantos} registros en ${ENTORNO ?? 'el entorno del perfil activo'}…`)
log(`Cuentas encontradas: Microsoft ${MICROSOFT ? 'sí' : 'no'} · Hetzner ${HETZNER ? 'sí' : 'no'} · Talleres Ruiz ${TALLERES ? 'sí' : 'no'} · Frutas Damián ${FRUTAS ? 'sí' : 'no'}\n`)

const ids = { loc_gastos: [], loc_documentos: [] }
const guardarIds = () => { if (!SIMULAR) writeFileSync(ARCHIVO_IDS, JSON.stringify(ids, null, 2)) }

try {
  for (const [conjunto, clave, filas, cuerpo] of PASOS) {
    for (const fila of filas) {
      const etiqueta = fila.no ? `${fila.no} ${fila.concepto}` : fila.nombre
      if (SIMULAR) { log(`+ ${conjunto} ${etiqueta}`); continue }
      peticion(conjunto, { metodo: 'POST', cuerpo: { ...cuerpo(fila), [clave]: fila.id, statecode: 0 } })
      ids[conjunto].push(fila.id); guardarIds()
      log(`+ ${conjunto} ${etiqueta}`)
    }
  }
} catch (e) {
  console.error(`\nFALLO: ${e.message}`)
  console.error(`Los ids insertados hasta ahora están en ${ARCHIVO_IDS}; ejecuta --borrar para deshacer.`)
  process.exit(1)
}

log(SIMULAR ? '\nNada insertado (simulación).' : `\nListo: ${cuantos} registros. Ids guardados en ${ARCHIVO_IDS} (para deshacer: node gestion-ejemplos.mjs --borrar).`)
