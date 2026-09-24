#!/usr/bin/env node
/**
 * Datos de ejemplo del CRM en Dataverse: unos pocos registros realistas de
 * ventas, compras y productos para probar la app con algo dentro (5 cuentas,
 * 5 contactos, 2 clientes potenciales, 3 oportunidades, 2 ofertas, 2 pedidos de
 * venta, 3 facturas de venta, 2 pedidos de compra, 2 facturas de compra,
 * 8 productos, 4 actividades y 2 notas, con sus líneas).
 *
 * Uso (desde esta carpeta):
 *   node crm-ejemplos.mjs                 # inserta los ejemplos y guarda sus ids en crm-ejemplos.ids.json
 *   node crm-ejemplos.mjs --simular       # solo lista lo que insertaría
 *   node crm-ejemplos.mjs --borrar        # borra exactamente lo que insertó (lee crm-ejemplos.ids.json)
 *   node crm-ejemplos.mjs --entorno https://orgXXXX.crm17.dynamics.com
 *
 * Necesita el CLI de Dataverse (`npx -y @microsoft/dataverse`) con sesión
 * iniciada, igual que crm-esquema.mjs. Los propietarios se buscan por nombre
 * en loc_miembro. Los valores de opción son los de app/src/crm/dataverse.ts.
 * Las fechas se calculan desde hoy para que el ejemplo no se quede viejo.
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
const ARCHIVO_IDS = join(dirname(fileURLToPath(import.meta.url)), 'crm-ejemplos.ids.json')

// ─────────────────────────────────────────────── acceso a la API (como en crm-esquema.mjs)

const temporal = mkdtempSync(join(tmpdir(), 'crm-ejemplos-'))
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

// ─────────────────────────────────────────────── valores de opción (app/src/crm/dataverse.ts)

const TIPO_CUENTA = { cliente: 412000100, proveedor: 412000101, ambos: 412000102 }
const ACTIVO = { activo: 412000105, inactivo: 412000106 }
const CONDICIONES = { contado: 412000110, 15: 412000111, 30: 412000112, 60: 412000113 }
const METODO = { transferencia: 412000115, domiciliacion: 412000116, tarjeta: 412000117 }
const ORIGEN = { web: 412000120, referido: 412000121, linkedin: 412000122, evento: 412000123, llamada: 412000124, partner: 412000125 }
const PUNTUACION = { caliente: 412000130, templado: 412000131, frio: 412000132 }
const EST_POTENCIAL = { abierto: 412000135, calificado: 412000136, descalificado: 412000137 }
const FASE = { calificar: 412000140, desarrollar: 412000141, proponer: 412000142, cerrar: 412000143 }
const EST_OPORTUNIDAD = { abierta: 412000145, ganada: 412000146, perdida: 412000147 }
const EST_OFERTA = { borrador: 412000150, enviada: 412000151, aceptada: 412000152, rechazada: 412000153, expirada: 412000154, convertida: 412000155 }
const EST_PEDIDO_VENTA = { abierto: 412000160, liberado: 412000161, enviado: 412000162, facturado: 412000163, cancelado: 412000164 }
const EST_FACTURA_VENTA = { borrador: 412000170, registrada: 412000171, pagada: 412000172, anulada: 412000173 }
const EST_PEDIDO_COMPRA = { abierto: 412000180, liberado: 412000181, recibido: 412000182, facturado: 412000183, cancelado: 412000184 }
const EST_FACTURA_COMPRA = { pendiente: 412000190, registrada: 412000191, pagada: 412000192, anulada: 412000193 }
const TIPO_PRODUCTO = { servicio: 412000200, licencia: 412000201, producto: 412000202 }
const UNIDAD = { hora: 412000205, dia: 412000206, mes: 412000207, ud: 412000208, proyecto: 412000209 }
const TIPO_ACTIVIDAD = { tarea: 412000210, llamada: 412000211, correo: 412000212, cita: 412000213 }
const EST_ACTIVIDAD = { abierta: 412000215, completada: 412000216, cancelada: 412000217 }
const PRIORIDAD = { baja: 412000220, normal: 412000221, alta: 412000222 }

// ─────────────────────────────────────────────── utilidades

const hoy = new Date(); hoy.setHours(10, 0, 0, 0)
/** Día relativo a hoy, YYYY-MM-DD. */
const d = n => { const x = new Date(hoy); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10) }
/** Instante relativo a hoy, ISO. */
const iso = (n, h = 10, m = 0) => { const x = new Date(hoy); x.setDate(x.getDate() + n); x.setHours(h, m, 0, 0); return x.toISOString() }
const id = () => randomUUID()
const ref = (conjunto, guid) => (guid ? `/${conjunto}(${guid})` : null)
const log = (...m) => console.log(...m)

