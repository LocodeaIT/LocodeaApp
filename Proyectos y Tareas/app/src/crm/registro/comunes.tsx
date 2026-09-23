/**
 * Piezas compartidas por las entidades: opciones de desplegables (propietario,
 * cuenta, contacto…), filtros y columnas que se repiten.
 */
import type { Opcion } from '../../ui/Select'
import type { CrmCtx } from '../contexto'
import type { ColReferente, RegistroBase, TipoCuenta } from '../types'
import { nombreCompleto, nombreRegistro } from '../consultas'
import { normalizar } from '../formato'
import { Propietario } from '../ui'
import type { Columna, Filtro } from './tipos'

const NINGUNO: Opcion = { valor: '', etiqueta: '—' }

export const porNombre = (a: { etiqueta: string }, b: { etiqueta: string }) => a.etiqueta.localeCompare(b.etiqueta, 'es')

export function opcionesPropietario(c: CrmCtx): Opcion[] {
  return [{ valor: '', etiqueta: 'Sin propietario' }, ...c.miembros.filter(m => m.activo).map(m => ({ valor: m.id, etiqueta: m.nombre }))]
}

/** Cuentas para un campo; `tipo` limita a clientes o proveedores (las de tipo «ambos» valen para los dos). */
export function opcionesCuentas(c: CrmCtx, tipo?: TipoCuenta): Opcion[] {
  const lista = c.datos.cuentas.filter(a => !tipo || a.tipo === tipo || a.tipo === 'ambos')
  return [NINGUNO, ...lista.map(a => ({ valor: a.id, etiqueta: a.nombre, detalle: a.no })).sort(porNombre)]
}

export function opcionesContactos(c: CrmCtx, cuentaId: string | null): Opcion[] {
  const lista = c.datos.contactos.filter(x => !cuentaId || x.cuentaId === cuentaId)
  return [NINGUNO, ...lista.map(x => ({ valor: x.id, etiqueta: nombreCompleto(x) })).sort(porNombre)]
}

export function opcionesOportunidades(c: CrmCtx, cuentaId: string | null): Opcion[] {
  return [NINGUNO, ...c.datos.oportunidades.filter(o => !cuentaId || o.cuentaId === cuentaId).map(o => ({ valor: o.id, etiqueta: o.titulo, detalle: o.no }))]
}

export function opcionesReferente(c: CrmCtx, col: ColReferente | null): Opcion[] {
  if (!col) return [NINGUNO]
  const lista = c.datos[col] as RegistroBase[]
  return [NINGUNO, ...lista.map(o => ({ valor: o.id, etiqueta: nombreRegistro(c.datos, col, o) })).sort(porNombre)]
}

/** Valores distintos de un campo de texto (sector, categoría…) como opciones de filtro. */
export function opcionesDistintas(valores: string[]): Opcion[] {
  return [...new Set(valores.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es')).map(v => ({ valor: v, etiqueta: v }))
}

export const cuentasFiltro = (c: CrmCtx, tipo?: TipoCuenta): Opcion[] => opcionesCuentas(c, tipo).filter(o => o.valor)

// ─────────────────────────────────────────────── filtros y columnas repetidos

export function filtroPropietario<T extends { propietarioId: string | null }>(): Filtro<T> {
  return { clave: 'propietarioId', titulo: 'Propietario', opciones: c => opcionesPropietario(c).filter(o => o.valor) }
}

export function colPropietario<T extends { propietarioId: string | null }>(): Columna<T> {
  return { clave: 'propietarioId', titulo: 'Propietario', texto: (o, c) => c.nombreMiembro(o.propietarioId), celda: o => <Propietario id={o.propietarioId} corto /> }
}

export function colNo<T extends RegistroBase>(ancho = 90): Columna<T> {
  return { clave: 'no', titulo: 'Nº', enlace: true, ancho, texto: o => o.no ?? '' }
}

export const esMio = (o: { propietarioId: string | null }, c: CrmCtx) => !!c.yoId && o.propietarioId === c.yoId

export const ordenTexto = (s: string) => normalizar(s)
