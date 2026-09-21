/**
 * Equipo: miembros de Locodea. Cuando la app pase a Dataverse, el usuario se
 * identificará por su cuenta de Power Apps y esta tabla enlazará con ella.
 */
import { useState } from 'react'
import { Plus, UserCog } from 'lucide-react'
import { useApp } from '../store'
import { Avatar, Campo, COLORES, Modal } from '../ui/basicos'
import { Select } from '../ui/Select'
import type { Miembro, Rol } from '../domain/types'

export default function Equipo(_: { abrirTarea: (id: string) => void }) {
  const { datos, guardarMiembro } = useApp()
  const [editar, setEditar] = useState<Miembro | null | 'nuevo'>(null)
  return (
    <div className="pagina">
      <div className="titulo-pagina">
        <div><h1>Equipo</h1><div className="sub">Quién forma Locodea y qué papel tiene</div></div>
        <div className="acciones"><button className="btn primario" onClick={() => setEditar('nuevo')}><Plus size={15} /> Añadir miembro</button></div>
      </div>
      <div className="tarjeta">
        <table className="tabla">
          <thead><tr><th>Miembro</th><th>Correo</th><th>Rol</th><th>Estado</th><th className="num">Tareas abiertas</th><th></th></tr></thead>
          <tbody>
            {datos.miembros.map(m => (
              <tr key={m.id} className="clicable" onClick={() => setEditar(m)}>
                <td><span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}><Avatar miembro={m} /><b>{m.nombre}</b></span></td>
                <td style={{ color: 'var(--texto-2)' }}>{m.email}</td>
                <td>{m.rol === 'socio' ? 'Socio' : 'Colaborador'}</td>
                <td><span className={`chip pequeno ${m.activo ? 'ok' : ''}`}>{m.activo ? 'Activo' : 'Inactivo'}</span></td>
                <td className="num">{datos.tareas.filter(t => t.asignadoId === m.id && t.estado !== 'hecha' && !t.personal).length}</td>
                <td><UserCog size={15} style={{ color: 'var(--texto-3)' }} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ marginTop: 12, fontSize: 12, color: 'var(--texto-3)' }}>Los socios pueden reabrir semanas cerradas. El revisor es quien acepta o rechaza los objetivos de todos y aprueba la semana. Solo puede haber uno.</p>
      {editar && <ModalMiembro inicial={editar === 'nuevo' ? null : editar} onCerrar={() => setEditar(null)} onGuardar={m => { void guardarMiembro(m); setEditar(null) }} />}
    </div>
  )
}

function ModalMiembro({ inicial, onCerrar, onGuardar }: { inicial: Miembro | null; onCerrar: () => void; onGuardar: (m: Miembro | Omit<Miembro, 'id'>) => void }) {
  const [nombre, setNombre] = useState(inicial?.nombre ?? '')
  const [email, setEmail] = useState(inicial?.email ?? '')
  const [iniciales, setIniciales] = useState(inicial?.iniciales ?? '')
  const [color, setColor] = useState(inicial?.color ?? COLORES[3])
  const [rol, setRol] = useState<Rol>(inicial?.rol ?? 'colaborador')
  const [activo, setActivo] = useState(inicial?.activo ?? true)
  const ini = iniciales || nombre.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase()).join('')
  return (
    <Modal titulo={inicial ? 'Editar miembro' : 'Nuevo miembro'} onCerrar={onCerrar} pie={<>
      <button className="btn" onClick={onCerrar}>Cancelar</button>
      <button className="btn primario" disabled={!nombre.trim()} onClick={() => onGuardar({ ...(inicial ?? {}), nombre: nombre.trim(), email: email.trim(), iniciales: ini, color, rol, activo })}>Guardar</button>
    </>}>
      <div className="formulario">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><span className="avatar grande" style={{ background: color }}>{ini || '?'}</span><span style={{ color: 'var(--texto-3)', fontSize: 13 }}>Vista previa del avatar</span></div>
        <div className="fila-campos dos">
          <Campo label="Nombre"><input autoFocus value={nombre} onChange={e => setNombre(e.target.value)} /></Campo>
          <Campo label="Correo"><input value={email} onChange={e => setEmail(e.target.value)} /></Campo>
        </div>
        <div className="fila-campos">
          <Campo label="Iniciales"><input value={iniciales} maxLength={3} onChange={e => setIniciales(e.target.value.toUpperCase())} placeholder={ini} /></Campo>
          <Campo label="Rol"><Select valor={rol} onCambio={setRol} opciones={[{ valor: 'socio', etiqueta: 'Socio' }, { valor: 'colaborador', etiqueta: 'Colaborador' }]} /></Campo>
          <Campo label="Estado"><Select valor={activo ? '1' : '0'} onCambio={v => setActivo(v === '1')} opciones={[{ valor: '1', etiqueta: 'Activo' }, { valor: '0', etiqueta: 'Inactivo' }]} /></Campo>
        </div>
        <Campo label="Color">
          <div style={{ display: 'flex', gap: 6 }}>{COLORES.map(c => <span key={c} onClick={() => setColor(c)} style={{ width: 24, height: 24, borderRadius: 6, background: c, cursor: 'pointer', boxShadow: color === c ? '0 0 0 2px #fff, 0 0 0 4px ' + c : 'none' }} />)}</div>
        </Campo>
      </div>
    </Modal>
  )
}