// ─────────────────────────────────────────────── borrar lo insertado antes

if (BORRAR) {
  if (!existsSync(ARCHIVO_IDS)) { console.error(`No existe ${ARCHIVO_IDS}: no hay nada que borrar.`); process.exit(1) }
  const ids = JSON.parse(readFileSync(ARCHIVO_IDS, 'utf8'))
  // las líneas primero (no hay borrado en cascada), luego documentos y el resto
  const orden = ['loc_lineadocumentos', 'loc_notacrms', 'loc_actividadcrms', 'loc_facturacompras', 'loc_pedidocompras', 'loc_facturaventas', 'loc_pedidoventas', 'loc_ofertas', 'loc_oportunidads', 'loc_potencials', 'loc_contactos', 'loc_cuentas', 'loc_productos']
  let borrados = 0
  for (const conjunto of orden) {
    for (const guid of ids[conjunto] ?? []) {
      try { peticion(`${conjunto}(${guid})`, { metodo: 'DELETE' }); borrados++; log(`- ${conjunto} ${guid}`) }
      catch (e) { if (e.estado === 404) log(`  (ya no existe) ${conjunto} ${guid}`); else throw e }
    }
  }
  log(`\nBorrados ${borrados} registros.`)
  process.exit(0)
}

// ─────────────────────────────────────────────── propietarios (loc_miembro)

const miembros = peticion('loc_miembros?$select=loc_miembroid,loc_nombre')?.value ?? []
const miembro = nombre => {
  const m = miembros.find(x => (x.loc_nombre ?? '').toLowerCase().startsWith(nombre.toLowerCase()))
  if (!m) throw new Error(`No encuentro al miembro «${nombre}» en loc_miembro (hay: ${miembros.map(x => x.loc_nombre).join(', ')})`)
  return m.loc_miembroid
}
const ALEJANDRO = miembro('Alejandro'), JESUS = miembro('Jesús'), MARCO = miembro('Marco')

// ─────────────────────────────────────────────── los ejemplos

const productos = [
  { id: id(), no: 'P1001', nombre: 'Consultoría Power Platform', tipo: 'servicio', categoria: 'Consultoría', unidad: 'hora', precio: 85, coste: 40, descripcion: 'Análisis, diseño de la solución y acompañamiento funcional.' },
  { id: id(), no: 'P1002', nombre: 'Desarrollo Power Apps', tipo: 'servicio', categoria: 'Desarrollo', unidad: 'hora', precio: 75, coste: 38, descripcion: 'Apps canvas y basadas en modelo sobre Dataverse o SharePoint.' },
  { id: id(), no: 'P1003', nombre: 'Desarrollo Power Automate', tipo: 'servicio', categoria: 'Desarrollo', unidad: 'hora', precio: 75, coste: 38, descripcion: 'Flujos con conectores estándar y premium; integración con el ERP.' },
  { id: id(), no: 'P1004', nombre: 'Cuadro de mando Power BI', tipo: 'servicio', categoria: 'Datos', unidad: 'proyecto', precio: 4500, coste: 2200, descripcion: 'Modelo de datos, informe y publicación en el servicio, con actualización diaria.' },
  { id: id(), no: 'P1005', nombre: 'Soporte y evolutivos', tipo: 'servicio', categoria: 'Soporte', unidad: 'mes', precio: 450, coste: 180, descripcion: 'Bolsa mensual de soporte con respuesta en 24 h. Sin permanencia.' },
  { id: id(), no: 'P1006', nombre: 'Formación Power Platform', tipo: 'servicio', categoria: 'Formación', unidad: 'dia', precio: 900, coste: 400, descripcion: 'Jornada presencial o remota, hasta 12 personas, con los datos del cliente.' },
  { id: id(), no: 'P1007', nombre: 'Licencia Power Apps Premium', tipo: 'licencia', categoria: 'Licencias', unidad: 'mes', precio: 18.7, coste: 16.9, descripcion: 'Por usuario y mes. Revendida con margen.' },
  { id: id(), no: 'P1008', nombre: 'Hosting n8n gestionado', tipo: 'servicio', categoria: 'Infraestructura', unidad: 'mes', precio: 60, coste: 24, descripcion: 'Servidor dedicado con copias diarias y actualizaciones.' },
]
const P = Object.fromEntries(productos.map(p => [p.no, p]))

