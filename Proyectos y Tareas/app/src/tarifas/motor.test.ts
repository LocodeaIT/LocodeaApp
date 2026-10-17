import { describe, expect, it } from 'vitest'
import { importeLinea } from '../crm/documentos'
import {
  TARIFAS_INICIALES, calcular, calculoNuevo, desdeCalculadoraWeb, lineasDocumento, normalizarCalculo, normalizarTarifas, resumenTexto,
  type Calculo, type LineaCalculo,
} from './motor'

const t = TARIFAS_INICIALES
const l = (herramientaId: string, cantidad: number, complejidad: string, integracion = 'ninguna'): LineaCalculo => ({ herramientaId, cantidad, complejidad, integracion })

/** Pyme de 11–50 trabajadores, 2–10 M€, España, Grupo 2. */
const ejemplo: Calculo = {
  empleados: '11–50', facturacion: '2a10m', pais: 'ES', plazo: 'estandar', relacion: 'grupo2', programas: 1,
  mantenimiento: { incluido: false, meses: 12, cuotaPactada: null },
  lineas: [
    l('apps', 2, 'media'), l('apps', 1, 'baja', 'api'),
    l('automate', 3, 'baja', 'estandar'), l('automate', 2, 'media', 'api'),
    l('bi', 1, 'media', 'api'),
    l('migracion', 1, 'media'),
    l('formacion', 4, 'media'),
  ],
}

describe('calcular', () => {
  it('separa desarrollo, migración, formación e integración y aplica los ajustes del cliente', () => {
    const r = calcular(t, ejemplo)
    expect(r.desarrollo).toBeCloseTo(3600 + 1080 + 630 + 700 + 900)
    expect(r.migracion).toBe(800)
    expect(r.formacion).toBe(240)
    expect(r.horasFormacion).toBe(4)
    expect(r.integracion).toBeCloseTo(1080 + 315 + 420 + 540 + 300)
    expect(r.base).toBeCloseTo(10605)
    expect(r.fTamano).toBeCloseTo(0.95)
    expect(r.precio).toBe(9550)
    expect(r.minimoNegociable).toBe(8600)
    expect(r.techo).toBe(11000)
  })

  it('la migración y la formación nunca llevan recargo de integración', () => {
    const r = calcular(t, { ...ejemplo, lineas: [l('migracion', 2, 'alta', 'sinapi'), l('formacion', 3, 'baja', 'api')] })
    expect(r.integracion).toBe(0)
    expect(r.programas).toBe(0)
    expect(r.migracion).toBeCloseTo(2 * 800 * 1.6)
    expect(r.formacion).toBeCloseTo(3 * 60 * 0.6)
  })

  it('sin integraciones no cobra puesta en marcha aunque se indiquen programas', () => {
    const r = calcular(t, { ...ejemplo, programas: 3, lineas: [l('apps', 1, 'media')] })
    expect(r.programas).toBe(0)
    expect(r.integracion).toBe(0)
  })

  it('con piezas integradas cuenta al menos un programa', () => {
    const r = calcular(t, { ...ejemplo, programas: 0, lineas: [l('automate', 1, 'media', 'sinapi')] })
    expect(r.programas).toBe(1)
    expect(r.integracion).toBeCloseTo(350 + 300)
  })

  it('aplica el precio mínimo y deja a 0 un alcance vacío', () => {
    expect(calcular(t, { ...ejemplo, lineas: [l('formacion', 1, 'baja')] }).precio).toBe(600)
    expect(calcular(t, { ...ejemplo, lineas: [] }).precio).toBe(0)
  })

  it('una herramienta o una opción borrada de las tarifas no rompe el cálculo', () => {
    const r = calcular(t, { ...ejemplo, pais: 'ZZ', lineas: [l('borrada', 2, 'media'), l('apps', 1, 'inexistente')] })
    expect(r.fPais).toBe(1) // la primera de la lista: España
    expect(r.desarrollo).toBeCloseTo(1800 * 0.6) // complejidad desconocida → la primera (baja)
  })
})

describe('mantenimiento', () => {
  it('cuota automática: % del proyecto con mínimo', () => {
    expect(calcular(t, ejemplo).mantenimiento.automatica).toBe(190) // 2 % de 9.550, redondeado a 10
    expect(calcular(t, { ...ejemplo, lineas: [l('formacion', 1, 'baja')] }).mantenimiento.automatica).toBe(50) // mínimo
  })

  it('solo suma si está incluido, y respeta la cuota pactada', () => {
    expect(calcular(t, ejemplo).mantenimiento.total).toBe(0)
    const m = calcular(t, { ...ejemplo, mantenimiento: { incluido: true, meses: 6, cuotaPactada: 150 } }).mantenimiento
    expect(m).toMatchObject({ pactada: true, cuota: 150, meses: 6, total: 900 })
  })
})

