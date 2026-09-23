/**
 * Herramientas del inicio del CRM: menú de avisos (actividades vencidas,
 * cobros y pagos vencidos) y menú de datos (copia de seguridad JSON,
 * importar, restablecer el ejemplo y borrar todo; solo en modo demo).
 */
import { useRef, useState } from 'react'
import { Bell, Clock, Database, Download, RotateCcw, Trash2, Upload } from 'lucide-react'
import { useApp } from '../../store'
import { Desplegable } from '../../ui/basicos'
import { useCrm } from '../contexto'
import type { ColEntidad, CrmInstantanea } from '../types'
import { COLECCIONES } from '../types'
import { actividadVencida, nombreCuenta } from '../consultas'
import { estadoFactura, totalDoc } from '../documentos'
import { eur0, relativo } from '../formato'
import { ICONO_COL } from '../iconos'
import { hoy } from '../../domain/fechas'
import { ModalConfirmar, ModalExportar } from './ModalesCrm'

export function MenuAvisos() {
  const { datos: d, abrir } = useCrm()
  const [abierto, setAbierto] = useState(false)
  const actividades = d.actividades.filter(actividadVencida)
  const cobros = d.facturasVenta.filter(f => estadoFactura(f) === 'vencida')
  const pagos = d.facturasCompra.filter(f => estadoFactura(f) === 'vencida')
  const total = actividades.length + cobros.length + pagos.length
  const ir = (col: ColEntidad, id: string) => { setAbierto(false); abrir(col, id) }
  const IcoCobro = ICONO_COL.facturasVenta
  const IcoPago = ICONO_COL.facturasCompra
  return (
    <Desplegable abierto={abierto} setAbierto={setAbierto} boton={
      <button type="button" className="btn" onClick={() => setAbierto(a => !a)} aria-haspopup="menu">
        <Bell size={15} /> Avisos{total > 0 && <span className="crm-insignia">{total}</span>}
      </button>
    }>
      <div className="crm-menu-avisos">
        {total === 0 && <div className="item crm-apagado">Todo al día.</div>}
        {actividades.length > 0 && <div className="cabecera-menu">Actividades vencidas</div>}
        {actividades.map(a => (
          <button key={a.id} className="item" onClick={() => ir('actividades', a.id)}>
            <Clock size={14} /><span className="crm-crece">{a.asunto}</span><small className="crm-tarde">{relativo(a.fecha)}</small>
          </button>
        ))}
        {cobros.length > 0 && <div className="cabecera-menu">Cobros vencidos</div>}
        {cobros.map(f => (
          <button key={f.id} className="item" onClick={() => ir('facturasVenta', f.id)}>
            <IcoCobro size={14} /><span className="crm-crece">{f.no} · {nombreCuenta(d, f.cuentaId)}</span><small>{eur0(totalDoc(f))}</small>
          </button>
        ))}
        {pagos.length > 0 && <div className="cabecera-menu">Pagos vencidos</div>}
        {pagos.map(f => (
          <button key={f.id} className="item" onClick={() => ir('facturasCompra', f.id)}>
            <IcoPago size={14} /><span className="crm-crece">{f.no} · {nombreCuenta(d, f.cuentaId)}</span><small>{eur0(totalDoc(f))}</small>
          </button>
        ))}
      </div>
    </Desplegable>
  )
}

/** Acepta la copia tal cual se exporta ({ datos }) o la instantánea sin envolver. */
function leerCopia(texto: string): CrmInstantanea | null {
  try {
    const raw = JSON.parse(texto.replace(/^﻿/, '')) as Record<string, unknown>
    const d = (raw && typeof raw === 'object' && 'datos' in raw ? raw.datos : raw) as Record<string, unknown>
    if (!d || typeof d !== 'object') return null
    // al menos una colección conocida y todas las presentes, listas
    if (!COLECCIONES.some(c => Array.isArray(d[c])) || COLECCIONES.some(c => d[c] !== undefined && !Array.isArray(d[c]))) return null
    return Object.fromEntries(COLECCIONES.map(c => [c, (d[c] as unknown[] | undefined) ?? []])) as unknown as CrmInstantanea
  } catch {
    return null
  }
}

const contar = (d: CrmInstantanea) => COLECCIONES.reduce((s, c) => s + d[c].length, 0)

export function MenuDatos() {
  const c = useCrm()
  const { avisar } = useApp()
  const [abierto, setAbierto] = useState(false)
  const [exportar, setExportar] = useState<string | null>(null)
  const [confirmar, setConfirmar] = useState<null | { titulo: string; texto: string; ok: string; fn: () => void }>(null)
  const archivo = useRef<HTMLInputElement>(null)

  const importar = (f: File) => {
    const lector = new FileReader()
    lector.onload = () => {
      const d = leerCopia(String(lector.result ?? ''))
      if (!d) { avisar('El archivo no es una copia de seguridad del CRM', 'error'); return }
      setConfirmar({
        titulo: 'Importar copia de seguridad', ok: 'Importar',
        texto: `Se sustituirán todos los datos del CRM por los de la copia (${contar(d)} registros). Esta acción no se puede deshacer.`,
        fn: () => void c.importarDatos(d),
      })
    }
    lector.readAsText(f)
  }

  return (
    <>
      <Desplegable abierto={abierto} setAbierto={setAbierto} boton={
        <button type="button" className="btn" onClick={() => setAbierto(a => !a)} aria-haspopup="menu"><Database size={15} /> Datos</button>
      }>
        <div className="cabecera-menu">Datos del CRM (demostración)</div>
        <button className="item" onClick={() => { setAbierto(false); setExportar(JSON.stringify({ app: 'locodea-crm', version: 1, exportadoEl: new Date().toISOString(), datos: c.datos }, null, 2)) }}>
          <Download size={14} /> Copia de seguridad (JSON)
        </button>
        <button className="item" onClick={() => { setAbierto(false); archivo.current?.click() }}><Upload size={14} /> Importar copia…</button>
        <hr />
        <button className="item" onClick={() => {
          setAbierto(false)
          setConfirmar({ titulo: 'Restablecer datos de ejemplo', texto: 'Se sustituirá todo lo que hay en el CRM por los datos de ejemplo de Locodea.', ok: 'Restablecer', fn: () => void c.restablecerDemo() })
        }}><RotateCcw size={14} /> Restablecer datos de ejemplo</button>
        <button className="item crm-peligro" onClick={() => {
          setAbierto(false)
          setConfirmar({ titulo: 'Borrar todos los datos del CRM', texto: 'Se borrarán cuentas, contactos, oportunidades, documentos, productos, actividades y notas. No se puede deshacer.', ok: 'Borrar todo', fn: () => void c.borrarTodo() })
        }}><Trash2 size={14} /> Borrar todos los datos del CRM</button>
      </Desplegable>
      <input ref={archivo} type="file" accept=".json,application/json" hidden
        onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) importar(f) }} />
      {exportar && <ModalExportar json nombre={`locodea-crm-${hoy()}.json`} csv={exportar} registros={contar(c.datos)} onCerrar={() => setExportar(null)} />}
      {confirmar && <ModalConfirmar titulo={confirmar.titulo} texto={confirmar.texto} ok={confirmar.ok} onOk={confirmar.fn} onCerrar={() => setConfirmar(null)} />}
    </>
  )
}