const cuentas = [
  { id: id(), no: 'C1001', nombre: 'Talleres Ruiz S.L.', tipo: 'cliente', cif: 'B28455120', sector: 'Automoción', direccion: 'Pol. Ind. Los Olivos, nave 14', cp: '28906', ciudad: 'Getafe', provincia: 'Madrid', web: 'talleresruiz.es', telefono: '+34 916 81 23 40', email: 'info@talleresruiz.es', empleados: '11–50', propietario: ALEJANDRO, condiciones: 30, metodo: 'transferencia', notas: 'Tres naves en el polígono. Los partes de trabajo de los técnicos van en papel y llegan a administración con días de retraso.' },
  { id: id(), no: 'C1002', nombre: 'Frutas Damián S.L.', tipo: 'cliente', cif: 'B83210447', sector: 'Alimentación', direccion: 'Mercamadrid, nave F, puesto 22', cp: '28053', ciudad: 'Madrid', provincia: 'Madrid', web: 'frutasdamian.es', telefono: '+34 917 85 06 12', email: 'pedidos@frutasdamian.es', empleados: '51–200', propietario: JESUS, condiciones: 60, metodo: 'transferencia', notas: 'Los pedidos de las 40 tiendas llegan por correo cada mañana y se copiaban a mano en Business Central.' },
  { id: id(), no: 'C1003', nombre: 'Vega Suministros Industriales S.A.', tipo: 'cliente', cif: 'A80112390', sector: 'Distribución industrial', direccion: 'C/ Pintores 8', cp: '28805', ciudad: 'Alcalá de Henares', provincia: 'Madrid', web: 'vegasuministros.com', telefono: '+34 918 82 44 71', email: 'info@vegasuministros.com', empleados: '51–200', propietario: MARCO, condiciones: 30, metodo: 'domiciliacion', notas: 'Cinco comerciales de zona. Dirección quiere ver las ventas por zona y producto sin esperar al cierre de mes.' },
  { id: id(), no: 'C1004', nombre: 'Microsoft Ibérica S.R.L.', tipo: 'proveedor', cif: 'B78603495', sector: 'Licencias de software', direccion: 'Paseo del Club Deportivo 1', cp: '28223', ciudad: 'Pozuelo de Alarcón', provincia: 'Madrid', web: 'microsoft.com/es-es', telefono: '+34 913 91 90 00', email: '', empleados: '500+', propietario: ALEJANDRO, condiciones: 30, metodo: 'domiciliacion', notas: 'Licencias Power Apps Premium y Business Central a través del CSP.' },
  { id: id(), no: 'C1005', nombre: 'Hetzner Online GmbH', tipo: 'proveedor', cif: 'DE812871812', sector: 'Hosting', direccion: 'Industriestr. 25', cp: '91710', ciudad: 'Gunzenhausen', provincia: 'Baviera', web: 'hetzner.com', telefono: '+49 9831 505-0', email: 'support@hetzner.com', empleados: '201–500', propietario: ALEJANDRO, condiciones: 15, metodo: 'tarjeta', notas: 'Servidor del n8n de los clientes. Se paga con tarjeta a principio de mes.' },
]
const C = Object.fromEntries(cuentas.map(c => [c.no, c]))
cuentas[3].pais = 'España'; cuentas[4].pais = 'Alemania'

const contactos = [
  { id: id(), no: 'CT1001', nombre: 'Carlos', apellidos: 'Ruiz Montero', cuenta: C.C1001, cargo: 'Gerente', email: 'carlos.ruiz@talleresruiz.es', movil: '+34 629 41 08 77', propietario: ALEJANDRO, notas: 'Decide él. Prefiere que le llamen por la tarde.' },
  { id: id(), no: 'CT1002', nombre: 'Marta', apellidos: 'Serrano Gil', cuenta: C.C1001, cargo: 'Administración', email: 'marta.serrano@talleresruiz.es', movil: '+34 617 30 55 21', propietario: ALEJANDRO, notas: 'Recibe los partes y factura. Será la usuaria principal de la app.' },
  { id: id(), no: 'CT1003', nombre: 'María', apellidos: 'López Arenas', cuenta: C.C1002, cargo: 'Gerente', email: 'maria.lopez@frutasdamian.es', movil: '+34 646 92 18 03', propietario: JESUS, notas: '' },
  { id: id(), no: 'CT1004', nombre: 'Lucía', apellidos: 'Vega Ortiz', cuenta: C.C1003, cargo: 'Directora de operaciones', email: 'lucia.vega@vegasuministros.com', movil: '+34 690 12 47 58', propietario: MARCO, notas: 'Patrocina el proyecto del cuadro de mando.' },
  { id: id(), no: 'CT1005', nombre: 'Jonas', apellidos: 'Weber', cuenta: C.C1005, cargo: 'Account Manager', email: 'jonas.weber@hetzner.com', movil: '+49 151 2345 6789', propietario: ALEJANDRO, notas: '' },
]
const CT = Object.fromEntries(contactos.map(c => [c.no, c]))

