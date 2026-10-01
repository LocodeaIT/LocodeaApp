/**
 * Piezas comunes de la Bóveda: campo de contraseña con ojo, medidor de
 * fortaleza, botón de copiar (que se borra solo), valor oculto, código de dos
 * pasos en vivo, monograma y cuenta atrás del bloqueo.
 */
import { useEffect, useMemo, useRef, useState, type InputHTMLAttributes } from 'react'
import { Check, Copy, Dices, Eye, EyeOff } from 'lucide-react'
import { useApp } from '../../store'
import { copiarSecreto, SEGUNDOS_PORTAPAPELES } from '../portapapeles'
import { fortaleza } from '../generador'
import { codigoTotp, leerTotp, segundosRestantes } from '../totp'

/** Re-render cada `ms`: solo en piezas pequeñas (relojes), no en la pantalla entera. */
export function useAhora(ms = 1000): number {
  const [ahora, setAhora] = useState(() => Date.now())
  useEffect(() => {
    const t = window.setInterval(() => setAhora(Date.now()), ms)
    return () => window.clearInterval(t)
  }, [ms])
  return ahora
}

/** Atributos para que el navegador no guarde ni corrija lo que se escribe. */
export const SIN_AUTOCOMPLETAR = { autoComplete: 'off', autoCorrect: 'off', autoCapitalize: 'off', spellCheck: false } as const

export function CampoSecreto({ valor, onCambio, onGenerar, nuevo, autoFocus, placeholder, id }: {
  valor: string
  onCambio: (v: string) => void
  /** Si se pasa, aparece el dado para generar una contraseña. */
  onGenerar?: () => void
  /** Contraseña nueva (no la de entrar): el navegador no ofrece las guardadas. */
  nuevo?: boolean
  autoFocus?: boolean
  placeholder?: string
  id?: string
}) {
  const [ver, setVer] = useState(false)
  const props: InputHTMLAttributes<HTMLInputElement> = { ...SIN_AUTOCOMPLETAR, autoComplete: nuevo ? 'new-password' : 'current-password' }
  return (
    <div className="bov-secreto">
      <input id={id} {...props} type={ver ? 'text' : 'password'} value={valor} onChange={e => onCambio(e.target.value)} autoFocus={autoFocus} placeholder={placeholder} />
      <button type="button" className="btn sutil icono pequeno" onClick={() => setVer(v => !v)} title={ver ? 'Ocultar' : 'Mostrar'} aria-label={ver ? 'Ocultar' : 'Mostrar'}>
        {ver ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
      {onGenerar && <button type="button" className="btn sutil icono pequeno" onClick={onGenerar} title="Generar una contraseña segura" aria-label="Generar"><Dices size={15} /></button>}
    </div>
  )
}

export function MedidorFortaleza({ valor, compacto }: { valor: string; compacto?: boolean }) {
  if (!valor) return null
  const f = fortaleza(valor)
  const tono = f.nivel <= 1 ? 'mal' : f.nivel === 2 ? 'regular' : 'bien'
  return (
    <div className={`bov-medidor ${tono} ${compacto ? 'compacto' : ''}`}>
      <div className="barras" aria-hidden>{[0, 1, 2, 3].map(i => <i key={i} className={i < Math.max(1, f.nivel) ? 'llena' : ''} />)}</div>
      <span className="texto"><b>{f.etiqueta}</b>{!compacto && f.bits > 0 && <> · {f.bits} bits</>}{!compacto && f.consejo && <> · {f.consejo}</>}</span>
    </div>
  )
}

export function BotonCopiar({ valor, que = 'Copiado', pequeno = true }: { valor: string; que?: string; pequeno?: boolean }) {
  const { avisar } = useApp()
  const [hecho, setHecho] = useState(false)
  const temporizador = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(temporizador.current), [])
  if (!valor) return null
  const copiar = async () => {
    if (await copiarSecreto(valor)) {
      setHecho(true)
      window.clearTimeout(temporizador.current)
      temporizador.current = window.setTimeout(() => setHecho(false), 1600)
      avisar(`${que}. Se borra del portapapeles en ${SEGUNDOS_PORTAPAPELES} s`, 'info')
    } else {
      avisar('El navegador no ha dejado copiar', 'error')
    }
  }
  return (
    <button type="button" className={`btn sutil icono ${pequeno ? 'pequeno' : ''} ${hecho ? 'bov-copiado' : ''}`} onClick={() => void copiar()} title="Copiar" aria-label="Copiar">
      {hecho ? <Check size={15} /> : <Copy size={15} />}
    </button>
  )
}

