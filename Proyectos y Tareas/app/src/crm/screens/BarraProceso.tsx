/**
 * Flujo de proceso de negocio: Calificar → Desarrollar → Proponer → Cerrar.
 * En oportunidades abiertas cada fase se puede pulsar y fija su probabilidad.
 */
import { Ban, Check, X } from 'lucide-react'
import type { Fase } from '../types'
import { FASE, FASES } from '../catalogos'
import type { FinProceso } from '../registro/tipos'

export function BarraProceso({ fase, fin, editable, onFase }: { fase: Fase; fin: FinProceso | null; editable: boolean; onFase: (f: Fase) => void }) {
  const actual = Math.max(0, FASES.indexOf(fase))
  const IconoFin = fin?.tono === 'error' ? X : fin?.tono === 'apagado' ? Ban : Check
  return (
    <div className="crm-proceso" role="group" aria-label="Proceso de venta">
      {FASES.map((f, i) => {
        const hecha = !!fin || i < actual
        return (
          <button key={f} type="button" className={hecha ? 'hecha' : i === actual ? 'actual' : ''} disabled={!editable} onClick={() => onFase(f)} aria-current={i === actual ? 'step' : undefined}>
            <i>{hecha ? <Check size={12} strokeWidth={2.5} /> : i + 1}</i>{FASE[f]}
          </button>
        )
      })}
      {fin && <span className={`crm-proceso-fin ${fin.tono}`}><IconoFin size={14} /> {fin.texto}</span>}
    </div>
  )
}
