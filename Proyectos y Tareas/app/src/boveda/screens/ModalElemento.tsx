/**
 * Alta y edición de un elemento: contraseña, clave API o nota segura, con
 * generador, verificación en dos pasos, etiquetas y campos extra.
 */
import { useState } from 'react'
import { Plus, Star, Trash2, X } from 'lucide-react'
import { Campo, Modal, Segmentado } from '../../ui/basicos'
import { Select } from '../../ui/Select'
import { nuevoId } from '../../data/repo'
import { leerTotp } from '../totp'
import type { CampoExtra, Elemento, EntornoApi, TipoElemento } from '../types'
import { ENTORNO_API, TIPO_ELEMENTO, elementoVacio } from '../types'
import { CampoSecreto, CodigoTotp, MedidorFortaleza, SIN_AUTOCOMPLETAR } from './comunes'
import { Generador } from './Generador'

const OPC_TIPO = (Object.keys(TIPO_ELEMENTO) as TipoElemento[]).map(v => ({ valor: v, etiqueta: TIPO_ELEMENTO[v] }))
const OPC_ENTORNO = [{ valor: '', etiqueta: 'Sin indicar' }, ...(Object.keys(ENTORNO_API) as Exclude<EntornoApi, ''>[]).map(v => ({ valor: v, etiqueta: ENTORNO_API[v] }))]

