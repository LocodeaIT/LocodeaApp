import { useApp } from '../store'
import { Avatar } from '../ui/basicos'
import { Logo } from '../ui/Logo'

/**
 * Entrada: se elige quién eres.
 *
 * El logo entra por piezas —cuerpo, cabeza y brazo— y las personas aparecen
 * escalonadas detrás. Es la primera pantalla que ve el equipo cada mañana, así
 * que se le ha dado algo de carácter sin que estorbe: nada bloquea el clic.
 */
export default function Login() {
  const { datos, entrarComo } = useApp()
  const activos = datos.miembros.filter(m => m.activo)

  return (
    <div className="login">
      <div className="login-caja">
        <div className="login-logo"><Logo tamano={104} animado /></div>

        <h1 className="login-marca">locodea<em>.</em><span>App</span></h1>
        <p className="login-lema">Objetivos, tareas y reuniones del equipo</p>

        <div className="login-personas">
          {activos.map((m, i) => (
            <button key={m.id} className="login-persona" style={{ animationDelay: `${420 + i * 70}ms` }}
              onClick={() => entrarComo(m.id)}>
              <Avatar miembro={m} tamano="grande" />
              <span className="datos"><b>{m.nombre}</b></span>
              <span className="flecha" aria-hidden>→</span>
            </button>
          ))}
        </div>

        <p className="login-pie">Elige quién eres para entrar</p>
      </div>
    </div>
  )
}