const potenciales = [
  { id: id(), no: 'CP1001', tema: 'Automatizar las altas de empleados en Teams', nombre: 'Nuria', apellidos: 'Ferrer', empresa: 'Clínica Dental Sonrisa', cargo: 'Directora', email: 'nuria@clinicasonrisa.es', telefono: '+34 915 44 20 18', ciudad: 'Madrid', sector: 'Salud', origen: 'web', puntuacion: 'caliente', estado: 'abierto', importe: 8000, propietario: JESUS, descripcion: 'Cada alta son seis correos y tres formularios. Quieren un flujo que lo haga todo desde Teams. Llegó por el formulario de la web.' },
  { id: id(), no: 'CP1002', tema: 'App de partes para técnicos de instalaciones', nombre: 'Pedro', apellidos: 'Salcedo', empresa: 'Instalaciones Salcedo', cargo: 'Gerente', email: 'pedro@instalacionessalcedo.es', telefono: '+34 925 21 67 09', ciudad: 'Toledo', sector: 'Instalaciones', origen: 'referido', puntuacion: 'templado', estado: 'abierto', importe: 12000, propietario: MARCO, descripcion: 'Referido por Carlos Ruiz. Ocho técnicos en furgoneta, partes en papel y fotos por WhatsApp.' },
]

const oportunidades = [
  { id: id(), no: 'OP1001', titulo: 'App de partes de trabajo con foto y firma', cuenta: C.C1001, contacto: CT.CT1001, importe: 9460, fase: 'proponer', estado: 'abierta', probabilidad: 60, cierre: d(20), propietario: ALEJANDRO, notas: 'Oferta enviada. Quieren arrancar con los técnicos en octubre. Punto crítico: que funcione sin cobertura dentro de las naves.' },
  { id: id(), no: 'OP1002', titulo: 'Pedidos del correo a Business Central', cuenta: C.C1002, contacto: CT.CT1003, importe: 5970, fase: 'cerrar', estado: 'ganada', probabilidad: 100, cierre: d(-25), cerradaEl: iso(-25, 17, 30), propietario: JESUS, notas: 'Ganada tras la demo con sus propios correos de pedidos. Pedido PV-26001 en marcha.' },
  { id: id(), no: 'OP1003', titulo: 'Cuadro de mando de ventas por zona', cuenta: C.C1003, contacto: CT.CT1004, importe: 5010, fase: 'desarrollar', estado: 'abierta', probabilidad: 35, cierre: d(45), propietario: MARCO, notas: 'Tienen los datos en Business Central. Pendiente demo con el modelo de datos real.' },
]
const OP = Object.fromEntries(oportunidades.map(o => [o.no, o]))

/** Línea: [producto, cantidad, precio (por defecto el del producto), descuento %] */
const lin = (no, cantidad, precio, dto = 0, descripcion) => ({ producto: P[no], cantidad, precio: precio ?? P[no].precio, dto, descripcion: descripcion ?? P[no].nombre, unidad: P[no].unidad })

const ofertas = [
  { id: id(), no: 'OF-26001', cuenta: C.C1001, contacto: CT.CT1001, fecha: d(-6), estado: 'enviada', oportunidad: OP.OP1001, validaHasta: d(24), propietario: ALEJANDRO, condiciones: 30, metodo: 'transferencia', referencia: 'Partes de trabajo v2', notas: 'Incluye una jornada de formación a los técnicos.',
    lineas: [lin('P1002', 80, 75, 0, 'Desarrollo de la app de partes (móvil, foto y firma)'), lin('P1003', 24, 75, 0, 'Flujo de envío del parte al ERP y avisos en Teams'), lin('P1001', 10, 85), lin('P1006', 1, 900, 10, 'Formación a los técnicos en la nave')] },
  { id: id(), no: 'OF-26002', cuenta: C.C1002, contacto: CT.CT1003, fecha: d(-40), estado: 'convertida', oportunidad: OP.OP1002, validaHasta: d(-10), propietario: JESUS, condiciones: 60, metodo: 'transferencia', referencia: 'Pedidos por correo → BC', notas: '',
    lineas: [lin('P1003', 48, 75, 0, 'Flujo que lee los correos de pedidos y crea el pedido en Business Central'), lin('P1001', 12, 85), lin('P1005', 3, 450, 0, 'Soporte los tres primeros meses')] },
]
const OF = Object.fromEntries(ofertas.map(o => [o.no, o]))

