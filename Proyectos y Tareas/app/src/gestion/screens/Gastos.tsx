/**
 * Gastos: tickets y facturas pequeñas que no pasan por un pedido de compra.
 * Se apuntan con foto del ticket, categoría y quién lo pagó (para reembolsos).
 * Los gastos fijos entran solos en la previsión de caja cada mes.
 */
import { useMemo, useRef, useState } from 'react'
import { Camera, Check, ExternalLink, HandCoins, ImageOff, Plus, Receipt, RotateCcw, Search, Trash2, Repeat } from 'lucide-react'
import { useApp } from '../../store'
import { useCrm } from '../../crm/contexto'
import { Avatar, Campo, Modal, SelectMiembro, SelectProyecto, Vacio, confirmar } from '../../ui/basicos'
import { Select, type Opcion } from '../../ui/Select'
import { eur, fecha, normalizar } from '../../crm/formato'
import { hoy } from '../../domain/fechas'
import { useGestion } from '../store'
import { baseDesdeTotal, cuotaIrpf, cuotaIva, totalDesdeBase } from '../calculos'
import type { CategoriaGasto, EstadoGasto, Gasto, MetodoPagoGasto } from '../types'
import { CATEGORIA_GASTO, ESTADO_GASTO, METODO_PAGO_GASTO, TIPOS_IVA, TONO_ESTADO_GASTO, opcionesDe } from '../types'

type Filtro = 'todos' | 'pendientes' | 'reembolsos' | 'fijos' | 'pagados'
const FILTROS: { valor: Filtro; etiqueta: string }[] = [
  { valor: 'todos', etiqueta: 'Todos' },
  { valor: 'pendientes', etiqueta: 'Pendientes' },
  { valor: 'reembolsos', etiqueta: 'Reembolsos' },
  { valor: 'fijos', etiqueta: 'Fijos' },
  { valor: 'pagados', etiqueta: 'Pagados' },
]

const pasaFiltro = (g: Gasto, f: Filtro) =>
  f === 'todos' ? true
  : f === 'pendientes' ? g.estado === 'pendiente'
  : f === 'reembolsos' ? g.estado === 'reembolsar'
  : f === 'fijos' ? g.recurrente
  : g.estado === 'pagado' || g.estado === 'reembolsado'

