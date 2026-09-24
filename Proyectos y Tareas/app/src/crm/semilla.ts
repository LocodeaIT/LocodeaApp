/**
 * Datos de ejemplo del CRM: Locodea como consultora de Power Platform, IA y
 * Business Central. Las fechas se calculan desde hoy para que el ejemplo nunca
 * se quede viejo. Los propietarios son los miembros de ../data/seed.ts.
 */
import type {
  ActividadCrm, ColReferente, CondicionPago, Contacto, CrmInstantanea, Cuenta, FacturaCompra, FacturaVenta, LineaDocumento,
  Nota, Oferta, Oportunidad, PedidoCompra, PedidoVenta, Potencial, Producto, RegimenIva,
} from './types'
import { PROBABILIDAD_FASE } from './catalogos'
import { hoy, sumarDias } from '../domain/fechas'

// Mismos ids que los miembros de la semilla de Proyectos y Tareas.
const A = 'm-alejandro'
const J = 'm-jesus'
const M = 'm-marco'

export function generarSemillaCrm(): CrmInstantanea {
  const ahora = new Date()
  const dia = (n: number, h = 10, m = 0) => { const d = new Date(ahora); d.setDate(d.getDate() + n); d.setHours(h, m, 0, 0); return d.toISOString() }
  const soloDia = (n: number) => sumarDias(hoy(), n)
  const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().split(' ')[0]

  // ─────────────────────────────────────────── productos
  const productos: Producto[] = ([
    ['p1', 'P1001', 'Consultoría Power Platform', 'servicio', 'Consultoría', 'hora', 85, 40, 'Análisis, diseño de solución y acompañamiento funcional.'],
    ['p2', 'P1002', 'Desarrollo Power Apps', 'servicio', 'Desarrollo', 'hora', 75, 38, 'Construcción de apps canvas y basadas en modelo.'],
    ['p3', 'P1003', 'Desarrollo Power Automate', 'servicio', 'Desarrollo', 'hora', 75, 38, 'Flujos de automatización con conectores estándar y premium.'],
    ['p4', 'P1004', 'Desarrollo Copilot Studio', 'servicio', 'IA', 'hora', 90, 45, 'Agentes conversacionales conectados a datos de empresa.'],
    ['p5', 'P1005', 'Cuadro de mando Power BI', 'servicio', 'Datos', 'proyecto', 4500, 2200, 'Modelo de datos, informe y publicación en el servicio.'],
    ['p6', 'P1006', 'Integración con Business Central', 'servicio', 'ERP', 'proyecto', 6300, 3100, 'Conector, mapeo de entidades y pruebas con el ERP.'],
    ['p7', 'P1007', 'Soporte y evolutivos', 'servicio', 'Soporte', 'mes', 450, 180, 'Bolsa mensual de soporte con respuesta en 24 h.'],
    ['p8', 'P1008', 'Formación Power Platform', 'servicio', 'Formación', 'dia', 900, 400, 'Jornada de formación presencial o remota, hasta 12 personas.'],
    ['p9', 'P1009', 'Licencia Power Apps Premium', 'licencia', 'Licencias', 'mes', 18.7, 16.9, 'Por usuario y mes. Revendida con margen.'],
    ['p10', 'P1010', 'Licencia Business Central Essentials', 'licencia', 'Licencias', 'mes', 70, 65.5, 'Por usuario y mes.'],
    ['p11', 'P1011', 'Hosting n8n gestionado', 'servicio', 'Infraestructura', 'mes', 60, 24, 'Servidor dedicado con copias diarias.'],
    ['p12', 'P1012', 'Diseño UX de pantallas', 'servicio', 'Diseño', 'dia', 650, 400, 'Maquetas y sistema de diseño para la app.'],
  ] as const).map(([id, no, nombre, tipo, categoria, unidad, precio, coste, descripcion]) => ({
    id, no, nombre, tipo, categoria, unidad, precio, coste, iva: 21, activo: true, descripcion, creadoEl: dia(-300),
  }))

  // ─────────────────────────────────────────── cuentas
  const cuentas: Cuenta[] = ([
    // id, nombre, tipo, CIF, sector, ciudad, provincia, web, teléfono, empleados, propietario, alta, condiciones
    ['a1', 'Apple', 'cliente', 'B82806219', 'Tecnología', 'Madrid', 'Madrid', 'apple.com', '+34 915 21 40 00', '500+', A, -210, '60'],
    ['a2', 'OrtoAlresa', 'cliente', 'A28457216', 'Equipamiento médico', 'Ajalvir', 'Madrid', 'ortoalresa.com', '+34 918 84 43 10', '51–200', J, -180, '30'],
    ['a3', 'Udia', 'cliente', 'B87654321', 'Consultoría', 'Madrid', 'Madrid', 'udia.es', '+34 910 55 32 18', '11–50', A, -160, '30'],
    ['a4', 'Anka', 'cliente', 'B66123984', 'Retail', 'Barcelona', 'Barcelona', 'anka.es', '+34 932 70 18 44', '51–200', M, -150, '30'],
    ['a5', 'Evolve', 'cliente', 'B98765012', 'Marketing digital', 'Valencia', 'Valencia', 'evolve.es', '+34 963 41 27 09', '11–50', J, -120, '15'],
    ['a6', 'Panaderías Churros', 'cliente', 'B41872630', 'Alimentación', 'Sevilla', 'Sevilla', 'panaderiaschurros.es', '+34 954 22 61 35', '51–200', M, -95, '30'],
    ['a7', 'Grupo Logístico Ebro', 'cliente', 'A50193377', 'Logística', 'Zaragoza', 'Zaragoza', 'logisticaebro.com', '+34 976 44 02 18', '201–500', A, -70, '60'],
    ['a8', 'Bodegas Val de Oca', 'cliente', 'B26339902', 'Agroalimentación', 'Haro', 'La Rioja', 'valdeoca.wine', '+34 941 31 08 55', '11–50', J, -60, '30'],
    ['a9', 'Gimnasio Forma 10', 'cliente', 'B01563320', 'Deporte', 'Vitoria-Gasteiz', 'Álava', 'forma10.es', '+34 945 12 84 66', '11–50', M, -40, 'contado'],
    ['a10', 'Colegio Las Encinas', 'cliente', 'R2800419D', 'Educación', 'Madrid', 'Madrid', 'colegiolasencinas.es', '+34 915 63 77 40', '51–200', A, -25, '30'],
    ['a11', 'Microsoft Ibérica', 'proveedor', 'A28062102', 'Licencias de software', 'Pozuelo de Alarcón', 'Madrid', 'microsoft.com/es-es', '+34 913 91 90 00', '500+', A, -300, '30'],
    ['a12', 'Hetzner Online', 'proveedor', 'DE812871812', 'Hosting', 'Gunzenhausen', 'Baviera', 'hetzner.com', '+49 9831 505-0', '201–500', A, -280, '15'],
    ['a13', 'Estudio Trazo', 'proveedor', '48922011K', 'Diseño UX', 'Sevilla', 'Sevilla', 'estudiotrazo.es', '+34 655 20 41 18', '1–10', M, -90, '30'],
  ] as const).map(([id, nombre, tipo, cif, sector, ciudad, provincia, web, telefono, empleados, propietarioId, alta, condicionesPago]) => ({
    id, no: 'C' + (1000 + Number(id.slice(1))), nombre, tipo, estado: 'activo' as const, cif, sector, ciudad, provincia, pais: 'España',
    direccion: '', cp: '', web, telefono, email: 'info@' + web.split('/')[0], empleados, propietarioId,
    condicionesPago: condicionesPago as CondicionPago, metodoPago: 'transferencia' as const, iva: 21, iban: '',
    regimenIva: (id === 'a12' ? 'intracomunitario' : 'general') as RegimenIva, notas: '', creadoEl: dia(alta),
  }))
  cuentas[0].notas = 'Prefieren llamadas por la mañana. El contrato de soporte se renueva en marzo.'
  cuentas[2].notas = 'Quieren sustituir sus Excel de inventario por una Power App antes del verano. Piden pago en 3 hitos.'
  cuentas[5].notas = 'Llegaron por LinkedIn. 40 tiendas que hacen los pedidos al obrador por WhatsApp.'
  const cuenta = (id: string) => cuentas.find(a => a.id === id)!

  // ─────────────────────────────────────────── contactos
  const contactos: Contacto[] = ([
    // id, nombre, apellidos, cuenta, cargo, propietario, alta, móvil
    ['c1', 'Beatriz', 'Solana Ruiz', 'a1', 'IT Manager', A, -205, '+34 646 21 90 11'],
    ['c2', 'Iñaki', 'Goikoetxea', 'a1', 'Responsable de operaciones', A, -200, '+34 688 40 13 72'],
    ['c3', 'Rocío', 'Arroyo Martín', 'a2', 'Directora de calidad', J, -178, '+34 619 55 07 33'],
    ['c4', 'Álvaro', 'Lasheras', 'a3', 'Director de operaciones', A, -158, '+34 677 02 81 45'],
    ['c5', 'Nerea', 'Pascual', 'a3', 'Directora financiera', A, -150, '+34 690 33 72 18'],
    ['c6', 'Tomás', 'Vidal Esteban', 'a4', 'Responsable de sistemas', M, -148, '+34 655 18 26 04'],
    ['c7', 'Fernando', 'Sanz Gil', 'a5', 'CEO', J, -118, '+34 628 71 44 90'],
    ['c8', 'Ainhoa', 'Urrutia', 'a6', 'Directora de expansión', M, -9, '+34 634 90 12 57'],
    ['c9', 'Pilar', 'Del Carmen Ortiz', 'a7', 'Jefa de tráfico', A, -68, '+34 609 27 63 81'],
    ['c10', 'Diego', 'Montes', 'a8', 'Director general', J, -58, '+34 661 84 30 29'],
    ['c11', 'Sara', 'López Aguirre', 'a8', 'Responsable de compras', J, -12, '+34 612 09 55 70'],
    ['c12', 'Rubén', 'Castaño', 'a9', 'Gerente', M, -6, '+34 695 47 18 36'],
    ['c13', 'Carmen', 'Arnaiz Pérez', 'a10', 'Directora', A, -24, '+34 626 38 91 04'],
    ['c14', 'Javier', 'Ortega Ruiz', 'a10', 'Coordinador TIC', A, -3, '+34 670 15 62 88'],
    ['c15', 'Lorena', 'Blanco', 'a4', 'Directora de RR. HH.', M, -140, '+34 651 72 04 19'],
    ['c16', 'Marcos', 'Herrero', 'a2', 'Técnico de compras', J, -170, '+34 617 26 83 50'],
    ['c17', 'María', 'Gómez Lara', 'a11', 'Partner Development Manager', A, -290, '+34 600 11 22 33'],
    ['c18', 'Jonas', 'Weber', 'a12', 'Account Manager', A, -270, '+49 151 2345 6789'],
    ['c19', 'Lucía', 'Trazo', 'a13', 'Diseñadora UX', M, -88, '+34 655 20 41 18'],
  ] as const).map(([id, nombre, apellidos, cuentaId, cargo, propietarioId, alta, movil], i) => {
    const a = cuenta(cuentaId)
    return {
      id, no: 'CT' + (1001 + i), nombre, apellidos, cuentaId, cargo, email: `${slug(nombre)}.${slug(apellidos)}@${a.web.split('/')[0]}`,
      telefono: a.telefono, movil, ciudad: a.ciudad, linkedin: '', propietarioId, estado: 'activo' as const, notas: '', creadoEl: dia(alta),
    }
  })

  // ─────────────────────────────────────────── clientes potenciales
  const potenciales: Potencial[] = ([
    // id, tema, nombre, apellidos, empresa, cargo, origen, puntuación, estado, importe, propietario, alta, ciudad, sector
    ['l1', 'Automatizar altas de empleados en Teams', 'Nuria', 'Ferrer', 'Clínica Dental Sonrisa', 'Directora', 'web', 'caliente', 'abierto', 8000, A, -4, 'Madrid', 'Salud'],
    ['l2', 'App de partes de trabajo para técnicos', 'Pedro', 'Salcedo', 'Instalaciones Salcedo', 'Gerente', 'referido', 'templado', 'abierto', 12000, M, -9, 'Toledo', 'Instalaciones'],
    ['l3', 'Cuadro de mando de ventas', 'Elena', 'Roig', 'Distribuciones Roig', 'Directora comercial', 'linkedin', 'templado', 'abierto', 4500, J, -12, 'Castellón', 'Distribución'],
    ['l4', 'Migrar Access a Dataverse', 'Andrés', 'Pinto', 'Asesoría Pinto y Asociados', 'Socio', 'evento', 'frio', 'abierto', 15000, A, -20, 'Valladolid', 'Asesoría'],
    ['l5', 'Agente de atención al cliente', 'Carla', 'Nieto', 'Seguros Nieto', 'Responsable de marketing', 'web', 'caliente', 'abierto', 9000, J, -2, 'Murcia', 'Seguros'],
    ['l6', 'Power App de pedidos para tiendas', 'Ainhoa', 'Urrutia', 'Panaderías Churros', 'Directora de expansión', 'referido', 'caliente', 'calificado', 9400, M, -14, 'Sevilla', 'Alimentación'],
    ['l7', 'Facturación electrónica', 'Roberto', 'Lima', 'Talleres Lima', 'Gerente', 'llamada', 'frio', 'descalificado', 3000, A, -30, 'Jaén', 'Automoción'],
    ['l8', 'Chatbot para la intranet municipal', 'Sofía', 'Márquez', 'Ayuntamiento de Ribera', 'Técnica de informática', 'evento', 'templado', 'abierto', 6000, M, -6, 'Ribera', 'Administración pública'],
  ] as const).map(([id, tema, nombre, apellidos, empresa, cargo, origen, puntuacion, estado, importeEst, propietarioId, alta, ciudad, sector], i) => ({
    id, no: 'CP' + (1001 + i), tema, nombre, apellidos, empresa, cargo, email: `${slug(nombre)}@${slug(empresa)}.es`,
    telefono: '+34 6' + String(10000000 + i * 1234567).slice(0, 8), ciudad, sector, origen, puntuacion, estado, fase: 'calificar' as const,
    importeEst, propietarioId, descripcion: '', creadoEl: dia(alta),
    calificadoEl: estado === 'calificado' ? dia(-8) : null, descalificadoEl: estado === 'descalificado' ? dia(-22) : null,
    motivo: estado === 'descalificado' ? 'Sin presupuesto este año' : '', cuentaId: null, contactoId: null, oportunidadId: null,
  }))
  potenciales[0].descripcion = 'Cada alta de empleado son 6 correos y 3 formularios. Quieren un flujo que lo haga todo desde Teams.'
  Object.assign(potenciales[5], { cuentaId: 'a6', contactoId: 'c8', oportunidadId: 'o4' })

  // ─────────────────────────────────────────── oportunidades
  const oportunidades: Oportunidad[] = ([
    // id, tema, cuenta, contacto, importe, fase, estado, cierre previsto, propietario, alta, cierre real, motivo
    ['o1', 'App de inventario en Power Apps', 'a3', 'c4', 48500, 'proponer', 'abierta', 12, A, -60, null, ''],
    ['o2', 'App de socios y reservas', 'a9', 'c12', 21800, 'calificar', 'abierta', 40, M, -5, null, ''],
    ['o3', 'Automatización de pedidos con IA', 'a8', 'c10', 36200, 'proponer', 'abierta', 18, J, -40, null, ''],
    ['o4', 'Power App de pedidos para tiendas', 'a6', 'c8', 9400, 'desarrollar', 'abierta', 25, M, -8, null, ''],
    ['o5', 'Soporte y evolutivos 2027', 'a1', 'c1', 5400, 'proponer', 'abierta', -2, A, -20, null, ''],
    ['o6', 'Portal de familias en Power Pages', 'a10', 'c13', 27500, 'desarrollar', 'abierta', 55, M, -35, null, ''],
    ['o7', 'Auditoría de Power Platform', 'a4', 'c6', 3200, 'calificar', 'abierta', 30, A, -7, null, ''],
    ['o8', 'Agente IA para no conformidades', 'a2', 'c3', 7600, 'cerrar', 'abierta', 6, J, -28, null, ''],
    ['o9', 'Integración con Business Central', 'a2', 'c3', 6300, 'cerrar', 'ganada', -3, J, -18, -3, ''],
    ['o10', 'Plataforma de mantenimiento en Power Apps', 'a1', 'c1', 41100, 'cerrar', 'ganada', -20, A, -80, -20, ''],
    ['o11', 'Lectura de facturas con IA', 'a5', 'c7', 19200, 'cerrar', 'ganada', -100, J, -115, -100, ''],
    ['o12', 'Intranet en SharePoint', 'a4', 'c15', 22000, 'cerrar', 'perdida', -110, M, -140, -110, 'Eligieron a otro proveedor por precio'],
  ] as const).map(([id, titulo, cuentaId, contactoId, importe, fase, estado, cierre, propietarioId, alta, cerrada, motivoPerdida], i) => ({
    id, no: 'OP' + (1001 + i), titulo, cuentaId, contactoId, importe, fase, estado,
    probabilidad: estado === 'ganada' ? 100 : estado === 'perdida' ? 0 : PROBABILIDAD_FASE[fase],
    cierrePrevisto: soloDia(cierre), propietarioId, notas: '', creadoEl: dia(alta), cerradaEl: cerrada === null ? null : dia(cerrada, 17),
    motivoPerdida, potencialId: id === 'o4' ? 'l6' : null,
  }))
  oportunidades[0].notas = 'Compiten con una consultora grande. Nuestro punto fuerte: primera versión funcionando en 3 semanas.'

  // ─────────────────────────────────────────── documentos
  const producto = (id: string) => productos.find(p => p.id === id)!
  const L = (productoId: string, cantidad: number, dto = 0): LineaDocumento => { const p = producto(productoId); return { productoId, descripcion: p.nombre, cantidad, unidad: p.unidad, precio: p.precio, dto, iva: 21 } }
  const LC = (productoId: string, cantidad: number): LineaDocumento => { const p = producto(productoId); return { productoId, descripcion: p.nombre, cantidad, unidad: p.unidad, precio: p.coste, dto: 0, iva: 21 } }
  const doc = { metodoPago: 'transferencia' as const, referencia: '', notas: '', creadoEl: dia(-1) }

  const ofertas: Oferta[] = [
    { id: 'q1', no: 'OF-26001', cuentaId: 'a1', contactoId: 'c1', oportunidadId: 'o10', fecha: soloDia(-32), validaHasta: soloDia(-2), estado: 'convertida', propietarioId: A, pedidoId: 'so1', lineas: [L('p2', 440), L('p6', 1), L('p8', 2)], condicionesPago: '60' },
    { id: 'q2', no: 'OF-26002', cuentaId: 'a2', contactoId: 'c3', oportunidadId: 'o9', fecha: soloDia(-18), validaHasta: soloDia(12), estado: 'convertida', propietarioId: J, pedidoId: 'so2', lineas: [L('p6', 1)], condicionesPago: '30' },
    { id: 'q3', no: 'OF-26003', cuentaId: 'a3', contactoId: 'c4', oportunidadId: 'o1', fecha: soloDia(-5), validaHasta: soloDia(25), estado: 'enviada', propietarioId: A, pedidoId: null, lineas: [L('p2', 500, 5), L('p1', 60), L('p8', 3), L('p7', 12)], condicionesPago: '30' },
    { id: 'q4', no: 'OF-26004', cuentaId: 'a8', contactoId: 'c10', oportunidadId: 'o3', fecha: soloDia(-1), validaHasta: soloDia(29), estado: 'enviada', propietarioId: J, pedidoId: null, lineas: [L('p4', 240), L('p3', 160), L('p1', 30)], condicionesPago: '30' },
    { id: 'q5', no: 'OF-26005', cuentaId: 'a1', contactoId: 'c1', oportunidadId: 'o5', fecha: soloDia(0), validaHasta: soloDia(30), estado: 'borrador', propietarioId: A, pedidoId: null, lineas: [L('p7', 12)], condicionesPago: '60' },
    { id: 'q6', no: 'OF-26006', cuentaId: 'a2', contactoId: 'c3', oportunidadId: 'o8', fecha: soloDia(-6), validaHasta: soloDia(24), estado: 'enviada', propietarioId: J, pedidoId: null, lineas: [L('p4', 70), L('p1', 15)], condicionesPago: '30' },
    { id: 'q7', no: 'OF-26007', cuentaId: 'a4', contactoId: 'c15', oportunidadId: 'o12', fecha: soloDia(-118), validaHasta: soloDia(-88), estado: 'rechazada', propietarioId: M, pedidoId: null, lineas: [L('p2', 250), L('p1', 40)], condicionesPago: '30' },
    { id: 'q8', no: 'OF-26008', cuentaId: 'a5', contactoId: 'c7', oportunidadId: 'o11', fecha: soloDia(-108), validaHasta: soloDia(-78), estado: 'convertida', propietarioId: J, pedidoId: 'so3', lineas: [L('p4', 180), L('p3', 40)], condicionesPago: '15' },
  ].map(q => ({ ...doc, ...q } as Oferta))
  ofertas[2].notas = 'Pago en tres hitos: 40 % al inicio, 40 % en la entrega, 20 % tras un mes en producción.'

  const pedidosVenta: PedidoVenta[] = [
    { id: 'so1', no: 'PV-26001', cuentaId: 'a1', contactoId: 'c1', ofertaId: 'q1', oportunidadId: 'o10', fecha: soloDia(-28), fechaEntrega: soloDia(-5), estado: 'facturado', propietarioId: A, facturaId: 'si1', lineas: [L('p2', 440), L('p6', 1), L('p8', 2)], condicionesPago: '60', refCliente: '' },
    { id: 'so2', no: 'PV-26002', cuentaId: 'a2', contactoId: 'c3', ofertaId: 'q2', oportunidadId: 'o9', fecha: soloDia(-16), fechaEntrega: soloDia(-3), estado: 'facturado', propietarioId: J, facturaId: 'si2', lineas: [L('p6', 1)], condicionesPago: '30', refCliente: '' },
    { id: 'so3', no: 'PV-26003', cuentaId: 'a5', contactoId: 'c7', ofertaId: 'q8', oportunidadId: 'o11', fecha: soloDia(-100), fechaEntrega: soloDia(-70), estado: 'facturado', propietarioId: J, facturaId: 'si3', lineas: [L('p4', 180), L('p3', 40)], condicionesPago: '15', refCliente: '' },
    { id: 'so4', no: 'PV-26004', cuentaId: 'a7', contactoId: 'c9', ofertaId: null, oportunidadId: null, fecha: soloDia(-40), fechaEntrega: soloDia(-4), estado: 'enviado', propietarioId: A, facturaId: null, lineas: [L('p2', 100), L('p8', 1)], condicionesPago: '60', refCliente: 'PED-2026-0417' },
    { id: 'so5', no: 'PV-26005', cuentaId: 'a1', contactoId: 'c2', ofertaId: null, oportunidadId: null, fecha: soloDia(-10), fechaEntrega: soloDia(9), estado: 'liberado', propietarioId: A, facturaId: null, lineas: [L('p8', 3), L('p9', 20)], condicionesPago: '60', refCliente: '' },
    { id: 'so6', no: 'PV-26006', cuentaId: 'a10', contactoId: 'c14', ofertaId: null, oportunidadId: null, fecha: soloDia(0), fechaEntrega: soloDia(14), estado: 'abierto', propietarioId: A, facturaId: null, lineas: [L('p9', 40)], condicionesPago: '30', refCliente: '' },
  ].map(o => ({ ...doc, ...o } as PedidoVenta))

  const facturasVenta: FacturaVenta[] = [
    { id: 'si1', no: 'FV-26001', cuentaId: 'a1', contactoId: 'c1', pedidoId: 'so1', fecha: soloDia(-27), vencimiento: soloDia(33), estado: 'pagada', pagadaEl: dia(-5), registradaEl: dia(-27), propietarioId: A, lineas: [L('p2', 440), L('p6', 1), L('p8', 2)], condicionesPago: '60' },
    { id: 'si2', no: 'FV-26002', cuentaId: 'a2', contactoId: 'c3', pedidoId: 'so2', fecha: soloDia(-15), vencimiento: soloDia(15), estado: 'registrada', pagadaEl: null, registradaEl: dia(-15), propietarioId: J, lineas: [L('p6', 1)], condicionesPago: '30' },
    { id: 'si3', no: 'FV-26003', cuentaId: 'a5', contactoId: 'c7', pedidoId: 'so3', fecha: soloDia(-99), vencimiento: soloDia(-84), estado: 'pagada', pagadaEl: dia(-80), registradaEl: dia(-99), propietarioId: J, lineas: [L('p4', 180), L('p3', 40)], condicionesPago: '15' },
    { id: 'si4', no: 'FV-26004', cuentaId: 'a7', contactoId: 'c9', pedidoId: null, fecha: soloDia(-50), vencimiento: soloDia(-20), estado: 'registrada', pagadaEl: null, registradaEl: dia(-50), propietarioId: A, lineas: [L('p2', 96), L('p1', 18)], condicionesPago: '60', referencia: 'App de visitas técnicas', importeCobrado: 3000 },
    { id: 'si5', no: 'FV-26005', cuentaId: 'a8', contactoId: 'c10', pedidoId: null, fecha: soloDia(-40), vencimiento: soloDia(-10), estado: 'registrada', pagadaEl: null, registradaEl: dia(-40), propietarioId: J, lineas: [L('p2', 32)], condicionesPago: '30', referencia: 'Mejoras en la app de recuento' },
    { id: 'si6', no: 'FV-26006', cuentaId: 'a1', contactoId: 'c1', pedidoId: null, fecha: soloDia(0), vencimiento: soloDia(60), estado: 'borrador', pagadaEl: null, registradaEl: null, propietarioId: A, lineas: [L('p7', 1)], condicionesPago: '60', referencia: 'Soporte · mes en curso' },
    { id: 'si7', no: 'FV-26007', cuentaId: 'a6', contactoId: 'c8', pedidoId: null, fecha: soloDia(-8), vencimiento: soloDia(22), estado: 'registrada', pagadaEl: null, registradaEl: dia(-8), propietarioId: M, lineas: [L('p8', 1)], condicionesPago: '30', referencia: 'Formación en el obrador' },
  ].map(o => ({ ...doc, importeCobrado: 0, ...o } as FacturaVenta))

  const pedidosCompra: PedidoCompra[] = [
    { id: 'po1', no: 'PC-26001', cuentaId: 'a11', contactoId: 'c17', fecha: soloDia(-14), recepcionPrevista: soloDia(-12), estado: 'facturado', propietarioId: A, facturaId: 'pi1', lineas: [LC('p9', 40)], condicionesPago: '30', refProveedor: 'MS-ORD-88123' },
    { id: 'po2', no: 'PC-26002', cuentaId: 'a12', contactoId: 'c18', fecha: soloDia(-3), recepcionPrevista: soloDia(2), estado: 'liberado', propietarioId: A, facturaId: null, lineas: [LC('p11', 3)], condicionesPago: '15', refProveedor: '' },
    { id: 'po3', no: 'PC-26003', cuentaId: 'a13', contactoId: 'c19', fecha: soloDia(0), recepcionPrevista: soloDia(12), estado: 'abierto', propietarioId: M, facturaId: null, lineas: [LC('p12', 4)], condicionesPago: '30', refProveedor: '' },
  ].map(o => ({ ...doc, ...o } as PedidoCompra))

  const facturasCompra: FacturaCompra[] = [
    { id: 'pi1', no: 'FC-26001', cuentaId: 'a11', contactoId: 'c17', pedidoId: 'po1', noProveedor: 'MS-4471020', fecha: soloDia(-10), vencimiento: soloDia(20), estado: 'registrada', registradaEl: dia(-10), pagadaEl: null, propietarioId: A, lineas: [LC('p9', 40)], condicionesPago: '30' },
    { id: 'pi2', no: 'FC-26002', cuentaId: 'a12', contactoId: 'c18', pedidoId: null, noProveedor: 'R0012345678', fecha: soloDia(-35), vencimiento: soloDia(-20), estado: 'pagada', registradaEl: dia(-35), pagadaEl: dia(-22), propietarioId: A, lineas: [LC('p11', 3)], condicionesPago: '15' },
    { id: 'pi3', no: 'FC-26003', cuentaId: 'a13', contactoId: 'c19', pedidoId: null, noProveedor: '2026-017', fecha: soloDia(-45), vencimiento: soloDia(-15), estado: 'registrada', registradaEl: dia(-45), pagadaEl: null, propietarioId: M, lineas: [LC('p12', 5)], condicionesPago: '30', referencia: 'Mockups del portal de familias' },
    { id: 'pi4', no: 'FC-26004', cuentaId: 'a11', contactoId: 'c17', pedidoId: null, noProveedor: 'MS-4472311', fecha: soloDia(-2), vencimiento: soloDia(28), estado: 'pendiente', registradaEl: null, pagadaEl: null, propietarioId: A, lineas: [LC('p10', 3)], condicionesPago: '30' },
  ].map(o => ({ ...doc, importePagado: 0, ...o } as FacturaCompra))

  // ─────────────────────────────────────────── actividades
  const todos: Record<ColReferente, { id: string; cuentaId?: string | null }[]> = {
    cuentas, contactos, potenciales, oportunidades, ofertas, pedidosVenta, facturasVenta, pedidosCompra, facturasCompra, productos,
  }
  const cuentaDe = (col: ColReferente, id: string) => col === 'cuentas' ? id : (todos[col].find(x => x.id === id)?.cuentaId ?? null)

  const actividades: ActividadCrm[] = ([
    // id, asunto, tipo, día, hora, referente a (colección, id), propietario, prioridad, estado
    ['t1', 'Enviar oferta revisada con pago por hitos', 'correo', -2, '09:00', 'oportunidades', 'o1', A, 'alta', 'abierta'],
    ['t2', 'Llamar para agendar la auditoría', 'llamada', -1, '11:00', 'oportunidades', 'o7', A, 'normal', 'abierta'],
    ['t3', 'Demo de la Power App en el obrador', 'cita', 0, '16:00', 'oportunidades', 'o4', M, 'alta', 'abierta'],
    ['t4', 'Seguimiento de la oferta OF-26004', 'tarea', 0, '12:00', 'ofertas', 'q4', J, 'normal', 'abierta'],
    ['t5', 'Reunión con dirección financiera', 'cita', 1, '10:00', 'cuentas', 'a3', A, 'alta', 'abierta'],
    ['t6', 'Llamada de presentación', 'llamada', 1, '17:00', 'potenciales', 'l1', A, 'normal', 'abierta'],
    ['t7', 'Preparar mockups del portal de familias', 'tarea', 3, '09:00', 'oportunidades', 'o6', M, 'normal', 'abierta'],
    ['t8', 'Reclamar la factura FV-26004', 'llamada', 0, '10:30', 'facturasVenta', 'si4', A, 'alta', 'abierta'],
    ['t9', 'Reclamar la factura FV-26005', 'correo', 2, '09:30', 'facturasVenta', 'si5', J, 'normal', 'abierta'],
    ['t10', 'Revisar el contrato de soporte 2027', 'tarea', 4, '10:00', 'oportunidades', 'o5', A, 'normal', 'abierta'],
    ['t11', 'Taller de requisitos del cuadro de mando', 'cita', 8, '09:00', 'potenciales', 'l3', J, 'normal', 'abierta'],
    ['t12', 'Llamar tras la puesta en producción', 'llamada', -6, '10:00', 'cuentas', 'a2', J, 'normal', 'completada'],
    ['t13', 'Enviar la factura final', 'correo', -4, '09:00', 'pedidosVenta', 'so1', A, 'normal', 'completada'],
    ['t14', 'Cualificar necesidades', 'llamada', -4, '12:00', 'potenciales', 'l6', M, 'normal', 'completada'],
    ['t15', 'Pedir presupuesto de servidores', 'correo', -3, '16:00', 'pedidosCompra', 'po2', A, 'baja', 'completada'],
    ['t16', 'Enviar propuesta del agente de atención', 'correo', 2, '11:00', 'potenciales', 'l5', J, 'alta', 'abierta'],
  ] as const).map(([id, asunto, tipo, d, hora, referenteTipo, referenteId, propietarioId, prioridad, estado]) => ({
    id, asunto, tipo, fecha: soloDia(d), hora, referenteTipo, referenteId, cuentaId: cuentaDe(referenteTipo, referenteId), propietarioId, prioridad, estado,
    completadaEl: estado === 'completada' ? dia(d, 13) : null, descripcion: '', creadoEl: dia(d - 5),
  }))

  // ─────────────────────────────────────────── notas
  const notas: Nota[] = ([
    ['Llamada con Álvaro: les encaja la demo, falta cerrar el calendario de pagos.', 'oportunidades', 'o1', A, -2, 11],
    ['Diego comenta que otra consultora es un 8 % más barata pero sin soporte incluido.', 'oportunidades', 'o3', J, -1, 17],
    ['Revisión trimestral: la app de visitas técnicas ya la usan 120 técnicos.', 'cuentas', 'a1', A, -3, 10],
    ['Ainhoa envía el Excel con los pedidos de las 40 tiendas.', 'oportunidades', 'o4', M, -4, 12],
    ['No contesta. Dejado mensaje en el buzón.', 'oportunidades', 'o7', M, -5, 18],
    ['Rocío confirma que quiere el agente antes de la auditoría ISO de noviembre.', 'oportunidades', 'o8', J, -8, 9],
    ['Sara quiere que el agente consulte stock y proveedores desde Teams.', 'cuentas', 'a8', J, -12, 16],
    ['Reunión en el colegio con Carmen para el portal de familias.', 'oportunidades', 'o6', M, -5, 10],
    ['Nuria pide referencias de otras clínicas. Le paso el caso de OrtoAlresa.', 'potenciales', 'l1', A, -1, 12],
    ['Pilar dice que contabilidad paga a 60 días desde la recepción; la factura les llegó tarde.', 'facturasVenta', 'si4', A, -6, 13],
    ['Licencias activadas en el tenant del cliente.', 'pedidosCompra', 'po1', A, -12, 9],
  ] as const).map(([texto, referenteTipo, referenteId, autorId, d, h], i) => {
    const f = dia(d, h, (i * 7) % 60)
    return { id: 'n' + (i + 1), texto, referenteTipo, referenteId, cuentaId: cuentaDe(referenteTipo, referenteId), autorId, fecha: f, creadoEl: f }
  })

  return { cuentas, contactos, potenciales, oportunidades, ofertas, pedidosVenta, facturasVenta, pedidosCompra, facturasCompra, productos, actividades, notas }
}
