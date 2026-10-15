/**
 * Alta y edición de una propuesta. Al crearla se puede dejar ya el primer
 * apunte (lo que contó el cliente, de dónde sale la idea…).
 */
import { useMemo, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { useApp } from '../../store'
import { useCrm } from '../../crm/contexto'
import { Campo, Modal, SelectMiembro, Segmentado, confirmar } from '../../ui/basicos'
import { Select } from '../../ui/Select'
import { nuevoId } from '../../data/repo'
import { ahoraIso } from '../../domain/fechas'
import { usePropuestas } from '../store'
import type { EstadoPropuesta, Propuesta, PrioridadPropuesta } from '../types'
import {
  ESTADOS_PROPUESTA, ETIQUETA_ESTADO_PROPUESTA, ETIQUETA_PRIORIDAD_PROPUESTA, PROBABILIDAD_ESTADO, TECNOLOGIAS_SUGERIDAS, propuestaVacia,
} from '../types'

const COLOR_ESTADO: Record<EstadoPropuesta, string> = {
  apunte: '#a89a8a', conversacion: '#5b7fa6', planificacion: '#6a4f9a', enviada: '#c9773a', aceptado: '#3f7a4f', descartado: '#a8432f',
}

export function ModalPropuesta({ inicial, estadoInicial, onCerrar, onCreada }: {
  inicial: Propuesta | null
  estadoInicial?: EstadoPropuesta
  onCerrar: () => void
  onCreada?: (p: Propuesta) => void
}) {
  const { yo } = useApp()
  const crm = useCrm()
  const { propuestas, crear, guardar, borrar } = usePropuestas()
  const base = inicial ?? { ...propuestaVacia({ estado: estadoInicial ?? 'apunte', responsableId: yo?.id ?? null }) }

  const [titulo, setTitulo] = useState(base.titulo)
  const [cliente, setCliente] = useState(base.cliente)
  const [contacto, setContacto] = useState(base.contacto)
  const [estado, setEstado] = useState<EstadoPropuesta>(base.estado)
  const [prioridad, setPrioridad] = useState<PrioridadPropuesta>(base.prioridad)
  const [importe, setImporte] = useState(base.importe === null ? '' : String(base.importe))
  const [probabilidad, setProbabilidad] = useState<number | null>(base.probabilidad)
  const [fechaPrevista, setFechaPrevista] = useState(base.fechaPrevista ?? '')
  const [responsableId, setResponsableId] = useState<string | null>(base.responsableId)
  const [tecnologias, setTecnologias] = useState<string[]>(base.tecnologias)
  const [otraTecnologia, setOtraTecnologia] = useState('')
  const [descripcion, setDescripcion] = useState(base.descripcion)
  const [primerApunte, setPrimerApunte] = useState('')
  const [guardando, setGuardando] = useState(false)

  // clientes que ya conocemos: los del CRM y los de otras propuestas
  const cuentas = useMemo(() => (crm.disponible ? crm.datos.cuentas : []), [crm.disponible, crm.datos.cuentas])
  const sugerenciasCliente = useMemo(() => {
    const nombres = new Set<string>([...cuentas.map(c => c.nombre), ...propuestas.map(p => p.cliente)].filter(Boolean))
    return [...nombres].sort((a, b) => a.localeCompare(b, 'es'))
  }, [cuentas, propuestas])
  const cuenta = cuentas.find(c => c.nombre.trim().toLowerCase() === cliente.trim().toLowerCase()) ?? null

  const probEfectiva = probabilidad ?? PROBABILIDAD_ESTADO[estado]
  const cerrada = estado === 'aceptado' || estado === 'descartado'

  const alternar = (t: string) => setTecnologias(l => (l.includes(t) ? l.filter(x => x !== t) : [...l, t]))
  const anadirOtra = () => {
    const t = otraTecnologia.trim()
    if (t && !tecnologias.includes(t)) setTecnologias(l => [...l, t])
    setOtraTecnologia('')
  }

  const valido = titulo.trim() && cliente.trim()

  const enviar = async () => {
    if (!valido || guardando) return
    setGuardando(true)
    const numero = importe.trim() ? Number(importe.replace(/\./g, '').replace(',', '.')) : null
    const campos = {
      titulo: titulo.trim(), cliente: cliente.trim(), cuentaId: cuenta?.id ?? null, contacto: contacto.trim(), estado, prioridad,
      importe: numero !== null && Number.isFinite(numero) ? numero : null, probabilidad: cerrada ? null : probabilidad,
      fechaPrevista: fechaPrevista || null, responsableId, tecnologias, descripcion: descripcion.trim(),
    }
    try {
      if (inicial) {
        await guardar({ ...inicial, ...campos })
      } else {
        const apuntes = primerApunte.trim() ? [{ id: nuevoId(), fecha: ahoraIso(), autorId: yo?.id ?? null, texto: primerApunte.trim() }] : []
        const creada = await crear({ ...propuestaVacia(), ...campos, apuntes })
        onCreada?.(creada)
      }
      onCerrar()
    } catch {
      setGuardando(false)  // el aviso de error ya lo ha dado el estado
    }
  }

  return (
    <Modal titulo={inicial ? 'Editar propuesta' : 'Nueva propuesta'} ancho onCerrar={onCerrar} pie={<>
      {inicial && (
        <button className="btn peligro" style={{ marginRight: 'auto' }} onClick={async () => {
          if (await confirmar('¿Borrar la propuesta?', { texto: 'Se pierden también sus apuntes. Si ya es un proyecto, el proyecto se queda.', aceptar: 'Borrar', peligro: true })) {
            void borrar(inicial.id); onCerrar()
          }
        }}>Borrar</button>
      )}
      <button className="btn" onClick={onCerrar}>Cancelar</button>
      <button className="btn primario" onClick={() => void enviar()} disabled={!valido || guardando}>{inicial ? 'Guardar' : 'Crear propuesta'}</button>
    </>}>
      <div className="formulario prop-formulario">
        <Campo label="¿Qué proyecto podría ser?">
          <input autoFocus value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ej.: App de partes de trabajo para los técnicos" />
        </Campo>

        <div className="fila-campos dos">
          <Campo label="Cliente">
            <input value={cliente} onChange={e => setCliente(e.target.value)} placeholder="Nombre de la empresa" list="prop-clientes" />
            <datalist id="prop-clientes">{sugerenciasCliente.map(n => <option key={n} value={n} />)}</datalist>
            {cuenta && <small className="prop-ayuda ok">Enlazada con la cuenta del CRM</small>}
          </Campo>
          <Campo label="Contacto">
            <input value={contacto} onChange={e => setContacto(e.target.value)} placeholder="Persona con la que hablamos" />
          </Campo>
        </div>

        <div className="fila-campos dos">
          <Campo label="Estado">
            <Select valor={estado} onCambio={setEstado} opciones={ESTADOS_PROPUESTA.map(e => ({ valor: e, etiqueta: ETIQUETA_ESTADO_PROPUESTA[e], color: COLOR_ESTADO[e] }))} />
          </Campo>
          <Campo label="Prioridad">
            <Segmentado valor={prioridad} onCambio={setPrioridad} etiqueta="Prioridad"
              opciones={(['alta', 'media', 'baja'] as PrioridadPropuesta[]).map(p => ({ valor: p, etiqueta: ETIQUETA_PRIORIDAD_PROPUESTA[p] }))} />
          </Campo>
        </div>

        <div className="fila-campos">
          <Campo label="Importe estimado (€)">
            <input inputMode="decimal" value={importe} onChange={e => setImporte(e.target.value)} placeholder="Ej.: 12000" />
          </Campo>
          <Campo label="Decisión prevista">
            <input type="date" value={fechaPrevista} onChange={e => setFechaPrevista(e.target.value)} />
          </Campo>
          <Campo label="Responsable">
            <SelectMiembro valor={responsableId} onCambio={setResponsableId} />
          </Campo>
        </div>

        {!cerrada && (
          <Campo label={`Probabilidad · ${probEfectiva}%${probabilidad === null ? ' (la típica de su estado)' : ''}`}>
            <div className="prop-deslizador">
              <input type="range" min={0} max={100} step={5} value={probEfectiva} onChange={e => setProbabilidad(Number(e.target.value))}
                style={{ ['--pct' as string]: `${probEfectiva}%` }} />
              {probabilidad !== null && <button type="button" className="btn sutil pequeno" onClick={() => setProbabilidad(null)}>Automática</button>}
            </div>
          </Campo>
        )}

        <Campo label="Tecnologías">
          <div className="prop-tecnologias">
            {[...TECNOLOGIAS_SUGERIDAS, ...tecnologias.filter(t => !TECNOLOGIAS_SUGERIDAS.includes(t))].map(t => (
              <button key={t} type="button" className={`prop-tec ${tecnologias.includes(t) ? 'activa' : ''}`} aria-pressed={tecnologias.includes(t)} onClick={() => alternar(t)}>
                {t}{tecnologias.includes(t) && !TECNOLOGIAS_SUGERIDAS.includes(t) && <X size={11} />}
              </button>
            ))}
            <span className="prop-tec-otra">
              <input value={otraTecnologia} onChange={e => setOtraTecnologia(e.target.value)} placeholder="Otra…"
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); anadirOtra() } }} />
              {otraTecnologia.trim() && <button type="button" className="btn sutil icono pequeno" onClick={anadirOtra} aria-label="Añadir tecnología"><Plus size={14} /></button>}
            </span>
          </div>
        </Campo>

        <Campo label="Descripción">
          <textarea value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="Qué necesita el cliente y qué le propondríamos" />
        </Campo>

        {!inicial && (
          <Campo label="Primer apunte (opcional)">
            <textarea value={primerApunte} onChange={e => setPrimerApunte(e.target.value)} placeholder="Lo que nos contó, de dónde sale la idea, próximos pasos…" style={{ minHeight: 70 }} />
          </Campo>
        )}
      </div>
    </Modal>
  )
}
