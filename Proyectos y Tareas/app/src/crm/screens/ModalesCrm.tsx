/**
 * Diálogos del CRM: confirmar un borrado, pedir un motivo y exportar una lista.
 * Usan el Modal de la app.
 */
import { useRef, useState } from 'react'
import { Copy, Download } from 'lucide-react'
import { useApp } from '../../store'
import { Campo, Modal } from '../../ui/basicos'
import { descargar } from '../csv'

export function ModalConfirmar({ titulo, texto, ok, onOk, onCerrar }: { titulo: string; texto: string; ok: string; onOk: () => void; onCerrar: () => void }) {
  return (
    <Modal titulo={titulo} onCerrar={onCerrar} pie={<>
      <button className="btn" onClick={onCerrar}>Cancelar</button>
      <button className="btn peligro" autoFocus onClick={() => { onCerrar(); onOk() }}>{ok}</button>
    </>}>
      <p className="crm-texto-modal">{texto}</p>
    </Modal>
  )
}

export function ModalTexto({ titulo, subtitulo, etiqueta, ok, onOk, onCerrar }: { titulo: string; subtitulo: string; etiqueta: string; ok: string; onOk: (t: string) => void; onCerrar: () => void }) {
  const [texto, setTexto] = useState('')
  const aceptar = () => { onCerrar(); onOk(texto.trim()) }
  return (
    <Modal titulo={titulo} onCerrar={onCerrar} pie={<>
      <button className="btn" onClick={onCerrar}>Cancelar</button>
      <button className="btn primario" onClick={aceptar}>{ok}</button>
    </>}>
      <div className="formulario">
        {subtitulo && <p className="crm-texto-modal">{subtitulo}</p>}
        <Campo label={etiqueta}><input autoFocus value={texto} onChange={e => setTexto(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') aceptar() }} placeholder="Opcional" /></Campo>
      </div>
    </Modal>
  )
}

/**
 * Exportar: descarga el archivo o, si el iframe de Power Apps la bloquea,
 * copia el texto. Sirve para el CSV de las listas y para la copia JSON.
 */
export function ModalExportar({ nombre, csv, registros, onCerrar, json }: { nombre: string; csv: string; registros: number; onCerrar: () => void; json?: boolean }) {
  const { avisar } = useApp()
  const area = useRef<HTMLTextAreaElement>(null)
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(csv)
    } catch {
      // sin permiso de portapapeles en el iframe: se selecciona para copiar a mano
      area.current?.select()
      if (!document.execCommand('copy')) { avisar('Selecciona el texto y cópialo con Ctrl+C', 'info'); return }
    }
    avisar(json ? 'Copiado.' : 'Copiado. Pégalo en Excel.')
  }
  const n = `${registros} ${registros === 1 ? 'registro' : 'registros'}`
  return (
    <Modal titulo={json ? 'Copia de seguridad del CRM' : 'Exportar a Excel'} ancho onCerrar={onCerrar} pie={<>
      <button className="btn" onClick={onCerrar}>Cerrar</button>
      <button className="btn" onClick={() => void copiar()}><Copy size={15} /> Copiar</button>
      <button className="btn primario" onClick={() => { descargar(nombre, csv, json ? 'application/json' : undefined); avisar(`Exportados ${n}`) }}>
        <Download size={15} /> {json ? 'Descargar JSON' : 'Descargar CSV'}
      </button>
    </>}>
      <div className="formulario">
        <p className="crm-texto-modal">
          {json
            ? `${n} de todas las colecciones del CRM. Guárdalo para restaurarlo luego con «Importar copia». Si la descarga no arranca dentro de Power Apps, copia el texto.`
            : `${n} con la vista y los filtros actuales. Si la descarga no arranca dentro de Power Apps, copia el texto y pégalo en Excel.`}
        </p>
        <textarea ref={area} className="crm-csv" readOnly value={csv} aria-label="Contenido exportado" />
      </div>
    </Modal>
  )
}
