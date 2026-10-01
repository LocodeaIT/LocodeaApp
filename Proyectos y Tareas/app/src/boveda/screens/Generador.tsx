/**
 * Generador de contraseñas: longitud, grupos de caracteres y sin ambiguos.
 * Sirve suelto (botón «Generador») y dentro del formulario, con «Usar esta».
 * Las opciones se recuerdan en el navegador; las contraseñas generadas, no.
 */
import { useCallback, useEffect, useState } from 'react'
import { Check, RefreshCw } from 'lucide-react'
import { Modal } from '../../ui/basicos'
import { generarContrasena, OPCIONES_GENERADOR, type OpcionesGenerador } from '../generador'
import { BotonCopiar, Coloreado, MedidorFortaleza } from './comunes'

const PREF = 'locodea.boveda.generador'

function leerOpciones(): OpcionesGenerador {
  try {
    const o = JSON.parse(localStorage.getItem(PREF) ?? 'null') as Partial<OpcionesGenerador> | null
    return { ...OPCIONES_GENERADOR, ...(o ?? {}) }
  } catch {
    return OPCIONES_GENERADOR
  }
}

const GRUPOS: { clave: keyof Omit<OpcionesGenerador, 'longitud'>; etiqueta: string; titulo: string }[] = [
  { clave: 'mayusculas', etiqueta: 'A–Z', titulo: 'Mayúsculas' },
  { clave: 'minusculas', etiqueta: 'a–z', titulo: 'Minúsculas' },
  { clave: 'numeros', etiqueta: '0–9', titulo: 'Números' },
  { clave: 'simbolos', etiqueta: '!@#', titulo: 'Símbolos' },
  { clave: 'sinAmbiguos', etiqueta: 'Sin ambiguos', titulo: 'Sin I, l, 1, O ni 0' },
]

export function Generador({ onUsar }: { onUsar?: (p: string) => void }) {
  const [o, setO] = useState<OpcionesGenerador>(leerOpciones)
  const [valor, setValor] = useState(() => generarContrasena(o))

  const regenerar = useCallback((nuevas: OpcionesGenerador) => {
    setO(nuevas)
    setValor(generarContrasena(nuevas))
    try { localStorage.setItem(PREF, JSON.stringify(nuevas)) } catch { /* modo privado */ }
  }, [])

  // Ctrl+G vuelve a generar mientras el generador está a la vista
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'g') { e.preventDefault(); setValor(generarContrasena(o)) } }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [o])

  const grupos = GRUPOS.filter(g => g.clave !== 'sinAmbiguos' && o[g.clave]).length

  return (
    <div className="bov-generador">
      <div className="resultado">
        <span className="valor"><Coloreado texto={valor} /></span>
        <span className="botones">
          <button type="button" className="btn sutil icono pequeno" onClick={() => setValor(generarContrasena(o))} title="Otra (Ctrl+G)" aria-label="Generar otra"><RefreshCw size={15} /></button>
          <BotonCopiar valor={valor} que="Contraseña copiada" />
        </span>
      </div>
      <MedidorFortaleza valor={valor} />
      <div className="opciones">
        <label className="longitud">
          <span>Longitud <b>{o.longitud}</b></span>
          <input type="range" min={8} max={64} value={o.longitud} onChange={e => regenerar({ ...o, longitud: Number(e.target.value) })} />
        </label>
        <div className="grupos" role="group" aria-label="Caracteres">
          {GRUPOS.map(g => {
            const activo = o[g.clave]
            // no se deja quitar el último grupo de caracteres
            const bloqueado = activo && g.clave !== 'sinAmbiguos' && grupos === 1
            return (
              <button key={g.clave} type="button" className={`bov-toggle ${activo ? 'activo' : ''}`} title={g.titulo} aria-pressed={activo} disabled={bloqueado}
                onClick={() => regenerar({ ...o, [g.clave]: !activo })}>
                {activo && <Check size={13} />}{g.etiqueta}
              </button>
            )
          })}
        </div>
      </div>
      {onUsar && <button type="button" className="btn acento pequeno usar" onClick={() => onUsar(valor)}><Check size={15} /> Usar esta contraseña</button>}
    </div>
  )
}

export function ModalGenerador({ onCerrar }: { onCerrar: () => void }) {
  return (
    <Modal titulo="Generador de contraseñas" onCerrar={onCerrar}>
      <Generador />
      <p className="bov-nota">Se genera en tu navegador con el generador criptográfico del sistema. Nada de esto se guarda hasta que lo pongas en un elemento.</p>
    </Modal>
  )
}
