/**
 * Modales de alta/edición: tarea, objetivo, proyecto, revisión y evaluación
 * de objetivos, cierre de semana.
 */
import { useState } from 'react'
import { useApp } from '../store'
import { Campo, COLORES, Modal, SelectMiembro, SelectProyecto, confirmar } from '../ui/basicos'
import { Select } from '../ui/Select'
import { IconoPrioridad } from '../ui/basicos'
import type { EstadoProyecto, Objetivo, Prioridad, Proyecto, Tarea } from '../domain/types'
import { ETIQUETA_ESTADO_PROYECTO, ETIQUETA_PRIORIDAD } from '../domain/types'
import type { Nuevo } from '../data/repo'
import { apartadosDePlantilla, ETIQUETA_PLANTILLA, type PlantillaApartados } from '../domain/apartados'

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
  // null es un valor valido (objetivo general), asi que hay que mirar si la clave
  // viene o no; con ?? un null explicito caeria en "yo" y se perderia.
  const [responsableId, setResponsableId] = useState<string | null>(
    'responsableId' in inicial ? inicial.responsableId ?? null : yo?.id ?? null)
  const [prioridad, setPrioridad] = useState<Prioridad>(inicial.prioridad ?? 'media')

  const guardar = async () => {
    if (!titulo.trim()) return
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
    <Modal titulo={existente ? 'Editar objetivo' : 'Nuevo objetivo'} onCerrar={onCerrar} pie={<>
      {existente && <button className="btn peligro" style={{ marginRight: 'auto' }} onClick={async () => { if (await confirmar('¿Borrar el objetivo?', { aceptar: 'Borrar', peligro: true })) { void borrarObjetivo(existente.id); onCerrar() } }}>Borrar</button>}
      <button className="btn" onClick={onCerrar}>Cancelar</button>
      <button className="btn primario" onClick={() => void guardar()} disabled={!titulo.trim()}>{existente ? 'Guardar' : 'Crear objetivo'}</button>
    </>}>
      <div className="formulario">
        <p className="ayuda">Un objetivo es un resultado concreto que se puede dar por hecho o no el viernes. Sin responsable queda como objetivo general del equipo.</p>
        <Campo label="Objetivo"><input autoFocus value={titulo} onChange={e => setTitulo(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void guardar() }} placeholder="Ej.: Entregar la v1 del portal al cliente" /></Campo>
        <div className="fila-campos dos">
          <Campo label="Responsable"><SelectMiembro valor={responsableId} onCambio={setResponsableId} textoNadie="General del equipo" /></Campo>
          <Campo label="Proyecto"><SelectProyecto valor={proyectoId} onCambio={setProyectoId} /></Campo>
        </div>
        <Campo label="Prioridad"><Select valor={prioridad} onCambio={setPrioridad} opciones={OPCIONES_PRIORIDAD} ancho={200} /></Campo>
        <Campo label="Descripción"><textarea value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="Detalle, contexto o cómo sabremos que está cumplido" /></Campo>
      </div>
    </Modal>
  )
}

