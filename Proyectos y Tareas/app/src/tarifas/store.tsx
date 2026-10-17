/**
 * Estado de las tarifas de la calculadora de precios. Se cargan al arrancar
 * (es una sola fila). Si la tabla aún no está en el entorno, la calculadora
 * sigue funcionando con las tarifas de partida y la pantalla Tarifas lo dice.
 *
 * Todo el equipo usa las mismas tarifas; solo los socios las cambian.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useApp } from '../store'
import { TARIFAS_INICIALES, normalizarTarifas, type Tarifas } from './motor'
import type { TarifasRepositorio, VersionTarifas } from './repo'

export interface TarifasCtx {
  /** Tarifas vigentes: la última versión guardada o, si no hay, las de partida. */
  tarifas: Tarifas
  version: VersionTarifas | null
  cargando: boolean
  /** false si la tabla loc_tarifaprecio no está todavía en el entorno. */
  disponible: boolean
  puedeEditar: boolean
  guardar: (t: Tarifas) => Promise<boolean>
  recargar: () => Promise<void>
}

const Contexto = createContext<TarifasCtx | null>(null)

export function TarifasProveedor({ repo, children }: { repo: TarifasRepositorio; children: ReactNode }) {
  const { yo, avisar } = useApp()
  const [version, setVersion] = useState<VersionTarifas | null>(null)
  const [cargando, setCargando] = useState(true)
  const [disponible, setDisponible] = useState(true)

  const recargar = useCallback(async () => {
    setCargando(true)
    try {
      setVersion(await repo.cargar())
      setDisponible(true)
    } catch (e) {
      console.error(e)
      setDisponible(false)
    } finally {
      setCargando(false)
    }
  }, [repo])

  useEffect(() => { void recargar() }, [recargar])

  const puedeEditar = yo?.rol === 'socio' && disponible

  const guardar = useCallback(async (t: Tarifas) => {
    if (!puedeEditar) return false
    try {
      setVersion(await repo.guardar(normalizarTarifas(t), yo?.id ?? null))
      avisar('Tarifas guardadas para todo el equipo')
      return true
    } catch (e) {
      console.error(e)
      avisar('No se pudieron guardar las tarifas', 'error')
      return false
    }
  }, [repo, yo, avisar, puedeEditar])

  const valor = useMemo<TarifasCtx>(() => ({
    tarifas: version?.tarifas ?? TARIFAS_INICIALES, version, cargando, disponible, puedeEditar, guardar, recargar,
  }), [version, cargando, disponible, puedeEditar, guardar, recargar])

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>
}

export function useTarifas(): TarifasCtx {
  const c = useContext(Contexto)
  if (!c) throw new Error('useTarifas fuera del TarifasProveedor')
  return c
}
