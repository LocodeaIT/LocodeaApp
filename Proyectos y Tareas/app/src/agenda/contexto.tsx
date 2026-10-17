/**
 * Estado del calendario de reuniones y su sincronización con el CRM.
 *
 * Al abrir la app, cada cuarto de hora mientras sigue abierta y cuando alguien
 * pulsa «Sincronizar», se leen los calendarios compartidos del equipo y las
 * reuniones con clientes se dejan como citas en la ficha de su cuenta, contacto
 * o cliente potencial. Si Outlook falla, la app sigue funcionando: el
 * calendario lo dice y el CRM no se toca.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useApp } from '../store'
import { useCrm } from '../crm/contexto'
import { nuevoId } from '../data/repo'
import type { CalendarioVisible, EventoAgenda, FuenteAgenda } from './tipos'
import { dominiosInternos, esCuentaLocodea, planSincronizacion, unirEventos } from './vincular'

/** Ventana que se lee: dos meses hacia atrás y seis hacia delante. */
const DIAS_ATRAS = 60
const DIAS_ADELANTE = 180
const CADA_MIN = 15

export interface EstadoCalendario {
  cal: CalendarioVisible
  ok: boolean
  error: string | null
  eventos: number
}

export interface AgendaCtx {
  eventos: EventoAgenda[]
  calendarios: EstadoCalendario[]
  /** Miembros activos con cuenta de Locodea cuyo calendario no ve la cuenta de la app. */
  sinCompartir: string[]
  estado: 'esperando' | 'sincronizando' | 'listo' | 'error'
  error: string | null
  ultima: string | null
  desde: string
  hasta: string
  /** Lo que hizo la última sincronización en el CRM. */
  resumen: { creadas: number; actualizadas: number; sinVincular: number } | null
  sincronizar: (manual?: boolean) => Promise<void>
}

const Contexto = createContext<AgendaCtx | null>(null)

export function useAgenda(): AgendaCtx {
  const c = useContext(Contexto)
  if (!c) throw new Error('useAgenda fuera de AgendaProveedor')
  return c
}

export function AgendaProveedor({ fuente, children }: { fuente: FuenteAgenda; children: ReactNode }) {
  const { datos: app, cargando: cargandoApp, avisar } = useApp()
  const { cargando: cargandoCrm, disponible, guardar, refrescar } = useCrm()
  const [eventos, setEventos] = useState<EventoAgenda[]>([])
  const [calendarios, setCalendarios] = useState<EstadoCalendario[]>([])
  const [estado, setEstado] = useState<AgendaCtx['estado']>('esperando')
  const [error, setError] = useState<string | null>(null)
  const [ultima, setUltima] = useState<string | null>(null)
  const [resumen, setResumen] = useState<AgendaCtx['resumen']>(null)
  const enCurso = useRef(false)

  const miembros = useMemo(() => app.miembros.filter(m => m.activo), [app.miembros])
  const rango = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    const desde = new Date(d.getTime() - DIAS_ATRAS * 864e5).toISOString()
    const hasta = new Date(d.getTime() + DIAS_ADELANTE * 864e5).toISOString()
    return { desde, hasta }
  }, [])

  const sincronizar = useCallback(async (manual = false) => {
    if (enCurso.current || !miembros.length) return
    enCurso.current = true
    setEstado('sincronizando')
    setError(null)
    try {
      const internos = dominiosInternos(miembros)
      const todos = await fuente.calendarios(miembros)
      // solo los calendarios de alguien del equipo; uno por persona (el primero que aparezca)
      // y solo de cuentas de Locodea: la de Ortoalresa u otra de un cliente no se lee aunque esté compartida
      const delEquipo = todos.filter((c, i) => c.miembroId && esCuentaLocodea(c.propietario) && todos.findIndex(x => x.miembroId === c.miembroId) === i)
      const leidos = await Promise.all(delEquipo.map(async cal => {
        try {
          const ev = await fuente.eventos(cal, rango.desde, rango.hasta, internos)
          return { cal, ok: true, error: null, eventos: ev }
        } catch (e) {
          return { cal, ok: false, error: e instanceof Error ? e.message : 'No se pudo leer', eventos: [] }
        }
      }))
      const unidos = unirEventos(leidos.map(l => ({ miembroId: l.cal.miembroId, eventos: l.eventos })))
      setEventos(unidos)
      setCalendarios(leidos.map(l => ({ cal: l.cal, ok: l.ok, error: l.error, eventos: l.eventos.length })))

      // las citas, al día: otra pestaña o persona puede haber sincronizado ya
      if (disponible) {
        const crm = await refrescar('actividades')
        const plan = planSincronizacion(unidos, crm, miembros, {
          ahora: new Date().toISOString(), ...rango, completo: leidos.every(l => l.ok), nuevoId,
        })
        for (const a of [...plan.crear, ...plan.actualizar]) await guardar('actividades', a)
        setResumen({ creadas: plan.crear.length, actualizadas: plan.actualizar.length, sinVincular: plan.sinVincular.length })
        if (manual) {
          const cambios = plan.crear.length + plan.actualizar.length
          avisar(cambios ? `Calendario sincronizado: ${plan.crear.length} reuniones nuevas en el CRM, ${plan.actualizar.length} actualizadas` : 'Calendario sincronizado: el CRM ya estaba al día', 'ok')
        }
      }
      setUltima(new Date().toISOString())
      setEstado(leidos.every(l => l.ok) ? 'listo' : 'error')
      if (!leidos.every(l => l.ok)) setError('Algún calendario no se pudo leer.')
    } catch (e) {
      console.error(e)
      setEstado('error')
      setError(e instanceof Error ? e.message : 'No se pudieron leer los calendarios de Outlook')
      if (manual) avisar('No se pudieron leer los calendarios de Outlook', 'error')
    } finally {
      enCurso.current = false
    }
  }, [fuente, miembros, rango, disponible, refrescar, guardar, avisar])

  // al arrancar, en cuanto hay equipo y CRM, y después cada cuarto de hora
  const listo = !cargandoApp && !cargandoCrm && miembros.length > 0
  const ultimaSync = useRef(sincronizar)
  useEffect(() => { ultimaSync.current = sincronizar }, [sincronizar])
  useEffect(() => {
    if (!listo) return
    void ultimaSync.current()
    const t = window.setInterval(() => { void ultimaSync.current() }, CADA_MIN * 60000)
    return () => window.clearInterval(t)
  }, [listo])

  const sinCompartir = useMemo(() => {
    if (estado === 'esperando' || (estado === 'sincronizando' && !calendarios.length)) return []
    const vistos = new Set(calendarios.map(c => c.cal.miembroId))
    return miembros.filter(m => esCuentaLocodea(m.email) && !vistos.has(m.id)).map(m => m.id)
  }, [miembros, calendarios, estado])

  const valor = useMemo<AgendaCtx>(() => ({
    eventos, calendarios, sinCompartir, estado, error, ultima, resumen, sincronizar, ...rango,
  }), [eventos, calendarios, sinCompartir, estado, error, ultima, resumen, sincronizar, rango])

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>
}
