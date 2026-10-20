/**
 * Motor de precios de Locodea: de un alcance (desarrollo Power Platform,
 * migración y formación) y un perfil de cliente saca el precio de la
 * propuesta y el mantenimiento, y lo convierte en líneas de oferta o pedido.
 * Es puro (sin React ni Dataverse) y tiene sus pruebas en motor.test.ts.
 *
 * Cómo se calcula:
 *  1. Cada línea: cantidad × precio de la herramienta × complejidad. Las de
 *     desarrollo suman el recargo de integración (fracción del precio) si se
 *     conectan a un programa que el cliente ya usa. La migración y la
 *     formación no llevan integración.
 *  2. Puesta en marcha: una vez por cada programa distinto a conectar.
 *  3. Ajustes del cliente: tamaño (media ponderada de trabajadores y
 *     facturación), país y plazo multiplican; la relación descuenta.
 *  4. Precio mínimo y redondeo.
 *  5. Mantenimiento aparte: % del proyecto con un mínimo, o la cuota pactada.
 *
 * Las tarifas viven en Dataverse (loc_tarifaprecio) y se editan en la
 * pantalla Tarifas; aquí solo están los valores de partida.
 */
import type { LineaDocumento } from '../crm/types'
import { eur0 } from '../crm/formato'

/** Opción con su multiplicador (o recargo, en la integración). */
export interface Factor {
  id: string
  etiqueta: string
  f: number
  detalle?: string
}

/** Apartado de la calculadora en el que sale la herramienta. */
export type Seccion = 'desarrollo' | 'migracion' | 'formacion'

export const SECCIONES: { id: Seccion; titulo: string }[] = [
  { id: 'desarrollo', titulo: 'Desarrollo Power Platform' },
  { id: 'migracion', titulo: 'Migración' },
  { id: 'formacion', titulo: 'Formación' },
]

export interface HerramientaTarifa {
  id: string
  nombre: string
  /** Qué es una unidad: aplicación, flujo, migración de datos, hora… */
  unidad: string
  /** Precio por unidad de complejidad media, sin IVA. */
  precio: number
  color: string
  seccion: Seccion
}

export interface Tarifas {
  herramientas: HerramientaTarifa[]
  complejidad: Factor[]
  /** `f` es el recargo sobre el precio de la pieza: 0,6 = +60 %. La primera es «Sin integración». */
  integracion: Factor[]
  /** Por cada programa distinto a conectar, una vez. */
  puestaEnMarcha: number
  empleados: Factor[]
  facturacion: Factor[]
  paises: Factor[]
  plazo: Factor[]
  /** `f` < 1 es descuento: 0,95 = −5 %. */
  relacion: Factor[]
  /** Peso de los trabajadores frente a la facturación en el factor de tamaño (0–1). */
  pesoEmpleados: number
  precioMinimo: number
  /** Fracciones: 0,1 = 10 %. */
  descuentoMaximo: number
  techo: number
  /** Cuota mensual de mantenimiento como fracción del proyecto, y su mínimo en euros. */
  mantenimiento: number
  mantenimientoMinimo: number
  redondeo: number
}

export interface LineaCalculo {
  herramientaId: string
  cantidad: number
  complejidad: string
  integracion: string
}

export interface MantenimientoCalculo {
  incluido: boolean
  meses: number
  /** Cuota mensual pactada a mano; null = la automática. */
  cuotaPactada: number | null
}

/** Lo que se elige en la calculadora. Se guarda con la oferta o el pedido. */
export interface Calculo {
  lineas: LineaCalculo[]
  /** Programas distintos a conectar (solo cuenta si alguna línea lleva integración). */
  programas: number
  empleados: string
  facturacion: string
  pais: string
  plazo: string
  relacion: string
  mantenimiento: MantenimientoCalculo
}

/** Cálculo guardado en un documento: la entrada y el precio que se aplicó. */
export interface CalculoGuardado {
  entrada: Calculo
  precio: number
  /** Instante ISO en que se aplicó. */
  aplicadoEl: string
}

export const SIN_INTEGRACION = 'ninguna'

