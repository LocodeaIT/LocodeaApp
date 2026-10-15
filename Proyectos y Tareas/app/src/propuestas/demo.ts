/**
 * Repositorio de DEMOSTRACIÓN de Propuestas: en memoria y persistido en
 * localStorage. Solo se carga con `VITE_DEMO=1` (import diferido en main.tsx).
 * Arranca con unas cuantas propuestas de ejemplo repartidas por el embudo.
 */
import type { PropuestasRepositorio } from './repo'
import type { AdjuntoPropuesta, ApuntePropuesta, Propuesta } from './types'
import { propuestaVacia } from './types'
import { ahoraIso, hoy, sumarDias } from '../domain/fechas'

const CLAVE = 'locodea.propuestas.demo.v1'
const CLAVE_ADJUNTOS = 'locodea.propuestas.adjuntos.demo.v1'

function hace(dias: number, hora = '10:30'): string {
  return `${sumarDias(hoy(), -dias)}T${hora}:00.000Z`
}

function ejemplo(n: number, parcial: Partial<Propuesta>, apuntes: [number, string, Partial<ApuntePropuesta>?][] = []): Propuesta {
  return {
    ...propuestaVacia(), id: `demo-prop-${n}`, creadoEl: hace(30 - n), actualizadoEl: null, orden: n, ...parcial,
    apuntes: apuntes.map(([dias, texto, extra], i) => ({ id: `demo-ap-${n}-${i}`, fecha: hace(dias), autorId: null, texto, ...extra })),
  }
}

function semilla(): Propuesta[] {
  return [
    ejemplo(1, { titulo: 'Portal de pedidos para distribuidores', cliente: 'Talleres Moreno', estado: 'enviada', prioridad: 'alta', importe: 18500, probabilidad: 70, fechaPrevista: sumarDias(hoy(), 9), tecnologias: ['Power Pages', 'Dataverse', 'Business Central'], descripcion: 'Que los distribuidores hagan los pedidos y vean el estado sin llamar a la oficina.', contacto: 'Laura Moreno (gerencia)' }, [
      [21, 'Nos lo comentan en la visita: les llaman 40 veces al día para saber cómo va un pedido.'],
      [14, 'Pasa a En conversación', { estado: 'conversacion' }],
      [8, 'Reunión con Laura: quieren empezar por los 12 distribuidores grandes.'],
      [3, 'Propuesta enviada con dos fases.', { estado: 'enviada' }],
    ]),
    ejemplo(2, { titulo: 'Cuadro de mando de producción', cliente: 'Aislapol', estado: 'planificacion', prioridad: 'alta', importe: 9200, fechaPrevista: sumarDias(hoy(), 20), tecnologias: ['Power BI', 'Dataverse'], descripcion: 'Paradas, OEE y mermas por línea, a partir de los partes de las máquinas.' }, [
      [10, 'Les encantó la demo del almacén 3D. Piden algo parecido para producción.'],
      [4, 'Preparando el alcance: 3 líneas, datos cada 15 minutos.', { estado: 'planificacion' }],
    ]),
    ejemplo(3, { titulo: 'Automatizar facturas de proveedor', cliente: 'Grupo de la Vega', estado: 'conversacion', importe: 6000, tecnologias: ['Power Automate', 'IA'], descripcion: 'Leer los PDF que llegan al buzón de facturas y llevarlos al ERP.' }, [
      [6, 'Les llegan unas 600 facturas al mes, casi todas en PDF.'],
    ]),
    ejemplo(4, { titulo: 'App de inspecciones de vehículos', cliente: 'Transportes Ruiz', estado: 'apunte', prioridad: 'baja', tecnologias: ['Power Apps'], descripcion: 'Checklist con fotos antes de cada salida.' }, [
      [2, 'Lo dejó caer en el evento de Power Platform. Volver a llamar en noviembre.'],
    ]),
    ejemplo(5, { titulo: 'Agente de atención al cliente', cliente: 'Clínica Dental Sonríe', estado: 'apunte', importe: 4500, tecnologias: ['Copilot Studio'] }),
    ejemplo(6, { titulo: 'Migración del CRM a Dynamics 365 Sales', cliente: 'Aislapol', estado: 'aceptado', prioridad: 'alta', importe: 22000, tecnologias: ['Dynamics 365 Sales', 'Dataverse'], descripcion: 'Del Excel compartido a Sales, con los 1.800 clientes y el histórico de ofertas.' }, [
      [25, 'Propuesta enviada.', { estado: 'enviada' }],
      [12, '¡Aceptada! Arrancamos el lunes.', { estado: 'aceptado' }],
    ]),
    ejemplo(7, { titulo: 'Web corporativa nueva', cliente: 'Bodegas Alonso', estado: 'descartado', importe: 3500, tecnologias: ['Web'] }, [
      [9, 'Se lo hace un sobrino. Lo dejamos aquí.', { estado: 'descartado' }],
    ]),
  ]
}

