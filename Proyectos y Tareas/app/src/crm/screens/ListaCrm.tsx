/**
 * Página de lista genérica del CRM: selector de vistas del sistema, búsqueda,
 * filtros, columnas ordenables, selección con borrado en lote, paginación de
 * 25 y exportación a Excel. Todo lo describe la entidad del registro.
 */
import { useState } from 'react'
import { ArrowDown, ArrowUp, Check, ChevronDown, ChevronLeft, ChevronRight, Download, Plus, RefreshCw, Search, Trash2, X } from 'lucide-react'
import { useApp } from '../../store'
import { Desplegable, Vacio } from '../../ui/basicos'
import { Select } from '../../ui/Select'
import { LISTA_INICIAL, useCrm, type CrmCtx, type EstadoLista } from '../contexto'
import type { ColEntidad, RegistroBase } from '../types'
import { entidadDe } from '../registro'
import type { Columna, Entidad } from '../registro/tipos'
import { normalizar } from '../formato'
import { aCsv } from '../csv'
import { hoy } from '../../domain/fechas'
import { ModalConfirmar, ModalExportar } from './ModalesCrm'

const POR_PAGINA = 25

const valorCampo = (o: RegistroBase, clave: string) => (o as unknown as Record<string, unknown>)[clave]

function textoColumna(col: Columna<RegistroBase>, o: RegistroBase, c: CrmCtx): string | number {
  if (col.texto) return col.texto(o, c)
  const v = valorCampo(o, col.clave)
  return v == null ? '' : typeof v === 'number' ? v : String(v)
}

/** Filtra, busca y ordena según la vista y los controles de la lista. */
function filasDe(e: Entidad<RegistroBase>, est: EstadoLista, c: CrmCtx) {
  const vista = e.vistas.find(v => v.clave === est.vista) ?? e.vistas[0]
  const q = normalizar(est.texto)
  let lista = (c.datos[e.col] as RegistroBase[]).filter(o => vista.filtro(o, c))
  if (q) lista = lista.filter(o => normalizar(e.buscar(o, c).join(' ')).includes(q))
  for (const f of e.filtros) {
    const v = est.filtros[f.clave]
    if (v) lista = lista.filter(o => String((f.valor ? f.valor(o, c) : valorCampo(o, f.clave)) ?? '') === v)
  }
  const orden = est.orden ?? e.ordenInicial ?? { clave: e.columnas.find(x => !x.sinOrden)!.clave, dir: 1 as const }
  const col = e.columnas.find(x => x.clave === orden.clave)
  const clave = (o: RegistroBase) => (col?.orden ? col.orden(o, c) : col ? textoColumna(col, o, c) : String(valorCampo(o, orden.clave) ?? ''))
  lista = [...lista].sort((a, b) => { const x = clave(a), y = clave(b); return (x < y ? -1 : x > y ? 1 : 0) * orden.dir })
  return { vista, lista, orden }
}

