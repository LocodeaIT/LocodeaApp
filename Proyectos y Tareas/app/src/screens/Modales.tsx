/**
 * Modales de alta/edición: tarea, objetivo, proyecto, revisión y evaluación
 * de objetivos, cierre de semana.
 */
import { useState } from 'react'
import { useApp } from '../store'
import { Campo, COLORES, Modal, SelectMiembro, SelectProyecto } from '../ui/basicos'
import { Select } from '../ui/Select'
import { IconoPrioridad } from '../ui/basicos'
import type { EstadoProyecto, Objetivo, Prioridad, Proyecto, Tarea } from '../domain/types'
import { ETIQUETA_ESTADO_PROYECTO, ETIQUETA_PRIORIDAD } from '../domain/types'
import type { Nuevo } from '../data/repo'

export const OPCIONES_PRIORIDAD = (['alta', 'media', 'baja'] as Prioridad[]).map(p => ({ valor: p, etiqueta: ETIQUETA_PRIORIDAD[p], icono: <IconoPrioridad prioridad={p} /> }))

export function ModalTarea({ inicial, onCerrar, onCreada }: { inicial: Partial<Tarea>; onCerrar: () => void; onCreada?: (t: Tarea) => void }) {
  const { datos, yo, guardarTarea, semanaDe, semanaSel, tareaBase, miembro } = useApp()
  const [titulo, setTitulo] = useState(inicial.titulo ?? '')
  const [proyectoId, setProyectoId] = useState<string | null>(inicial.proyectoId ?? null)
  const [asignadoId, setAsignadoId] = useState<string | null>(inicial.asignadoId ?? yo?.id ?? null)
  const [objetivoId, setObjetivoId] = useState<string | null>(inicial.objetivoId ?? null)
  const [prioridad, setPrioridad] = useState<Prioridad>(inicial.prioridad ?? 'media')
  const [inicio, setInicio] = useState(inicial.inicio ?? '')
  const [vence, setVence] = useState(inicial.vence ?? '')
  const [descripcion, setDescripcion] = useState(inicial.descripcion ?? '')
  const [guardando, setGuardando] = useState(false)

  const semana = semanaDe(semanaSel)
  const objetivos = datos.objetivos.filter(o => semana && o.semanaId === semana.id)

  const guardar = async () => {
    if (!titulo.trim() || !yo) return
    setGuardando(true)
    const nueva: Nuevo<Tarea> = tareaBase({
      ...inicial, titulo: titulo.trim(), descripcion, proyectoId, objetivoId, asignadoId, prioridad, inicio: inicio || null, vence: vence || null,
    })
    const t = await guardarTarea(nueva)
    setGuardando(false)
    onCreada?.(t)
    onCerrar()
  }

  return (
    <Modal titulo={inicial.padreId ? 'Nueva subtarea' : 'Nueva tarea'} onCerrar={onCerrar} pie={<>
      <button className="btn" onClick={onCerrar}>Cancelar</button>
      <button className="btn primario" onClick={() => void guardar()} disabled={!titulo.trim() || guardando}>Crear tarea</button>
    </>}>
      <div className="formulario">
        <Campo label="Título"><input autoFocus value={titulo} onChange={e => setTitulo(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void guardar() }} placeholder="Qué hay que hacer" /></Campo>
        <div className="fila-campos dos">
          <Campo label="Proyecto"><SelectProyecto valor={proyectoId} onCambio={setProyectoId} /></Campo>
          <Campo label="Asignada a"><SelectMiembro valor={asignadoId} onCambio={setAsignadoId} /></Campo>
        </div>
        <Campo label="Objetivo semanal al que contribuye">
          <Select valor={objetivoId ?? ''} onCambio={v => setObjetivoId(v || null)} opciones={[{ valor: '', etiqueta: 'Ninguno' }, ...objetivos.map(o => ({ valor: o.id, etiqueta: o.titulo, detalle: miembro(o.responsableId)?.iniciales }))]} />
        </Campo>
        <div className="fila-campos">
          <Campo label="Prioridad"><Select valor={prioridad} onCambio={setPrioridad} opciones={OPCIONES_PRIORIDAD} /></Campo>
          <Campo label="Inicio"><input type="date" value={inicio} onChange={e => setInicio(e.target.value)} /></Campo>
          <Campo label="Vence"><input type="date" value={vence} onChange={e => setVence(e.target.value)} /></Campo>
        </div>
        <Campo label="Descripción"><textarea value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="Contexto, criterios de aceptación, enlaces…" /></Campo>
      </div>
    </Modal>
  )
}

