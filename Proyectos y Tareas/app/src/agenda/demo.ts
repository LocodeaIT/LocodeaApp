/**
 * Calendarios de ejemplo para el modo demostración: Marco, Jesús y Alejandro
 * han compartido el suyo; Juan Ángel todavía no. Los correos de los clientes
 * son los de la semilla del CRM, para que las reuniones se casen con sus
 * fichas igual que con datos reales.
 */
import type { CalendarioVisible, EventoAgenda, FuenteAgenda } from './tipos'
import { asistentesDe, miembroDelCalendario } from './vincular'
import { normalizar } from '../crm/formato'

const COMPARTIDOS = ['marco', 'jesus', 'alejandro']

/** Lunes de esta semana a las 00:00, hora local. */
function lunes(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return d
}

type Ejemplo = [dia: number, hora: string, min: number, titulo: string, organiza: string, asistentes: string, lugar: string]

// día relativo al lunes de esta semana, hora, duración, asunto, quién organiza (nombre de pila), asistentes
const EJEMPLOS: Ejemplo[] = [
  [-7, '10:00', 60, 'Demo de partes de trabajo', 'marco', 'pedro@instalaciones.es', 'Microsoft Teams'],
  [-5, '12:30', 45, 'Seguimiento cuadro de mando', 'jesus', 'elena@distribuciones.es', 'Microsoft Teams'],
  [-3, '09:30', 90, 'Kick-off portal de pedidos', 'jesus', 'marcos.herrero@ortoalresa.com;alejandro@locodea.com', 'Ajalvir, oficinas de OrtoAlresa'],
  [0, '09:00', 30, 'Daily Locodea', 'jesus', 'marco@locodea.com;alejandro@locodea.com;juanangel@locodea.com', 'Microsoft Teams'],
  [0, '11:00', 60, 'Primera llamada · altas de empleados en Teams', 'alejandro', 'nuria@clinica.es', 'Microsoft Teams'],
  [1, '16:00', 60, 'Revisión del agente de atención', 'jesus', 'carla@seguros.es;marco@locodea.com', 'Microsoft Teams'],
  [2, '10:30', 60, 'Taller Power Apps con el equipo TIC', 'alejandro', 'carmen.arnaiz@colegiolasencinas.es;javier.ortega@colegiolasencinas.es', 'Colegio Las Encinas'],
  [2, '17:00', 30, 'Llamada con un posible cliente', 'marco', 'direccion@ferreteriaquintana.es', 'Teléfono'],
  [3, '12:00', 45, 'Chatbot intranet municipal', 'marco', 'sofia@ayuntamiento.es;jesus@locodea.com', 'Ayuntamiento de Ribera'],
  [4, '09:30', 60, 'Comité de propuestas', 'alejandro', 'marco@locodea.com;jesus@locodea.com', 'Oficina'],
  [4, '13:00', 60, 'Comida con Gimnasio Forma 10', 'marco', 'ruben.castano@forma10.es', 'Vitoria-Gasteiz'],
  [7, '10:00', 60, 'Presentación de la propuesta de migración', 'alejandro', 'andres@asesoria.es;jesus@locodea.com', 'Microsoft Teams'],
  [8, '11:30', 60, 'Revisión trimestral Anka', 'marco', 'compras@anka.es', 'Barcelona'],
  [10, '16:00', 45, 'Seguimiento facturación', 'jesus', 'contabilidad@udia.es', 'Microsoft Teams'],
  [14, '10:00', 60, 'Cancelado: Demo Bodegas Val de Oca', 'jesus', 'enologia@valdeoca.wine', 'Haro'],
]

export const fuenteDemo: FuenteAgenda = {
  async calendarios(miembros) {
    await new Promise(r => setTimeout(r, 300))
    const otros: CalendarioVisible[] = [
      { id: 'cal-admin', nombre: 'Calendario', propietario: 'admin@locodea.com', miembroId: null },
      // compartido también, pero es de Ortoalresa: no se lee
      { id: 'cal-ortoalresa', nombre: 'Jesús Alonso', propietario: 'jesus.alonso@ortoalresa.com', miembroId: miembroDelCalendario('jesus.alonso@ortoalresa.com', miembros) },
    ]
    return otros.concat(miembros
      .filter(m => COMPARTIDOS.includes(normalizar(m.nombre.split(' ')[0])))
      .map(m => ({ id: 'cal-' + m.id, nombre: m.nombre, propietario: m.email, miembroId: miembroDelCalendario(m.email, miembros) })))
  },

  async eventos(cal, desde, hasta, internos) {
    if (!cal.miembroId) return []
    const base = lunes()
    const quien = cal.propietario.toLowerCase()
    return EJEMPLOS.map(([dia, hora, min, titulo, organiza, otros, lugar], i) => {
      const ini = new Date(base)
      ini.setDate(ini.getDate() + dia)
      const [h, m] = hora.split(':').map(Number)
      ini.setHours(h, m)
      const org = organiza + '@locodea.com'
      return {
        id: `demo-${i}`, titulo: titulo.replace(/^Cancelado:\s*/, ''), inicio: ini.toISOString(), fin: new Date(ini.getTime() + min * 60000).toISOString(),
        todoElDia: false, lugar, enlace: '', organizador: org,
        asistentes: asistentesDe([org, otros], internos), cancelado: titulo.startsWith('Cancelado:'),
      } satisfies Omit<EventoAgenda, 'miembrosIds'>
    }).filter(e => e.inicio >= desde && e.inicio < hasta && e.asistentes.some(a => a.email === quien))
  },
}
