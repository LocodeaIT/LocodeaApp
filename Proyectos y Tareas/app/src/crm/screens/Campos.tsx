/**
 * Controles de la ficha: un campo según su tipo (texto, número, fecha,
 * desplegable…) y la entrada numérica que deja escribir sin saltar a 0.
 */
import { useState, type InputHTMLAttributes } from 'react'
import { Select } from '../../ui/Select'
import type { CrmCtx } from '../contexto'
import type { RegistroBase } from '../types'
import type { Campo } from '../registro/tipos'
import { fecha } from '../formato'

/**
 * Número controlado que conserva lo que se está escribiendo («1.», vacío…) y
 * solo se resincroniza cuando el valor cambia desde fuera (p. ej. al elegir un
 * producto en la línea).
 */
export function Numero({ valor, onCambio, ...resto }: { valor: number; onCambio: (n: number) => void } & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'>) {
  const [texto, setTexto] = useState(String(valor ?? ''))
  if ((Number(texto) || 0) !== (Number(valor) || 0)) setTexto(String(valor ?? ''))
  return <input {...resto} type="number" value={texto} onChange={e => { setTexto(e.target.value); onCambio(Number(e.target.value) || 0) }} />
}

const leer = (d: RegistroBase, clave: string) => (d as unknown as Record<string, unknown>)[clave]

export function CampoFicha<T extends RegistroBase>({ campo, d, c, bloqueado, onCambio }: { campo: Campo<T>; d: T; c: CrmCtx; bloqueado: boolean; onCambio: (valor: unknown) => void }) {
  const id = `crm-${campo.clave}`
  const v = leer(d, campo.clave)
  const soloLectura = bloqueado || !!campo.soloLectura
  let control
  if (campo.mostrar) {
    const m = campo.mostrar(d, c)
    control = <div className="crm-valor">{m === '' || m == null ? <span className="crm-apagado">—</span> : m}</div>
  } else if (campo.tipo === 'opciones' || campo.tipo === 'sino') {
    const opciones = campo.tipo === 'sino'
      ? [{ valor: 'si', etiqueta: 'Sí' }, { valor: 'no', etiqueta: 'No' }]
      : typeof campo.opciones === 'function' ? campo.opciones(d, c) : campo.opciones ?? []
    const actual = campo.tipo === 'sino' ? (v ? 'si' : 'no') : String(v ?? '')
    control = (
      <Select valor={actual} opciones={opciones} deshabilitado={soloLectura} ancho="100%"
        onCambio={x => onCambio(campo.tipo === 'sino' ? x === 'si' : x === '' && (campo.clave.endsWith('Id') || campo.clave === 'referenteTipo') ? null : x)} />
    )
  } else if (soloLectura) {
    control = <div className="crm-valor">{v === '' || v == null ? <span className="crm-apagado">—</span> : campo.tipo === 'fecha' ? fecha(String(v)) : String(v)}</div>
  } else if (campo.tipo === 'area') {
    control = <textarea id={id} value={String(v ?? '')} onChange={e => onCambio(e.target.value)} />
  } else if (campo.tipo === 'numero') {
    control = <Numero id={id} valor={Number(v) || 0} onCambio={onCambio} step={campo.paso} min={campo.min} />
  } else {
    const tipo = campo.tipo === 'fecha' ? 'date' : campo.tipo === 'hora' ? 'time' : campo.tipo === 'email' ? 'email' : 'text'
    control = <input id={id} type={tipo} value={String(v ?? '')} onChange={e => onCambio(e.target.value)} autoComplete="off" />
  }
  return (
    <div className={`crm-campo ${campo.completo ? 'completo' : ''}`}>
      <label htmlFor={id}>{campo.titulo}{campo.req && <i className="crm-req"> *</i>}</label>
      {control}
    </div>
  )
}