export function Gastos() {
  const { datos, guardarGasto, borrar } = useGestion()
  const { datos: crm } = useCrm()
  const { miembro } = useApp()
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [categoria, setCategoria] = useState<CategoriaGasto | ''>('')
  const [texto, setTexto] = useState('')
  const [editando, setEditando] = useState<Gasto | Partial<Gasto> | null>(null)
  const [foto, setFoto] = useState<string | null>(null)

  const proveedor = (id: string | null) => crm.cuentas.find(a => a.id === id)?.nombre ?? ''

  const visibles = useMemo(() => {
    const q = normalizar(texto.trim())
    return datos.gastos
      .filter(g => pasaFiltro(g, filtro))
      .filter(g => !categoria || g.categoria === categoria)
      .filter(g => !q || normalizar(`${g.concepto} ${g.no} ${g.noFactura} ${proveedor(g.proveedorId)} ${g.notas}`).includes(q))
      .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.no.localeCompare(a.no))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datos.gastos, filtro, categoria, texto, crm.cuentas])

  const mes = hoy().slice(0, 7)
  const delMes = datos.gastos.filter(g => g.fecha.startsWith(mes))
  const suma = (l: Gasto[]) => l.reduce((s, g) => s + g.total, 0)
  const pendientes = datos.gastos.filter(g => g.estado === 'pendiente')
  const reembolsos = datos.gastos.filter(g => g.estado === 'reembolsar')
  const fijos = datos.gastos.filter(g => g.recurrente)
  const totalVisible = suma(visibles)

  const opcCategoria: Opcion[] = [{ valor: '', etiqueta: 'Todas las categorías' }, ...opcionesDe(CATEGORIA_GASTO)]

  const cambiarEstado = async (g: Gasto, estado: EstadoGasto) => { await guardarGasto({ ...g, estado }) }
  const eliminar = async (g: Gasto) => {
    if (!(await confirmar(`¿Borrar el gasto ${g.no}?`, { texto: g.concepto, aceptar: 'Borrar', peligro: true }))) return
    await borrar('gastos', g.id)
    setEditando(null)
  }

  return (
    <div className="pagina">
      <div className="titulo-pagina">
        <div>
          <h1>Gastos.</h1>
          <div className="sub">Tickets, licencias y facturas pequeñas, con su foto. Lo que paga alguien de su bolsillo queda marcado para reembolsar.</div>
        </div>
        <div className="acciones">
          <button className="btn acento" onClick={() => setEditando({})}><Plus size={16} /> Apuntar gasto</button>
        </div>
      </div>

      <div className="kpis ges-kpis">
        <div className="tarjeta kpi ges-kpi anim-aparecer retraso-1">
          <div className="etiqueta"><span className="ico"><Receipt size={14} /></span>Este mes</div>
          <div className="valor">{eur(suma(delMes))}</div>
          <div className="pie">{delMes.length} {delMes.length === 1 ? 'gasto' : 'gastos'}</div>
        </div>
        <div className="tarjeta kpi ges-kpi anim-aparecer retraso-2">
          <div className="etiqueta"><span className="ico"><HandCoins size={14} /></span>Pendiente de pago</div>
          <div className="valor">{eur(suma(pendientes))}</div>
          <div className={`pie ${pendientes.length ? 'mal' : ''}`}>{pendientes.length ? `${pendientes.length} sin pagar` : 'Todo pagado'}</div>
        </div>
        <div className="tarjeta kpi ges-kpi anim-aparecer retraso-3">
          <div className="etiqueta"><span className="ico"><RotateCcw size={14} /></span>Por reembolsar</div>
          <div className="valor">{eur(suma(reembolsos))}</div>
          <div className={`pie ${reembolsos.length ? 'mal' : ''}`}>{reembolsos.length ? `${reembolsos.length} al equipo` : 'Nadie espera dinero'}</div>
        </div>
        <div className="tarjeta kpi ges-kpi anim-aparecer retraso-4">
          <div className="etiqueta"><span className="ico"><Repeat size={14} /></span>Fijos al mes</div>
          <div className="valor">{eur(suma(fijos))}</div>
          <div className="pie">{fijos.length} {fijos.length === 1 ? 'cargo recurrente' : 'cargos recurrentes'}</div>
        </div>
      </div>

      <div className="ges-herramientas">
        <div className="btn-grupo" role="tablist" aria-label="Filtrar gastos">
          {FILTROS.map(f => <button key={f.valor} className={filtro === f.valor ? 'activo' : ''} onClick={() => setFiltro(f.valor)} role="tab" aria-selected={filtro === f.valor}>{f.etiqueta}</button>)}
        </div>
        <Select valor={categoria} opciones={opcCategoria} onCambio={v => setCategoria(v as CategoriaGasto | '')} pequeno ancho={220} />
        <label className="buscar"><Search size={15} /><input placeholder="Buscar concepto, nº de factura, proveedor…" value={texto} onChange={e => setTexto(e.target.value)} /></label>
      </div>

      <div className="tarjeta">
        {visibles.length === 0 ? (
          <Vacio icono={<Receipt size={36} />} titulo={datos.gastos.length ? 'Ningún gasto con estos filtros' : 'Todavía no hay gastos'} texto={datos.gastos.length ? undefined : 'Apunta el primero con la foto del ticket: base, IVA y total se calculan solos.'} />
        ) : (
          <div className="ges-tabla-wrap">
            <table className="tabla ges-tabla">
              <thead>
                <tr>
                  <th style={{ width: 46 }} />
                  <th>Concepto</th>
                  <th>Fecha</th>
                  <th>Categoría</th>
                  <th>Pagó</th>
                  <th>Estado</th>
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map(g => {
                  const m = miembro(g.pagadorId)
                  return (
                    <tr key={g.id} className={`clicable ${g.estado === 'pendiente' && g.fecha < hoy() ? 'vencida' : ''}`} onClick={() => setEditando(g)}>
                      <td>
                        {g.foto
                          ? <img className="miniatura" src={g.foto} alt="" onClick={e => { e.stopPropagation(); setFoto(g.foto) }} />
                          : <span className="sin-foto" title="Sin foto"><ImageOff size={14} /></span>}
                      </td>
                      <td className="concepto">
                        <b>{g.concepto}</b>
                        <small>{[g.no, proveedor(g.proveedorId), g.noFactura, g.recurrente ? `fijo · día ${g.diaCargo}` : '', g.deducible ? '' : 'no deducible'].filter(Boolean).join(' · ')}</small>
                      </td>
                      <td>{fecha(g.fecha)}</td>
                      <td>{CATEGORIA_GASTO[g.categoria]}</td>
                      <td>{m ? <span className="crm-persona"><Avatar miembro={m} tamano="pequeno" />{m.nombre.split(' ')[0]}</span> : <span className="crm-apagado">Locodea</span>}</td>
                      <td><span className={`chip pequeno punto ${TONO_ESTADO_GASTO[g.estado]}`}>{ESTADO_GASTO[g.estado]}</span></td>
                      <td className="num ges-total">{eur(g.total)}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={6} style={{ color: 'var(--texto-3)', fontSize: 12.5 }}>{visibles.length} {visibles.length === 1 ? 'gasto' : 'gastos'}</td>
                  <td className="num ges-total"><b>{eur(totalVisible)}</b></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {editando && <ModalGasto inicial={editando} onCerrar={() => setEditando(null)} onGuardar={async g => { await guardarGasto(g); setEditando(null) }} onBorrar={eliminar} onEstado={cambiarEstado} onVerFoto={setFoto} />}
      {foto && <Modal titulo="Ticket" onCerrar={() => setFoto(null)} ancho><img className="ges-foto-grande" src={foto} alt="Ticket" /></Modal>}
    </div>
  )
}

// ─────────────────────────────────────────────── formulario

const OPC_CATEGORIA = opcionesDe(CATEGORIA_GASTO)
const OPC_ESTADO = opcionesDe(ESTADO_GASTO)
const OPC_METODO = opcionesDe(METODO_PAGO_GASTO)
const OPC_IVA: Opcion[] = TIPOS_IVA.map(t => ({ valor: String(t), etiqueta: `${t} %` }))
const OPC_IRPF: Opcion[] = [0, 7, 15, 19].map(t => ({ valor: String(t), etiqueta: t ? `${t} %` : 'Sin retención' }))

/** Máximo de la columna loc_foto (1 MB de texto): la foto se comprime hasta caber con margen. */
const MAX_FOTO = 900_000

function nuevoGasto(yoId: string | null): Gasto {
  return {
    id: '', no: '', concepto: '', fecha: hoy(), base: 0, iva: 21, irpf: 0, total: 0, categoria: 'otros', estado: 'pagado', metodoPago: 'tarjeta',
    recurrente: false, diaCargo: 1, deducible: true, noFactura: '', enlace: '', foto: '', notas: '', proveedorId: null, proyectoId: null,
    pagadorId: yoId, facturaCompraId: null, creadoEl: '',
  }
}

/** Reduce la foto a ≤1200 px de lado y JPEG; baja la calidad hasta que quepa en la columna. */
async function comprimirFoto(archivo: File): Promise<string> {
  const bitmap = await createImageBitmap(archivo)
  const escala = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * escala)
  canvas.height = Math.round(bitmap.height * escala)
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  for (const calidad of [0.8, 0.7, 0.6, 0.5, 0.4, 0.3]) {
    const url = canvas.toDataURL('image/jpeg', calidad)
    if (url.length <= MAX_FOTO) return url
  }
  // aún grande: se reduce el tamaño a la mitad y se vuelve a intentar
  const mitad = document.createElement('canvas')
  mitad.width = Math.round(canvas.width / 2)
  mitad.height = Math.round(canvas.height / 2)
  mitad.getContext('2d')!.drawImage(canvas, 0, 0, mitad.width, mitad.height)
  return mitad.toDataURL('image/jpeg', 0.5)
}

function ModalGasto({ inicial, onCerrar, onGuardar, onBorrar, onEstado, onVerFoto }: {
  inicial: Gasto | Partial<Gasto>
  onCerrar: () => void
  onGuardar: (g: Gasto) => Promise<void>
  onBorrar: (g: Gasto) => Promise<void>
  onEstado: (g: Gasto, e: EstadoGasto) => Promise<void>
  onVerFoto: (url: string) => void
}) {
  const { yoId } = useGestion()
  const { datos: crm } = useCrm()
  const [g, setG] = useState<Gasto>({ ...nuevoGasto(yoId), ...inicial } as Gasto)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const archivo = useRef<HTMLInputElement>(null)
  const nuevo = !g.id
  const set = (cambio: Partial<Gasto>) => setG(x => ({ ...x, ...cambio }))

  // el total manda: es lo que pone el ticket. La base se deriva; si se toca la base, se deriva el total.
  const setTotal = (total: number) => set({ total, base: baseDesdeTotal(total, g.iva, g.irpf) })
  const setBase = (base: number) => set({ base, total: totalDesdeBase(base, g.iva, g.irpf) })
  const setIva = (iva: number) => set({ iva, base: baseDesdeTotal(g.total, iva, g.irpf) })
  const setIrpf = (irpf: number) => set({ irpf, base: baseDesdeTotal(g.total, g.iva, irpf) })

  const opcProveedor: Opcion[] = [
    { valor: '', etiqueta: 'Sin proveedor' },
    ...crm.cuentas.filter(a => a.tipo !== 'cliente').sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')).map(a => ({ valor: a.id, etiqueta: a.nombre, detalle: 'Proveedor' })),
    ...crm.cuentas.filter(a => a.tipo === 'cliente').sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')).map(a => ({ valor: a.id, etiqueta: a.nombre, detalle: 'Cliente' })),
  ]

  const elegirFoto = async (f: File | undefined) => {
    if (!f) return
    try { set({ foto: await comprimirFoto(f) }) } catch { setError('No se pudo leer la imagen.') }
  }

  const guardar = async () => {
    if (!g.concepto.trim()) { setError('Escribe el concepto.'); return }
    if (!g.fecha) { setError('Falta la fecha.'); return }
    if (!(g.total > 0)) { setError('El total tiene que ser mayor que cero.'); return }
    setError(null); setGuardando(true)
    try { await onGuardar({ ...g, concepto: g.concepto.trim() }) } finally { setGuardando(false) }
  }

  const pie = (
    <>
      {!nuevo && <button className="btn sutil peligro" onClick={() => void onBorrar(g)} disabled={guardando}><Trash2 size={15} /> Borrar</button>}
      <span style={{ flex: 1 }} />
      {!nuevo && g.estado === 'pendiente' && <button className="btn" onClick={() => { void onEstado(g, 'pagado'); onCerrar() }} disabled={guardando}><Check size={15} /> Marcar pagado</button>}
      {!nuevo && g.estado === 'reembolsar' && <button className="btn" onClick={() => { void onEstado(g, 'reembolsado'); onCerrar() }} disabled={guardando}><Check size={15} /> Marcar reembolsado</button>}
      <button className="btn sutil" onClick={onCerrar} disabled={guardando}>Cancelar</button>
      <button className="btn acento" onClick={() => void guardar()} disabled={guardando}>{guardando ? 'Guardando…' : nuevo ? 'Apuntar' : 'Guardar'}</button>
    </>
  )

  return (
    <Modal titulo={nuevo ? 'Apuntar gasto' : g.no} onCerrar={onCerrar} pie={pie} ancho>
      <div className="formulario">
        <div className="ges-foto">
          {g.foto ? <img src={g.foto} alt="Ticket" onClick={() => onVerFoto(g.foto)} style={{ cursor: 'zoom-in' }} /> : <div className="marco"><Camera size={26} /></div>}
          <div className="acciones">
            <input ref={archivo} type="file" accept="image/*" capture="environment" hidden onChange={e => { void elegirFoto(e.target.files?.[0]); e.target.value = '' }} />
            <button className="btn pequeno" onClick={() => archivo.current?.click()}><Camera size={14} /> {g.foto ? 'Cambiar foto' : 'Foto del ticket'}</button>
            {g.foto && <button className="btn sutil pequeno" onClick={() => set({ foto: '' })}>Quitar foto</button>}
            <span style={{ fontSize: 12, color: 'var(--texto-3)', maxWidth: 260 }}>Desde el móvil abre la cámara. Se guarda comprimida junto al gasto.</span>
          </div>
        </div>

        <Campo label="Concepto"><input autoFocus value={g.concepto} onChange={e => set({ concepto: e.target.value })} placeholder="Tren a Sevilla · cliente Panaderías Churros" /></Campo>

        <div className="fila-campos">
          <Campo label="Fecha"><input type="date" value={g.fecha} onChange={e => set({ fecha: e.target.value })} /></Campo>
          <Campo label="Categoría"><Select valor={g.categoria} opciones={OPC_CATEGORIA} onCambio={v => set({ categoria: v as CategoriaGasto })} /></Campo>
          <Campo label="Proveedor"><Select valor={g.proveedorId ?? ''} opciones={opcProveedor} onCambio={v => set({ proveedorId: v || null })} /></Campo>
        </div>

        <div className="ges-importes">
          <Campo label="Total (con IVA)"><input type="number" min={0} step={0.01} value={g.total || ''} onChange={e => setTotal(Number(e.target.value) || 0)} placeholder="0,00" /></Campo>
          <Campo label="IVA"><Select valor={String(g.iva)} opciones={OPC_IVA} onCambio={v => setIva(Number(v))} /></Campo>
          <Campo label="Retención IRPF"><Select valor={String(g.irpf)} opciones={OPC_IRPF} onCambio={v => setIrpf(Number(v))} /></Campo>
          <Campo label="Base imponible"><input type="number" min={0} step={0.01} value={g.base || ''} onChange={e => setBase(Number(e.target.value) || 0)} placeholder="0,00" /></Campo>
          <div className="calculado">IVA <b>{eur(cuotaIva(g))}</b>{g.irpf > 0 && <> · IRPF <b>−{eur(cuotaIrpf(g))}</b></>}</div>
        </div>

        <div className="fila-campos">
          <Campo label="Estado"><Select valor={g.estado} opciones={OPC_ESTADO} onCambio={v => set({ estado: v as EstadoGasto })} /></Campo>
          <Campo label="Método de pago"><Select valor={g.metodoPago} opciones={OPC_METODO} onCambio={v => set({ metodoPago: v as MetodoPagoGasto })} /></Campo>
          <Campo label="Lo pagó"><SelectMiembro valor={g.pagadorId} onCambio={id => set({ pagadorId: id })} textoNadie="Locodea (cuenta de empresa)" /></Campo>
          <Campo label="Proyecto"><SelectProyecto valor={g.proyectoId} onCambio={id => set({ proyectoId: id })} /></Campo>
        </div>

        <div className="fila-campos">
          <label className="ges-check"><input type="checkbox" checked={g.recurrente} onChange={e => set({ recurrente: e.target.checked })} /> Gasto fijo mensual</label>
          {g.recurrente && <Campo label="Día de cargo"><input type="number" min={1} max={28} value={g.diaCargo} onChange={e => set({ diaCargo: Math.min(28, Math.max(1, Number(e.target.value) || 1)) })} /></Campo>}
          <label className="ges-check"><input type="checkbox" checked={g.deducible} onChange={e => set({ deducible: e.target.checked })} /> Deducible (entra en el 303)</label>
        </div>

        <div className="fila-campos">
          <Campo label="Nº de factura del proveedor"><input value={g.noFactura} onChange={e => set({ noFactura: e.target.value })} /></Campo>
          <Campo label="Enlace al PDF (SharePoint, OneDrive…)">
            <div style={{ display: 'flex', gap: 6 }}>
              <input value={g.enlace} onChange={e => set({ enlace: e.target.value })} placeholder="https://…" style={{ flex: 1 }} />
              {/^https?:\/\//.test(g.enlace) && <a className="btn icono" href={g.enlace} target="_blank" rel="noreferrer" title="Abrir"><ExternalLink size={15} /></a>}
            </div>
          </Campo>
        </div>

        <Campo label="Notas"><textarea value={g.notas} onChange={e => set({ notas: e.target.value })} rows={2} /></Campo>

        {error && <div className="error-formulario">{error}</div>}
      </div>
    </Modal>
  )
}
