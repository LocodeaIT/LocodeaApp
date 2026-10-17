/**
 * Flujo de proceso de negocio. Por defecto, el de las oportunidades
 * (Calificar → Desarrollar → Proponer → Cerrar): en las abiertas cada fase se
 * puede pulsar y fija su probabilidad. Una entidad puede traer sus propios
 * pasos (el recorrido del cliente potencial).
 */
import { Ban, Check, X } from 'lucide-react'
import { FASE, FASES } from '../catalogos'
import type { FinProceso } from '../registro/tipos'

const PASOS_FASE = FASES.map(f => ({ clave: f, etiqueta: FASE[f] }))

export function BarraProceso({ pasos = PASOS_FASE, actual: claveActual, fin, editable, onPaso }: {
  pasos?: { clave: string; etiqueta: string }[]
  actual: string
  fin: FinProceso | null
  editable: boolean
  onPaso: (clave: string) => void
}) {
  const actual = Math.max(0, pasos.findIndex(p => p.clave === claveActual))
  const IconoFin = fin?.tono === 'error' ? X : fin?.tono === 'apagado' ? Ban : Check
  return (
    <div className="crm-proceso" role="group" aria-label="Proceso de venta">
      {pasos.map((p, i) => {
        const hecha = !!fin || i < actual
        return (
          <button key={p.clave} type="button" className={hecha ? 'hecha' : i === actual ? 'actual' : ''} disabled={!editable} onClick={() => onPaso(p.clave)} aria-current={i === actual ? 'step' : undefined}>
            <i>{hecha ? <Check size={12} strokeWidth={2.5} /> : i + 1}</i>{p.etiqueta}
          </button>
        )
      })}
      {fin && <span className={`crm-proceso-fin ${fin.tono}`}><IconoFin size={14} /> {fin.texto}</span>}
    </div>
  )
}
