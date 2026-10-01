/**
 * Estado de la Bóveda: las bóvedas y los elementos cifrados que hay en
 * Dataverse y, mientras una bóveda está abierta, su clave (no extraíble) y los
 * elementos descifrados. Nada de lo descifrado sale de la memoria: no se
 * guarda en localStorage ni en la URL, y al bloquear se suelta todo.
 *
 * Se bloquea sola tras unos minutos sin tocar la app, al cambiar de usuario y
 * al cerrar sesión. Los datos se cargan la primera vez que se entra en la
 * pantalla, no al arrancar la app.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useApp } from '../store'
import { nuevoId } from '../data/repo'
import { ahoraIso } from '../domain/fechas'
import type { BovedaRepositorio } from './repo'
import type { Boveda, ContenidoElemento, Elemento, SecretoCifrado, TipoBoveda } from './types'
import { MAX_HISTORIAL, elementoVacio } from './types'
import { ContrasenaIncorrecta, abrirClave, cambiarContrasenaMaestra, cifrar, crearClaves, descifrar } from './cripto'
import './boveda.css'

export interface BovedaCtx {
  disponible: boolean
  cargado: boolean
  cargando: boolean
  error: string | null
  /** Carga (o recarga) las bóvedas. La pantalla la llama al entrar. */
  cargar: () => Promise<void>
  /** La del equipo o la personal de quien está dentro; null si aún no existe. */
  bovedaDe: (tipo: TipoBoveda) => Boveda | null
  abierta: Boveda | null
  elementos: Elemento[]
  /** Elementos que no se han podido descifrar (dañados o de otra bóveda). */
  ilegibles: number
  /** Cuándo se bloqueará sola si nadie toca nada (ms). */
  bloqueaEn: number | null
  minutosBloqueo: number
  setMinutosBloqueo: (m: number) => void
  /** Si hay demasiados intentos fallidos, hasta cuándo hay que esperar (ms). */
  esperaHasta: number | null
  crear: (tipo: TipoBoveda, contrasena: string) => Promise<void>
  /** Lanza ContrasenaIncorrecta si la contraseña no es la buena. */
  abrir: (bovedaId: string, contrasena: string) => Promise<void>
  bloquear: () => void
  guardar: (e: Elemento) => Promise<Elemento>
  borrar: (id: string) => Promise<void>
  cambiarMaestra: (actual: string, nueva: string) => Promise<void>
}

const Contexto = createContext<BovedaCtx | null>(null)

const PREF_MINUTOS = 'locodea.boveda.minutos'
export const OPCIONES_BLOQUEO = [1, 5, 15, 30]

function leerMinutos(): number {
  try {
    const n = Number(localStorage.getItem(PREF_MINUTOS))
    return OPCIONES_BLOQUEO.includes(n) ? n : 5
  } catch {
    return 5
  }
}

/** Lo que va al cifrado: todo menos los campos de la fila. */
function contenidoDe(e: Elemento): ContenidoElemento {
  const base = elementoVacio(e.tipo)
  const r = {} as Record<string, unknown>
  for (const k of Object.keys(base) as (keyof ContenidoElemento)[]) r[k] = e[k] ?? base[k]
  return r as unknown as ContenidoElemento
}

/** El valor que se vigila en el historial: la contraseña o la clave API. */
const principal = (e: Pick<Elemento, 'tipo' | 'contrasena' | 'clave'>) => (e.tipo === 'api' ? e.clave : e.tipo === 'login' ? e.contrasena : '')

const ordenar = (l: Elemento[]) => [...l].sort((a, b) => a.titulo.localeCompare(b.titulo, 'es', { sensitivity: 'base' }))

