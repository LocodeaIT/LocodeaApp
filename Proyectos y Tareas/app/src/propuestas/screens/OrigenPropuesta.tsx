/**
 * En la ficha de un proyecto que nació de una propuesta: de dónde viene, lo
 * que se habló (los últimos apuntes) y los archivos que se adjuntaron. Así,
 * cuando una propuesta pasa a real, el proyecto arranca con todo lo que se
 * sabía del cliente.
 */
import { useEffect, useState } from 'react'
import { ArrowRight, Handshake, MessageSquareText } from 'lucide-react'
import { useApp } from '../../store'
import { fechaHora } from '../../domain/fechas'
import { usePropuestas } from '../store'
import { formatoEuros } from '../calculos'
import { Adjuntos } from './Adjuntos'

export function OrigenPropuesta({ proyectoId }: { proyectoId: string }) {
  const { setPantalla, miembro } = useApp()
  const { propuestas, adjuntos, cargado, cargando, error, cargar } = usePropuestas()
  const [verTodo, setVerTodo] = useState(false)

  useEffect(() => { if (!cargado && !cargando && !error) void cargar() }, [cargado, cargando, error, cargar])

  const p = propuestas.find(x => x.proyectoId === proyectoId)
  if (!p) return null
  const suyos = adjuntos.filter(a => a.propuestaId === p.id || a.proyectoId === proyectoId)
  const notas = p.apuntes.filter(a => !a.estado || !a.texto.startsWith('Pasa a ')).sort((a, b) => b.fecha.localeCompare(a.fecha))
  const visibles = verTodo ? notas : notas.slice(0, 3)

  return (
    <section className="tarjeta prop-origen">
      <header>
        <span className="prop-origen-icono"><Handshake size={18} /></span>
        <div>
          <small>Viene de la propuesta</small>
          <b>{p.titulo}</b>
        </div>
        {p.importe !== null && <span className="chip pequeno">{formatoEuros(p.importe)}</span>}
        <button type="button" className="btn sutil pequeno" onClick={() => setPantalla('propuestas')}>Ver propuestas <ArrowRight size={13} /></button>
      </header>

      {notas.length > 0 && (
        <div className="prop-origen-apuntes">
          <h4><MessageSquareText size={14} /> Lo que se habló</h4>
          <ul>
            {visibles.map(a => (
              <li key={a.id}><span>{miembro(a.autorId)?.nombre ?? 'Equipo'} · {fechaHora(a.fecha)}</span>{a.texto}</li>
            ))}
          </ul>
          {notas.length > 3 && <button type="button" className="btn sutil pequeno" onClick={() => setVerTodo(v => !v)}>{verTodo ? 'Ver menos' : `Ver los ${notas.length} apuntes`}</button>}
        </div>
      )}

      <Adjuntos propuestaId={p.id} adjuntos={suyos} soloLectura />
    </section>
  )
}