const pedidosVenta = [
  { id: id(), no: 'PV-26001', cuenta: C.C1002, contacto: CT.CT1003, fecha: d(-30), estado: 'facturado', oferta: OF['OF-26002'], oportunidad: OP.OP1002, fechaEntrega: d(-5), refCliente: 'FD-2026-118', propietario: JESUS, condiciones: 60, metodo: 'transferencia', referencia: 'Pedidos por correo → BC', notas: 'Entregado y en producción desde la semana pasada.', lineas: OF['OF-26002'].lineas },
  { id: id(), no: 'PV-26002', cuenta: C.C1003, contacto: CT.CT1004, fecha: d(-3), estado: 'abierto', oferta: null, oportunidad: OP.OP1003, fechaEntrega: d(40), refCliente: '', propietario: MARCO, condiciones: 30, metodo: 'domiciliacion', referencia: 'Cuadro de mando · fase 1', notas: 'Primera fase: ventas por zona. Margen por producto en una segunda fase.',
    lineas: [lin('P1004', 1, 4500, 0, 'Cuadro de mando de ventas por zona y comercial'), lin('P1001', 6, 85)] },
]
const PV = Object.fromEntries(pedidosVenta.map(o => [o.no, o]))

const facturasVenta = [
  { id: id(), no: 'FV-26001', cuenta: C.C1002, contacto: CT.CT1003, fecha: d(-20), estado: 'registrada', pedido: PV['PV-26001'], vencimiento: d(40), registradaEl: iso(-20, 12), pagadaEl: null, propietario: JESUS, condiciones: 60, metodo: 'transferencia', referencia: 'Pedidos por correo → BC', notas: '', lineas: OF['OF-26002'].lineas },
  { id: id(), no: 'FV-26002', cuenta: C.C1001, contacto: CT.CT1002, fecha: d(-70), estado: 'pagada', pedido: null, vencimiento: d(-40), registradaEl: iso(-70, 12), pagadaEl: iso(-42, 9), propietario: ALEJANDRO, condiciones: 30, metodo: 'transferencia', referencia: 'Diagnóstico inicial', notas: 'Una jornada de diagnóstico en las naves.',
    lineas: [lin('P1001', 8, 85, 0, 'Diagnóstico: mapa de procesos y lista priorizada')] },
  { id: id(), no: 'FV-26003', cuenta: C.C1002, contacto: CT.CT1003, fecha: d(-45), estado: 'registrada', pedido: null, vencimiento: d(-15), registradaEl: iso(-45, 12), pagadaEl: null, propietario: JESUS, condiciones: 30, metodo: 'transferencia', referencia: 'Soporte agosto', notas: 'Pendiente de cobro: reclamar a María.',
    lineas: [lin('P1005', 1, 450, 0, 'Soporte y evolutivos · agosto')] },
]

const pedidosCompra = [
  { id: id(), no: 'PC-26001', cuenta: C.C1004, contacto: null, fecha: d(-35), estado: 'facturado', recepcionPrevista: d(-35), refProveedor: 'MS-88213', propietario: ALEJANDRO, condiciones: 30, metodo: 'domiciliacion', referencia: 'Licencias Frutas Damián', notas: '10 licencias Power Apps Premium para los usuarios del flujo de pedidos.',
    lineas: [lin('P1007', 10, 16.9, 0, 'Power Apps Premium · 10 usuarios · septiembre')] },
  { id: id(), no: 'PC-26002', cuenta: C.C1005, contacto: CT.CT1005, fecha: d(-2), estado: 'abierto', recepcionPrevista: d(3), refProveedor: '', propietario: ALEJANDRO, condiciones: 15, metodo: 'tarjeta', referencia: 'Servidor n8n · octubre', notas: '',
    lineas: [lin('P1008', 1, 24, 0, 'Servidor CX32 · n8n clientes · octubre')] },
]
const PC = Object.fromEntries(pedidosCompra.map(o => [o.no, o]))

const facturasCompra = [
  { id: id(), no: 'FC-26001', cuenta: C.C1004, contacto: null, fecha: d(-33), estado: 'pagada', pedido: PC['PC-26001'], noProveedor: 'E0200123456', vencimiento: d(-3), registradaEl: iso(-33, 9), pagadaEl: iso(-5, 9), propietario: ALEJANDRO, condiciones: 30, metodo: 'domiciliacion', referencia: 'Licencias Frutas Damián', notas: '', lineas: PC['PC-26001'].lineas },
  { id: id(), no: 'FC-26002', cuenta: C.C1005, contacto: CT.CT1005, fecha: d(-1), estado: 'registrada', pedido: null, noProveedor: 'R0012345678', vencimiento: d(14), registradaEl: iso(-1, 9), pagadaEl: null, propietario: ALEJANDRO, condiciones: 15, metodo: 'tarjeta', referencia: 'Servidor n8n · septiembre', notas: '',
    lineas: [lin('P1008', 1, 24, 0, 'Servidor CX32 · n8n clientes · septiembre')] },
]

