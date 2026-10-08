/**
 * Libros registro del IVA: facturas expedidas, recibidas y bienes de
 * inversión. Se calculan de los apuntes fiscales del CRM y se exportan a
 * Excel (CSV con «;» y decimales con coma).
 */
import { useMemo, useState } from 'react'
import { BookOpen, ChevronLeft, ChevronRight, Download } from 'lucide-react'
import { useApp } from '../../store'
import { useCrm } from '../../crm/contexto'
import { descargar } from '../../crm/csv'
import { Vacio } from '../../ui/basicos'
import { hoy } from '../../domain/fechas'
import { useGestion } from '../../gestion/store'
import { ETIQUETAS_LIBRO, apuntesFiscales, csvLibro, libroBienesInversion, libroExpedidas, libroRecibidas } from '../fiscal'

type Libro = 'expedidas' | 'recibidas' | 'inversion'
const LIBROS: { valor: Libro; etiqueta: string }[] = [
  { valor: 'expedidas', etiqueta: 'Facturas expedidas' }, { valor: 'recibidas', etiqueta: 'Facturas recibidas' }, { valor: 'inversion', etiqueta: 'Bienes de inversión' },
]

type Rango = { anio: number; t: number | null }
const desdeHasta = ({ anio, t }: Rango) => {
  if (!t) return { desde: `${anio}-01-01`, hasta: `${anio}-12-31` }
  const m0 = (t - 1) * 3 + 1, m1 = m0 + 2
  const dd = (m: number) => String(m).padStart(2, '0')
  return { desde: `${anio}-${dd(m0)}-01`, hasta: `${anio}-${dd(m1)}-${dd(new Date(anio, m1, 0).getDate())}` }
}

export function Libros() {
  const crm = useCrm()
  const gestion = useGestion()
  const { avisar } = useApp()
  const [libro, setLibro] = useState<Libro>('expedidas')
  const [rango, setRango] = useState<Rango>(() => ({ anio: Number(hoy().slice(0, 4)), t: null }))
  const { desde, hasta } = desdeHasta(rango)
  const apuntes = useMemo(() => apuntesFiscales(crm.datos, gestion.datos), [crm.datos, gestion.datos])
  const filas = useMemo(() => (libro === 'expedidas' ? libroExpedidas(apuntes, desde, hasta) : libro === 'recibidas' ? libroRecibidas(apuntes, desde, hasta) : libroBienesInversion(apuntes, hasta)) as unknown as Record<string, unknown>[],
    [apuntes, libro, desde, hasta])
  // el id del documento sirve para enlazar, no se enseña
  const columnas = useMemo(() => (filas[0] ? Object.keys(filas[0]).filter(c => c !== 'docId') : []), [filas])
  const etiqueta = rango.t ? `${rango.t}T ${rango.anio}` : `Año ${rango.anio}`
  const titulo = LIBROS.find(l => l.valor === libro)!.etiqueta

  const exportar = () => {
    if (!filas.length) { avisar('No hay nada que exportar', 'info'); return }
    descargar(`libro-${libro}-${rango.anio}${rango.t ? '-' + rango.t + 'T' : ''}.csv`, csvLibro(filas as never, `${titulo} · ${etiqueta}`).replace(/^﻿/, ''))
  }
  const celda = (v: unknown) => (typeof v === 'number' ? v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : typeof v === 'boolean' ? (v ? 'Sí' : 'No') : String(v ?? ''))

  return (
    <div className="pagina">
      <div className="titulo-pagina">
        <div>
          <h1>Libros registro.</h1>
          <div className="sub">Los libros del IVA que exige la AEAT, sacados de las facturas y gastos del CRM. Se exportan a Excel tal cual.</div>
        </div>
        <div className="acciones">
          <div className="ges-selector">
            <button onClick={() => setRango(r => (r.t ? { anio: r.t === 1 ? r.anio - 1 : r.anio, t: r.t === 1 ? 4 : r.t - 1 } : { anio: r.anio - 1, t: null }))}><ChevronLeft size={16} /></button>
            <b>{etiqueta}</b>
            <button onClick={() => setRango(r => (r.t ? { anio: r.t === 4 ? r.anio + 1 : r.anio, t: r.t === 4 ? 1 : r.t + 1 } : { anio: r.anio + 1, t: null }))}><ChevronRight size={16} /></button>
          </div>
          <button className="btn sutil" onClick={() => setRango(r => ({ anio: r.anio, t: r.t ? null : 1 }))}>{rango.t ? 'Ver el año' : 'Por trimestre'}</button>
          <button className="btn" onClick={exportar}><Download size={16} /> Exportar</button>
        </div>
      </div>

      <div className="gst-pestanas btn-grupo" role="tablist">
        {LIBROS.map(l => <button key={l.valor} className={libro === l.valor ? 'activo' : ''} onClick={() => setLibro(l.valor)} role="tab" aria-selected={libro === l.valor}>{l.etiqueta}</button>)}
      </div>

      <div className="tarjeta">
        {!filas.length ? <Vacio icono={<BookOpen size={36} />} titulo={`Sin anotaciones en ${etiqueta}`} /> : (
          <div className="ges-tabla-wrap">
            <table className="tabla">
              <thead><tr>{columnas.map(c => <th key={c}>{ETIQUETAS_LIBRO[c] ?? c}</th>)}</tr></thead>
              <tbody>{filas.map((f, i) => <tr key={i}>{columnas.map(c => <td key={c} className={typeof f[c] === 'number' ? 'num' : ''}>{celda(f[c])}</td>)}</tr>)}</tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