export const TARIFAS_INICIALES: Tarifas = {
  herramientas: [
    { id: 'apps', nombre: 'Power Apps', unidad: 'aplicación', precio: 1800, color: '#7a3e9d', seccion: 'desarrollo' },
    { id: 'automate', nombre: 'Power Automate', unidad: 'flujo', precio: 350, color: '#2f6fd6', seccion: 'desarrollo' },
    { id: 'bi', nombre: 'Power BI', unidad: 'informe', precio: 900, color: '#c99a00', seccion: 'desarrollo' },
    { id: 'copilot', nombre: 'Copilot Studio', unidad: 'agente', precio: 1200, color: '#1f8f7a', seccion: 'desarrollo' },
    { id: 'pages', nombre: 'Power Pages', unidad: 'portal', precio: 2500, color: '#a8435d', seccion: 'desarrollo' },
    { id: 'migracion', nombre: 'Migración', unidad: 'migración de datos', precio: 800, color: '#4f6b78', seccion: 'migracion' },
    { id: 'formacion', nombre: 'Formación', unidad: 'hora', precio: 60, color: '#8a7b5c', seccion: 'formacion' },
  ],
  complejidad: [
    { id: 'baja', etiqueta: 'Baja', f: 0.6 },
    { id: 'media', etiqueta: 'Media', f: 1 },
    { id: 'alta', etiqueta: 'Alta', f: 1.6 },
  ],
  integracion: [
    { id: SIN_INTEGRACION, etiqueta: 'Sin integración', f: 0 },
    { id: 'estandar', etiqueta: 'Conector estándar', f: 0.3, detalle: 'Excel, SharePoint, Outlook, Teams' },
    { id: 'api', etiqueta: 'Programa con API', f: 0.6, detalle: 'Holded, Odoo, Sage, A3…' },
    { id: 'sinapi', etiqueta: 'Programa sin API', f: 1, detalle: 'Base de datos local, ficheros, gateway' },
  ],
  puestaEnMarcha: 300,
  // mismos tramos que el campo Empleados de las cuentas del CRM
  empleados: [
    { id: '1–10', etiqueta: '1–10', f: 0.85 },
    { id: '11–50', etiqueta: '11–50', f: 0.95 },
    { id: '51–200', etiqueta: '51–200', f: 1 },
    { id: '201–500', etiqueta: '201–500', f: 1.1 },
    { id: '500+', etiqueta: 'Más de 500', f: 1.2 },
  ],
  facturacion: [
    { id: 'hasta100k', etiqueta: '< 100 k€', f: 0.7 },
    { id: '100ka500k', etiqueta: '100–500 k€', f: 0.75 },
    { id: '500ka2m', etiqueta: '500 k–2 M€', f: 0.85 },
    { id: '2a10m', etiqueta: '2–10 M€', f: 0.95 },
    { id: '10a50m', etiqueta: '10–50 M€', f: 1 },
    { id: '50a250m', etiqueta: '50–250 M€', f: 1.1 },
    { id: 'mas250m', etiqueta: '> 250 M€', f: 1.2 },
  ],
  // ids: código ISO del país, como `codigoPais` de las cuentas
  paises: [
    { id: 'ES', etiqueta: 'España', f: 1 },
    { id: 'PT', etiqueta: 'Portugal', f: 0.9 },
    { id: 'AD', etiqueta: 'Andorra', f: 1.05 },
    { id: 'FR', etiqueta: 'Francia', f: 1.15 },
    { id: 'IT', etiqueta: 'Italia', f: 1.05 },
    { id: 'DE', etiqueta: 'Alemania', f: 1.2 },
    { id: 'GB', etiqueta: 'Reino Unido', f: 1.2 },
    { id: 'CH', etiqueta: 'Suiza', f: 1.35 },
    { id: 'US', etiqueta: 'Estados Unidos', f: 1.3 },
    { id: 'MX', etiqueta: 'México', f: 0.75 },
    { id: 'CO', etiqueta: 'Colombia', f: 0.7 },
    { id: 'CL', etiqueta: 'Chile', f: 0.8 },
    { id: 'PE', etiqueta: 'Perú', f: 0.7 },
    { id: 'AR', etiqueta: 'Argentina', f: 0.7 },
    { id: 'XX', etiqueta: 'Otro país', f: 1 },
  ],
  plazo: [
    { id: 'estandar', etiqueta: 'Estándar', f: 1 },
    { id: 'urgente', etiqueta: 'Urgente', f: 1.15 },
    { id: 'muyurgente', etiqueta: 'Muy urgente', f: 1.3 },
  ],
  relacion: [
    { id: 'grupo1', etiqueta: 'Grupo 1', f: 0.85, detalle: 'Contactos cercanos' },
    { id: 'grupo2', etiqueta: 'Grupo 2', f: 0.95, detalle: 'Contactos de contactos' },
    { id: 'externo', etiqueta: 'Externo', f: 1, detalle: 'Sin relación previa' },
  ],
  pesoEmpleados: 0.5,
  precioMinimo: 600,
  descuentoMaximo: 0.1,
  techo: 0.15,
  mantenimiento: 0.02,
  mantenimientoMinimo: 50,
  redondeo: 50,
}