const actividades = [
  { id: id(), asunto: 'Llamar a Carlos para cerrar la oferta de partes', tipo: 'llamada', fecha: d(1), hora: '10:00', referenteTipo: 'oportunidades', referente: OP.OP1001, cuenta: C.C1001, propietario: ALEJANDRO, prioridad: 'alta', estado: 'abierta', descripcion: 'Resolver la duda de la cobertura en las naves (modo sin conexión) y proponer arranque el 6 de octubre.' },
  { id: id(), asunto: 'Demo del cuadro de mando en Vega', tipo: 'cita', fecha: d(6), hora: '12:00', referenteTipo: 'oportunidades', referente: OP.OP1003, cuenta: C.C1003, propietario: MARCO, prioridad: 'normal', estado: 'abierta', descripcion: 'Enseñar el modelo con sus datos de Business Central. Asisten Lucía y los jefes de zona.' },
  { id: id(), asunto: 'Reclamar la factura FV-26003 a Frutas Damián', tipo: 'tarea', fecha: d(-2), hora: '09:30', referenteTipo: 'cuentas', referente: C.C1002, cuenta: C.C1002, propietario: JESUS, prioridad: 'normal', estado: 'abierta', descripcion: 'Soporte de agosto vencido hace 15 días. Llamar a María antes de mandar el recordatorio.' },
  { id: id(), asunto: 'Enviar propuesta a Clínica Dental Sonrisa', tipo: 'correo', fecha: d(3), hora: '17:00', referenteTipo: 'potenciales', referente: potenciales[0], cuenta: null, propietario: JESUS, prioridad: 'normal', estado: 'abierta', descripcion: 'Propuesta del flujo de altas en Teams con precio cerrado.' },
]

const notas = [
  { id: id(), texto: 'Carlos quiere firmar antes de fin de mes para arrancar con los técnicos en octubre. Le preocupa que la app funcione sin cobertura dentro de las naves: preparar la demo en modo sin conexión.', referenteTipo: 'cuentas', referente: C.C1001, cuenta: C.C1001, autor: ALEJANDRO, fecha: iso(-2, 18, 10) },
  { id: id(), texto: 'Pedido en marcha. El flujo lee el correo de pedidos y crea el pedido en Business Central; la segunda fase serán los avisos por Teams a las tiendas.', referenteTipo: 'oportunidades', referente: OP.OP1002, cuenta: C.C1002, autor: JESUS, fecha: iso(-28, 11, 40) },
]

// ─────────────────────────────────────────────── cuerpos para la API

const docBase = x => ({
  loc_numero: x.no, loc_fecha: x.fecha, loc_condicionespago: CONDICIONES[x.condiciones], loc_metodopago: METODO[x.metodo], loc_referencia: x.referencia, loc_notas: x.notas,
  'loc_Cuenta@odata.bind': ref('loc_cuentas', x.cuenta?.id), 'loc_Contacto@odata.bind': ref('loc_contactos', x.contacto?.id), 'loc_Propietario@odata.bind': ref('loc_miembros', x.propietario),
})

