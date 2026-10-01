/**
 * Bóveda cerrada: abrirla con la contraseña maestra o, si todavía no existe,
 * crearla. Es el panel de noche de la pantalla.
 */
import { useState, type FormEvent } from 'react'
import { KeyRound, LockKeyhole, ShieldCheck, Timer, Unlock } from 'lucide-react'
import { useBoveda } from '../store'
import { ContrasenaIncorrecta, ITERACIONES, criptoDisponible } from '../cripto'
import { maestraValida } from '../generador'
import type { Boveda, TipoBoveda } from '../types'
import { CampoSecreto, CuentaAtras, MedidorFortaleza, useAhora } from './comunes'

export function Desbloqueo({ tipo, boveda }: { tipo: TipoBoveda; boveda: Boveda | null }) {
  const { minutosBloqueo } = useBoveda()
  if (!criptoDisponible()) {
    return (
      <div className="bov-cerrada">
        <div className="tarjeta tinta bov-caja">
          <span className="bov-candado"><LockKeyhole size={26} /></span>
          <h2>Este navegador no puede abrir la bóveda.</h2>
          <p>Hace falta una conexión segura (https) para cifrar. Ábrela desde Power Apps.</p>
        </div>
      </div>
    )
  }
  return (
    <div className="bov-cerrada">
      {boveda ? <Abrir boveda={boveda} /> : <Crear tipo={tipo} />}
      <div className="bov-garantias">
        <div className="tarjeta arena garantia anim-aparecer retraso-1">
          <ShieldCheck size={20} />
          <h4>Cifrado en tu navegador.</h4>
          <p>Todo se cifra con AES-256 antes de salir de este equipo. En Dataverse solo hay texto ilegible: ni Microsoft ni un administrador pueden leerlo.</p>
        </div>
        <div className="tarjeta arena garantia anim-aparecer retraso-2">
          <Timer size={20} />
          <h4>Se cierra sola.</h4>
          <p>Tras {minutosBloqueo} {minutosBloqueo === 1 ? 'minuto' : 'minutos'} sin tocar la app, al cambiar de usuario o al cerrar sesión. Lo copiado se borra del portapapeles a los 30 segundos.</p>
        </div>
        <div className="tarjeta arena garantia anim-aparecer retraso-3">
          <KeyRound size={20} />
          <h4>Sin puerta trasera.</h4>
          <p>La contraseña maestra no se guarda en ningún sitio y nadie puede recuperarla. Sin ella no hay forma de abrir la bóveda.</p>
        </div>
      </div>
    </div>
  )
}

function Abrir({ boveda }: { boveda: Boveda }) {
  const { abrir, esperaHasta } = useBoveda()
  const ahora = useAhora(1000)
  const [contrasena, setContrasena] = useState('')
  const [abriendo, setAbriendo] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const esperando = !!esperaHasta && esperaHasta > ahora

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    if (!contrasena || abriendo || esperando) return
    setAbriendo(true)
    setError(null)
    try {
      await abrir(boveda.id, contrasena)
    } catch (err) {
      setError(err instanceof ContrasenaIncorrecta ? 'Esa no es la contraseña maestra.' : err instanceof Error ? err.message : 'No se pudo abrir')
      setContrasena('')
    } finally {
      setAbriendo(false)
    }
  }

  return (
    <form className="tarjeta tinta bov-caja" onSubmit={e => void enviar(e)}>
      <span className={`bov-candado ${abriendo ? 'girando' : ''}`}>{abriendo ? <Unlock size={26} /> : <LockKeyhole size={26} />}</span>
      <h2>{boveda.tipo === 'equipo' ? 'Bóveda del equipo.' : 'Tu bóveda personal.'}</h2>
      <p>{boveda.tipo === 'equipo' ? 'Escribe la contraseña maestra del equipo para abrirla.' : 'Escribe tu contraseña maestra para abrirla.'}</p>
      <div className="fila">
        <CampoSecreto valor={contrasena} onCambio={setContrasena} autoFocus placeholder="Contraseña maestra" />
        <button className="btn acento" disabled={!contrasena || abriendo || esperando}>{abriendo ? 'Abriendo…' : 'Abrir'}</button>
      </div>
      {esperando
        ? <div className="bov-error">Demasiados intentos fallidos. Podrás volver a probar en <CuentaAtras hasta={esperaHasta} />.</div>
        : error && <div className="bov-error">{error}</div>}
      <div className="bov-sello"><ShieldCheck size={14} /> AES-256-GCM · PBKDF2 con {ITERACIONES.toLocaleString('es-ES')} iteraciones</div>
    </form>
  )
}

function Crear({ tipo }: { tipo: TipoBoveda }) {
  const { crear } = useBoveda()
  const [contrasena, setContrasena] = useState('')
  const [repetida, setRepetida] = useState('')
  const [entendido, setEntendido] = useState(false)
  const [creando, setCreando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    const problema = maestraValida(contrasena) ?? (contrasena !== repetida ? 'Las dos contraseñas no coinciden.' : !entendido ? 'Marca que entiendes que no se puede recuperar.' : null)
    if (problema) { setError(problema); return }
    setCreando(true)
    setError(null)
    try {
      await crear(tipo, contrasena)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la bóveda')
      setCreando(false)
    }
  }

  return (
    <form className="tarjeta tinta bov-caja" onSubmit={e => void enviar(e)}>
      <span className="bov-candado"><KeyRound size={26} /></span>
      <h2>{tipo === 'equipo' ? 'Crea la bóveda del equipo.' : 'Crea tu bóveda personal.'}</h2>
      <p>{tipo === 'equipo'
        ? 'Elige una contraseña maestra larga. Compartidla en persona o por un canal seguro, nunca por correo ni por Teams.'
        : 'Elige una contraseña maestra que solo sepas tú. Nadie más del equipo podrá abrirla.'}</p>
      <div className="campos">
        <CampoSecreto valor={contrasena} onCambio={setContrasena} nuevo autoFocus placeholder="Contraseña maestra (12 caracteres o más)" />
        <MedidorFortaleza valor={contrasena} />
        <CampoSecreto valor={repetida} onCambio={setRepetida} nuevo placeholder="Repítela" />
        <label className="bov-check">
          <input type="checkbox" checked={entendido} onChange={e => setEntendido(e.target.checked)} />
          Entiendo que si se pierde la contraseña maestra no hay forma de recuperar lo guardado.
        </label>
      </div>
      {error && <div className="bov-error">{error}</div>}
      <button className="btn acento" disabled={creando}>{creando ? 'Creando…' : 'Crear bóveda'}</button>
      <div className="bov-sello"><ShieldCheck size={14} /> Una frase de 4 o 5 palabras sueltas es fácil de recordar y muy difícil de adivinar.</div>
    </form>
  )
}
