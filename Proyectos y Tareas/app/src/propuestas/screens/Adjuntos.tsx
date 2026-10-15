/**
 * Adjuntos de una propuesta: se añaden con el botón, arrastrando archivos o
 * pegando una captura (Ctrl + V). Las imágenes salen en miniatura y se abren
 * en grande; el resto de archivos se descarga con un clic.
 *
 * El mismo componente, en solo lectura, enseña los adjuntos en la ficha del
 * proyecto en el que se convirtió la propuesta.
 */
import { useEffect, useRef, useState, type DragEvent } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, Download, FileText, ImagePlus, Paperclip, Trash2, X } from 'lucide-react'
import { confirmar } from '../../ui/basicos'
import { fechaHora } from '../../domain/fechas'
import { usePropuestas } from '../store'
import type { AdjuntoPropuesta } from '../types'
import { esImagen } from '../types'
import { MAX_ARCHIVO, descargar, extension, formatoTamano } from '../adjuntos'

export function Adjuntos({ propuestaId, adjuntos, soloLectura }: { propuestaId: string; adjuntos: AdjuntoPropuesta[]; soloLectura?: boolean }) {
  const { subirArchivos, subiendo, borrarAdjunto, datosAdjunto, adjuntosDisponibles } = usePropuestas()
  const entrada = useRef<HTMLInputElement>(null)
  const [encima, setEncima] = useState(false)
  const [visor, setVisor] = useState<string | null>(null)
  const pendientes = subiendo[propuestaId] ?? 0
  const ordenados = [...adjuntos].sort((a, b) => a.creadoEl.localeCompare(b.creadoEl))
  const imagenes = ordenados.filter(esImagen)

  // pegar una captura con Ctrl + V mientras la ficha está abierta
  useEffect(() => {
    if (soloLectura || !adjuntosDisponibles) return
    const alPegar = (e: ClipboardEvent) => {
      const archivos = [...(e.clipboardData?.files ?? [])]
      if (!archivos.length) return
      e.preventDefault()
      const conNombre = archivos.map((f, i) => (f.name && f.name !== 'image.png' ? f : new File([f], `Captura ${new Date().toLocaleString('es-ES').replace(/[/:]/g, '-')}${i ? ` (${i + 1})` : ''}.png`, { type: f.type })))
      void subirArchivos(propuestaId, conNombre)
    }
    document.addEventListener('paste', alPegar)
    return () => document.removeEventListener('paste', alPegar)
  }, [soloLectura, adjuntosDisponibles, subirArchivos, propuestaId])

  if (!adjuntosDisponibles) return null
  if (soloLectura && !adjuntos.length) return null

  const abrir = async (a: AdjuntoPropuesta) => {
    if (esImagen(a)) { setVisor(a.id); return }
    try { descargar(a.nombre, await datosAdjunto(a.id)) } catch { /* el aviso ya sale del estado */ }
  }

  const soltar = (e: DragEvent) => {
    e.preventDefault()
    setEncima(false)
    if (soloLectura) return
    void subirArchivos(propuestaId, [...e.dataTransfer.files])
  }

  return (
    <section className={`prop-adjuntos ${encima ? 'encima' : ''}`}
      onDragOver={e => { if (!soloLectura && e.dataTransfer.types.includes('Files')) { e.preventDefault(); setEncima(true) } }}
      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setEncima(false) }}
      onDrop={soltar}>
      <h3>
        <Paperclip size={16} /> Adjuntos <small>{adjuntos.length || ''}</small>
        {!soloLectura && (
          <button type="button" className="btn sutil pequeno" style={{ marginLeft: 'auto' }} onClick={() => entrada.current?.click()}>
            <ImagePlus size={14} /> Añadir
          </button>
        )}
      </h3>
      {!soloLectura && (
        <input ref={entrada} type="file" multiple hidden onChange={e => { void subirArchivos(propuestaId, [...(e.target.files ?? [])]); e.target.value = '' }} />
      )}

      {!adjuntos.length && !pendientes && !soloLectura && (
        <button type="button" className="prop-soltar" onClick={() => entrada.current?.click()}>
          <ImagePlus size={22} />
          <b>Arrastra aquí fotos o documentos</b>
          <span>o pega una captura con Ctrl + V · imágenes sin límite (se comprimen), otros archivos hasta {formatoTamano(MAX_ARCHIVO)}</span>
        </button>
      )}

      {(ordenados.length > 0 || pendientes > 0) && (
        <div className="prop-adjuntos-rejilla">
          {ordenados.map(a => (
            <figure key={a.id} className={`prop-adjunto ${esImagen(a) ? 'imagen' : 'archivo'}`}>
              <button type="button" className="prop-adjunto-abrir" onClick={() => void abrir(a)} title={esImagen(a) ? `Ver ${a.nombre}` : `Descargar ${a.nombre}`}>
                {esImagen(a) ? <Miniatura adjunto={a} /> : (
                  <span className="prop-adjunto-icono"><FileText size={22} /><b>{extension(a.nombre, a.tipo)}</b></span>
                )}
              </button>
              <figcaption title={`${a.nombre} · ${formatoTamano(a.tamano)} · ${fechaHora(a.creadoEl)}`}>
                <span>{a.nombre}</span>
                <small>{formatoTamano(a.tamano)}</small>
              </figcaption>
              {!soloLectura && (
                <button type="button" className="prop-adjunto-borrar" aria-label={`Borrar ${a.nombre}`} onClick={async () => {
                  if (await confirmar('¿Borrar el adjunto?', { texto: a.proyectoId ? `«${a.nombre}» también desaparece del proyecto.` : `«${a.nombre}»`, aceptar: 'Borrar', peligro: true })) void borrarAdjunto(a.id)
                }}><Trash2 size={13} /></button>
              )}
            </figure>
          ))}
          {Array.from({ length: pendientes }, (_, i) => (
            <figure key={`subiendo-${i}`} className="prop-adjunto subiendo"><span className="prop-adjunto-abrir"><span className="spinner" /></span><figcaption><span>Subiendo…</span></figcaption></figure>
          ))}
        </div>
      )}

      {encima && <div className="prop-adjuntos-velo"><ImagePlus size={26} /> Suelta para adjuntar</div>}
      {visor && <Visor imagenes={imagenes} inicial={visor} onCerrar={() => setVisor(null)} />}
    </section>
  )
}