export function ModalProyecto({ inicial, onCerrar, onCreado }: { inicial: Proyecto | null; onCerrar: () => void; onCreado?: (p: Proyecto) => void }) {
  const { datos, yo, guardarProyecto, borrarProyecto } = useApp()
  const [nombre, setNombre] = useState(inicial?.nombre ?? '')
  const [interno, setInterno] = useState(inicial?.interno ?? false)
  const [cliente, setCliente] = useState(inicial?.cliente ?? '')
  const [color, setColor] = useState(inicial?.color ?? COLORES[datos.proyectos.length % COLORES.length])
  const [estado, setEstado] = useState<EstadoProyecto>(inicial?.estado ?? 'activo')
  const [responsableId, setResponsableId] = useState<string | null>(inicial?.responsableId ?? yo?.id ?? null)
  const [descripcion, setDescripcion] = useState(inicial?.descripcion ?? '')
  const [fechaInicio, setFechaInicio] = useState(inicial?.fechaInicio ?? '')
  const [fechaFin, setFechaFin] = useState(inicial?.fechaFin ?? '')
  const [enlaceDocumentos, setEnlaceDocumentos] = useState(inicial?.enlaceDocumentos ?? '')
  const [plantilla, setPlantilla] = useState<PlantillaApartados>('ninguna')

  const guardar = async () => {
    if (!nombre.trim()) return
    const base = {
      nombre: nombre.trim(), interno,
      // un proyecto interno es de Locodea: así se ve igual en listas e informes
      cliente: interno ? 'Locodea' : cliente.trim(),
      color, estado, responsableId, descripcion, enlaceDocumentos: enlaceDocumentos.trim(),
      fechaInicio: fechaInicio || null, fechaFin: fechaFin || null,
      horasPresupuestadas: inicial?.horasPresupuestadas ?? null,
    }
    const guardado = await guardarProyecto(inicial ? { ...inicial, ...base } : { ...base, apartados: apartadosDePlantilla(plantilla) })
    if (!inicial) onCreado?.(guardado)
    onCerrar()
  }

  return (
    <Modal titulo={inicial ? 'Editar proyecto' : 'Nuevo proyecto'} ancho onCerrar={onCerrar} pie={<>
      {inicial && <button className="btn peligro" style={{ marginRight: 'auto' }} onClick={async () => { if (await confirmar('¿Borrar el proyecto?', { texto: 'Sus tareas no se borran: quedan sin proyecto.', aceptar: 'Borrar', peligro: true })) { void borrarProyecto(inicial.id); onCerrar() } }}>Borrar</button>}
      <button className="btn" onClick={onCerrar}>Cancelar</button>
      <button className="btn primario" onClick={() => void guardar()} disabled={!nombre.trim()}>{inicial ? 'Guardar' : 'Crear proyecto'}</button>
    </>}>
      <div className="formulario">
        <Campo label="Nombre"><input autoFocus value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej.: Portal de proveedores" /></Campo>
        <div className="fila-campos dos">
          <Campo label="Tipo">
            <div className="btn-grupo" role="radiogroup" aria-label="Tipo de proyecto">
              <button type="button" role="radio" aria-checked={!interno} className={!interno ? 'activo' : ''} onClick={() => setInterno(false)}>De cliente</button>
              <button type="button" role="radio" aria-checked={interno} className={interno ? 'activo' : ''} onClick={() => setInterno(true)}>Interno</button>
            </div>
          </Campo>
          {!interno && <Campo label="Cliente"><input value={cliente} onChange={e => setCliente(e.target.value)} placeholder="Empresa" /></Campo>}
        </div>
        <div className="fila-campos dos">
          <Campo label="Responsable"><SelectMiembro valor={responsableId} onCambio={setResponsableId} /></Campo>
          <Campo label="Estado"><Select valor={estado} onCambio={setEstado} opciones={(Object.keys(ETIQUETA_ESTADO_PROYECTO) as EstadoProyecto[]).map(e => ({ valor: e, etiqueta: ETIQUETA_ESTADO_PROYECTO[e] }))} /></Campo>
        </div>
        <div className="fila-campos dos">
          <Campo label="Inicio"><input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} /></Campo>
          <Campo label="Fin previsto"><input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)} /></Campo>
        </div>
        <Campo label="Documentación en SharePoint">
          <input value={enlaceDocumentos} onChange={e => setEnlaceDocumentos(e.target.value)} placeholder="Enlace a la carpeta del proyecto" />
        </Campo>
        {!inicial && (
          <Campo label="Apartados de partida">
            <div className="btn-grupo" role="radiogroup" aria-label="Apartados de partida">
              {(Object.keys(ETIQUETA_PLANTILLA) as PlantillaApartados[]).map(k => (
                <button key={k} type="button" role="radio" aria-checked={plantilla === k} className={plantilla === k ? 'activo' : ''} onClick={() => setPlantilla(k)}>{ETIQUETA_PLANTILLA[k]}</button>
              ))}
            </div>
          </Campo>
        )}
        <Campo label="Color">
          <div className="muestras-color">
            {COLORES.map(c => <button key={c} type="button" aria-label={`Color ${c}`} aria-pressed={color === c} onClick={() => setColor(c)} style={{ background: c, boxShadow: color === c ? '0 0 0 2px var(--paper), 0 0 0 4px ' + c : 'none' }} />)}
          </div>
        </Campo>
        <Campo label="Descripción"><textarea value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="De qué trata y qué hay que entregar." /></Campo>
      </div>
    </Modal>
  )
}
