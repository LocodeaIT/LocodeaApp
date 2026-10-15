/**
 * Estado de Propuestas. Se carga la primera vez que se entra en la pantalla,
 * no al arrancar la app. Los cambios se ven al instante (el tablero no espera a
 * Dataverse) y, si el guardado falla, se avisa y se vuelve a cargar lo que hay.
 *
 * Los cambios de estado dejan un apunte automático en el hilo de la propuesta.
 * Al aceptar una, se ofrece pasarla ya a proyecto de la cartera: se crea con
 * su descripción, sus tecnologías como apartados y sus adjuntos enlazados.
 *
 * Los adjuntos se cargan sin sus datos; cada archivo se descarga la primera
 * vez que se abre y queda en memoria mientras dure la sesión.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useApp } from '../store'
import { nuevoId } from '../data/repo'
import { ahoraIso, hoy } from '../domain/fechas'
import { COLORES, confirmar } from '../ui/basicos'
import type { ApartadoProyecto, IconoApartado } from '../domain/types'
import type { PropuestasRepositorio } from './repo'
import type { AdjuntoPropuesta, ApuntePropuesta, EstadoPropuesta, NuevaPropuesta, Propuesta } from './types'
import { ErrorAdjunto, prepararArchivo } from './adjuntos'
import { ETIQUETA_ESTADO_PROPUESTA } from './types'
import { columna, ordenAlFinal } from './calculos'
import './propuestas.css'

export interface PropuestasCtx {
  propuestas: Propuesta[]
  cargado: boolean
  cargando: boolean
  error: string | null
  cargar: () => Promise<void>
  crear: (p: NuevaPropuesta) => Promise<Propuesta>
  guardar: (p: Propuesta) => Promise<void>
  borrar: (id: string) => Promise<void>
  /** Mueve la propuesta a otra columna (o dentro de la suya) en la posición indicada. */
  mover: (id: string, estado: EstadoPropuesta, indice?: number) => Promise<void>
  anadirApunte: (id: string, texto: string) => Promise<void>
  borrarApunte: (id: string, apunteId: string) => Promise<void>
  /** Crea el proyecto en la cartera a partir de la propuesta y los enlaza. */
  convertirEnProyecto: (id: string) => Promise<string | null>

  adjuntos: AdjuntoPropuesta[]
  /** false si la tabla de adjuntos no está en el entorno: el resto sigue funcionando. */
  adjuntosDisponibles: boolean
  /** Cuántos archivos se están subiendo a cada propuesta. */
  subiendo: Record<string, number>
  subirArchivos: (propuestaId: string, archivos: File[]) => Promise<void>
  /** Data URL del adjunto (lo descarga la primera vez). */
  datosAdjunto: (id: string) => Promise<string>
  borrarAdjunto: (id: string) => Promise<void>
}

const Contexto = createContext<PropuestasCtx | null>(null)

/** Apartado del proyecto que sale de cada tecnología de la propuesta. */
function iconoDeTecnologia(t: string): IconoApartado {
  const x = t.toLowerCase()
  if (x.includes('bi')) return 'grafico'
  if (x.includes('automate') || x.includes('flujo')) return 'flujo'
  if (x.includes('business central') || x.includes('erp')) return 'erp'
  if (x.includes('sales') || x.includes('crm')) return 'ventas'
  if (x.includes('pages') || x.includes('web')) return 'web'
  if (x.includes('copilot') || x.includes('ia') || x.includes('agente')) return 'ia'
  if (x.includes('apps')) return 'app'
  return 'general'
}