export function ModalObjetivo({ inicial, semanaId, onCerrar }: { inicial: Objetivo | Partial<Objetivo>; semanaId: string; onCerrar: () => void }) {
  const { datos, yo, guardarObjetivo, borrarObjetivo } = useApp()
  const existente = 'id' in inicial && inicial.id ? (inicial as Objetivo) : null
  const [titulo, setTitulo] = useState(inicial.titulo ?? '')
  const [descripcion, setDescripcion] = useState(inicial.descripcion ?? '')
  const [proyectoId, setProyectoId] = useState<string | null>(inicial.proyectoId ?? null)
  const [responsableId, setResponsableId] = useState<string | null>(inicial.responsableId ?? yo?.id ?? null)
  const [prioridad, setPrioridad] = useState<Prioridad>(inicial.prioridad ?? 'media')

  const guardar = async () => {
    if (!titulo.trim() || !responsableId) return
    if (existente) {
      await guardarObjetivo({ ...existente, titulo: titulo.trim(), descripcion, proyectoId, responsableId, prioridad })
    } else {
      const orden = datos.objetivos.filter(o => o.semanaId === semanaId && o.responsableId === responsableId).length
      await guardarObjetivo({
        semanaId, proyectoId, responsableId, titulo: titulo.trim(), descripcion, prioridad,
        estado: 'pendiente', orden, cumplidoEl: null,
      })
    }
    onCerrar()
  }

  return (
    <Modal titulo={existente ? 'Editar objetivo' : 'Proponer objetivo'} onCerrar={onCerrar} pie={<>
      {existente && <button className="btn peligro" style={{ marginRight: 'auto' }} onClick={() => { if (confirm('¿Borrar el objetivo?')) { void borrarObjetivo(existente.id); onCerrar() } }}>Borrar</button>}
      <button className="btn" onClick={onCerrar}>Cancelar</button>
      <button className="btn primario" onClick={() => void guardar()} disabled={!titulo.trim()}>{existente ? 'Guardar' : 'Proponer'}</button>
    </>}>
      <div className="formulario">
        <p className="ayuda">Un objetivo es un resultado concreto que se puede dar por hecho o no el viernes. Lo revisará un compañero.</p>
        <Campo label="Objetivo"><input autoFocus value={titulo} onChange={e => setTitulo(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void guardar() }} placeholder="Ej.: Entregar la v1 del portal al cliente" /></Campo>
        <div className="fila-campos dos">
          <Campo label="Responsable"><SelectMiembro valor={responsableId} onCambio={setResponsableId} conNadie={false} /></Campo>
          <Campo label="Proyecto"><SelectProyecto valor={proyectoId} onCambio={setProyectoId} /></Campo>
        </div>
        <Campo label="Prioridad"><Select valor={prioridad} onCambio={setPrioridad} opciones={OPCIONES_PRIORIDAD} ancho={200} /></Campo>
        <Campo label="Criterio de éxito (opcional)"><textarea value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="¿Cómo sabremos que está cumplido?" /></Campo>
      </div>
    </Modal>
  )
}

export function ModalProyecto({ inicial, onCerrar }: { inicial: Proyecto | null; onCerrar: () => void }) {
  const { datos, guardarProyecto, borrarProyecto } = useApp()
  const [nombre, setNombre] = useState(inicial?.nombre ?? '')
  const [cliente, setCliente] = useState(inicial?.cliente ?? '')
  const [color, setColor] = useState(inicial?.color ?? COLORES[datos.proyectos.length % COLORES.length])
  const [estado, setEstado] = useState<EstadoProyecto>(inicial?.estado ?? 'activo')
  const [responsableId, setResponsableId] = useState<string | null>(inicial?.responsableId ?? null)
  const [descripcion, setDescripcion] = useState(inicial?.descripcion ?? '')
  const [fechaInicio, setFechaInicio] = useState(inicial?.fechaInicio ?? '')
  const [fechaFin, setFechaFin] = useState(inicial?.fechaFin ?? '')

  const guardar = async () => {
    if (!nombre.trim()) return
    const base = { nombre: nombre.trim(), cliente: cliente.trim(), color, estado, responsableId, descripcion, fechaInicio: fechaInicio || null, fechaFin: fechaFin || null, horasPresupuestadas: inicial?.horasPresupuestadas ?? null }
    await guardarProyecto(inicial ? { ...inicial, ...base } : base)
    onCerrar()
  }

  return (
    <Modal titulo={inicial ? 'Editar proyecto' : 'Nuevo proyecto'} onCerrar={onCerrar} pie={<>
      {inicial && <button className="btn peligro" style={{ marginRight: 'auto' }} onClick={() => { if (confirm('¿Borrar el proyecto? Sus tareas quedarán sin proyecto.')) { void borrarProyecto(inicial.id); onCerrar() } }}>Borrar</button>}
      <button className="btn" onClick={onCerrar}>Cancelar</button>
      <button className="btn primario" onClick={() => void guardar()} disabled={!nombre.trim()}>Guardar</button>
    </>}>
      <div className="formulario">
        <div className="fila-campos dos">
          <Campo label="Nombre"><input autoFocus value={nombre} onChange={e => setNombre(e.target.value)} /></Campo>
          <Campo label="Cliente"><input value={cliente} onChange={e => setCliente(e.target.value)} /></Campo>
        </div>
        <div className="fila-campos dos">
          <Campo label="Responsable"><SelectMiembro valor={responsableId} onCambio={setResponsableId} /></Campo>
          <Campo label="Estado"><Select valor={estado} onCambio={setEstado} opciones={(Object.keys(ETIQUETA_ESTADO_PROYECTO) as EstadoProyecto[]).map(e => ({ valor: e, etiqueta: ETIQUETA_ESTADO_PROYECTO[e] }))} /></Campo>
        </div>
        <div className="fila-campos dos">
          <Campo label="Inicio"><input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} /></Campo>
          <Campo label="Fin previsto"><input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)} /></Campo>
        </div>
        <Campo label="Color">
          <div style={{ display: 'flex', gap: 6 }}>
            {COLORES.map(c => <span key={c} onClick={() => setColor(c)} style={{ width: 24, height: 24, borderRadius: 6, background: c, cursor: 'pointer', boxShadow: color === c ? '0 0 0 2px #fff, 0 0 0 4px ' + c : 'none', transition: 'box-shadow 120ms' }} />)}
          </div>
        </Campo>
        <Campo label="Descripción"><textarea value={descripcion} onChange={e => setDescripcion(e.target.value)} /></Campo>
      </div>
    </Modal>
  )
}
