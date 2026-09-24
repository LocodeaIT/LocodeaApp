/**
 * Estado del módulo Gestión: gastos y documentos cargados, y las acciones para
 * guardarlos y borrarlos. Caja y Trimestre se calculan en las pantallas a
 * partir de estos datos y de los del CRM.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useApp } from '../store'
import { nuevoId } from '../data/repo'
import { ahoraIso } from '../domain/fechas'
import type { GestionRepositorio } from './repo'
import type { ColGestion, DocumentoGestion, Gasto, GestionInstantanea, RegistroGestion, RegistroGestionDe } from './types'
import { GESTION_VACIA, SERIE_GASTO } from './types'
import './gestion.css'

export interface GestionCtx {
  datos: GestionInstantanea
  cargando: boolean
  error: string | null
  disponible: boolean
  puedeGestionarDatos: boolean
  yoId: string | null
  /** Crea (sin id) o actualiza. Asigna id, número de serie y fechas. */
  guardarGasto: (g: Gasto) => Promise<Gasto>
  guardarDocumento: (d: DocumentoGestion) => Promise<DocumentoGestion>
  borrar: (col: ColGestion, id: string) => Promise<void>
  restablecerDemo: () => Promise<void>
  recargar: () => Promise<void>
}

const Contexto = createContext<GestionCtx | null>(null)

function sustituir<T extends RegistroGestion>(lista: T[], o: T): T[] {
  return lista.some(x => x.id === o.id) ? lista.map(x => (x.id === o.id ? o : x)) : [...lista, o]
}

/** Siguiente número de la serie de gastos: el mayor usado + 1. */
function siguienteNoGasto(existentes: Gasto[]): string {
  const [prefijo, base] = SERIE_GASTO
  const n = existentes.reduce((m, g) => Math.max(m, parseInt(String(g.no ?? '').replace(/\D/g, ''), 10) || 0), base)
  return prefijo + (n + 1)
}

export function GestionProveedor({ repo, children }: { repo: GestionRepositorio; children: ReactNode }) {
  const { yo, avisar } = useApp()
  const [datos, setDatos] = useState<GestionInstantanea>(GESTION_VACIA)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const actual = useRef<GestionInstantanea>(GESTION_VACIA)

  const aplicar = useCallback((cambio: (d: GestionInstantanea) => GestionInstantanea) => {
    actual.current = cambio(actual.current)
    setDatos(actual.current)
  }, [])

  const recargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      const d = await repo.cargar()
      actual.current = d
      setDatos(d)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar Gestión')
    } finally {
      setCargando(false)
    }
  }, [repo])

  useEffect(() => { void recargar() }, [recargar])

  const guardarGenerico = useCallback(async <K extends ColGestion>(col: K, obj: RegistroGestionDe<K>): Promise<RegistroGestionDe<K>> => {
    const nuevo = !obj.id
    const listo = { ...obj, id: obj.id || nuevoId(), creadoEl: obj.creadoEl || ahoraIso(), actualizadoEl: nuevo ? null : ahoraIso() } as RegistroGestionDe<K>
    try {
      const guardado = await repo.guardar(col, listo)
      aplicar(d => ({ ...d, [col]: sustituir(d[col] as RegistroGestion[], guardado) }))
      return guardado
    } catch (e) {
      console.error(e)
      avisar('No se pudo guardar', 'error')
      throw e
    }
  }, [repo, aplicar, avisar])

  const guardarGasto = useCallback(async (g: Gasto) => {
    const conNo = g.no ? g : { ...g, no: siguienteNoGasto(actual.current.gastos) }
    const r = await guardarGenerico('gastos', conNo)
    avisar(g.id ? 'Gasto guardado' : 'Gasto apuntado')
    return r
  }, [guardarGenerico, avisar])

  const guardarDocumento = useCallback(async (d: DocumentoGestion) => {
    const r = await guardarGenerico('documentos', d)
    avisar('Documento guardado')
    return r
  }, [guardarGenerico, avisar])

  const borrar = useCallback(async (col: ColGestion, id: string) => {
    try {
      await repo.borrar(col, id)
      aplicar(d => ({ ...d, [col]: (d[col] as RegistroGestion[]).filter(x => x.id !== id) }))
      avisar('Borrado', 'info')
    } catch (e) {
      console.error(e)
      avisar('No se pudo borrar', 'error')
      throw e
    }
  }, [repo, aplicar, avisar])

  const restablecerDemo = useCallback(async () => {
    if (!repo.restablecer) return
    const d = await repo.restablecer()
    actual.current = d
    setDatos(d)
    avisar('Datos de ejemplo restablecidos')
  }, [repo, avisar])

  const valor = useMemo<GestionCtx>(() => ({
    datos, cargando, error, disponible: repo.disponible, puedeGestionarDatos: !!repo.restablecer, yoId: yo?.id ?? null,
    guardarGasto, guardarDocumento, borrar, restablecerDemo, recargar,
  }), [datos, cargando, error, repo, yo, guardarGasto, guardarDocumento, borrar, restablecerDemo, recargar])

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>
}

export function useGestion(): GestionCtx {
  const c = useContext(Contexto)
  if (!c) throw new Error('useGestion fuera del GestionProveedor')
  return c
}
