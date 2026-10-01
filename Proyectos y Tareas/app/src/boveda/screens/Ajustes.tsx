/**
 * Ajustes de la bóveda abierta: bloqueo automático y cambio de contraseña
 * maestra (solo se vuelve a envolver la clave; los elementos no se tocan).
 */
import { useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { Campo, Modal, Segmentado } from '../../ui/basicos'
import { fechaHora } from '../../domain/fechas'
import { OPCIONES_BLOQUEO, useBoveda } from '../store'
import { ContrasenaIncorrecta } from '../cripto'
import { maestraValida } from '../generador'
import { CampoSecreto, MedidorFortaleza } from './comunes'

export function ModalAjustes({ onCerrar }: { onCerrar: () => void }) {
  const { abierta, minutosBloqueo, setMinutosBloqueo, cambiarMaestra } = useBoveda()
  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [repetida, setRepetida] = useState('')
  const [cambiando, setCambiando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (!abierta) return null

  const cambiar = async () => {
    const problema = !actual ? 'Escribe la contraseña maestra actual.' : maestraValida(nueva) ?? (nueva !== repetida ? 'Las dos contraseñas nuevas no coinciden.' : nueva === actual ? 'La nueva es igual que la actual.' : null)
    if (problema) { setError(problema); return }
    setCambiando(true)
    setError(null)
    try {
      await cambiarMaestra(actual, nueva)
      onCerrar()
    } catch (e) {
      setError(e instanceof ContrasenaIncorrecta ? 'La contraseña maestra actual no es correcta.' : e instanceof Error ? e.message : 'No se pudo cambiar')
    } finally {
      setCambiando(false)
    }
  }

  return (
    <Modal titulo="Ajustes de la bóveda" onCerrar={onCerrar}>
      <div className="formulario bov-ajustes">
        <div>
          <div className="titulo-seccion">Bloqueo automático</div>
          <p className="bov-nota">Se cierra sola tras este tiempo sin tocar la app. Vale para este navegador.</p>
          <Segmentado etiqueta="Minutos" valor={String(minutosBloqueo)} opciones={OPCIONES_BLOQUEO.map(m => ({ valor: String(m), etiqueta: `${m} min` }))} onCambio={v => setMinutosBloqueo(Number(v))} />
        </div>

        <hr />

        <div className="titulo-seccion">Cambiar la contraseña maestra</div>
        <p className="bov-nota">
          {abierta.tipo === 'equipo'
            ? 'Al cambiarla, el resto del equipo tendrá que usar la nueva. Hazlo si alguien deja Locodea o si sospechas que se ha filtrado.'
            : 'Hazlo si sospechas que alguien la ha visto.'}
        </p>
        <Campo label="Contraseña maestra actual"><CampoSecreto valor={actual} onCambio={setActual} /></Campo>
        <Campo label="Nueva"><CampoSecreto valor={nueva} onCambio={setNueva} nuevo /></Campo>
        <MedidorFortaleza valor={nueva} />
        <Campo label="Repite la nueva"><CampoSecreto valor={repetida} onCambio={setRepetida} nuevo /></Campo>
        {error && <div className="error-formulario">{error}</div>}
        <div><button className="btn acento" onClick={() => void cambiar()} disabled={cambiando}>{cambiando ? 'Cambiando…' : 'Cambiar contraseña maestra'}</button></div>

        <div className="bov-ficha-tecnica">
          <ShieldCheck size={15} />
          <span>{abierta.nombre} · creada el {fechaHora(abierta.creadoEl)}{abierta.actualizadoEl && <> · maestra cambiada el {fechaHora(abierta.actualizadoEl)}</>}<br />
            PBKDF2-SHA256 con {abierta.iteraciones.toLocaleString('es-ES')} iteraciones · AES-256-GCM · cada elemento con su propio vector aleatorio</span>
        </div>
      </div>
    </Modal>
  )
}
