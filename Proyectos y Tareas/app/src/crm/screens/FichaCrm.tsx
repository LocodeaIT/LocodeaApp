/**
 * Ficha genérica del CRM (página de ficha de Business Central): pestañas
 * desplegables, barra de comandos, flujo de proceso y paneles laterales.
 *
 * Se edita un borrador. «Sin guardar» avisa de cambios pendientes; al salir de
 * la ficha, un registro existente se guarda solo (si es válido) y uno nuevo se
 * descarta avisando, como en Business Central.
 */
import { useEffect, useRef, useState } from 'react'
import { ChevronRight, Plus, Printer, Save, Check, Trash2, X } from 'lucide-react'
import { useApp } from '../../store'
import { useCrm, type CrmCtx } from '../contexto'
import type { ColEntidad, Documento, Fase, LineaDocumento, RegistroBase } from '../types'
import { entidadDe } from '../registro'
import type { Campo, Comando, Entidad, Pestana } from '../registro/tipos'
import { totalDoc } from '../documentos'
import { eur, fecha } from '../formato'
import { guardarPestanas, pestanasGuardadas } from '../preferencias'
import { CampoFicha } from './Campos'
import { DocumentoImpreso } from './DocumentoImpreso'
import { LineasDocumento } from './LineasDocumento'
import { BarraProceso } from './BarraProceso'
import { ModalConfirmar, ModalTexto } from './ModalesCrm'

interface Borrador { base: RegistroBase | undefined; d: RegistroBase; sucio: boolean }
interface PeticionTexto { titulo: string; subtitulo: string; etiqueta: string; ok: string; fn: (t: string) => void }

const clonar = <T,>(o: T): T => structuredClone(o)

/** Texto de un campo para el resumen de la pestaña plegada. */
function textoCampo(campo: Campo<RegistroBase>, d: RegistroBase, c: CrmCtx): string {
  if (campo.resumen) return campo.resumen(d, c)
  if (campo.mostrar) return ''
  const v = (d as unknown as Record<string, unknown>)[campo.clave]
  if (v === '' || v == null) return ''
  if (campo.tipo === 'sino') return v ? 'Sí' : 'No'
  if (campo.opciones) {
    const ops = typeof campo.opciones === 'function' ? campo.opciones(d, c) : campo.opciones
    return ops.find(o => o.valor === String(v))?.etiqueta ?? ''
  }
  if (campo.tipo === 'fecha') return fecha(String(v))
  return String(v)
}

