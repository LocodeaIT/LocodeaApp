/**
 * Forma del registro de entidades del CRM. Cada entidad describe su página de
 * lista (vistas del sistema, filtros, columnas) y su ficha (pestañas
 * desplegables, comandos, paneles laterales y flujo de proceso). La lista y la
 * ficha genéricas de ../screens solo leen esta descripción.
 */
import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import type { Opcion } from '../../ui/Select'
import type { CrmCtx } from '../contexto'
import type { ColEntidad, RegistroBase } from '../types'

/** Vista del sistema (selector del título de la lista). */
export interface Vista<T> {
  clave: string
  titulo: string
  filtro: (o: T, c: CrmCtx) => boolean
}

/** Desplegable de filtro de la lista. `valor` lee el campo si no es `o[clave]`. */
export interface Filtro<T> {
  clave: string
  titulo: string
  opciones: (c: CrmCtx) => Opcion[]
  valor?: (o: T, c: CrmCtx) => string
}

export interface Columna<T> {
  clave: string
  titulo: string
  num?: boolean
  ancho?: number
  /** La celda abre la ficha. */
  enlace?: boolean
  sinOrden?: boolean
  /** Texto de la celda; también se usa para exportar y, si no hay `orden`, para ordenar. */
  texto?: (o: T, c: CrmCtx) => string | number
  orden?: (o: T, c: CrmCtx) => string | number
  /** Presentación rica (chips, enlaces…). Sin ella se pinta `texto`. */
  celda?: (o: T, c: CrmCtx) => ReactNode
  /** Columnas de interacción (casilla de completar) que no van al CSV. */
  sinExportar?: boolean
}

export type TipoCampo = 'texto' | 'numero' | 'fecha' | 'hora' | 'email' | 'area' | 'opciones' | 'sino'

export interface Campo<T> {
  clave: keyof T & string
  titulo: string
  tipo?: TipoCampo
  opciones?: Opcion[] | ((d: T, c: CrmCtx) => Opcion[])
  req?: boolean
  /** Ocupa las dos columnas de la pestaña. */
  completo?: boolean
  soloLectura?: boolean
  paso?: number
  min?: number
  /** Campo calculado o de solo lectura con presentación propia. */
  mostrar?: (d: T, c: CrmCtx) => ReactNode
  /** Texto para el resumen de la pestaña plegada, cuando no basta el valor. */
  resumen?: (d: T, c: CrmCtx) => string
  /** Ajustes en cascada tras cambiar el valor (p. ej. al elegir cuenta se limpian contacto y condiciones). */
  alCambiar?: (d: T, c: CrmCtx) => T
}

/** Pestaña desplegable de la ficha (FastTab). */
export interface Pestana<T> {
  clave: string
  titulo: string
  /** Abierta al entrar. Por defecto, sí. */
  abierta?: boolean
  campos?: Campo<T>[]
  /** Pestaña de líneas del documento. */
  lineas?: boolean
}

export interface Comando {
  texto: string
  icono: LucideIcon
  accion: () => void | Promise<void>
  tono?: 'primario' | 'acento' | 'peligro'
}

/** Diálogos que la ficha pone a disposición de los comandos. */
export interface UiFicha {
  pedirTexto: (titulo: string, subtitulo: string, etiqueta: string, ok: string, fn: (texto: string) => void) => void
}

export interface FinProceso {
  texto: string
  tono: 'ok' | 'error' | 'apagado'
}

export interface Entidad<T extends RegistroBase> {
  col: ColEntidad
  uno: string
  muchos: string
  /** Género gramatical para «Nueva …», «creada»… */
  fem?: boolean
  icono: LucideIcon
  vistas: Vista<T>[]
  buscar: (o: T, c: CrmCtx) => unknown[]
  filtros: Filtro<T>[]
  columnas: Columna<T>[]
  ordenInicial?: { clave: string; dir: 1 | -1 }
  /** Registro nuevo con sus valores por defecto (id vacío). */
  nuevo: (c: CrmCtx) => T
  titulo: (o: T, c: CrmCtx) => string
  validar: (d: T, c: CrmCtx) => string | null
  antesDeGuardar?: (o: T, c: CrmCtx) => T
  /** Registrado o cerrado: la ficha queda de solo lectura. */
  bloqueado?: (o: T) => boolean
  etiquetas?: (o: T, c: CrmCtx) => ReactNode
  pestanas: Pestana<T>[]
  comandos?: (d: T, c: CrmCtx, ui: UiFicha) => (Comando | null | false)[]
  /** Paneles laterales (FactBoxes) de un registro guardado. */
  hechos?: (o: T, c: CrmCtx) => ReactNode
  /** Barra del flujo de proceso de negocio. */
  proceso?: { fin: (o: T) => FinProceso | null; editable: boolean }
  /** Documento de compra: las líneas toman el coste del producto. */
  compra?: boolean
  imprimir?: boolean
}