/** [conjunto, clave primaria, filas, cuerpo(fila)] en orden de dependencias. */
const PASOS = [
  ['loc_productos', 'loc_productoid', productos, p => ({ loc_numero: p.no, loc_nombre: p.nombre, loc_tipo: TIPO_PRODUCTO[p.tipo], loc_categoria: p.categoria, loc_unidad: UNIDAD[p.unidad], loc_precio: p.precio, loc_coste: p.coste, loc_iva: 21, loc_activo: true, loc_descripcion: p.descripcion })],
  ['loc_cuentas', 'loc_cuentaid', cuentas, c => ({ loc_numero: c.no, loc_nombre: c.nombre, loc_tipo: TIPO_CUENTA[c.tipo], loc_estado: ACTIVO.activo, loc_cif: c.cif, loc_sector: c.sector, loc_direccion: c.direccion, loc_cp: c.cp, loc_ciudad: c.ciudad, loc_provincia: c.provincia, loc_pais: c.pais ?? 'España', loc_web: c.web, loc_telefono: c.telefono, loc_email: c.email, loc_empleados: c.empleados, loc_condicionespago: CONDICIONES[c.condiciones], loc_metodopago: METODO[c.metodo], loc_iva: 21, loc_iban: '', loc_notas: c.notas, 'loc_Propietario@odata.bind': ref('loc_miembros', c.propietario) })],
  ['loc_contactos', 'loc_contactoid', contactos, c => ({ loc_numero: c.no, loc_nombre: c.nombre, loc_apellidos: c.apellidos, loc_cargo: c.cargo, loc_email: c.email, loc_telefono: c.cuenta.telefono, loc_movil: c.movil, loc_ciudad: c.cuenta.ciudad, loc_linkedin: '', loc_estado: ACTIVO.activo, loc_notas: c.notas, 'loc_Cuenta@odata.bind': ref('loc_cuentas', c.cuenta.id), 'loc_Propietario@odata.bind': ref('loc_miembros', c.propietario) })],
  ['loc_potencials', 'loc_potencialid', potenciales, l => ({ loc_numero: l.no, loc_tema: l.tema, loc_nombre: l.nombre, loc_apellidos: l.apellidos, loc_empresa: l.empresa, loc_cargo: l.cargo, loc_email: l.email, loc_telefono: l.telefono, loc_ciudad: l.ciudad, loc_sector: l.sector, loc_origen: ORIGEN[l.origen], loc_puntuacion: PUNTUACION[l.puntuacion], loc_estado: EST_POTENCIAL[l.estado], loc_fase: FASE.calificar, loc_importeest: l.importe, loc_descripcion: l.descripcion, loc_motivo: '', 'loc_Propietario@odata.bind': ref('loc_miembros', l.propietario) })],
  ['loc_oportunidads', 'loc_oportunidadid', oportunidades, o => ({ loc_numero: o.no, loc_titulo: o.titulo, loc_importe: o.importe, loc_fase: FASE[o.fase], loc_estado: EST_OPORTUNIDAD[o.estado], loc_probabilidad: o.probabilidad, loc_cierreprevisto: o.cierre, loc_notas: o.notas, loc_cerradael: o.cerradaEl ?? null, loc_motivoperdida: '', 'loc_Cuenta@odata.bind': ref('loc_cuentas', o.cuenta.id), 'loc_Contacto@odata.bind': ref('loc_contactos', o.contacto.id), 'loc_Propietario@odata.bind': ref('loc_miembros', o.propietario) })],
  ['loc_ofertas', 'loc_ofertaid', ofertas, q => ({ ...docBase(q), loc_estado: EST_OFERTA[q.estado], loc_validahasta: q.validaHasta, 'loc_Oportunidad@odata.bind': ref('loc_oportunidads', q.oportunidad?.id) })],
  ['loc_pedidoventas', 'loc_pedidoventaid', pedidosVenta, p => ({ ...docBase(p), loc_estado: EST_PEDIDO_VENTA[p.estado], loc_fechaentrega: p.fechaEntrega, loc_refcliente: p.refCliente, 'loc_Oferta@odata.bind': ref('loc_ofertas', p.oferta?.id), 'loc_Oportunidad@odata.bind': ref('loc_oportunidads', p.oportunidad?.id) })],
  ['loc_facturaventas', 'loc_facturaventaid', facturasVenta, f => ({ ...docBase(f), loc_estado: EST_FACTURA_VENTA[f.estado], loc_vencimiento: f.vencimiento, loc_registradael: f.registradaEl, loc_pagadael: f.pagadaEl, 'loc_Pedido@odata.bind': ref('loc_pedidoventas', f.pedido?.id) })],
  ['loc_pedidocompras', 'loc_pedidocompraid', pedidosCompra, p => ({ ...docBase(p), loc_estado: EST_PEDIDO_COMPRA[p.estado], loc_recepcionprevista: p.recepcionPrevista, loc_refproveedor: p.refProveedor })],
  ['loc_facturacompras', 'loc_facturacompraid', facturasCompra, f => ({ ...docBase(f), loc_estado: EST_FACTURA_COMPRA[f.estado], loc_noproveedor: f.noProveedor, loc_vencimiento: f.vencimiento, loc_registradael: f.registradaEl, loc_pagadael: f.pagadaEl, 'loc_Pedido@odata.bind': ref('loc_pedidocompras', f.pedido?.id) })],
  ['loc_actividadcrms', 'loc_actividadcrmid', actividades, a => ({ loc_asunto: a.asunto, loc_tipo: TIPO_ACTIVIDAD[a.tipo], loc_fecha: a.fecha, loc_hora: a.hora, loc_referentetipo: a.referenteTipo, loc_referenteid: a.referente.id, loc_prioridad: PRIORIDAD[a.prioridad], loc_estado: EST_ACTIVIDAD[a.estado], loc_completadael: null, loc_descripcion: a.descripcion, 'loc_Cuenta@odata.bind': ref('loc_cuentas', a.cuenta?.id), 'loc_Propietario@odata.bind': ref('loc_miembros', a.propietario) })],
  ['loc_notacrms', 'loc_notacrmid', notas, n => ({ loc_resumen: n.texto.slice(0, 200), loc_texto: n.texto, loc_referentetipo: n.referenteTipo, loc_referenteid: n.referente.id, loc_fecha: n.fecha, 'loc_Cuenta@odata.bind': ref('loc_cuentas', n.cuenta?.id), 'loc_Autor@odata.bind': ref('loc_miembros', n.autor) })],
]