/** Valor oculto con puntos; el ojo lo enseña 20 segundos y vuelve a taparlo. */
export function ValorSecreto({ valor, que, multilinea }: { valor: string; que?: string; multilinea?: boolean }) {
  const [ver, setVer] = useState(false)
  useEffect(() => {
    if (!ver) return
    const t = window.setTimeout(() => setVer(false), 20_000)
    return () => window.clearTimeout(t)
  }, [ver])
  if (!valor) return <span className="bov-vacio">—</span>
  return (
    <div className={`bov-valor ${multilinea ? 'multilinea' : ''}`}>
      <span className={`dato ${ver ? 'visible' : 'oculto'}`}>{ver ? <Coloreado texto={valor} /> : '•'.repeat(Math.min(14, Math.max(8, valor.length)))}</span>
      <span className="botones">
        <button type="button" className="btn sutil icono pequeno" onClick={() => setVer(v => !v)} title={ver ? 'Ocultar' : 'Mostrar'} aria-label={ver ? 'Ocultar' : 'Mostrar'}>
          {ver ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
        <BotonCopiar valor={valor} que={que} />
      </span>
    </div>
  )
}

/** Números y símbolos en otro tono: así se distinguen la O del 0 o la l del 1 al leerla. */
export function Coloreado({ texto }: { texto: string }) {
  return <>{[...texto].map((c, i) => <span key={i} className={/[0-9]/.test(c) ? 'n' : /[a-zA-ZñÑ]/.test(c) ? '' : 's'}>{c}</span>)}</>
}

export function CodigoTotp({ secreto }: { secreto: string }) {
  const ahora = useAhora(1000)
  const [codigo, setCodigo] = useState<string | null>(null)
  const config = useConfigTotp(secreto)
  const ventana = config ? Math.floor(ahora / 1000 / config.periodo) : 0
  useEffect(() => {
    if (!config) return
    let vivo = true
    void codigoTotp(config).then(c => { if (vivo) setCodigo(c) })
    return () => { vivo = false }
  }, [config, ventana])
  if (!config) return <span className="bov-vacio">El secreto de dos pasos no es válido</span>
  const quedan = segundosRestantes(config, ahora)
  const pct = (quedan / config.periodo) * 100
  const mitad = codigo ? Math.ceil(codigo.length / 2) : 0
  return (
    <div className="bov-totp">
      <span className={`anillo ${quedan <= 5 ? 'acaba' : ''}`} style={{ ['--pct' as string]: `${pct}%` }} title={`Cambia en ${quedan} s`}><b>{quedan}</b></span>
      <span className="codigo">{codigo ? <><span>{codigo.slice(0, mitad)}</span><span>{codigo.slice(mitad)}</span></> : <span>··· ···</span>}</span>
      {codigo && <BotonCopiar valor={codigo} que="Código copiado" />}
    </div>
  )
}

const useConfigTotp = (secreto: string) => useMemo(() => leerTotp(secreto), [secreto])

/** Inicial en bronce sobre papel, como los avatares de la app. */
export function Monograma({ texto, grande }: { texto: string; grande?: boolean }) {
  const letra = (texto.trim().match(/[\p{L}\p{N}]/u)?.[0] ?? '·').toUpperCase()
  return <span className={`bov-monograma ${grande ? 'grande' : ''}`} aria-hidden>{letra}</span>
}

export function CuentaAtras({ hasta }: { hasta: number | null }) {
  const ahora = useAhora(1000)
  if (!hasta) return null
  const s = Math.max(0, Math.round((hasta - ahora) / 1000))
  return <>{Math.floor(s / 60)}:{String(s % 60).padStart(2, '0')}</>
}