const clonar = <T,>(o: T): T => JSON.parse(JSON.stringify(o)) as T
const num = (v: unknown, defecto: number) => (typeof v === 'number' && Number.isFinite(v) ? v : defecto)
const SECCION_VALIDA = new Set<string>(SECCIONES.map(s => s.id))

/** Completa unas tarifas leídas de Dataverse con los valores de partida (por si faltan claves de una versión anterior). */
export function normalizarTarifas(t: Partial<Tarifas> | null | undefined): Tarifas {
  const base = clonar(TARIFAS_INICIALES)
  if (!t) return base
  const lista = <K extends keyof Tarifas>(k: K) => (Array.isArray(t[k]) && (t[k] as unknown[]).length ? clonar(t[k]) : base[k]) as Tarifas[K]
  const herramientas = lista('herramientas').map(h => ({ ...h, seccion: SECCION_VALIDA.has(h.seccion) ? h.seccion : 'desarrollo' as Seccion }))
  return {
    herramientas, complejidad: lista('complejidad'), integracion: lista('integracion'),
    empleados: lista('empleados'), facturacion: lista('facturacion'), paises: lista('paises'), plazo: lista('plazo'), relacion: lista('relacion'),
    puestaEnMarcha: num(t.puestaEnMarcha, base.puestaEnMarcha), pesoEmpleados: num(t.pesoEmpleados, base.pesoEmpleados),
    precioMinimo: num(t.precioMinimo, base.precioMinimo), descuentoMaximo: num(t.descuentoMaximo, base.descuentoMaximo),
    techo: num(t.techo, base.techo), mantenimiento: num(t.mantenimiento, base.mantenimiento),
    mantenimientoMinimo: num(t.mantenimientoMinimo, base.mantenimientoMinimo), redondeo: num(t.redondeo, base.redondeo),
  }
}

/** La opción elegida o, si ya no existe, la primera de la lista. */
export function factorDe(lista: Factor[], id: string): Factor {
  return lista.find(x => x.id === id) ?? lista[0] ?? { id, etiqueta: id, f: 1 }
}

const redondear = (n: number, paso: number) => (paso > 0 ? Math.round(n / paso) * paso : Math.round(n * 100) / 100)
const centimos = (n: number) => Math.round(n * 100) / 100

/** Calculadora vacía para un cliente; toma el país y el tramo de empleados si se conocen. */
export function calculoNuevo(t: Tarifas, cliente: { pais?: string; empleados?: string } = {}): Calculo {
  const elegir = (lista: Factor[], id: string | undefined, defecto: string) =>
    (id && lista.some(x => x.id === id) ? id : lista.some(x => x.id === defecto) ? defecto : lista[0]?.id ?? '')
  return {
    lineas: [], programas: 1,
    empleados: elegir(t.empleados, cliente.empleados, '11–50'),
    facturacion: elegir(t.facturacion, undefined, '2a10m'),
    pais: elegir(t.paises, cliente.pais, 'ES'),
    plazo: t.plazo[0]?.id ?? '',
    relacion: elegir(t.relacion, undefined, 'externo'),
    mantenimiento: { incluido: false, meses: 12, cuotaPactada: null },
  }
}

/** Un cálculo guardado con una versión anterior, completado. */
export function normalizarCalculo(c: Partial<Calculo>, t: Tarifas): Calculo {
  const base = calculoNuevo(t)
  return { ...base, ...c, lineas: Array.isArray(c.lineas) ? c.lineas : [], mantenimiento: { ...base.mantenimiento, ...(c.mantenimiento ?? {}) } }
}