export function ModalElemento({ inicial, bovedaId, onCerrar, onGuardar, onBorrar }: {
  inicial: Elemento | null
  bovedaId: string
  onCerrar: () => void
  onGuardar: (e: Elemento) => Promise<void>
  onBorrar?: (e: Elemento) => Promise<void>
}) {
  const [e, setE] = useState<Elemento>(() => inicial ?? { ...elementoVacio('login'), id: '', bovedaId, creadoEl: '' })
  const [etiquetas, setEtiquetas] = useState(() => (inicial?.etiquetas ?? []).join(', '))
  const [generador, setGenerador] = useState<'contrasena' | 'clave' | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const nuevo = !e.id
  const set = (cambio: Partial<Elemento>) => setE(x => ({ ...x, ...cambio }))
  const setCampo = (id: string, cambio: Partial<CampoExtra>) => set({ campos: e.campos.map(c => (c.id === id ? { ...c, ...cambio } : c)) })
  const totpValido = !e.totp.trim() || !!leerTotp(e.totp)

  const guardar = async () => {
    if (!e.titulo.trim()) { setError(e.tipo === 'api' ? 'Escribe el nombre del servicio.' : 'Ponle un nombre.'); return }
    if (!totpValido) { setError('El secreto de dos pasos no es válido: pega la clave en base32 o el enlace otpauth://'); return }
    setError(null)
    setGuardando(true)
    try {
      await onGuardar({
        ...e,
        titulo: e.titulo.trim(),
        usuario: e.usuario.trim(),
        url: e.url.trim(),
        totp: e.totp.trim(),
        etiquetas: [...new Set(etiquetas.split(',').map(t => t.trim()).filter(Boolean))],
        campos: e.campos.filter(c => c.nombre.trim() || c.valor),
      })
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal ancho titulo={nuevo ? 'Nuevo en la bóveda' : e.titulo || 'Editar'} onCerrar={onCerrar} pie={<>
      {!nuevo && onBorrar && <button className="btn sutil peligro" onClick={() => void onBorrar(e)} disabled={guardando}><Trash2 size={15} /> Borrar</button>}
      <span style={{ flex: 1 }} />
      <button className="btn sutil" onClick={onCerrar} disabled={guardando}>Cancelar</button>
      <button className="btn acento" onClick={() => void guardar()} disabled={guardando}>{guardando ? 'Cifrando…' : nuevo ? 'Guardar en la bóveda' : 'Guardar'}</button>
    </>}>
      <form className="formulario bov-formulario" onSubmit={ev => { ev.preventDefault(); void guardar() }} autoComplete="off">
        <div className="cabeza">
          {nuevo ? <Segmentado etiqueta="Tipo" valor={e.tipo} opciones={OPC_TIPO} onCambio={t => set({ tipo: t })} /> : <span className="chip">{TIPO_ELEMENTO[e.tipo]}</span>}
          <button type="button" className={`bov-estrella ${e.favorito ? 'activa' : ''}`} onClick={() => set({ favorito: !e.favorito })} title={e.favorito ? 'Quitar de favoritos' : 'Marcar como favorito'} aria-pressed={e.favorito}>
            <Star size={17} />
          </button>
        </div>

        <Campo label={e.tipo === 'api' ? 'Servicio' : 'Nombre'}>
          <input {...SIN_AUTOCOMPLETAR} autoFocus={nuevo} value={e.titulo} onChange={ev => set({ titulo: ev.target.value })}
            placeholder={e.tipo === 'api' ? 'OpenAI · cuenta de Locodea' : e.tipo === 'nota' ? 'Códigos de recuperación de Microsoft 365' : 'Microsoft 365 · admin'} />
        </Campo>

        {e.tipo === 'login' && <>
          <div className="fila-campos dos">
            <Campo label="Usuario o correo"><input {...SIN_AUTOCOMPLETAR} value={e.usuario} onChange={ev => set({ usuario: ev.target.value })} placeholder="nombre@locodea.com" /></Campo>
            <Campo label="Web"><input {...SIN_AUTOCOMPLETAR} value={e.url} onChange={ev => set({ url: ev.target.value })} placeholder="https://admin.microsoft.com" /></Campo>
          </div>
          <Campo label="Contraseña">
            <CampoSecreto valor={e.contrasena} onCambio={v => set({ contrasena: v })} nuevo onGenerar={() => setGenerador(g => (g === 'contrasena' ? null : 'contrasena'))} />
          </Campo>
          {generador === 'contrasena'
            ? <Generador onUsar={p => { set({ contrasena: p }); setGenerador(null) }} />
            : <MedidorFortaleza valor={e.contrasena} />}
          <Campo label="Verificación en dos pasos (opcional)">
            <input {...SIN_AUTOCOMPLETAR} value={e.totp} onChange={ev => set({ totp: ev.target.value })} placeholder="Clave de configuración (JBSW Y3DP…) o enlace otpauth://" />
          </Campo>
          {e.totp.trim() && (totpValido ? <CodigoTotp secreto={e.totp} /> : <div className="bov-error claro">No es un secreto válido de dos pasos.</div>)}
        </>}

        {e.tipo === 'api' && <>
          <Campo label="Clave API">
            <CampoSecreto valor={e.clave} onCambio={v => set({ clave: v })} nuevo onGenerar={() => setGenerador(g => (g === 'clave' ? null : 'clave'))} placeholder="sk-…" />
          </Campo>
          {generador === 'clave' && <Generador onUsar={p => { set({ clave: p }); setGenerador(null) }} />}
          <Campo label="Secreto o segunda clave (opcional)"><CampoSecreto valor={e.secreto} onCambio={v => set({ secreto: v })} nuevo placeholder="Client secret, token de refresco…" /></Campo>
          <div className="fila-campos">
            <Campo label="Entorno"><Select valor={e.entorno} opciones={OPC_ENTORNO} onCambio={v => set({ entorno: v as EntornoApi })} /></Campo>
            <Campo label="Caduca"><input type="date" value={e.caduca ?? ''} onChange={ev => set({ caduca: ev.target.value || null })} /></Campo>
          </div>
          <div className="fila-campos dos">
            <Campo label="Usuario o id de cliente (opcional)"><input {...SIN_AUTOCOMPLETAR} value={e.usuario} onChange={ev => set({ usuario: ev.target.value })} /></Campo>
            <Campo label="Consola o documentación"><input {...SIN_AUTOCOMPLETAR} value={e.url} onChange={ev => set({ url: ev.target.value })} placeholder="https://platform.openai.com/api-keys" /></Campo>
          </div>
        </>}

        <Campo label={e.tipo === 'nota' ? 'Contenido (se guarda cifrado)' : 'Notas'}>
          <textarea {...SIN_AUTOCOMPLETAR} className={e.tipo === 'nota' ? 'bov-nota-segura' : ''} rows={e.tipo === 'nota' ? 8 : 3} value={e.notas} onChange={ev => set({ notas: ev.target.value })}
            placeholder={e.tipo === 'nota' ? 'Códigos de recuperación, licencias, respuestas de seguridad…' : 'Para qué es, quién la usa, a quién pedirla…'} />
        </Campo>

        <div className="bov-campos-extra">
          <div className="titulo-seccion">Campos extra <small>PIN, puerto, id de inquilino…</small></div>
          {e.campos.map(c => (
            <div key={c.id} className="campo-extra">
              <input {...SIN_AUTOCOMPLETAR} value={c.nombre} onChange={ev => setCampo(c.id, { nombre: ev.target.value })} placeholder="Nombre" aria-label="Nombre del campo" />
              {c.oculto
                ? <CampoSecreto valor={c.valor} onCambio={v => setCampo(c.id, { valor: v })} nuevo placeholder="Valor" />
                : <input {...SIN_AUTOCOMPLETAR} value={c.valor} onChange={ev => setCampo(c.id, { valor: ev.target.value })} placeholder="Valor" aria-label="Valor del campo" />}
              <label className="bov-check pequeno" title="Se enseña con puntos, como una contraseña"><input type="checkbox" checked={c.oculto} onChange={ev => setCampo(c.id, { oculto: ev.target.checked })} /> Oculto</label>
              <button type="button" className="btn sutil icono pequeno" onClick={() => set({ campos: e.campos.filter(x => x.id !== c.id) })} title="Quitar" aria-label="Quitar campo"><X size={15} /></button>
            </div>
          ))}
          <button type="button" className="btn sutil pequeno" onClick={() => set({ campos: [...e.campos, { id: nuevoId(), nombre: '', valor: '', oculto: true }] })}><Plus size={15} /> Añadir campo</button>
        </div>

        <Campo label="Etiquetas (separadas por comas)">
          <input {...SIN_AUTOCOMPLETAR} value={etiquetas} onChange={ev => setEtiquetas(ev.target.value)} placeholder="cliente Apple, Azure, facturación" />
        </Campo>
        {error && <div className="error-formulario">{error}</div>}
        <button type="submit" hidden />
      </form>
    </Modal>
  )
}
