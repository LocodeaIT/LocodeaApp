/**
 * Estado de la Gestoría: perfil fiscal, presentaciones, asientos manuales y
 * Verifactu, con las acciones para guardarlos. Los modelos, los libros, la
 * contabilidad y la revisión se calculan en las pantallas a partir de esto y
 * de los datos del CRM y de Gestión (funciones puras de ./fiscal y
 * ./contabilidad).
 *
 * Escucha al CRM: cuando se registra o se anula una factura de venta crea su
 * registro de Verifactu (encadenado con el anterior) y deja en la factura su
 * estado y su huella. Los registros se crean de uno en uno, en cola, para que
 * dos facturas seguidas no tomen la misma huella anterior.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useApp } from '../store'
import { useCrm } from '../crm/contexto'
import { alCambiarFacturaVenta } from '../crm/eventos'
import type { EstadoVerifactu, FacturaVenta } from '../crm/types'
import { nuevoId } from '../data/repo'
import { ahoraIso } from '../domain/fechas'
import type { GestoriaRepositorio } from './repo'
import type {
  AsientoManual, ColGestoria, ConfigVerifactu, EstadoRegistro, GestoriaInstantanea, ModeloFiscal, PerfilFiscal, Presentacion, RegistroFacturacion,
  RegistroGestoria, RegistroGestoriaDe,
} from './types'
import { GESTORIA_VACIA, perfilInicial, verifactuInicial } from './types'
import { crearRegistroAlta, crearRegistroAnulacion, enviarAlServicio, ultimoDeLaCadena } from './verifactu'
import './gestoria.css'

/** completo: socios. lectura: asesor externo. ninguno: colaboradores (la Gestoría no se les muestra). */
export type AccesoGestoria = 'completo' | 'lectura' | 'ninguno'

export interface GestoriaCtx {
  datos: GestoriaInstantanea
  cargando: boolean
  error: string | null
  disponible: boolean
  puedeGestionarDatos: boolean
  acceso: AccesoGestoria
  /** El perfil guardado o, si aún no hay, el de partida (con id vacío). */
  perfil: PerfilFiscal
  /** La configuración de Verifactu guardada o la de partida (modo preparación). */
  config: ConfigVerifactu
  guardarPerfil: (p: PerfilFiscal) => Promise<PerfilFiscal>
  guardarPresentacion: (p: Presentacion) => Promise<Presentacion>
  guardarAsiento: (a: AsientoManual) => Promise<AsientoManual>
  guardarConfig: (v: ConfigVerifactu) => Promise<ConfigVerifactu>
  borrar: (col: ColGestoria, id: string) => Promise<void>
  /** Crea el registro de Verifactu de una factura de venta (alta o anulación). */
  registrarFactura: (f: FacturaVenta, tipo: 'alta' | 'anulacion') => Promise<RegistroFacturacion | null>
  /** Reenvía a la AEAT los registros pendientes o rechazados (fuera del modo preparación). */
  reenviarPendientes: () => Promise<void>
  /** Modelo y periodo que abre la pantalla Modelos (desde el panel o la revisión). */
  seleccion: { modelo: ModeloFiscal; periodo: string } | null
  abrirModelo: (modelo: ModeloFiscal, periodo: string) => void
  restablecerDemo: () => Promise<void>
  recargar: () => Promise<void>
}

const Contexto = createContext<GestoriaCtx | null>(null)

function sustituir<T extends RegistroGestoria>(lista: T[], o: T): T[] {
  return lista.some(x => x.id === o.id) ? lista.map(x => (x.id === o.id ? o : x)) : [...lista, o]
}

/** Estado que se refleja en la factura del CRM según cómo quedó su registro. */
function estadoEnFactura(r: RegistroFacturacion): EstadoVerifactu {
  if (r.tipo === 'anulacion') return 'anulado'
  const m: Record<EstadoRegistro, EstadoVerifactu> = { simulado: 'preparado', pendiente: 'pendiente', correcto: 'correcto', 'aceptado-errores': 'aceptado-errores', rechazado: 'rechazado' }
  return m[r.estado]
}