function leer(): Propuesta[] {
  try {
    const raw = localStorage.getItem(CLAVE)
    if (raw) return JSON.parse(raw) as Propuesta[]
  } catch { /* datos corruptos: se empieza de cero */ }
  return semilla()
}

function escribir(d: Propuesta[]): void {
  try { localStorage.setItem(CLAVE, JSON.stringify(d)) } catch { /* sin espacio o modo privado */ }
}

const espera = (ms = 40) => new Promise<void>(r => setTimeout(r, ms))

let datos: Propuesta[] | null = null
function estado(): Propuesta[] {
  if (!datos) datos = leer()
  return datos
}

function sustituir(lista: Propuesta[], p: Propuesta): Propuesta[] {
  return lista.some(x => x.id === p.id) ? lista.map(x => (x.id === p.id ? p : x)) : [...lista, p]
}

export const propuestasRepoDemo: PropuestasRepositorio = {
  async cargar() {
    await espera(120)
    return structuredClone(estado())
  },

  async guardar(p) {
    await espera()
    const guardada = { ...structuredClone(p), actualizadoEl: ahoraIso() }
    datos = sustituir(estado(), guardada)
    escribir(datos)
    return guardada
  },

  async guardarVarias(ps) {
    await espera()
    let d = estado()
    for (const p of ps) d = sustituir(d, structuredClone(p))
    datos = d
    escribir(datos)
  },

  async borrar(id) {
    await espera()
    datos = estado().filter(p => p.id !== id)
    escribir(datos)
  },

  async cargarAdjuntos() {
    await espera()
    return adjuntos().map(a => ({ id: a.id, propuestaId: a.propuestaId, proyectoId: a.proyectoId, nombre: a.nombre, tipo: a.tipo, tamano: a.tamano, creadoEl: a.creadoEl }))
  },

  async leerAdjunto(id) {
    await espera(200)
    return adjuntos().find(a => a.id === id)?.datos ?? ''
  },

  async crearAdjunto(a, datosArchivo) {
    await espera(300)
    guardarAdjuntos([...adjuntos(), { ...a, datos: datosArchivo }])
    return a
  },

  async enlazarAdjuntos(ids, proyectoId) {
    await espera()
    guardarAdjuntos(adjuntos().map(a => (ids.includes(a.id) ? { ...a, proyectoId } : a)))
  },

  async borrarAdjunto(id) {
    await espera()
    guardarAdjuntos(adjuntos().filter(a => a.id !== id))
  },
}

// ─────────────────────────────────────────────── adjuntos (con sus datos, en memoria y en localStorage si caben)

type AdjuntoConDatos = AdjuntoPropuesta & { datos: string }
let listaAdjuntos: AdjuntoConDatos[] | null = null

function adjuntos(): AdjuntoConDatos[] {
  if (!listaAdjuntos) {
    try { listaAdjuntos = JSON.parse(localStorage.getItem(CLAVE_ADJUNTOS) ?? '[]') as AdjuntoConDatos[] } catch { listaAdjuntos = [] }
  }
  return listaAdjuntos
}

function guardarAdjuntos(l: AdjuntoConDatos[]): void {
  listaAdjuntos = l
  try { localStorage.setItem(CLAVE_ADJUNTOS, JSON.stringify(l)) } catch { /* sin espacio: se quedan solo en memoria */ }
}
