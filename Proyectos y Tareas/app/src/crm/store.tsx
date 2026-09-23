/**
 * Estado del CRM: datos cargados, ficha abierta, estado de las listas y las
 * acciones de negocio (calificar, ganar/perder, convertir documentos…).
 *
 * Vive dentro del Proveedor de la app: toma de él quién soy, los miembros del
 * equipo (propietarios), los avisos y la pantalla activa.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { useApp, type Pantalla } from '../store'
import { nuevoId } from '../data/repo'
import { ahoraIso, hoy, sumarDias } from '../domain/fechas'
import type { CrmRepositorio } from './repo'
import type {
  ActividadCrm, ColDocumento, ColEntidad, ColReferente, Contacto, CrmInstantanea, Cuenta, Documento, FacturaCompra,
  FacturaVenta, Fase, Oferta, Oportunidad, PedidoCompra, PedidoVenta, Potencial, RegistroBase, RegistroDe,
} from './types'
import { CRM_VACIO } from './types'
import { DIAS_PAGO, FASE, NOMBRE_REGISTRO, PROBABILIDAD_FASE } from './catalogos'
import { copiarLineas, siguienteNo } from './documentos'
import { cuentaDeReferente, etiquetaEstado } from './consultas'
import { eur0, normalizar } from './formato'
import { ContextoCrm, LISTA_INICIAL, type CrmCtx, type EstadoLista, type Ficha } from './contexto'
import { PANTALLA_DE, PREFIJO, esPantallaCrm, hashDe, leerHash, type Destino } from './navegacion'
import './crm.css'

function sustituir<T extends RegistroBase>(lista: T[], o: T): T[] {
  return lista.some(x => x.id === o.id) ? lista.map(x => (x.id === o.id ? o : x)) : [...lista, o]
}

export function CrmProveedor({ repo, children }: { repo: CrmRepositorio; children: ReactNode }) {
  const { yo, datos: app, avisar, pantalla, setPantalla } = useApp()
  const [datos, setDatos] = useState<CrmInstantanea>(CRM_VACIO)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // un enlace directo (#crm/…/<id>) abre la ficha al arrancar
  const [ficha, setFicha] = useState<Ficha | null>(() => { const d = leerHash(); return d?.col && d.id ? { col: d.col, id: d.id, prefill: null } : null })
  const [listas, setListas] = useState<Partial<Record<ColEntidad, EstadoLista>>>({})
  // Copia síncrona de los datos: una acción encadena varios guardados (calificar
  // crea cuenta, contacto y oportunidad) y cada uno debe ver los anteriores.
  const actual = useRef<CrmInstantanea>(CRM_VACIO)
  const yoId = yo?.id ?? null

  const aplicar = useCallback((cambio: (d: CrmInstantanea) => CrmInstantanea) => {
    actual.current = cambio(actual.current)
    setDatos(actual.current)
  }, [])

  useEffect(() => {
    let vivo = true
    repo.cargar()
      .then(d => { if (vivo) { actual.current = d; setDatos(d); setCargando(false) } })
      .catch((e: unknown) => { if (vivo) { setError(e instanceof Error ? e.message : 'No se pudo cargar el CRM'); setCargando(false) } })
    return () => { vivo = false }
  }, [repo])

  const recargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      const d = await repo.cargar()
      actual.current = d
      setDatos(d)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar el CRM')
    } finally {
      setCargando(false)
    }
  }, [repo])

  const nombreMiembro = useCallback((id: string | null | undefined) => app.miembros.find(m => m.id === id)?.nombre ?? '', [app.miembros])

  // ─────────────────────────────────────────────── navegación
  // Cada destino del CRM deja una entrada en el historial con un hash propio
  // (#crm/…): funcionan el botón Atrás y los enlaces directos a un registro. La
  // app no usa el hash, así que no hay choque.

  /** Aplica un destino sin tocar el historial. */
  const aplicarDestino = useCallback((d: Destino) => {
    setFicha(d.col && d.id ? { col: d.col, id: d.id, prefill: d.prefill ?? null } : null)
    setPantalla(d.col ? PANTALLA_DE[d.col] : 'crm-inicio')
  }, [setPantalla])

  const pantallaRef = useRef(pantalla)
  const ir = useCallback((d: Destino, reemplazar = false) => {
    aplicarDestino(d)
    const h = hashDe(d)
    try {
      if (location.hash === h) return
      if (reemplazar) history.replaceState(null, '', h)
      else {
        // al entrar al CRM desde otra pantalla se apunta cuál era, para que Atrás vuelva a ella
        if (!location.hash.startsWith(PREFIJO)) history.replaceState({ pantallaApp: pantallaRef.current }, '')
        history.pushState(null, '', h)
      }
    } catch { /* historial no disponible: se navega igual */ }
  }, [aplicarDestino])

  useEffect(() => {
    const anterior = pantallaRef.current
    pantallaRef.current = pantalla
    // se sale del CRM por el menú de la app: se quita el hash del CRM con una
    // entrada nueva, así Atrás vuelve al registro que estaba abierto
    if (esPantallaCrm(anterior) && !esPantallaCrm(pantalla) && location.hash.startsWith(PREFIJO)) {
      try { history.pushState({ pantallaApp: pantalla }, '', location.pathname + location.search) } catch { /* sin historial */ }
    }
  }, [pantalla])

  useEffect(() => {
    // enlace directo al arrancar: la ficha ya viene del estado inicial, falta la pantalla
    const inicial = leerHash()
    if (inicial) setPantalla(inicial.col ? PANTALLA_DE[inicial.col] : 'crm-inicio')
    const alVolver = (e: PopStateEvent) => {
      const d = leerHash()
      if (d) aplicarDestino(d)
      else {
        const previa = (e.state as { pantallaApp?: string } | null)?.pantallaApp
        if (previa && !esPantallaCrm(previa)) { setFicha(null); setPantalla(previa as Pantalla) }
      }
    }
    window.addEventListener('popstate', alVolver)
    return () => window.removeEventListener('popstate', alVolver)
  }, [aplicarDestino, setPantalla])

  const abrir = useCallback((col: ColEntidad, id: string, prefill?: Record<string, unknown> | null, reemplazar?: boolean) => {
    ir({ col, id, prefill }, reemplazar)
  }, [ir])

  const cambiarLista = useCallback((col: ColEntidad, cambio: Partial<EstadoLista>) => {
    setListas(l => ({ ...l, [col]: { ...LISTA_INICIAL, ...l[col], ...cambio } }))
  }, [])

  const irLista = useCallback((col: ColEntidad, vista?: string) => {
    if (vista) cambiarLista(col, { vista, pagina: 0, seleccion: [] })
    ir({ col, id: null })
  }, [ir, cambiarLista])

  const irInicio = useCallback(() => ir({ col: null, id: null }), [ir])

  // aviso con «Deshacer», propio del CRM
  const [deshacer, setDeshacer] = useState<{ id: number; texto: string; fn: () => void } | null>(null)
  const contadorDeshacer = useRef(0)

  // ─────────────────────────────────────────────── escritura genérica

  const guardar = useCallback(async <K extends ColEntidad>(col: K, obj: RegistroDe<K>): Promise<RegistroDe<K>> => {
    const ahora = ahoraIso()
    const o = { ...obj, id: obj.id || nuevoId(), creadoEl: obj.creadoEl || ahora, actualizadoEl: ahora } as RegistroDe<K>
    if (!obj.id && !o.no) {
      const no = siguienteNo(col, actual.current[col])
      if (no) o.no = no
    }
    try {
      const r = await repo.guardar(col, o)
      aplicar(d => ({ ...d, [col]: sustituir(d[col] as RegistroBase[], r) }))
      return r
    } catch (e) {
      console.error(e)
      avisar('No se pudo guardar el registro', 'error')
      throw e
    }
  }, [repo, aplicar, avisar])

  const borrar = useCallback(async (col: ColEntidad, ids: string[]) => {
    try {
      for (const id of ids) await repo.borrar(col, id)
      aplicar(d => ({ ...d, [col]: (d[col] as RegistroBase[]).filter(x => !ids.includes(x.id)) }))
    } catch (e) {
      console.error(e)
      avisar('No se pudo eliminar', 'error')
      throw e
    }
  }, [repo, aplicar, avisar])

  const anadirNota = useCallback(async (texto: string, col: ColReferente, id: string) => {
    const f = ahoraIso()
    try {
      const n = { id: nuevoId(), texto, referenteTipo: col, referenteId: id, cuentaId: cuentaDeReferente(actual.current, col, id), autorId: yoId, fecha: f, creadoEl: f }
      const r = await repo.guardar('notas', n)
      aplicar(d => ({ ...d, notas: sustituir(d.notas, r) }))
    } catch (e) {
      console.error(e)
      avisar('No se pudo añadir la nota', 'error')
    }
  }, [repo, aplicar, avisar, yoId])

  // ─────────────────────────────────────────────── clientes potenciales

  /** Calificar crea (o reutiliza) cuenta y contacto y abre una oportunidad en «Desarrollar». */
  const calificarPotencial = useCallback(async (l: Potencial) => {
    if (l.estado !== 'abierto') return
    const d = actual.current
    let cuentaId = l.cuentaId || (l.empresa ? d.cuentas.find(a => normalizar(a.nombre) === normalizar(l.empresa))?.id : null) || null
    if (!cuentaId && l.empresa) {
      const c: Cuenta = {
        id: '', no: '', nombre: l.empresa, tipo: 'cliente', estado: 'activo', cif: '', sector: l.sector, direccion: '', cp: '', ciudad: l.ciudad,
        provincia: '', pais: 'España', web: '', telefono: l.telefono, email: l.email, empleados: '', propietarioId: l.propietarioId,
        condicionesPago: '30', metodoPago: 'transferencia', iva: 21, iban: '', notas: '', creadoEl: '',
      }
      cuentaId = (await guardar('cuentas', c)).id
    }
    let contactoId = l.contactoId
    if (!contactoId && (l.nombre || l.apellidos)) {
      const c: Contacto = {
        id: '', no: '', nombre: l.nombre, apellidos: l.apellidos, cuentaId, cargo: l.cargo, email: l.email, telefono: l.telefono, movil: '',
        ciudad: l.ciudad, linkedin: '', propietarioId: l.propietarioId, estado: 'activo', notas: '', creadoEl: '',
      }
      contactoId = (await guardar('contactos', c)).id
    }
    const o = await guardar('oportunidades', {
      id: '', no: '', titulo: l.tema, cuentaId, contactoId, potencialId: l.id, importe: Number(l.importeEst) || 0, fase: 'desarrollar',
      probabilidad: PROBABILIDAD_FASE.desarrollar, estado: 'abierta', cierrePrevisto: sumarDias(hoy(), 45), propietarioId: l.propietarioId,
      notas: l.descripcion, motivoPerdida: '', cerradaEl: null, creadoEl: '',
    })
    await guardar('potenciales', { ...l, estado: 'calificado', calificadoEl: ahoraIso(), cuentaId, contactoId, oportunidadId: o.id })
    await anadirNota(`Creada al calificar el cliente potencial ${l.no}.`, 'oportunidades', o.id)
    avisar(`Calificado: se ha creado la oportunidad ${o.no}`)
    abrir('oportunidades', o.id)
  }, [guardar, anadirNota, avisar, abrir])

  const descalificarPotencial = useCallback(async (l: Potencial, motivo: string) => {
    await guardar('potenciales', { ...l, estado: 'descalificado', descalificadoEl: ahoraIso(), motivo })
    avisar('Cliente potencial descalificado', 'info')
  }, [guardar, avisar])

  const reactivarPotencial = useCallback(async (l: Potencial) => {
    await guardar('potenciales', { ...l, estado: 'abierto', descalificadoEl: null, motivo: '' })
    avisar('Cliente potencial reactivado')
  }, [guardar, avisar])

  // ─────────────────────────────────────────────── oportunidades

  const cambiarFase = useCallback(async (o: Oportunidad, fase: Fase) => {
    if (o.estado !== 'abierta') return
    await guardar('oportunidades', { ...o, fase, probabilidad: PROBABILIDAD_FASE[fase] })
    avisar('Fase: ' + FASE[fase])
  }, [guardar, avisar])

  const ganarOportunidad = useCallback(async (o: Oportunidad) => {
    const r = await guardar('oportunidades', { ...o, estado: 'ganada', fase: 'cerrar', probabilidad: 100, cerradaEl: ahoraIso() })
    await anadirNota(`Oportunidad cerrada como ganada · ${eur0(r.importe)}.`, 'oportunidades', r.id)
    avisar('Oportunidad ganada: ' + eur0(r.importe))
  }, [guardar, anadirNota, avisar])

  const perderOportunidad = useCallback(async (o: Oportunidad, motivo: string) => {
    const r = await guardar('oportunidades', { ...o, estado: 'perdida', fase: 'cerrar', probabilidad: 0, cerradaEl: ahoraIso(), motivoPerdida: motivo })
    await anadirNota(`Oportunidad cerrada como perdida${motivo ? ' · ' + motivo : ''}.`, 'oportunidades', r.id)
    avisar('Oportunidad cerrada como perdida', 'info')
  }, [guardar, anadirNota, avisar])

  const reabrirOportunidad = useCallback(async (o: Oportunidad) => {
    await guardar('oportunidades', { ...o, estado: 'abierta', fase: 'proponer', probabilidad: PROBABILIDAD_FASE.proponer, cerradaEl: null, motivoPerdida: '' })
    avisar('Oportunidad reabierta')
  }, [guardar, avisar])

  // ─────────────────────────────────────────────── documentos

  const cambiarEstadoDocumento = useCallback(async (col: ColDocumento, doc: Documento, estado: string) => {
    if (estado === 'registrada' && !doc.lineas.length) { avisar('No se puede registrar una factura sin líneas.', 'error'); return }
    const extra = estado === 'pagada' ? { pagadaEl: ahoraIso() } : estado === 'registrada' ? { registradaEl: ahoraIso() } : {}
    await guardar(col, { ...doc, estado, ...extra } as RegistroDe<typeof col>)
    avisar(`${NOMBRE_REGISTRO[col]}: ${etiquetaEstado(col, estado).toLowerCase()}`)
  }, [guardar, avisar])

  const ofertaAPedido = useCallback(async (q: Oferta) => {
    const aceptada = await guardar('ofertas', { ...q, estado: 'aceptada' })
    const p = await guardar('pedidosVenta', {
      id: '', no: '', cuentaId: q.cuentaId, contactoId: q.contactoId, ofertaId: q.id, oportunidadId: q.oportunidadId, fecha: hoy(),
      fechaEntrega: sumarDias(hoy(), 14), estado: 'abierto', propietarioId: q.propietarioId, lineas: copiarLineas(q.lineas),
      condicionesPago: q.condicionesPago, metodoPago: q.metodoPago, referencia: q.referencia, refCliente: '', notas: q.notas, facturaId: null, creadoEl: '',
    })
    await guardar('ofertas', { ...aceptada, estado: 'convertida', pedidoId: p.id })
    const opp = actual.current.oportunidades.find(o => o.id === q.oportunidadId)
    if (opp?.estado === 'abierta') await guardar('oportunidades', { ...opp, fase: 'cerrar', probabilidad: PROBABILIDAD_FASE.cerrar })
    avisar(`Pedido ${p.no} creado a partir de la oferta`)
    abrir('pedidosVenta', p.id)
  }, [guardar, avisar, abrir])

  const pedidoAFactura = useCallback(async (so: PedidoVenta) => {
    const pedido = await guardar('pedidosVenta', so)
    const cond = pedido.condicionesPago || actual.current.cuentas.find(a => a.id === pedido.cuentaId)?.condicionesPago || '30'
    const f: FacturaVenta = {
      id: '', no: '', cuentaId: pedido.cuentaId, contactoId: pedido.contactoId, pedidoId: pedido.id, fecha: hoy(), vencimiento: sumarDias(hoy(), DIAS_PAGO[cond] ?? 30),
      estado: 'borrador', propietarioId: pedido.propietarioId, lineas: copiarLineas(pedido.lineas), condicionesPago: cond, metodoPago: pedido.metodoPago,
      referencia: pedido.referencia, notas: '', registradaEl: null, pagadaEl: null, creadoEl: '',
    }
    const nueva = await guardar('facturasVenta', f)
    await guardar('pedidosVenta', { ...pedido, estado: 'facturado', facturaId: nueva.id })
    avisar(`Factura ${nueva.no} creada (borrador)`)
    abrir('facturasVenta', nueva.id)
  }, [guardar, avisar, abrir])

  const pedidoCompraAFactura = useCallback(async (po: PedidoCompra) => {
    const pedido = await guardar('pedidosCompra', po)
    const cond = pedido.condicionesPago || '30'
    const f: FacturaCompra = {
      id: '', no: '', cuentaId: pedido.cuentaId, contactoId: pedido.contactoId, pedidoId: pedido.id, noProveedor: '', fecha: hoy(),
      vencimiento: sumarDias(hoy(), DIAS_PAGO[cond] ?? 30), estado: 'pendiente', propietarioId: pedido.propietarioId, lineas: copiarLineas(pedido.lineas),
      condicionesPago: cond, metodoPago: pedido.metodoPago, referencia: pedido.referencia, notas: '', registradaEl: null, pagadaEl: null, creadoEl: '',
    }
    const nueva = await guardar('facturasCompra', f)
    await guardar('pedidosCompra', { ...pedido, estado: 'facturado', facturaId: nueva.id })
    avisar(`Factura de compra ${nueva.no} creada`)
    abrir('facturasCompra', nueva.id)
  }, [guardar, avisar, abrir])

  // ─────────────────────────────────────────────── actividades

  const alternarActividad = useCallback(async (a: ActividadCrm) => {
    const hecha = a.estado !== 'completada'
    const r = await guardar('actividades', { ...a, estado: hecha ? 'completada' : 'abierta', completadaEl: hecha ? ahoraIso() : null })
    if (hecha) {
      const id = ++contadorDeshacer.current
      setDeshacer({ id, texto: 'Actividad completada', fn: () => { void guardar('actividades', { ...r, estado: 'abierta', completadaEl: null }) } })
      setTimeout(() => setDeshacer(x => (x?.id === id ? null : x)), 6000)
    }
  }, [guardar])

  const cancelarActividad = useCallback(async (a: ActividadCrm) => {
    await guardar('actividades', { ...a, estado: 'cancelada' })
    avisar('Actividad cancelada', 'info')
  }, [guardar, avisar])

  // ─────────────────────────────────────────────── copia de seguridad (solo demo)

  const sustituirTodo = useCallback(async (d: CrmInstantanea | null, mensaje: string) => {
    const nuevos = d ? await repo.reemplazar?.(d) : await repo.restablecer?.()
    if (!nuevos) return
    actual.current = nuevos
    setDatos(nuevos)
    setListas({})
    irInicio()
    avisar(mensaje)
  }, [repo, avisar, irInicio])

  const restablecerDemo = useCallback(() => sustituirTodo(null, 'Datos de ejemplo del CRM restablecidos'), [sustituirTodo])
  const importarDatos = useCallback((d: CrmInstantanea) => sustituirTodo(d, 'Copia de seguridad importada'), [sustituirTodo])
  const borrarTodo = useCallback(() => sustituirTodo(structuredClone(CRM_VACIO), 'Datos del CRM borrados'), [sustituirTodo])

  const valor: CrmCtx = useMemo(() => ({
    datos, cargando, error, disponible: repo.disponible, puedeGestionarDatos: !!repo.reemplazar && !!repo.restablecer, yoId, miembros: app.miembros, nombreMiembro,
    ficha, abrir, irLista, irInicio, listas, cambiarLista,
    guardar, borrar, anadirNota,
    calificarPotencial, descalificarPotencial, reactivarPotencial, cambiarFase, ganarOportunidad, perderOportunidad, reabrirOportunidad,
    cambiarEstadoDocumento, ofertaAPedido, pedidoAFactura, pedidoCompraAFactura,
    alternarActividad, cancelarActividad, restablecerDemo, importarDatos, borrarTodo, recargar,
  }), [
    datos, cargando, error, repo, yoId, app.miembros, nombreMiembro,
    ficha, abrir, irLista, irInicio, listas, cambiarLista,
    guardar, borrar, anadirNota,
    calificarPotencial, descalificarPotencial, reactivarPotencial, cambiarFase, ganarOportunidad, perderOportunidad, reabrirOportunidad,
    cambiarEstadoDocumento, ofertaAPedido, pedidoAFactura, pedidoCompraAFactura,
    alternarActividad, cancelarActividad, restablecerDemo, importarDatos, borrarTodo, recargar,
  ])

  return (
    <ContextoCrm.Provider value={valor}>
      {children}
      {deshacer && (
        <div className="toasts crm-toasts">
          <div className="toast ok">
            <CheckCircle2 size={18} />{deshacer.texto}
            <button type="button" className="crm-toast-accion" onClick={() => { deshacer.fn(); setDeshacer(null) }}>Deshacer</button>
          </div>
        </div>
      )}
    </ContextoCrm.Provider>
  )
}