export function PropuestasProveedor({ repo, children }: { repo: PropuestasRepositorio; children: ReactNode }) {
  const { yo, avisar, guardarProyecto, datos } = useApp()
  const [propuestas, setPropuestas] = useState<Propuesta[]>([])
  const [cargado, setCargado] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [adjuntos, setAdjuntos] = useState<AdjuntoPropuesta[]>([])
  const [adjuntosDisponibles, setAdjuntosDisponibles] = useState(true)
  const [subiendo, setSubiendo] = useState<Record<string, number>>({})
  const cacheDatos = useRef(new Map<string, Promise<string>>())
  /** Pregunta si se pasa a proyecto al aceptar; se rellena más abajo, cuando ya existe convertirEnProyecto. */
  const ofrecerProyecto = useRef<(id: string) => Promise<void>>(async () => undefined)
  // la última lista, para las operaciones que encadenan cambios sin esperar al render
  const actual = useRef<Propuesta[]>([])
  const fijar = useCallback((l: Propuesta[]) => { actual.current = l; setPropuestas(l) }, [])

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const [ps, as] = await Promise.all([
        repo.cargar(),
        repo.cargarAdjuntos().then(a => { setAdjuntosDisponibles(true); return a }, e => { console.error(e); setAdjuntosDisponibles(false); return [] }),
      ])
      fijar(ps)
      setAdjuntos(as)
      setError(null)
      setCargado(true)
    } catch (e) {
      console.error(e)
      setError('La tabla de propuestas todavía no está disponible en este entorno.')
    } finally {
      setCargando(false)
    }
  }, [repo, fijar])

  /** Aplica el cambio en pantalla y lo guarda; si falla, avisa y recarga. */
  const persistir = useCallback(async (nueva: Propuesta[], guardar: () => Promise<unknown>, mensajeError: string) => {
    fijar(nueva)
    try {
      await guardar()
    } catch (e) {
      console.error(e)
      avisar(mensajeError, 'error')
      void cargar()
      throw e
    }
  }, [fijar, avisar, cargar])

  const apunte = useCallback((texto: string, estado?: EstadoPropuesta): ApuntePropuesta => ({
    id: nuevoId(), fecha: ahoraIso(), autorId: yo?.id ?? null, texto, ...(estado ? { estado } : {}),
  }), [yo])

  const crear = useCallback(async (n: NuevaPropuesta) => {
    const p: Propuesta = { ...n, id: nuevoId(), orden: ordenAlFinal(actual.current, n.estado), creadoEl: ahoraIso(), actualizadoEl: null }
    await persistir([...actual.current, p], () => repo.guardar(p), 'No se pudo crear la propuesta')
    avisar('Propuesta creada')
    return p
  }, [persistir, repo, avisar])

  const guardar = useCallback(async (p: Propuesta) => {
    const antes = actual.current.find(x => x.id === p.id)
    let final = p
    // si el estado cambia desde la ficha, queda apuntado y va al final de su nueva columna
    if (antes && antes.estado !== p.estado) {
      final = { ...p, orden: ordenAlFinal(actual.current, p.estado), apuntes: [...p.apuntes, apunte(`Pasa a ${ETIQUETA_ESTADO_PROPUESTA[p.estado]}`, p.estado)] }
    }
    final = { ...final, actualizadoEl: ahoraIso() }
    await persistir(actual.current.map(x => (x.id === p.id ? final : x)), () => repo.guardar(final), 'No se pudo guardar la propuesta')
    if (antes && antes.estado !== 'aceptado' && final.estado === 'aceptado' && !final.proyectoId) await ofrecerProyecto.current(final.id)
  }, [persistir, repo, apunte])

  const borrar = useCallback(async (id: string) => {
    // sus adjuntos se van con ella, salvo los que ya pasaron a un proyecto
    const suyos = adjuntos.filter(a => a.propuestaId === id && !a.proyectoId)
    await persistir(actual.current.filter(x => x.id !== id), async () => {
      await Promise.all(suyos.map(a => repo.borrarAdjunto(a.id)))
      await repo.borrar(id)
    }, 'No se pudo borrar la propuesta')
    setAdjuntos(l => l.filter(a => a.propuestaId !== id))
    avisar('Propuesta borrada')
  }, [persistir, repo, avisar, adjuntos])

  const mover = useCallback(async (id: string, estado: EstadoPropuesta, indice?: number) => {
    const lista = actual.current
    const p = lista.find(x => x.id === id)
    if (!p) return
    const cambiaEstado = p.estado !== estado
    const destino = columna(lista, estado).filter(x => x.id !== id)
    const pos = indice === undefined ? destino.length : Math.max(0, Math.min(indice, destino.length))
    const movida: Propuesta = cambiaEstado
      ? { ...p, estado, apuntes: [...p.apuntes, apunte(`Pasa a ${ETIQUETA_ESTADO_PROPUESTA[estado]}`, estado)], actualizadoEl: ahoraIso() }
      : p
    destino.splice(pos, 0, movida)
    const reordenadas = destino.map((x, i) => ({ ...x, orden: i }))
    const cambiadas = reordenadas.filter(x => x.id === id || x.orden !== lista.find(y => y.id === x.id)?.orden)
    if (!cambiaEstado && !cambiadas.length) return
    const porId = new Map(reordenadas.map(x => [x.id, x]))
    const nueva = lista.map(x => porId.get(x.id) ?? x)
    const laMovida = porId.get(id)!
    await persistir(nueva, async () => {
      // la movida entera (lleva el apunte nuevo); las demás, solo el orden
      await repo.guardar(laMovida)
      await repo.guardarVarias(cambiadas.filter(x => x.id !== id))
    }, 'No se pudo mover la propuesta')
    if (cambiaEstado && estado === 'aceptado' && !laMovida.proyectoId) await ofrecerProyecto.current(id)
  }, [persistir, repo, apunte])

  const anadirApunte = useCallback(async (id: string, texto: string) => {
    const p = actual.current.find(x => x.id === id)
    if (!p || !texto.trim()) return
    const final = { ...p, apuntes: [...p.apuntes, apunte(texto.trim())], actualizadoEl: ahoraIso() }
    await persistir(actual.current.map(x => (x.id === id ? final : x)), () => repo.guardar(final), 'No se pudo guardar el apunte')
  }, [persistir, repo, apunte])

  const borrarApunte = useCallback(async (id: string, apunteId: string) => {
    const p = actual.current.find(x => x.id === id)
    if (!p) return
    const final = { ...p, apuntes: p.apuntes.filter(a => a.id !== apunteId) }
    await persistir(actual.current.map(x => (x.id === id ? final : x)), () => repo.guardar(final), 'No se pudo borrar el apunte')
  }, [persistir, repo])

  const convertirEnProyecto = useCallback(async (id: string) => {
    const p = actual.current.find(x => x.id === id)
    if (!p) return null
    const apartados: ApartadoProyecto[] = p.tecnologias.map(t => ({ id: nuevoId(), nombre: t, descripcion: '', icono: iconoDeTecnologia(t) }))
    const proyecto = await guardarProyecto({
      nombre: p.titulo, cliente: p.cliente, interno: false, enlaceDocumentos: '', apartados,
      color: COLORES[datos.proyectos.length % COLORES.length], estado: 'activo', responsableId: p.responsableId ?? yo?.id ?? null,
      descripcion: p.descripcion, fechaInicio: hoy(), fechaFin: null, horasPresupuestadas: null,
    })
    // los adjuntos de la propuesta pasan también al proyecto
    const suyos = adjuntos.filter(a => a.propuestaId === id).map(a => a.id)
    if (suyos.length) {
      try {
        await repo.enlazarAdjuntos(suyos, proyecto.id)
        setAdjuntos(l => l.map(a => (suyos.includes(a.id) ? { ...a, proyectoId: proyecto.id } : a)))
      } catch (e) {
        console.error(e)
        avisar('El proyecto se creó, pero no se pudieron enlazar los adjuntos', 'error')
      }
    }
    const final: Propuesta = {
      ...p, proyectoId: proyecto.id, estado: 'aceptado',
      apuntes: [...p.apuntes, apunte(`Convertida en el proyecto «${proyecto.nombre}»`, p.estado === 'aceptado' ? undefined : 'aceptado')],
      actualizadoEl: ahoraIso(),
    }
    await persistir(actual.current.map(x => (x.id === id ? final : x)), () => repo.guardar(final), 'El proyecto se creó, pero no se pudo enlazar con la propuesta')
    return proyecto.id
  }, [guardarProyecto, datos.proyectos.length, yo, persistir, repo, apunte, adjuntos, avisar])

  // al aceptar desde el tablero o la ficha se ofrece pasarla ya a proyecto
  useEffect(() => {
    ofrecerProyecto.current = async (id: string) => {
      const p = actual.current.find(x => x.id === id)
      if (!p || p.proyectoId) return
      const ok = await confirmar('¡Propuesta aceptada! ¿La pasamos ya a proyecto?', {
        texto: `Se crea «${p.titulo}» en la cartera de proyectos con su descripción, sus tecnologías como apartados y sus adjuntos. También puedes hacerlo más tarde desde la ficha.`,
        aceptar: 'Crear proyecto',
      })
      if (ok) await convertirEnProyecto(id)
    }
  }, [convertirEnProyecto])

  // ─────────────────────────────────────────────── adjuntos
  const subirArchivos = useCallback(async (propuestaId: string, archivos: File[]) => {
    if (!archivos.length) return
    const cambiar = (n: number) => setSubiendo(s => ({ ...s, [propuestaId]: Math.max(0, (s[propuestaId] ?? 0) + n) }))
    cambiar(archivos.length)
    let subidos = 0
    const proyectoId = actual.current.find(p => p.id === propuestaId)?.proyectoId ?? null
    for (const archivo of archivos) {
      try {
        const listo = await prepararArchivo(archivo)
        const a: AdjuntoPropuesta = { id: nuevoId(), propuestaId, proyectoId, nombre: listo.nombre, tipo: listo.tipo, tamano: listo.tamano, creadoEl: ahoraIso() }
        await repo.crearAdjunto(a, listo.datos)
        cacheDatos.current.set(a.id, Promise.resolve(listo.datos))
        setAdjuntos(l => [...l, a])
        subidos++
      } catch (e) {
        console.error(e)
        avisar(e instanceof ErrorAdjunto ? e.message : `No se pudo subir «${archivo.name}»`, 'error')
      } finally {
        cambiar(-1)
      }
    }
    if (subidos) avisar(subidos === 1 ? 'Archivo adjuntado' : `${subidos} archivos adjuntados`)
  }, [repo, avisar])

  const datosAdjunto = useCallback((id: string) => {
    let d = cacheDatos.current.get(id)
    if (!d) {
      d = repo.leerAdjunto(id)
      cacheDatos.current.set(id, d)
      d.catch(() => cacheDatos.current.delete(id))
    }
    return d
  }, [repo])

  const borrarAdjunto = useCallback(async (id: string) => {
    const antes = adjuntos
    setAdjuntos(l => l.filter(a => a.id !== id))
    try {
      await repo.borrarAdjunto(id)
      cacheDatos.current.delete(id)
    } catch (e) {
      console.error(e)
      setAdjuntos(antes)
      avisar('No se pudo borrar el adjunto', 'error')
    }
  }, [repo, adjuntos, avisar])

  const valor = useMemo<PropuestasCtx>(() => ({
    propuestas, cargado, cargando, error, cargar, crear, guardar, borrar, mover, anadirApunte, borrarApunte, convertirEnProyecto,
    adjuntos, adjuntosDisponibles, subiendo, subirArchivos, datosAdjunto, borrarAdjunto,
  }), [propuestas, cargado, cargando, error, cargar, crear, guardar, borrar, mover, anadirApunte, borrarApunte, convertirEnProyecto,
    adjuntos, adjuntosDisponibles, subiendo, subirArchivos, datosAdjunto, borrarAdjunto])

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>
}

export function usePropuestas(): PropuestasCtx {
  const c = useContext(Contexto)
  if (!c) throw new Error('usePropuestas fuera de <PropuestasProveedor>')
  return c
}