describe('lineasDocumento', () => {
  it('la base imponible del proyecto es el precio recomendado', () => {
    const lineas = lineasDocumento(t, ejemplo)
    expect(lineas).toHaveLength(8) // 7 del alcance + puesta en marcha
    const base = lineas.reduce((s, x) => s + importeLinea(x), 0)
    expect(Math.abs(base - 9550)).toBeLessThan(1)
    expect(lineas.every(x => x.dto === 5)).toBe(true)
    expect(lineas[1].descripcion).toBe('Power Apps · aplicación · complejidad baja · programa con api')
    expect(lineas[5].descripcion).toBe('Migración · migración de datos · complejidad media')
    expect(lineas[6].unidad).toBe('hora')
  })

  it('el mantenimiento incluido va aparte, por meses y sin descuento', () => {
    const lineas = lineasDocumento(t, { ...ejemplo, mantenimiento: { incluido: true, meses: 12, cuotaPactada: null } })
    const ultima = lineas[lineas.length - 1]
    expect(ultima).toMatchObject({ unidad: 'mes', cantidad: 12, precio: 190, dto: 0 })
  })

  it('usa el IVA que se le pase', () => {
    expect(lineasDocumento(t, ejemplo, undefined, 0).every(x => x.iva === 0)).toBe(true)
  })
})

describe('resumenTexto', () => {
  it('lista cada apartado y el precio', () => {
    const texto = resumenTexto(t, ejemplo, undefined, 'Talleres Moreno')
    expect(texto).toContain('Propuesta Locodea — Talleres Moreno')
    expect(texto).toContain('Migración:\n  • 1 × Migración')
    expect(texto).toContain('Formación: 4 h')
    expect(texto).toMatch(/PRECIO RECOMENDADO: 9\.550\s€/) // Intl separa con espacio fino
  })
})

describe('calculoNuevo, normalizar e importar', () => {
  it('toma el país y los empleados del cliente si existen en las tarifas', () => {
    expect(calculoNuevo(t, { pais: 'PT', empleados: '201–500' })).toMatchObject({ pais: 'PT', empleados: '201–500', relacion: 'externo' })
    expect(calculoNuevo(t, { pais: 'JP', empleados: 'muchos' })).toMatchObject({ pais: 'ES', empleados: '11–50' })
  })

  it('completa con los valores de partida lo que falte', () => {
    const n = normalizarTarifas({ precioMinimo: 900, paises: [] })
    expect(n.precioMinimo).toBe(900)
    expect(n.paises).toEqual(t.paises)
    expect(n.herramientas).not.toBe(t.herramientas) // copia: editarla no toca los valores de partida
    expect(normalizarCalculo({ lineas: [l('apps', 1, 'media')] }, t).mantenimiento).toEqual({ incluido: false, meses: 12, cuotaPactada: null })
  })

  it('importa las tarifas copiadas de la calculadora web', () => {
    const web = {
      tools: [
        { id: 'apps', name: 'Power Apps', unit: 'aplicación', price: 1500, color: '#7a3e9d' },
        { id: 'migracion', name: 'Migración', unit: 'migración de datos', price: 700, color: '#4f6b78', noInt: true, section: 'migracion' },
        { id: 'formacion', name: 'Formación', unit: 'hora', price: 55, color: '#8a7b5c', noInt: true, section: 'formacion' },
      ],
      complexity: [{ id: 'baja', label: 'Baja', f: 0.5 }, { id: 'media', label: 'Media', f: 1 }, { id: 'alta', label: 'Alta', f: 2 }],
      integration: [{ id: 'none', label: 'Sin integración', f: 0 }, { id: 'api', label: 'Programa con API', f: 0.5 }],
      relation: [{ id: 'g1', label: 'Grupo 1', desc: 'Contactos cercanos', f: 0.8 }],
      revenue: [{ id: 'rA', label: '< 100 k€', f: 0.6 }],
      minPrice: 500, maintenancePct: 0.03, maintenanceMin: 40, integrationSetup: 250,
    }
    const i = desdeCalculadoraWeb(JSON.stringify(web))!
    expect(i.herramientas.map(h => `${h.id}:${h.precio}:${h.seccion}`)).toEqual(['apps:1500:desarrollo', 'migracion:700:migracion', 'formacion:55:formacion'])
    expect(i.integracion.map(x => x.id)).toEqual(['ninguna', 'api'])
    expect(i.relacion[0]).toMatchObject({ id: 'grupo1', f: 0.8, detalle: 'Contactos cercanos' })
    expect(i).toMatchObject({ precioMinimo: 500, mantenimiento: 0.03, mantenimientoMinimo: 40, puestaEnMarcha: 250, redondeo: 50 })
    expect(i.paises).toEqual(t.paises) // lo que no venía se queda con los valores de partida
    expect(desdeCalculadoraWeb('no es json')).toBeNull()
  })
})