export function FichaCrm({ col, id, prefill }: { col: ColEntidad; id: string; prefill?: Record<string, unknown> | null }) {
  const c = useCrm()
  const { avisar } = useApp()
  const e = entidadDe(col)
  const esNuevo = id === 'nuevo'
  const registro = esNuevo ? undefined : (c.datos[col] as RegistroBase[]).find(o => o.id === id)

  const [b, setB] = useState<Borrador>(() => ({ base: registro, d: clonar(registro ?? { ...e.nuevo(c), ...(prefill ?? {}) } as RegistroBase), sucio: false }))
  // Si el registro cambia fuera (una acción, un guardado) y no hay cambios pendientes, el borrador se recarga.
  if (registro && registro !== b.base && !b.sucio) setB({ base: registro, d: clonar(registro), sucio: false })

  // pestañas abiertas o plegadas: se recuerdan por entidad en este navegador
  const [abiertas, setAbiertas] = useState<Record<string, boolean>>(() => {
    const guardadas = pestanasGuardadas(col)
    return Object.fromEntries(e.pestanas.map(p => [p.clave, guardadas[p.clave] ?? p.abierta !== false]))
  })
  const alternarPestana = (clave: string) => setAbiertas(a => { const n = { ...a, [clave]: !a[clave] }; guardarPestanas(col, n); return n })
  const [pedir, setPedir] = useState<PeticionTexto | null>(null)
  const [borrar, setBorrar] = useState(false)

  const d = b.d
  const bloqueado = !!registro && !!e.bloqueado?.(registro)

  // Al desmontar (ir a otra pantalla o registro) se resuelve el borrador pendiente.
  const ultimo = useRef({ b, c, e, avisar })
  useEffect(() => { ultimo.current = { b, c, e, avisar } })
  useEffect(() => () => {
    const { b: fin, c: ctx, e: ent, avisar: av } = ultimo.current
    if (!fin.sucio) return
    if (fin.d.id && !ent.validar(fin.d, ctx)) {
      void ctx.guardar(ent.col, (ent.antesDeGuardar ? ent.antesDeGuardar(fin.d, ctx) : fin.d) as never).then(() => av('Cambios guardados'))
    } else if (!fin.d.id) {
      av('Borrador descartado', 'info')
    }
  }, [])

  const limpiar = () => { setB(x => ({ ...x, sucio: false })); ultimo.current = { ...ultimo.current, b: { ...ultimo.current.b, sucio: false } } }

  const cambiar = (campo: Campo<RegistroBase> | null, clave: string, valor: unknown) => {
    setB(x => {
      let n = { ...x.d, [clave]: valor } as RegistroBase
      if (campo?.alCambiar) n = campo.alCambiar(n, c)
      return { ...x, d: n, sucio: true }
    })
  }

  const guardar = async (cerrar: boolean) => {
    if (bloqueado) return
    const error = e.validar(d, c)
    if (error) { avisar(error, 'error'); return }
    const o = e.antesDeGuardar ? e.antesDeGuardar(d, c) : d
    limpiar()
    try {
      const r = await c.guardar(col, o as never) as RegistroBase
      avisar(esNuevo ? `${e.uno} ${e.fem ? 'creada' : 'creado'}` : 'Cambios guardados')
      if (cerrar) c.irLista(col)
      // sustituye la entrada «nuevo» del historial: Atrás no vuelve al formulario vacío
      else if (esNuevo) c.abrir(col, r.id, null, true)
    } catch {
      setB(x => ({ ...x, sucio: true }))
    }
  }

  // Ctrl+S guarda la ficha abierta
  const guardarRef = useRef(guardar)
  useEffect(() => { guardarRef.current = guardar })
  useEffect(() => {
    const h = (ev: KeyboardEvent) => { if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 's') { ev.preventDefault(); void guardarRef.current(false) } }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  if (!esNuevo && !registro) {
    return (
      <div className="pagina crm">
        <Migas e={e} texto="No encontrado" onLista={() => c.irLista(col)} />
        <div className="tarjeta padded crm-vacio">Este registro ya no existe.</div>
      </div>
    )
  }

  /** Los comandos trabajan con el borrador: sus cambios se guardan junto con la acción. */
  const ejecutar = (cmd: Comando) => { limpiar(); void cmd.accion() }
  const comandos = !esNuevo && registro
    ? (e.comandos?.(d, c, { pedirTexto: (titulo, subtitulo, etiqueta, ok, fn) => setPedir({ titulo, subtitulo, etiqueta, ok, fn }) }) ?? []).filter((x): x is Comando => !!x)
    : []
  const titulo = esNuevo ? `${e.fem ? 'Nueva' : 'Nuevo'} ${e.uno.toLowerCase()}` : e.titulo(d, c)
  const proceso = e.proceso
  const fase = (d as unknown as { fase?: Fase }).fase ?? 'calificar'

  return (
    <div className={`pagina crm ${e.imprimir && registro ? 'crm-con-impreso' : ''}`}>
      {e.imprimir && registro && <DocumentoImpreso col={col} doc={d as unknown as Documento} compra={!!e.compra} />}
      <Migas e={e} texto={esNuevo ? titulo : (registro?.no || titulo)} onLista={() => c.irLista(col)} />
      <div className="titulo-pagina crm-cabecera-ficha">
        <div>
          <div className="crm-antetitulo">{e.uno}</div>
          <div className="crm-fila-titulo">
            <h1>{titulo}</h1>
            {b.sucio && <span className="chip pequeno aviso">Sin guardar</span>}
            {bloqueado && <span className="chip pequeno contorno">Registrado · solo lectura</span>}
            {registro && e.etiquetas?.(registro, c)}
          </div>
        </div>
        <div className="acciones no-imprimir">
          {!bloqueado && <button className="btn primario" onClick={() => void guardar(false)} title="Ctrl+S"><Save size={15} /> Guardar</button>}
          {!bloqueado && <button className="btn" onClick={() => void guardar(true)}><Check size={15} /> Guardar y cerrar</button>}
          {esNuevo && <button className="btn sutil" onClick={() => c.irLista(col)}><X size={15} /> Descartar</button>}
          {comandos.map(cmd => (
            <button key={cmd.texto} className={`btn ${cmd.tono === 'acento' ? 'crm-acento' : cmd.tono === 'peligro' ? 'peligro' : ''}`} onClick={() => ejecutar(cmd)}>
              <cmd.icono size={15} /> {cmd.texto}
            </button>
          ))}
          {!esNuevo && <>
            <span className="crm-separador" />
            <button className="btn sutil" onClick={() => c.abrir(col, 'nuevo')}><Plus size={15} /> Nuevo</button>
            <button className="btn sutil crm-peligro" onClick={() => setBorrar(true)}><Trash2 size={15} /> Eliminar</button>
            {e.imprimir && <button className="btn sutil" onClick={() => window.print()}><Printer size={15} /> Imprimir</button>}
          </>}
        </div>
      </div>

      {proceso && (
        <div className="no-imprimir">
          <BarraProceso fase={fase} fin={proceso.fin(d)} editable={proceso.editable && !!registro && (d as unknown as { estado: string }).estado === 'abierta'}
            onFase={f => { limpiar(); void c.cambiarFase(d as never, f) }} />
        </div>
      )}

      <div className={`crm-ficha ${e.hechos && registro ? '' : 'sola'}`}>
        <div className="crm-pestanas">
          {e.pestanas.map(p => (
            <PestanaFicha key={p.clave} p={p} e={e} d={d} c={c} abierta={abiertas[p.clave]} bloqueado={bloqueado}
              onAlternar={() => alternarPestana(p.clave)} onCambiar={cambiar} />
          ))}
        </div>
        {e.hechos && registro && <aside className="crm-hechos no-imprimir">{e.hechos(registro, c)}</aside>}
      </div>

      {pedir && <ModalTexto titulo={pedir.titulo} subtitulo={pedir.subtitulo} etiqueta={pedir.etiqueta} ok={pedir.ok} onOk={t => { limpiar(); pedir.fn(t) }} onCerrar={() => setPedir(null)} />}
      {borrar && registro && (
        <ModalConfirmar titulo={`Eliminar ${e.uno.toLowerCase()}`} texto={`Se eliminará «${e.titulo(registro, c)}». Esta acción no se puede deshacer.`} ok="Eliminar"
          onCerrar={() => setBorrar(false)}
          onOk={() => {
            limpiar()
            void c.borrar(col, [registro.id]).then(() => { avisar(`${e.uno} ${e.fem ? 'eliminada' : 'eliminado'}`, 'info'); c.irLista(col) })
          }} />
      )}
    </div>
  )
}

function Migas({ e, texto, onLista }: { e: Entidad<RegistroBase>; texto: string; onLista: () => void }) {
  return (
    <div className="crm-migas no-imprimir">
      <button type="button" className="crm-enlace" onClick={onLista}>{e.muchos}</button>
      <ChevronRight size={13} />
      <span>{texto}</span>
    </div>
  )
}

function PestanaFicha({ p, e, d, c, abierta, bloqueado, onAlternar, onCambiar }: {
  p: Pestana<RegistroBase>; e: Entidad<RegistroBase>; d: RegistroBase; c: CrmCtx; abierta: boolean; bloqueado: boolean
  onAlternar: () => void; onCambiar: (campo: Campo<RegistroBase> | null, clave: string, valor: unknown) => void
}) {
  const lineas = (d as unknown as { lineas?: LineaDocumento[] }).lineas ?? []
  const resumen = abierta ? '' : p.lineas
    ? `${lineas.length} ${lineas.length === 1 ? 'línea' : 'líneas'} · ${eur(totalDoc({ lineas }))}`
    : (p.campos ?? []).slice(0, 3).map(x => textoCampo(x, d, c)).filter(Boolean).join(' · ')
  return (
    <section className={`crm-pestana ${abierta ? 'abierta' : ''}`}>
      <button type="button" className="crm-pestana-cabecera" onClick={onAlternar} aria-expanded={abierta}>
        <ChevronRight size={16} className="chev" />
        <b>{p.titulo}</b>
        {resumen && <span className="resumen">{resumen}</span>}
      </button>
      {/* siempre montado: plegado solo se oculta, así se imprime entero */}
      <div className="crm-pestana-cuerpo">
        {p.lineas
          ? <LineasDocumento lineas={lineas} compra={!!e.compra} bloqueado={bloqueado} onCambio={l => onCambiar(null, 'lineas', l)} />
          : (
            <div className="crm-campos">
              {(p.campos ?? []).map(x => <CampoFicha key={x.clave} campo={x} d={d} c={c} bloqueado={bloqueado} onCambio={v => onCambiar(x, x.clave, v)} />)}
            </div>
          )}
      </div>
    </section>
  )
}