function Miniatura({ adjunto }: { adjunto: AdjuntoPropuesta }) {
  const { datosAdjunto } = usePropuestas()
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let vivo = true
    datosAdjunto(adjunto.id).then(u => { if (vivo) setUrl(u) }, () => undefined)
    return () => { vivo = false }
  }, [adjunto.id, datosAdjunto])
  return url ? <img src={url} alt={adjunto.nombre} loading="lazy" /> : <span className="prop-adjunto-cargando" />
}

/** Visor a pantalla completa, con flechas entre las imágenes de la propuesta. */
function Visor({ imagenes, inicial, onCerrar }: { imagenes: AdjuntoPropuesta[]; inicial: string; onCerrar: () => void }) {
  const { datosAdjunto } = usePropuestas()
  const [i, setI] = useState(() => Math.max(0, imagenes.findIndex(a => a.id === inicial)))
  const [url, setUrl] = useState<{ id: string; url: string } | null>(null)
  const actual = imagenes[i]

  useEffect(() => {
    if (!actual) return
    let vivo = true
    datosAdjunto(actual.id).then(u => { if (vivo) setUrl({ id: actual.id, url: u }) }, () => undefined)
    return () => { vivo = false }
  }, [actual, datosAdjunto])

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopImmediatePropagation(); onCerrar() }
      if (e.key === 'ArrowRight') setI(n => (n + 1) % imagenes.length)
      if (e.key === 'ArrowLeft') setI(n => (n - 1 + imagenes.length) % imagenes.length)
    }
    window.addEventListener('keydown', tecla, true)
    return () => window.removeEventListener('keydown', tecla, true)
  }, [imagenes.length, onCerrar])

  if (!actual) return null
  const lista = url?.id === actual.id ? url.url : null
  return createPortal(
    <div className="prop-visor" onMouseDown={e => { if (e.target === e.currentTarget) onCerrar() }}>
      <header>
        <span>{actual.nombre} <small>{i + 1} / {imagenes.length}</small></span>
        <button type="button" className="btn sutil icono" onClick={() => lista && descargar(actual.nombre, lista)} aria-label="Descargar"><Download size={18} /></button>
        <button type="button" className="btn sutil icono" onClick={onCerrar} aria-label="Cerrar"><X size={20} /></button>
      </header>
      {lista ? <img src={lista} alt={actual.nombre} /> : <span className="spinner" />}
      {imagenes.length > 1 && <>
        <button type="button" className="prop-visor-flecha izq" onClick={() => setI(n => (n - 1 + imagenes.length) % imagenes.length)} aria-label="Anterior"><ChevronLeft size={26} /></button>
        <button type="button" className="prop-visor-flecha der" onClick={() => setI(n => (n + 1) % imagenes.length)} aria-label="Siguiente"><ChevronRight size={26} /></button>
      </>}
    </div>,
    document.body,
  )
}
