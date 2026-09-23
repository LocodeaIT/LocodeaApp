/**
 * Contrato del contexto del CRM y el hook para usarlo. El proveedor está en
 * store.tsx; aquí solo lo que las pantallas necesitan conocer.
 */
import { createContext, useContext } from 'react'
import type { Miembro } from '../domain/types'
import type {
  ActividadCrm, ColDocumento, ColEntidad, ColReferente, CrmInstantanea, Documento, Fase, Oferta, Oportunidad, PedidoCompra,
  PedidoVenta, Potencial, RegistroDe,
} from './types'

/** Ficha abierta: `id` es 'nuevo' mientras el registro no se ha guardado. */
export interface Ficha {
  col: ColEntidad
  id: string
  /** Valores iniciales de un registro nuevo (p. ej. la cuenta al crear un contacto desde ella). */
  prefill?: Record<string, unknown> | null
}

/** Estado de cada página de lista: se conserva al ir y volver de las fichas. */
export interface EstadoLista {
  vista: string | null
  texto: string
  filtros: Record<string, string>
  orden: { clave: string; dir: 1 | -1 } | null
  pagina: number
  seleccion: string[]
}

export const LISTA_INICIAL: EstadoLista = { vista: null, texto: '', filtros: {}, orden: null, pagina: 0, seleccion: [] }

export interface CrmCtx {
  datos: CrmInstantanea
  cargando: boolean
  error: string | null
  /** false si el CRM no tiene tablas en el entorno (Dataverse pendiente). */
  disponible: boolean
  /** Copia de seguridad, restablecer y borrar todo: solo con el repositorio de demostración. */
  puedeGestionarDatos: boolean
  yoId: string | null
  miembros: Miembro[]
  nombreMiembro: (id: string | null | undefined) => string

  // navegación (cada destino deja entrada en el historial: #crm/…)
  ficha: Ficha | null
  /** `reemplazar` no añade entrada al historial (p. ej. al guardar un registro nuevo). */
  abrir: (col: ColEntidad, id: string, prefill?: Record<string, unknown> | null, reemplazar?: boolean) => void
  irLista: (col: ColEntidad, vista?: string) => void
  irInicio: () => void
  listas: Partial<Record<ColEntidad, EstadoLista>>
  cambiarLista: (col: ColEntidad, cambio: Partial<EstadoLista>) => void

  // escritura genérica
  /** Crea (sin id) o actualiza. Asigna id, número de serie y fechas. */
  guardar: <K extends ColEntidad>(col: K, obj: RegistroDe<K>) => Promise<RegistroDe<K>>
  borrar: (col: ColEntidad, ids: string[]) => Promise<void>
  anadirNota: (texto: string, col: ColReferente, id: string) => Promise<void>

  // clientes potenciales y oportunidades
  calificarPotencial: (p: Potencial) => Promise<void>
  descalificarPotencial: (p: Potencial, motivo: string) => Promise<void>
  reactivarPotencial: (p: Potencial) => Promise<void>
  cambiarFase: (o: Oportunidad, fase: Fase) => Promise<void>
  ganarOportunidad: (o: Oportunidad) => Promise<void>
  perderOportunidad: (o: Oportunidad, motivo: string) => Promise<void>
  reabrirOportunidad: (o: Oportunidad) => Promise<void>

  // documentos
  cambiarEstadoDocumento: (col: ColDocumento, doc: Documento, estado: string) => Promise<void>
  ofertaAPedido: (q: Oferta) => Promise<void>
  pedidoAFactura: (p: PedidoVenta) => Promise<void>
  pedidoCompraAFactura: (p: PedidoCompra) => Promise<void>

  // actividades
  alternarActividad: (a: ActividadCrm) => Promise<void>
  cancelarActividad: (a: ActividadCrm) => Promise<void>

  restablecerDemo: () => Promise<void>
  importarDatos: (d: CrmInstantanea) => Promise<void>
  borrarTodo: () => Promise<void>
  recargar: () => Promise<void>
}

export const ContextoCrm = createContext<CrmCtx | null>(null)

export function useCrm(): CrmCtx {
  const c = useContext(ContextoCrm)
  if (!c) throw new Error('useCrm fuera del CrmProveedor')
  return c
}