export interface ResultadoLinea {
  linea: LineaCalculo
  herramienta: HerramientaTarifa | undefined
  seccion: Seccion
  cantidad: number
  /** Cantidad × precio × complejidad. */
  trabajo: number
  integracion: number
  total: number
}

export interface Resultado {
  lineas: ResultadoLinea[]
  desarrollo: number
  migracion: number
  formacion: number
  horasFormacion: number
  piezasIntegradas: number
  programas: number
  puesta: number
  /** Recargos de integración más la puesta en marcha. */
  integracion: number
  base: number
  fTamano: number
  fPais: number
  fPlazo: number
  fRelacion: number
  /** Base con tamaño, país y plazo, antes del descuento por relación. */
  ajustado: number
  descuento: number
  minimoAplicado: boolean
  /** Precio recomendado del proyecto, redondeado. 0 si no hay alcance. */
  precio: number
  minimoNegociable: number
  techo: number
  mantenimiento: {
    automatica: number
    pactada: boolean
    /** Cuota mensual que se aplica. */
    cuota: number
    meses: number
    /** Cuota × meses si está incluido; 0 si no. */
    total: number
  }
}

export function calcular(t: Tarifas, c: Calculo): Resultado {
  const lineas = c.lineas.map((linea): ResultadoLinea => {
    const herramienta = t.herramientas.find(h => h.id === linea.herramientaId)
    const seccion = herramienta?.seccion ?? 'desarrollo'
    const cantidad = Math.max(0, Math.floor(Number(linea.cantidad) || 0))
    const unidad = herramienta?.precio ?? 0
    const trabajo = cantidad * unidad * factorDe(t.complejidad, linea.complejidad).f
    // la migración y la formación no llevan integración: lo difícil va en la complejidad
    const conIntegracion = seccion === 'desarrollo' && linea.integracion !== SIN_INTEGRACION
    const integracion = conIntegracion ? cantidad * unidad * (t.integracion.find(i => i.id === linea.integracion)?.f ?? 0) : 0
    return { linea, herramienta, seccion, cantidad, trabajo, integracion, total: trabajo + integracion }
  })
  const suma = (s: Seccion) => lineas.filter(l => l.seccion === s).reduce((a, l) => a + l.trabajo, 0)
  const desarrollo = suma('desarrollo')
  const migracion = suma('migracion')
  const formacion = suma('formacion')
  const horasFormacion = lineas.filter(l => l.seccion === 'formacion').reduce((a, l) => a + l.cantidad, 0)
  const piezasIntegradas = lineas.reduce((s, l) => s + (l.integracion > 0 ? l.cantidad : 0), 0)
  const programas = piezasIntegradas > 0 ? Math.max(1, Math.floor(Number(c.programas) || 0)) : 0
  const puesta = programas * t.puestaEnMarcha
  const integracion = lineas.reduce((s, l) => s + l.integracion, 0) + puesta
  const base = desarrollo + migracion + formacion + integracion

  const peso = Math.min(1, Math.max(0, t.pesoEmpleados))
  const fTamano = factorDe(t.empleados, c.empleados).f * peso + factorDe(t.facturacion, c.facturacion).f * (1 - peso)
  const fPais = factorDe(t.paises, c.pais).f
  const fPlazo = factorDe(t.plazo, c.plazo).f
  const fRelacion = factorDe(t.relacion, c.relacion).f
  const ajustado = base * fTamano * fPais * fPlazo
  const descuento = ajustado * (1 - fRelacion)
  let final = ajustado - descuento
  const minimoAplicado = base > 0 && final < t.precioMinimo
  if (minimoAplicado) final = t.precioMinimo
  const precio = base > 0 ? redondear(final, t.redondeo) : 0

  const m = c.mantenimiento ?? { incluido: false, meses: 12, cuotaPactada: null }
  const automatica = precio > 0 ? Math.max(redondear(precio * t.mantenimiento, 10), t.mantenimientoMinimo) : 0
  const pactada = typeof m.cuotaPactada === 'number' && Number.isFinite(m.cuotaPactada)
  const cuota = pactada ? Math.max(0, m.cuotaPactada!) : automatica
  const meses = Math.max(1, Math.floor(Number(m.meses) || 1))
  return {
    lineas, desarrollo, migracion, formacion, horasFormacion, piezasIntegradas, programas, puesta, integracion, base,
    fTamano, fPais, fPlazo, fRelacion, ajustado, descuento, minimoAplicado, precio,
    minimoNegociable: redondear(precio * (1 - t.descuentoMaximo), t.redondeo),
    techo: redondear(precio * (1 + t.techo), t.redondeo),
    mantenimiento: { automatica, pactada, cuota, meses, total: m.incluido ? cuota * meses : 0 },
  }
}

