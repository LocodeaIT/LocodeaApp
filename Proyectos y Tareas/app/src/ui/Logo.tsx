/**
 * Logo de Locodea.
 *
 * Son las tres piezas del logo original —cuerpo, cabeza y brazo— extraídas con
 * transparencia y recolocadas en su posición exacta. Se mantienen separadas a
 * propósito: así la entrada puede animar cada una por su lado sin renunciar a
 * que el logo sea idéntico al original.
 *
 * Las posiciones son porcentajes respecto a la caja del logo, así que el
 * conjunto escala a cualquier tamaño sin descuadrarse.
 */
import cuerpo from '../assets/logo-cuerpo.png'
import cabeza from '../assets/logo-cabeza.png'
import brazo from '../assets/logo-brazo.png'

/** Proporción real de la caja del logo (308 × 504 en el original). */
const RELACION = 308 / 504

const PIEZAS = [
  { clave: 'cuerpo', src: cuerpo, izquierda: -0.649, arriba: -0.397, ancho: 42.857, alto: 75.992 },
  { clave: 'cabeza', src: cabeza, izquierda: 51.299, arriba: 39.683, ancho: 47.078, alto: 28.968 },
  { clave: 'brazo', src: brazo, izquierda: 10.714, arriba: 71.627, ancho: 89.935, alto: 28.770 },
] as const

export function Logo({ tamano = 40, animado = false, className = '' }: {
  /** Alto en píxeles; el ancho se deduce de la proporción del logo. */
  tamano?: number
  animado?: boolean
  className?: string
}) {
  return (
    <span
      className={`logo-locodea ${animado ? 'animado' : ''} ${className}`}
      style={{ width: Math.round(tamano * RELACION), height: tamano }}
      role="img" aria-label="Locodea"
    >
      {PIEZAS.map(p => (
        <img
          key={p.clave} src={p.src} alt="" aria-hidden draggable={false}
          className={`l-${p.clave}`}
          style={{ left: `${p.izquierda}%`, top: `${p.arriba}%`, width: `${p.ancho}%`, height: `${p.alto}%` }}
        />
      ))}
    </span>
  )
}