export function BovedaProveedor({ repo, children }: { repo: BovedaRepositorio; children: ReactNode }) {
  const { yo, avisar } = useApp()
  const [bovedas, setBovedas] = useState<Boveda[]>([])
  const [cargado, setCargado] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [abierta, setAbierta] = useState<Boveda | null>(null)
  const [elementos, setElementos] = useState<Elemento[]>([])
  const [ilegibles, setIlegibles] = useState(0)
  const [minutosBloqueo, setMinutos] = useState(leerMinutos)
  const [bloqueaEn, setBloqueaEn] = useState<number | null>(null)
  const [esperaHasta, setEsperaHasta] = useState<number | null>(null)

  // la clave vive en una ref: no provoca renders y se suelta al bloquear
  const clave = useRef<CryptoKey | null>(null)
  const ultimaActividad = useRef(0)
  const fallos = useRef(0)
  const enCurso = useRef<Promise<void> | null>(null)

  const bloquear = useCallback(() => {
    clave.current = null
    setAbierta(null)
    setElementos([])
    setIlegibles(0)
    setBloqueaEn(null)
  }, [])

  const cargar = useCallback(async () => {
    if (enCurso.current) return enCurso.current
    const tarea = (async () => {
      setCargando(true)
      setError(null)
      try {
        const d = await repo.cargar()
        setBovedas(d.bovedas)
        setCargado(true)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudo cargar la bóveda')
      } finally {
        setCargando(false)
        enCurso.current = null
      }
    })()
    enCurso.current = tarea
    return tarea
  }, [repo])

  const bovedaDe = useCallback((tipo: TipoBoveda): Boveda | null => {
    const candidatas = bovedas
      .filter(b => b.tipo === tipo && (tipo === 'equipo' || b.propietarioId === yo?.id))
      // si dos personas la crearon a la vez, manda la primera
      .sort((a, b) => a.creadoEl.localeCompare(b.creadoEl))
    return candidatas[0] ?? null
  }, [bovedas, yo])

  // ── bloqueo automático
  const tocar = useCallback(() => {
    ultimaActividad.current = Date.now()
  }, [])

  useEffect(() => {
    if (!abierta) return
    ultimaActividad.current = Date.now()
    const eventos = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const
    for (const ev of eventos) window.addEventListener(ev, tocar, { passive: true })
    const reloj = window.setInterval(() => {
      const limite = ultimaActividad.current + minutosBloqueo * 60_000
      if (Date.now() >= limite) {
        bloquear()
        avisar('Bóveda bloqueada por inactividad', 'info')
      } else {
        setBloqueaEn(prev => (prev !== null && Math.abs(prev - limite) < 4000 ? prev : limite))
      }
    }, 1000)
    return () => {
      for (const ev of eventos) window.removeEventListener(ev, tocar)
      window.clearInterval(reloj)
    }
  }, [abierta, minutosBloqueo, bloquear, tocar, avisar])

  // al cambiar de usuario o cerrar sesión, se cierra
  const yoId = yo?.id ?? null
  useEffect(() => { bloquear() }, [yoId, bloquear])

  const setMinutosBloqueo = useCallback((m: number) => {
    setMinutos(m)
    try { localStorage.setItem(PREF_MINUTOS, String(m)) } catch { /* modo privado */ }
  }, [])

  // ── abrir y crear
  const descifrarTodo = useCallback(async (b: Boveda, k: CryptoKey, lista: SecretoCifrado[]) => {
    const propios = lista.filter(s => s.bovedaId === b.id)
    const resultados = await Promise.allSettled(propios.map(async s => {
      const c = await descifrar<ContenidoElemento>(k, s.datos, s.id, b.id)
      return { ...elementoVacio(c.tipo), ...c, id: s.id, bovedaId: b.id, creadoEl: s.creadoEl, actualizadoEl: s.actualizadoEl ?? null } satisfies Elemento
    }))
    const ok = resultados.flatMap(r => (r.status === 'fulfilled' ? [r.value] : []))
    return { elementos: ordenar(ok), ilegibles: resultados.length - ok.length }
  }, [])

  const abrir = useCallback(async (bovedaId: string, contrasena: string) => {
    if (esperaHasta && Date.now() < esperaHasta) throw new Error('Demasiados intentos. Espera un momento.')
    // se recarga antes de abrir: así se ve lo que hayan guardado los demás
    const d = await repo.cargar()
    setBovedas(d.bovedas)
    const b = d.bovedas.find(x => x.id === bovedaId)
    if (!b) throw new Error('Esa bóveda ya no existe')
    let k: CryptoKey
    try {
      k = await abrirClave(b, contrasena, b.id)
    } catch (e) {
      if (e instanceof ContrasenaIncorrecta) {
        fallos.current += 1
        // a partir del quinto fallo, esperas crecientes: 30 s, 60 s, 2 min…
        if (fallos.current >= 5) setEsperaHasta(Date.now() + 30_000 * 2 ** Math.min(4, fallos.current - 5))
      }
      throw e
    }
    fallos.current = 0
    setEsperaHasta(null)
    const r = await descifrarTodo(b, k, d.secretos)
    ultimaActividad.current = Date.now()
    setBloqueaEn(ultimaActividad.current + minutosBloqueo * 60_000)
    clave.current = k
    setElementos(r.elementos)
    setIlegibles(r.ilegibles)
    setAbierta(b)
  }, [repo, esperaHasta, descifrarTodo, minutosBloqueo])

  const crear = useCallback(async (tipo: TipoBoveda, contrasena: string) => {
    if (!yo) throw new Error('Entra con tu usuario primero')
    const id = nuevoId()
    const { cabecera, clave: k } = await crearClaves(contrasena, id)
    const b: Boveda = {
      id, tipo, nombre: tipo === 'equipo' ? 'Equipo' : `Personal · ${yo.nombre}`, propietarioId: tipo === 'personal' ? yo.id : null,
      ...cabecera, creadoEl: ahoraIso(), actualizadoEl: null,
    }
    await repo.guardarBoveda(b)
    setBovedas(l => [...l, b])
    ultimaActividad.current = Date.now()
    setBloqueaEn(ultimaActividad.current + minutosBloqueo * 60_000)
    clave.current = k
    setElementos([])
    setIlegibles(0)
    setAbierta(b)
    avisar(tipo === 'equipo' ? 'Bóveda del equipo creada' : 'Tu bóveda personal está creada')
  }, [repo, yo, avisar, minutosBloqueo])

  // ── elementos
  const guardar = useCallback(async (e: Elemento): Promise<Elemento> => {
    const k = clave.current
    const b = abierta
    if (!k || !b) throw new Error('La bóveda está cerrada')
    const id = e.id || nuevoId()
    const previo = elementos.find(x => x.id === id)
    const ahora = ahoraIso()
    let { historial, cambiadaEl } = e
    const antes = previo ? principal(previo) : ''
    const despues = principal(e)
    if (antes !== despues) {
      if (antes) historial = [{ valor: antes, hasta: ahora }, ...(previo?.historial ?? [])].slice(0, MAX_HISTORIAL)
      cambiadaEl = despues ? ahora : null
    }
    const listo: Elemento = { ...e, id, bovedaId: b.id, historial, cambiadaEl, creadoEl: previo?.creadoEl || ahora, actualizadoEl: previo ? ahora : null }
    try {
      const datos = await cifrar(k, contenidoDe(listo), id, b.id)
      const s: SecretoCifrado = { id, bovedaId: b.id, datos, creadoEl: listo.creadoEl, actualizadoEl: listo.actualizadoEl }
      await repo.guardarSecreto(s)
      setElementos(l => ordenar(l.some(x => x.id === id) ? l.map(x => (x.id === id ? listo : x)) : [...l, listo]))
      avisar(previo ? 'Guardado y cifrado' : 'Añadido a la bóveda')
      return listo
    } catch (err) {
      console.error('No se pudo guardar en la bóveda')  // sin el contenido: nunca se escribe un secreto en la consola
      avisar('No se pudo guardar', 'error')
      throw err
    }
  }, [abierta, elementos, repo, avisar])

  const borrar = useCallback(async (id: string) => {
    try {
      await repo.borrarSecreto(id)
      setElementos(l => l.filter(x => x.id !== id))
      avisar('Borrado de la bóveda', 'info')
    } catch (err) {
      avisar('No se pudo borrar', 'error')
      throw err
    }
  }, [repo, avisar])

  const cambiarMaestra = useCallback(async (actual: string, nueva: string) => {
    const b = abierta
    if (!b) throw new Error('La bóveda está cerrada')
    const cabecera = await cambiarContrasenaMaestra(b, actual, nueva, b.id)
    const nuevaB: Boveda = { ...b, ...cabecera, actualizadoEl: ahoraIso() }
    await repo.guardarBoveda(nuevaB)
    setBovedas(l => l.map(x => (x.id === b.id ? nuevaB : x)))
    setAbierta(nuevaB)
    avisar('Contraseña maestra cambiada')
  }, [abierta, repo, avisar])

  const valor = useMemo<BovedaCtx>(() => ({
    disponible: repo.disponible, cargado, cargando, error, cargar, bovedaDe, abierta, elementos, ilegibles, bloqueaEn,
    minutosBloqueo, setMinutosBloqueo, esperaHasta, crear, abrir, bloquear, guardar, borrar, cambiarMaestra,
  }), [repo, cargado, cargando, error, cargar, bovedaDe, abierta, elementos, ilegibles, bloqueaEn, minutosBloqueo, setMinutosBloqueo, esperaHasta, crear, abrir, bloquear, guardar, borrar, cambiarMaestra])

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>
}

export function useBoveda(): BovedaCtx {
  const c = useContext(Contexto)
  if (!c) throw new Error('useBoveda fuera del BovedaProveedor')
  return c
}