/** Líneas: cada documento con su búsqueda de navegación. */
const LINEAS = [
  ...ofertas.map(x => ['loc_Oferta', 'loc_ofertas', x]),
  ...pedidosVenta.map(x => ['loc_PedidoVenta', 'loc_pedidoventas', x]),
  ...facturasVenta.map(x => ['loc_FacturaVenta', 'loc_facturaventas', x]),
  ...pedidosCompra.map(x => ['loc_PedidoCompra', 'loc_pedidocompras', x]),
  ...facturasCompra.map(x => ['loc_FacturaCompra', 'loc_facturacompras', x]),
]

/** Enlaces que solo se pueden poner cuando existen las dos filas (oferta ↔ pedido, pedido ↔ factura, oportunidad → potencial…). */
const ENLACES = [
  ['loc_ofertas', OF['OF-26002'].id, { 'loc_Pedido@odata.bind': ref('loc_pedidoventas', PV['PV-26001'].id) }],
  ['loc_pedidoventas', PV['PV-26001'].id, { 'loc_Factura@odata.bind': ref('loc_facturaventas', facturasVenta[0].id) }],
  ['loc_pedidocompras', PC['PC-26001'].id, { 'loc_Factura@odata.bind': ref('loc_facturacompras', facturasCompra[0].id) }],
]

// ─────────────────────────────────────────────── ejecución

const total = PASOS.reduce((s, [, , filas]) => s + filas.length, 0) + LINEAS.reduce((s, [, , x]) => s + x.lineas.length, 0)
log(`${SIMULAR ? 'Simulación: se insertarían' : 'Insertando'} ${total} registros en ${ENTORNO ?? 'el entorno del perfil activo'}…\n`)

const ids = Object.fromEntries([...PASOS.map(p => p[0]), 'loc_lineadocumentos'].map(c => [c, []]))
const guardarIds = () => { if (!SIMULAR) writeFileSync(ARCHIVO_IDS, JSON.stringify(ids, null, 2)) }

try {
  for (const [conjunto, clave, filas, cuerpo] of PASOS) {
    for (const fila of filas) {
      const etiqueta = fila.no ?? fila.asunto ?? fila.texto?.slice(0, 40)
      if (SIMULAR) { log(`+ ${conjunto} ${etiqueta}`); continue }
      peticion(conjunto, { metodo: 'POST', cuerpo: { ...cuerpo(fila), [clave]: fila.id, statecode: 0 } })
      ids[conjunto].push(fila.id); guardarIds()
      log(`+ ${conjunto} ${etiqueta}`)
    }
  }
  for (const [navegacion, conjunto, doc] of LINEAS) {
    for (const [i, l] of doc.lineas.entries()) {
      if (SIMULAR) { log(`  · línea ${doc.no}: ${l.cantidad} × ${l.descripcion}`); continue }
      const lineaId = id()
      peticion('loc_lineadocumentos', { metodo: 'POST', cuerpo: {
        loc_lineadocumentoid: lineaId, loc_descripcion: l.descripcion.slice(0, 500), loc_orden: i, loc_cantidad: l.cantidad, loc_unidad: UNIDAD[l.unidad],
        loc_precio: l.precio, loc_dto: l.dto, loc_iva: 21, [`${navegacion}@odata.bind`]: ref(conjunto, doc.id), 'loc_Producto@odata.bind': ref('loc_productos', l.producto.id), statecode: 0,
      } })
      ids.loc_lineadocumentos.push(lineaId); guardarIds()
      log(`  · línea ${doc.no}: ${l.cantidad} × ${l.descripcion}`)
    }
  }
  for (const [conjunto, guid, cuerpo] of ENLACES) {
    if (SIMULAR) { log(`~ enlace ${conjunto} ${Object.keys(cuerpo)[0]}`); continue }
    peticion(`${conjunto}(${guid})`, { metodo: 'PATCH', cuerpo })
    log(`~ enlace ${conjunto} ${Object.keys(cuerpo)[0]}`)
  }
} catch (e) {
  console.error(`\nFALLO: ${e.message}`)
  console.error(`Los ids insertados hasta ahora están en ${ARCHIVO_IDS}; ejecuta --borrar para deshacer.`)
  process.exit(1)
}

log(SIMULAR ? '\nNada insertado (simulación).' : `\nListo: ${total} registros. Ids guardados en ${ARCHIVO_IDS} (para deshacer: node crm-ejemplos.mjs --borrar).`)