export function GestoriaProveedor({ repo, children }: { repo: GestoriaRepositorio; children: ReactNode }) {
  const { yo, avisar, setPantalla } = useApp()
  const crm = useCrm()
  const [seleccion, setSeleccion] = useState<{ modelo: ModeloFiscal; periodo: string } | null>(null)
  const abrirModelo = useCallback((modelo: ModeloFiscal, periodo: string) => { setSeleccion({ modelo, periodo }); setPantalla('gestoria-modelos') }, [setPantalla])
  const [datos, setDatos] = useState<GestoriaInstantanea>(GESTORIA_VACIA)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const actual = useRef<GestoriaInstantanea>(GESTORIA_VACIA)
  const crmActual = useRef(crm)
  crmActual.current = crm
  /** Cola de registros de Verifactu: cada uno espera al anterior. */
  const cola = useRef<Promise<unknown>>(Promise.resolve())

  const aplicar = useCallback((cambio: (d: GestoriaInstantanea) => GestoriaInstantanea) => {
    actual.current = cambio(actual.current)
    setDatos(actual.current)
  }, [])

  const recargar = useCallback(async () => {
    if (!repo.disponible) { setCargando(false); return }
    setCargando(true)
    setError(null)
    try {
      const d = await repo.cargar()
      actual.current = d
      setDatos(d)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar la Gestoría')
    } finally {
      setCargando(false)
    }
  }, [repo])

  useEffect(() => { void recargar() }, [recargar])

  const guardarGenerico = useCallback(async <K extends ColGestoria>(col: K, obj: RegistroGestoriaDe<K>, silencioso = false): Promise<RegistroGestoriaDe<K>> => {
    const nuevo = !obj.id
    const listo = { ...obj, id: obj.id || nuevoId(), creadoEl: obj.creadoEl || ahoraIso(), actualizadoEl: nuevo ? null : ahoraIso() } as RegistroGestoriaDe<K>
    try {
      const guardado = await repo.guardar(col, listo)
      aplicar(d => ({ ...d, [col]: sustituir(d[col] as RegistroGestoria[], guardado) }))
      return guardado
    } catch (e) {
      console.error(e)
      if (!silencioso) avisar('No se pudo guardar', 'error')
      throw e
    }
  }, [repo, aplicar, avisar])

  const perfil = useMemo(() => datos.perfil[0] ?? perfilInicial(), [datos.perfil])
  const config = useMemo(() => datos.verifactu[0] ?? { ...verifactuInicial(), nifEmisor: perfil.nif, razonSocial: perfil.razonSocial }, [datos.verifactu, perfil])

  const guardarPerfil = useCallback(async (p: PerfilFiscal) => {
    const r = await guardarGenerico('perfil', p)
    avisar('Perfil fiscal guardado')
    return r
  }, [guardarGenerico, avisar])

  const guardarPresentacion = useCallback(async (p: Presentacion) => {
    const r = await guardarGenerico('presentaciones', p)
    avisar(`Modelo ${p.modelo}: guardado`)
    return r
  }, [guardarGenerico, avisar])

  const guardarAsiento = useCallback(async (a: AsientoManual) => {
    const r = await guardarGenerico('asientos', a)
    avisar('Asiento guardado')
    return r
  }, [guardarGenerico, avisar])

  const guardarConfig = useCallback(async (v: ConfigVerifactu) => {
    const r = await guardarGenerico('verifactu', v)
    avisar('Configuración de Verifactu guardada')
    return r
  }, [guardarGenerico, avisar])

  const borrar = useCallback(async (col: ColGestoria, id: string) => {
    try {
      await repo.borrar(col, id)
      aplicar(d => ({ ...d, [col]: (d[col] as RegistroGestoria[]).filter(x => x.id !== id) }))
      avisar('Borrado', 'info')
    } catch (e) {
      console.error(e)
      avisar('No se pudo borrar', 'error')
      throw e
    }
  }, [repo, aplicar, avisar])

  /** Envía registros al servicio de Azure y guarda el envío y el resultado de cada uno. */
  const enviar = useCallback(async (cfg: ConfigVerifactu, registros: RegistroFacturacion[]) => {
    const r = await enviarAlServicio(cfg, registros)
    const envio = await guardarGenerico('envios', {
      id: '', creadoEl: '', fecha: ahoraIso(), entorno: cfg.entorno, registros: registros.length, estado: r.estado, csv: r.csv,
      respuesta: JSON.stringify(r.respuestas), esperaSegundos: r.esperaSegundos,
    }, true)
    const salida: RegistroFacturacion[] = []
    for (const reg of registros) {
      const resp = r.respuestas.find(x => x.registroId === reg.id)
      salida.push(await guardarGenerico('registros', {
        ...reg, estado: resp?.estado ?? 'pendiente', codigoError: resp?.codigoError ?? '', descripcionError: resp?.descripcionError ?? '', csv: r.csv, envioId: envio.id,
      }, true))
    }
    return salida
  }, [guardarGenerico])

  /** Deja en la factura del CRM el estado y la huella de su registro. */
  const marcarFactura = useCallback(async (facturaId: string, r: RegistroFacturacion) => {
    const c = crmActual.current
    const f = c.datos.facturasVenta.find(x => x.id === facturaId)
    if (!f) return
    await c.guardar('facturasVenta', { ...f, estadoVerifactu: estadoEnFactura(r), huella: r.huella })
  }, [])

  const registrarFactura = useCallback((f: FacturaVenta, tipo: 'alta' | 'anulacion') => {
    const tarea = cola.current.then(async () => {
      if (!repo.disponible) return null
      const d = actual.current
      const cfg = d.verifactu[0] ?? await guardarGenerico('verifactu', { ...verifactuInicial(), nifEmisor: d.perfil[0]?.nif ?? '', razonSocial: d.perfil[0]?.razonSocial ?? 'Locodea SL' }, true)
      const anterior = ultimoDeLaCadena(actual.current.registros, cfg.nifEmisor, cfg.entorno)
      const c = crmActual.current
      const ahora = new Date()
      const nuevo = tipo === 'alta'
        ? await crearRegistroAlta({
          factura: f, cuenta: c.datos.cuentas.find(a => a.id === f.cuentaId), config: cfg, anterior, ahora,
          rectificada: f.rectificadaId ? c.datos.facturasVenta.find(x => x.id === f.rectificadaId) : undefined,
        })
        : await crearRegistroAnulacion({ factura: f, config: cfg, anterior, ahora })
      let registro = await guardarGenerico('registros', { ...nuevo, id: '', creadoEl: '' } as RegistroFacturacion, true)
      if (cfg.entorno !== 'preparacion') {
        try {
          registro = (await enviar(cfg, [registro]))[0] ?? registro
        } catch (e) {
          console.error(e)
          avisar('Verifactu: no se pudo enviar ahora; queda pendiente y se reintentará', 'error')
        }
      }
      await marcarFactura(f.id, registro)
      if (registro.estado === 'rechazado') avisar(`Verifactu rechazó la factura ${f.no}: ${registro.descripcionError || registro.codigoError}`, 'error')
      return registro
    })
    cola.current = tarea.catch(() => undefined)
    return tarea.catch(e => {
      console.error(e)
      avisar('No se pudo crear el registro de Verifactu', 'error')
      return null
    })
  }, [repo, guardarGenerico, enviar, marcarFactura, avisar])

  // el CRM avisa al registrar o anular una factura de venta
  useEffect(() => alCambiarFacturaVenta(e => { void registrarFactura(e.factura, e.tipo === 'registrada' ? 'alta' : 'anulacion') }), [registrarFactura])

  const reenviarPendientes = useCallback(async () => {
    const cfg = actual.current.verifactu[0]
    if (!cfg || cfg.entorno === 'preparacion') { avisar('En modo preparación no se envía nada a la AEAT', 'info'); return }
    const pendientes = actual.current.registros.filter(r => r.entorno === cfg.entorno && (r.estado === 'pendiente' || r.estado === 'rechazado')).sort((a, b) => a.orden - b.orden)
    if (!pendientes.length) { avisar('No hay registros pendientes', 'info'); return }
    try {
      // la AEAT admite hasta 1.000 registros por envío
      for (let i = 0; i < pendientes.length; i += 1000) {
        const hechos = await enviar(cfg, pendientes.slice(i, i + 1000))
        for (const r of hechos) await marcarFactura(r.facturaId, r)
      }
      avisar(`Reenviados ${pendientes.length} registros`)
    } catch (e) {
      console.error(e)
      avisar('No se pudo contactar con el servicio de Verifactu', 'error')
    }
  }, [enviar, marcarFactura, avisar])

  const restablecerDemo = useCallback(async () => {
    if (!repo.restablecer) return
    const d = await repo.restablecer()
    actual.current = d
    setDatos(d)
    avisar('Datos de ejemplo de la Gestoría restablecidos')
  }, [repo, avisar])

  const acceso: AccesoGestoria = yo?.rol === 'socio' ? 'completo' : yo?.rol === 'asesor' ? 'lectura' : 'ninguno'

  const valor = useMemo<GestoriaCtx>(() => ({
    datos, cargando, error, disponible: repo.disponible, puedeGestionarDatos: !!repo.restablecer, acceso, perfil, config,
    guardarPerfil, guardarPresentacion, guardarAsiento, guardarConfig, borrar, registrarFactura, reenviarPendientes, seleccion, abrirModelo, restablecerDemo, recargar,
  }), [datos, cargando, error, repo, acceso, perfil, config, guardarPerfil, guardarPresentacion, guardarAsiento, guardarConfig, borrar, registrarFactura, reenviarPendientes, seleccion, abrirModelo, restablecerDemo, recargar])

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>
}

export function useGestoria(): GestoriaCtx {
  const c = useContext(Contexto)
  if (!c) throw new Error('useGestoria fuera del GestoriaProveedor')
  return c
}
