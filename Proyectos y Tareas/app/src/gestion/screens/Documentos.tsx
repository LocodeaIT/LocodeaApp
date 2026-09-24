/**
 * Documentos: contratos, NDA, mandatos SEPA, certificados… con su fecha de
 * caducidad y un enlace a donde vive el archivo. La pantalla existe para que
 * nada caduque sin que alguien lo vea.
 */
import { useMemo, useState } from 'react'
import { AlertTriangle, ExternalLink, FileCheck2, FilePen, FolderLock, Plus, Search, Trash2 } from 'lucide-react'
import { useApp } from '../../store'
import { useCrm } from '../../crm/contexto'
import { Avatar, Campo, Modal, SelectMiembro, Vacio, confirmar } from '../../ui/basicos'
import { Select, type Opcion } from '../../ui/Select'
import { fecha, normalizar } from '../../crm/formato'
import { hoy } from '../../domain/fechas'
import { useGestion } from '../store'
import { diasParaCaducar, estadoCaducidad, type EstadoCaducidad } from '../calculos'
import type { DocumentoGestion, TipoDocumento } from '../types'
import { TIPO_DOCUMENTO, opcionesDe } from '../types'

type Filtro = 'todos' | 'caducan' | 'sinfirmar' | 'locodea'
const FILTROS: { valor: Filtro; etiqueta: string }[] = [
  { valor: 'todos', etiqueta: 'Todos' },
  { valor: 'caducan', etiqueta: 'Caducan' },
  { valor: 'sinfirmar', etiqueta: 'Sin firmar' },
  { valor: 'locodea', etiqueta: 'De Locodea' },
]

const ORDEN_ESTADO: Record<EstadoCaducidad, number> = { caducado: 0, pronto: 1, vigente: 2, 'sin-fecha': 3 }
const TONO_ESTADO: Record<EstadoCaducidad, string> = { caducado: 'error', pronto: 'aviso', vigente: 'ok', 'sin-fecha': 'contorno' }

function textoCaducidad(d: DocumentoGestion): string {
  const n = diasParaCaducar(d)
  if (n === null) return 'Sin caducidad'
  if (n < 0) return `Caducó hace ${-n} ${-n === 1 ? 'día' : 'días'}`
  if (n === 0) return 'Caduca hoy'
  if (n <= 60) return `Caduca en ${n} ${n === 1 ? 'día' : 'días'}`
  return `Caduca el ${fecha(d.caduca)}`
}