/** «complejidad media · programa con api» (la migración y la formación, solo la complejidad). */
export function describirLinea(t: Tarifas, l: LineaCalculo, seccion: Seccion = 'desarrollo'): string {
  const cx = `complejidad ${factorDe(t.complejidad, l.complejidad).etiqueta.toLowerCase()}`
  if (seccion !== 'desarrollo') return cx
  return `${cx} · ${(t.integracion.find(i => i.id === l.integracion)?.etiqueta ?? 'Sin integración').toLowerCase()}`
}

/**
 * Líneas para la oferta o el pedido. Cada línea del alcance lleva su precio
 * unitario con tamaño, país y plazo aplicados, y el descuento de la relación
 * como «Dto. %». Si el precio mínimo o el redondeo mueven el total, los precios
 * se escalan para que la base imponible del proyecto sea el precio
 * recomendado (salvo algún céntimo). El mantenimiento, si se incluye, va en
 * una línea aparte por meses y sin descuento.
 */
export function lineasDocumento(t: Tarifas, c: Calculo, r: Resultado = calcular(t, c), iva = 21): LineaDocumento[] {
  const factor = r.fTamano * r.fPais * r.fPlazo
  const dto = centimos((1 - r.fRelacion) * 100)
  const crudas: LineaDocumento[] = r.lineas.filter(l => l.cantidad > 0 && l.herramienta).map(l => ({
    productoId: '', unidad: l.seccion === 'formacion' ? 'hora' : 'ud', iva, dto,
    descripcion: `${l.herramienta!.nombre} · ${l.herramienta!.unidad} · ${describirLinea(t, l.linea, l.seccion)}`,
    cantidad: l.cantidad,
    precio: (l.total / l.cantidad) * factor,
  }))
  if (r.programas > 0) {
    crudas.push({
      productoId: '', unidad: 'ud', iva, dto, cantidad: r.programas, precio: t.puestaEnMarcha * factor,
      descripcion: `Puesta en marcha de la integración · ${r.programas === 1 ? '1 programa' : `${r.programas} programas`}`,
    })
  }
  const suma = crudas.reduce((s, l) => s + l.cantidad * l.precio * (1 - dto / 100), 0)
  const k = suma > 0 ? r.precio / suma : 1
  const proyecto = crudas.map(l => ({ ...l, precio: centimos(l.precio * k) }))
  if (r.mantenimiento.total > 0) {
    proyecto.push({
      productoId: '', unidad: 'mes', iva, dto: 0, cantidad: r.mantenimiento.meses, precio: centimos(r.mantenimiento.cuota),
      descripcion: `Mantenimiento mensual · ${r.mantenimiento.meses} meses`,
    })
  }
  return proyecto
}