export function ListaCrm({ col }: { col: ColEntidad }) {
  const c = useCrm()
  const { avisar } = useApp()
  const e = entidadDe(col)
  const est = c.listas[col] ?? LISTA_INICIAL
  const cambiar = (x: Partial<EstadoLista>) => c.cambiarLista(col, x)
  const [menuVistas, setMenuVistas] = useState(false)
  const [confirmar, setConfirmar] = useState(false)
  const [exportar, setExportar] = useState<{ csv: string; n: number } | null>(null)

  const { vista, lista, orden } = filasDe(e, est, c)
  const paginas = Math.max(1, Math.ceil(lista.length / POR_PAGINA))
  const pagina = Math.min(est.pagina, paginas - 1)
  const filas = lista.slice(pagina * POR_PAGINA, pagina * POR_PAGINA + POR_PAGINA)
  const existentes = new Set((c.datos[col] as RegistroBase[]).map(o => o.id))
  const seleccion = est.seleccion.filter(id => existentes.has(id))
  const todas = filas.length > 0 && filas.every(o => seleccion.includes(o.id))
  const hayFiltros = !!est.texto || e.filtros.some(f => est.filtros[f.clave])

  const alternar = (id: string) => cambiar({ seleccion: seleccion.includes(id) ? seleccion.filter(x => x !== id) : [...seleccion, id] })
  const alternarTodas = () => cambiar({ seleccion: todas ? seleccion.filter(id => !filas.some(o => o.id === id)) : [...new Set([...seleccion, ...filas.map(o => o.id)])] })
  const ordenarPor = (clave: string) => cambiar({ orden: orden.clave === clave ? { clave, dir: orden.dir === 1 ? -1 : 1 } : { clave, dir: 1 } })

  const borrarSeleccion = async () => {
    const n = seleccion.length
    await c.borrar(col, seleccion)
    cambiar({ seleccion: [] })
    avisar(`${n} ${n === 1 ? 'registro eliminado' : 'registros eliminados'}`, 'info')
  }

  const abrirExportar = () => {
    const cols = e.columnas.filter(x => x.titulo && !x.sinExportar)
    setExportar({ csv: aCsv([cols.map(x => x.titulo), ...lista.map(o => cols.map(x => textoColumna(x, o, c)))]), n: lista.length })
  }

  return (
    <div className="pagina crm">
      <div className="titulo-pagina">
        <div>
          <Desplegable abierto={menuVistas} setAbierto={setMenuVistas} boton={
            <button type="button" className="crm-selector-vista" onClick={() => setMenuVistas(m => !m)} aria-haspopup="menu"><h1>{vista.titulo}</h1><ChevronDown size={18} /></button>
          }>
            <div className="cabecera-menu">Vistas del sistema</div>
            {e.vistas.map(v => (
              <button key={v.clave} className={`item ${v.clave === vista.clave ? 'activo' : ''}`} onClick={() => { cambiar({ vista: v.clave, pagina: 0, seleccion: [] }); setMenuVistas(false) }}>
                <span style={{ flex: 1 }}>{v.titulo}</span>{v.clave === vista.clave && <Check size={14} />}
              </button>
            ))}
          </Desplegable>
          <div className="sub">{e.muchos}</div>
        </div>
        <div className="acciones">
          <button className="btn primario" onClick={() => c.abrir(col, 'nuevo')}><Plus size={15} /> Nuevo</button>
          <button className="btn peligro" disabled={!seleccion.length} onClick={() => setConfirmar(true)}><Trash2 size={15} /> Eliminar{seleccion.length > 0 && ` (${seleccion.length})`}</button>
          <button className="btn sutil" onClick={() => { void c.recargar().then(() => avisar('Lista actualizada', 'info')) }}><RefreshCw size={15} /> Actualizar</button>
          <button className="btn sutil" onClick={abrirExportar}><Download size={15} /> Exportar a Excel</button>
        </div>
      </div>

      <div className="herramientas">
        <label className="crm-buscar">
          <Search size={15} />
          <input value={est.texto} onChange={ev => cambiar({ texto: ev.target.value, pagina: 0 })} placeholder="Buscar" aria-label="Buscar" />
        </label>
        {e.filtros.map(f => (
          <Select key={f.clave} valor={est.filtros[f.clave] ?? ''} ancho={200}
            opciones={[{ valor: '', etiqueta: `${f.titulo}: todos` }, ...f.opciones(c)]}
            onCambio={v => cambiar({ filtros: { ...est.filtros, [f.clave]: v }, pagina: 0 })} />
        ))}
        {hayFiltros && <button className="btn sutil pequeno" onClick={() => cambiar({ texto: '', filtros: {}, pagina: 0 })}><X size={14} /> Quitar filtros</button>}
        <span className="crm-cuenta">{lista.length ? `${pagina * POR_PAGINA + 1}–${Math.min(lista.length, pagina * POR_PAGINA + POR_PAGINA)} de ${lista.length}` : 'Sin registros'}</span>
      </div>

      <div className="tarjeta crm-rejilla">
        <table className="tabla">
          <thead>
            <tr>
              <th className="crm-casilla"><input type="checkbox" checked={todas} onChange={alternarTodas} aria-label="Seleccionar todo" /></th>
              {e.columnas.map(x => (
                <th key={x.clave} className={`${x.num ? 'num' : ''} ${x.sinOrden ? '' : 'ordenable'}`} style={x.ancho ? { width: x.ancho } : undefined}
                  onClick={x.sinOrden ? undefined : () => ordenarPor(x.clave)} aria-sort={orden.clave === x.clave ? (orden.dir === 1 ? 'ascending' : 'descending') : undefined}>
                  {x.titulo}
                  {orden.clave === x.clave && (orden.dir === 1 ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map(o => (
              <tr key={o.id} className={`clicable ${seleccion.includes(o.id) ? 'seleccionada' : ''}`} onClick={() => c.abrir(col, o.id)}>
                <td className="crm-casilla" onClick={ev => ev.stopPropagation()}>
                  <input type="checkbox" checked={seleccion.includes(o.id)} onChange={() => alternar(o.id)} aria-label="Seleccionar" />
                </td>
                {e.columnas.map(x => {
                  const contenido = x.celda ? x.celda(o, c) : textoColumna(x, o, c)
                  const vacio = contenido === '' || contenido === null || contenido === undefined
                  return (
                    <td key={x.clave} className={x.num ? 'num' : undefined}>
                      {vacio ? <span className="crm-apagado">—</span> : x.enlace ? <span className="crm-enlace">{contenido}</span> : contenido}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {!filas.length && (
          <Vacio icono={<e.icono size={32} />} titulo={hayFiltros ? 'Ningún registro coincide con los filtros' : `Todavía no hay ${e.muchos.toLowerCase()}`}
            texto={hayFiltros ? undefined : `Pulsa «Nuevo» para crear ${e.fem ? 'la primera' : 'el primero'}.`} />
        )}
      </div>

      {paginas > 1 && (
        <div className="crm-paginas">
          <span>Página {pagina + 1} de {paginas}</span>
          <span>
            <button className="btn sutil pequeno" disabled={pagina === 0} onClick={() => cambiar({ pagina: pagina - 1 })}><ChevronLeft size={14} /> Anterior</button>
            <button className="btn sutil pequeno" disabled={pagina >= paginas - 1} onClick={() => cambiar({ pagina: pagina + 1 })}>Siguiente <ChevronRight size={14} /></button>
          </span>
        </div>
      )}

      {confirmar && (
        <ModalConfirmar titulo={`Eliminar ${seleccion.length} ${seleccion.length === 1 ? e.uno.toLowerCase() : e.muchos.toLowerCase()}`}
          texto="Esta acción no se puede deshacer." ok="Eliminar" onOk={() => void borrarSeleccion()} onCerrar={() => setConfirmar(false)} />
      )}
      {exportar && <ModalExportar nombre={`${e.muchos.toLowerCase().replace(/\s+/g, '-')}-${hoy()}.csv`} csv={exportar.csv} registros={exportar.n} onCerrar={() => setExportar(null)} />}
    </div>
  )
}