export function Documentos() {
  const { datos, guardarDocumento, borrar } = useGestion()
  const { datos: crm } = useCrm()
  const { miembro } = useApp()
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [tipo, setTipo] = useState<TipoDocumento | ''>('')
  const [texto, setTexto] = useState('')
  const [editando, setEditando] = useState<DocumentoGestion | Partial<DocumentoGestion> | null>(null)

  const cuenta = (id: string | null) => crm.cuentas.find(a => a.id === id)?.nombre ?? ''

  const visibles = useMemo(() => {
    const q = normalizar(texto.trim())
    return datos.documentos
      .filter(d => {
        const e = estadoCaducidad(d)
        return filtro === 'todos' ? true : filtro === 'caducan' ? e === 'caducado' || e === 'pronto' : filtro === 'sinfirmar' ? !d.firmado : !d.cuentaId
      })
      .filter(d => !tipo || d.tipo === tipo)
      .filter(d => !q || normalizar(`${d.nombre} ${cuenta(d.cuentaId)} ${d.notas}`).includes(q))
      .sort((a, b) => ORDEN_ESTADO[estadoCaducidad(a)] - ORDEN_ESTADO[estadoCaducidad(b)] || (a.caduca ?? '9').localeCompare(b.caduca ?? '9') || a.nombre.localeCompare(b.nombre, 'es'))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datos.documentos, filtro, tipo, texto, crm.cuentas])

  const caducados = datos.documentos.filter(d => estadoCaducidad(d) === 'caducado').length
  const pronto = datos.documentos.filter(d => estadoCaducidad(d) === 'pronto').length
  const sinFirmar = datos.documentos.filter(d => !d.firmado).length
  const opcTipo: Opcion[] = [{ valor: '', etiqueta: 'Todos los tipos' }, ...opcionesDe(TIPO_DOCUMENTO)]

  const eliminar = async (d: DocumentoGestion) => {
    if (!(await confirmar('¿Borrar este documento del registro?', { texto: `${d.nombre}. El archivo enlazado no se toca.`, aceptar: 'Borrar', peligro: true }))) return
    await borrar('documentos', d.id)
    setEditando(null)
  }

  return (
    <div className="pagina">
      <div className="titulo-pagina">
        <div>
          <h1>Documentos.</h1>
          <div className="sub">Contratos, NDA, mandatos SEPA y certificados con su caducidad. El archivo sigue en SharePoint; aquí se apunta dónde está y cuándo hay que renovarlo.</div>
        </div>
        <div className="acciones">
          <button className="btn acento" onClick={() => setEditando({})}><Plus size={16} /> Registrar documento</button>
        </div>
      </div>

      <div className="kpis ges-kpis">
        <div className="tarjeta kpi ges-kpi anim-aparecer retraso-1">
          <div className="etiqueta"><span className="ico"><AlertTriangle size={14} /></span>Caducados</div>
          <div className={`valor ${caducados ? 'neg' : ''}`}>{caducados}</div>
          <div className={`pie ${caducados ? 'mal' : 'ok'}`}>{caducados ? 'pendientes de renovar' : 'nada caducado'}</div>
        </div>
        <div className="tarjeta kpi ges-kpi anim-aparecer retraso-2">
          <div className="etiqueta"><span className="ico"><FileCheck2 size={14} /></span>Caducan pronto</div>
          <div className="valor">{pronto}</div>
          <div className="pie">dentro del plazo de aviso de cada uno</div>
        </div>
        <div className="tarjeta kpi ges-kpi anim-aparecer retraso-3">
          <div className="etiqueta"><span className="ico"><FilePen size={14} /></span>Sin firmar</div>
          <div className="valor">{sinFirmar}</div>
          <div className="pie">{sinFirmar ? 'esperando firma' : 'todo firmado'}</div>
        </div>
        <div className="tarjeta kpi ges-kpi anim-aparecer retraso-4">
          <div className="etiqueta"><span className="ico"><FolderLock size={14} /></span>Registrados</div>
          <div className="valor">{datos.documentos.length}</div>
          <div className="pie">{datos.documentos.filter(d => !d.cuentaId).length} de Locodea · {datos.documentos.filter(d => d.cuentaId).length} de clientes y proveedores</div>
        </div>
      </div>

      <div className="ges-herramientas">
        <div className="btn-grupo" role="tablist">
          {FILTROS.map(f => <button key={f.valor} className={filtro === f.valor ? 'activo' : ''} onClick={() => setFiltro(f.valor)} role="tab" aria-selected={filtro === f.valor}>{f.etiqueta}</button>)}
        </div>
        <Select valor={tipo} opciones={opcTipo} onCambio={v => setTipo(v as TipoDocumento | '')} pequeno ancho={210} />
        <label className="buscar"><Search size={15} /><input placeholder="Buscar documento o cuenta…" value={texto} onChange={e => setTexto(e.target.value)} /></label>
      </div>

      {visibles.length === 0 ? (
        <div className="tarjeta"><Vacio icono={<FolderLock size={36} />} titulo={datos.documentos.length ? 'Ningún documento con estos filtros' : 'Todavía no hay documentos registrados'} /></div>
      ) : (
        <div className="ges-docs">
          {visibles.map(d => {
            const e = estadoCaducidad(d)
            const m = miembro(d.responsableId)
            return (
              <div key={d.id} className={`tarjeta ges-doc ${e === 'caducado' ? 'caducado' : ''}`} onClick={() => setEditando(d)}>
                <div className="cima">
                  <span className="chip pequeno contorno">{TIPO_DOCUMENTO[d.tipo]}</span>
                  {!d.firmado && <span className="chip pequeno aviso">Sin firmar</span>}
                </div>
                <div className="cima"><h3 title={d.nombre}>{d.nombre}</h3></div>
                <div className="meta">{d.cuentaId ? cuenta(d.cuentaId) : 'Locodea'}{d.firmadoEl && <> · firmado el {fecha(d.firmadoEl)}</>}</div>
                <div className="pie">
                  <span className={`chip pequeno punto ${TONO_ESTADO[e]}`}>{textoCaducidad(d)}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {/^https?:\/\//.test(d.enlace) && <a className="btn sutil icono pequeno" href={d.enlace} target="_blank" rel="noreferrer" title="Abrir el archivo" onClick={ev => ev.stopPropagation()}><ExternalLink size={14} /></a>}
                    <Avatar miembro={m} tamano="pequeno" titulo={m ? `Responsable: ${m.nombre}` : 'Sin responsable'} />
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {editando && <ModalDocumento inicial={editando} onCerrar={() => setEditando(null)} onGuardar={async d => { await guardarDocumento(d); setEditando(null) }} onBorrar={eliminar} />}
    </div>
  )
}

// ─────────────────────────────────────────────── formulario

const OPC_TIPO = opcionesDe(TIPO_DOCUMENTO)

function ModalDocumento({ inicial, onCerrar, onGuardar, onBorrar }: {
  inicial: DocumentoGestion | Partial<DocumentoGestion>
  onCerrar: () => void
  onGuardar: (d: DocumentoGestion) => Promise<void>
  onBorrar: (d: DocumentoGestion) => Promise<void>
}) {
  const { yoId } = useGestion()
  const { datos: crm } = useCrm()
  const base: DocumentoGestion = { id: '', nombre: '', tipo: 'contrato', caduca: null, avisoDias: 30, enlace: '', firmado: false, firmadoEl: null, notas: '', cuentaId: null, responsableId: yoId, creadoEl: '' }
  const [d, setD] = useState<DocumentoGestion>({ ...base, ...inicial } as DocumentoGestion)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const nuevo = !d.id
  const set = (cambio: Partial<DocumentoGestion>) => setD(x => ({ ...x, ...cambio }))

  const opcCuenta: Opcion[] = [
    { valor: '', etiqueta: 'Locodea (documento propio)' },
    ...[...crm.cuentas].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')).map(a => ({ valor: a.id, etiqueta: a.nombre, detalle: a.tipo === 'proveedor' ? 'Proveedor' : 'Cliente' })),
  ]

  const guardar = async () => {
    if (!d.nombre.trim()) { setError('Escribe el nombre del documento.'); return }
    setError(null); setGuardando(true)
    try { await onGuardar({ ...d, nombre: d.nombre.trim(), firmadoEl: d.firmado ? d.firmadoEl || hoy() : null }) } finally { setGuardando(false) }
  }

  return (
    <Modal titulo={nuevo ? 'Registrar documento' : 'Documento'} onCerrar={onCerrar} pie={<>
      {!nuevo && <button className="btn sutil peligro" onClick={() => void onBorrar(d)} disabled={guardando}><Trash2 size={15} /> Borrar</button>}
      <span style={{ flex: 1 }} />
      <button className="btn sutil" onClick={onCerrar} disabled={guardando}>Cancelar</button>
      <button className="btn acento" onClick={() => void guardar()} disabled={guardando}>{guardando ? 'Guardando…' : nuevo ? 'Registrar' : 'Guardar'}</button>
    </>}>
      <div className="formulario">
        <Campo label="Nombre"><input autoFocus value={d.nombre} onChange={e => set({ nombre: e.target.value })} placeholder="Contrato de soporte · Apple" /></Campo>
        <div className="fila-campos">
          <Campo label="Tipo"><Select valor={d.tipo} opciones={OPC_TIPO} onCambio={v => set({ tipo: v as TipoDocumento })} /></Campo>
          <Campo label="Cuenta"><Select valor={d.cuentaId ?? ''} opciones={opcCuenta} onCambio={v => set({ cuentaId: v || null })} /></Campo>
        </div>
        <div className="fila-campos">
          <Campo label="Caduca"><input type="date" value={d.caduca ?? ''} onChange={e => set({ caduca: e.target.value || null })} /></Campo>
          <Campo label="Avisar con (días)"><input type="number" min={0} value={d.avisoDias} onChange={e => set({ avisoDias: Math.max(0, Number(e.target.value) || 0) })} /></Campo>
          <Campo label="Responsable"><SelectMiembro valor={d.responsableId} onCambio={id => set({ responsableId: id })} /></Campo>
        </div>
        <div className="fila-campos">
          <label className="ges-check"><input type="checkbox" checked={d.firmado} onChange={e => set({ firmado: e.target.checked, firmadoEl: e.target.checked ? d.firmadoEl || hoy() : null })} /> Firmado</label>
          {d.firmado && <Campo label="Fecha de firma"><input type="date" value={d.firmadoEl ?? ''} onChange={e => set({ firmadoEl: e.target.value || null })} /></Campo>}
        </div>
        <Campo label="Enlace al archivo (SharePoint, OneDrive…)">
          <div style={{ display: 'flex', gap: 6 }}>
            <input value={d.enlace} onChange={e => set({ enlace: e.target.value })} placeholder="https://…" style={{ flex: 1 }} />
            {/^https?:\/\//.test(d.enlace) && <a className="btn icono" href={d.enlace} target="_blank" rel="noreferrer" title="Abrir"><ExternalLink size={15} /></a>}
          </div>
        </Campo>
        <Campo label="Notas"><textarea value={d.notas} onChange={e => set({ notas: e.target.value })} rows={2} /></Campo>
        {error && <div className="error-formulario">{error}</div>}
      </div>
    </Modal>
  )
}