/** Texto para pegar en un correo o en la propuesta. */
export function resumenTexto(t: Tarifas, c: Calculo, r: Resultado = calcular(t, c), cliente = ''): string {
  const eur = eur0
  const pct = (f: number) => { const d = Math.round((f - 1) * 100); return `${d > 0 ? '+' : d < 0 ? '−' : '±'}${Math.abs(d)} %` }
  const bloque = (s: Seccion, titulo: string) => {
    const ls = r.lineas.filter(l => l.seccion === s && l.cantidad > 0 && l.herramienta)
    return ls.length
      ? [`${titulo}:`, ...ls.map(l => `  • ${l.cantidad} × ${l.herramienta!.nombre} (${l.herramienta!.unidad}), ${describirLinea(t, l.linea, s)} · ${eur(l.total)}`), '']
      : []
  }
  const rel = factorDe(t.relacion, c.relacion)
  const m = r.mantenimiento
  return [
    `Propuesta Locodea${cliente ? ' — ' + cliente : ''}`,
    `Cliente: ${factorDe(t.empleados, c.empleados).etiqueta} trabajadores · ${factorDe(t.facturacion, c.facturacion).etiqueta} · ${factorDe(t.paises, c.pais).etiqueta} · ${rel.etiqueta}${rel.detalle ? ` (${rel.detalle})` : ''}`,
    '',
    ...SECCIONES.flatMap(s => bloque(s.id, s.titulo)),
    `Desarrollo Power Platform: ${eur(r.desarrollo)}`,
    ...(r.migracion ? [`Migración: ${eur(r.migracion)}`] : []),
    `Integración: ${eur(r.integracion)}${r.programas ? ` (${r.piezasIntegradas} piezas, ${r.programas} programa(s))` : ''}`,
    ...(r.formacion ? [`Formación: ${r.horasFormacion} h · ${eur(r.formacion)}`] : []),
    `Ajustes: tamaño ${pct(r.fTamano)}, país ${pct(r.fPais)}${r.fPlazo !== 1 ? `, plazo ${pct(r.fPlazo)}` : ''}, relación ${pct(r.fRelacion)}`,
    '',
    `PRECIO RECOMENDADO: ${eur(r.precio)} (sin IVA)`,
    `Rango: ${eur(r.minimoNegociable)} – ${eur(r.techo)}`,
    m.total > 0
      ? `Mantenimiento: ${eur(m.cuota)}/mes × ${m.meses} meses = ${eur(m.total)}\nTOTAL PROYECTO + MANTENIMIENTO: ${eur(r.precio + m.total)}`
      : `Mantenimiento opcional: ${eur(m.cuota)}/mes`,
  ].join('\n')
}

// ─────────────────────────────────────────────── importar de la calculadora web

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Convierte las tarifas copiadas de la calculadora web (claude.ai) al formato
 * de la app. Devuelve null si el texto no es de la calculadora.
 */
export function desdeCalculadoraWeb(texto: string): Tarifas | null {
  let w: any
  try { w = JSON.parse(texto) } catch { return null }
  if (!w || !Array.isArray(w.tools) || !Array.isArray(w.complexity)) return null
  const factores = (xs: any[] | undefined, mapaId?: Record<string, string>): Factor[] | undefined =>
    Array.isArray(xs) ? xs.map(x => ({ id: mapaId?.[x.id] ?? String(x.id), etiqueta: String(x.label ?? x.id), f: Number(x.f) || 0, ...(x.desc ? { detalle: String(x.desc) } : {}) })) : undefined
  const seccion = (x: any): Seccion => (x.section === 'migracion' ? 'migracion' : x.section === 'formacion' ? 'formacion' : 'desarrollo')
  // la web usaba otros ids para la integración, la relación y el plazo
  const integ = { none: SIN_INTEGRACION, std: 'estandar', api: 'api', legacy: 'sinapi' }
  const rel = { g1: 'grupo1', g2: 'grupo2', ext: 'externo' }
  const empleados = { e1: '1–10', e2: '11–50', e3: '51–200', e4: '201–500', e5: '500+' }
  const facturacion = { rA: 'hasta100k', rB: '100ka500k', r1: '500ka2m', r2: '2a10m', r3: '10a50m', r4: '50a250m', r5: 'mas250m' }
  return normalizarTarifas({
    herramientas: w.tools.map((x: any) => ({ id: String(x.id), nombre: String(x.name), unidad: String(x.unit), precio: Number(x.price) || 0, color: String(x.color || '#6b6b6b'), seccion: seccion(x) })),
    complejidad: factores(w.complexity),
    integracion: factores(w.integration, integ),
    empleados: factores(w.employees, empleados)?.map(e => ({ ...e, etiqueta: e.id === '500+' ? 'Más de 500' : e.id })),
    facturacion: factores(w.revenue, facturacion),
    paises: factores(w.countries),
    relacion: factores(w.relation, rel),
    puestaEnMarcha: Number(w.integrationSetup),
    pesoEmpleados: Number(w.sizeWeightEmployees),
    precioMinimo: Number(w.minPrice),
    descuentoMaximo: Number(w.marginFloor),
    techo: Number(w.marginCeil),
    mantenimiento: Number(w.maintenancePct),
    mantenimientoMinimo: Number(w.maintenanceMin),
    redondeo: Number(w.rounding),
  })
}
