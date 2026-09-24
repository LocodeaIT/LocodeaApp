import { useMemo, useState, lazy, Suspense } from 'react'
import {
  BarChart3, Bot, CalendarDays, Check, ChevronRight, ChevronsUpDown, FileText, FolderKanban, Home, KanbanSquare, LogOut, Megaphone,
  PanelLeftClose, PanelLeftOpen, RefreshCw, Search, Target, Users,
} from 'lucide-react'
import { useApp, type Pantalla } from './store'
import { Avatar, Avisos, Confirmador, Desplegable } from './ui/basicos'
import { Logo, Wordmark } from './ui/Logo'
import { esVencida, lunesDe, hoy } from './domain/fechas'
import { useCrm } from './crm/contexto'
import { esPantallaCrm } from './crm/navegacion'
import { buscarEnCrm } from './crm/busqueda'
import { NavCrm, ResultadosCrm, migasCrm } from './crm/NavCrm'
import { esPantallaGestion } from './gestion/navegacion'
import { NavGestion, migasGestion } from './gestion/NavGestion'
// Carga diferida: cada pantalla es su propio paquete, asi el arranque no
// arrastra los graficos ni las vistas que todavia no se han abierto.
const Inicio = lazy(() => import('./screens/Inicio'))
const Objetivos = lazy(() => import('./screens/Objetivos'))
const Tareas = lazy(() => import('./screens/tareas/Tareas'))
const Proyectos = lazy(() => import('./screens/Proyectos'))
const Analisis = lazy(() => import('./screens/Analisis'))
const Informes = lazy(() => import('./screens/Informes'))
const Equipo = lazy(() => import('./screens/Equipo'))
const Reuniones = lazy(() => import('./screens/Reuniones'))
const PantallaCrm = lazy(() => import('./crm/screens/PantallaCrm'))
const PantallaGestion = lazy(() => import('./gestion/screens/PantallaGestion'))
const Contenido = lazy(() => import('./screens/Contenido'))
const SkillsIA = lazy(() => import('./screens/SkillsIA'))
import Login from './screens/Login'
import { DetalleTarea } from './screens/DetalleTarea'
import { MiDiaFlotante } from './screens/MiDia'

const NAV: { id: Pantalla; nombre: string; icono: typeof Home; seccion?: string }[] = [
  { id: 'inicio', nombre: 'Inicio', icono: Home },
  { id: 'objetivos', nombre: 'Objetivos semanales', icono: Target, seccion: 'Equipo' },
  { id: 'tareas', nombre: 'Tareas', icono: KanbanSquare },
  { id: 'proyectos', nombre: 'Proyectos', icono: FolderKanban },
  { id: 'skills', nombre: 'Skills y agentes de IA', icono: Bot },
  { id: 'reuniones', nombre: 'Reuniones', icono: CalendarDays, seccion: 'Seguimiento' },
  { id: 'contenido', nombre: 'Contenido', icono: Megaphone },
  { id: 'analisis', nombre: 'Análisis', icono: BarChart3 },
  { id: 'informes', nombre: 'Informes', icono: FileText },
  { id: 'equipo', nombre: 'Equipo', icono: Users },
]

export default function App() {
  const { cargando, error, yo, datos, pantalla, setPantalla, entrarComo, salir, recargar } = useApp()
  const [colapsada, setColapsada] = useState(false)
  const [menu, setMenu] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [tareaAbierta, setTareaAbierta] = useState<string | null>(null)

  const contadores = useMemo(() => {
    if (!yo) return {} as Partial<Record<Pantalla, number>>
    const semana = datos.semanas.find(s => s.inicio === lunesDe(hoy()))
    const mios = semana ? datos.objetivos.filter(o => o.semanaId === semana.id && o.responsableId === yo.id && o.estado === 'pendiente').length : 0
    const vencidas = datos.tareas.filter(t => t.estado !== 'hecha' && esVencida(t.vence) && !t.personal && !t.padreId).length
    return { objetivos: mios, tareas: vencidas }
  }, [datos, yo])

  if (cargando) {
    return <div className="carga"><div className="interior"><div className="spinner" /><span>Cargando Locodea…</span></div></div>
  }
  if (error) {
    return <div className="carga"><div className="interior"><b>No se pudieron cargar los datos</b><span>{error}</span><button className="btn primario" onClick={() => void recargar()}>Reintentar</button></div></div>
  }
  if (!yo) return <Login />

  const pantallaActiva: Pantalla = pantalla === 'midia' ? 'inicio' : pantalla
  const Pantalla = esPantallaCrm(pantallaActiva) || esPantallaGestion(pantallaActiva) ? null : { inicio: Inicio, objetivos: Objetivos, tareas: Tareas, reuniones: Reuniones, contenido: Contenido, skills: SkillsIA, proyectos: Proyectos, analisis: Analisis, informes: Informes, equipo: Equipo }[pantallaActiva]
  const migas = migasDe(pantallaActiva)

  return (
    <div className={`app ${colapsada ? 'plegada' : ''}`}>
      <aside className="lateral no-imprimir">
        <div className="lateral-marca">
          <button className="marca-boton" onClick={() => setPantalla('inicio')} title="Ir al inicio">
            <Wordmark producto="App" />
            {/* con el menú plegado no cabe la palabra: va el símbolo, como en los sitios cuadrados */}
            <Logo tamano={30} className="marca-simbolo" />
          </button>
        </div>

        <nav className="nav">
          {NAV.map(n => (
            <div key={n.id}>
              {n.seccion && <div className="nav-seccion">{n.seccion}</div>}
              <button className={`nav-item ${pantallaActiva === n.id ? 'activo' : ''}`} onClick={() => setPantalla(n.id)} title={n.nombre}>
                <n.icono size={18} /><span>{n.nombre}</span>
                {!!contadores[n.id] && <span className={`contador ${n.id === 'tareas' ? 'gris' : ''}`}>{contadores[n.id]}</span>}
              </button>
            </div>
          ))}
          <NavCrm pantallaActiva={pantallaActiva} />
          <NavGestion pantallaActiva={pantallaActiva} />
        </nav>

        <div className="lateral-pie">
          <Desplegable abierto={menu} setAbierto={setMenu} boton={
            <button className="yo" onClick={() => setMenu(m => !m)} title="Cambiar de usuario o cerrar sesión">
              <Avatar miembro={yo} />
              <div className="yo-texto"><div className="yo-nombre">{yo.nombre}</div><div className="yo-cargo">{yo.rol === 'socio' ? 'Socio' : 'Colaborador'}</div></div>
              <ChevronsUpDown size={15} className="yo-chev" />
            </button>
          }>
            <div className="cabecera-menu">Cambiar de usuario</div>
            {datos.miembros.filter(m => m.activo).map(m => (
              <button key={m.id} className={`item ${m.id === yo.id ? 'activo' : ''}`} onClick={() => { entrarComo(m.id); setMenu(false) }}>
                <Avatar miembro={m} tamano="pequeno" /><span style={{ flex: 1 }}>{m.nombre}</span>{m.id === yo.id && <Check size={14} />}
              </button>
            ))}
            <hr />
            <button className="item" onClick={() => { void recargar(); setMenu(false) }}><RefreshCw size={14} /> Recargar datos</button>
            <button className="item" onClick={() => { setMenu(false); salir() }}><LogOut size={14} /> Cerrar sesión</button>
          </Desplegable>
          <button className="nav-item plegar" onClick={() => setColapsada(c => !c)} title={colapsada ? 'Desplegar menú' : 'Plegar menú'}>
            {colapsada ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}<span>Plegar menú</span>
          </button>
        </div>
      </aside>

      <div className="principal">
        <header className="cabecera no-imprimir">
          <nav className="migas" aria-label="Estás en">
            {migas.seccion && <><span>{migas.seccion}</span><ChevronRight size={14} /></>}
            <b>{migas.nombre}</b>
          </nav>
          <div className="buscador">
            <Search size={16} />
            <input placeholder="Buscar tareas, objetivos, proyectos…" value={busqueda} onChange={e => setBusqueda(e.target.value)} />
            {busqueda.trim() && <ResultadosBusqueda texto={busqueda} onAbrirTarea={id => { setTareaAbierta(id); setBusqueda('') }} onIr={p => { setPantalla(p); setBusqueda('') }} />}
          </div>
        </header>

        <main className="contenido" key={pantallaActiva}>
          <Suspense fallback={<div className="carga"><div className="spinner" /></div>}>
            {Pantalla ? <Pantalla abrirTarea={setTareaAbierta} /> : esPantallaGestion(pantallaActiva) ? <PantallaGestion /> : <PantallaCrm />}
          </Suspense>
        </main>
      </div>

      <MiDiaFlotante abrirTarea={setTareaAbierta} />
      {tareaAbierta && <DetalleTarea id={tareaAbierta} onCerrar={() => setTareaAbierta(null)} onAbrirOtra={setTareaAbierta} />}
      <Avisos />
      <Confirmador />
    </div>
  )
}

/** Sección y nombre de la pantalla activa, para las migas de la barra superior. */
function migasDe(id: Pantalla): { seccion?: string; nombre: string } {
  const crm = migasCrm(id)
  if (crm) return crm
  const gestion = migasGestion(id)
  if (gestion) return gestion
  const i = NAV.findIndex(n => n.id === id)
  if (i < 0) return { nombre: 'Inicio' }
  const seccion = NAV.slice(0, i + 1).reverse().find(n => n.seccion)?.seccion
  return { seccion, nombre: NAV[i].nombre }
}

function ResultadosBusqueda({ texto, onAbrirTarea, onIr }: { texto: string; onAbrirTarea: (id: string) => void; onIr: (p: Pantalla) => void }) {
  const { datos, proyecto } = useApp()
  const q = texto.toLowerCase()
  const tareas = datos.tareas.filter(t => t.titulo.toLowerCase().includes(q)).slice(0, 6)
  const objetivos = datos.objetivos.filter(o => o.titulo.toLowerCase().includes(q)).slice(0, 4)
  const proyectos = datos.proyectos.filter(p => p.nombre.toLowerCase().includes(q) || p.cliente.toLowerCase().includes(q)).slice(0, 3)
  const crm = useCrm()
  const enCrm = crm.disponible ? buscarEnCrm(crm.datos, texto) : []
  return (
    <div className="menu-flotante" style={{ left: 0, right: 0, minWidth: 0 }}>
      {!tareas.length && !objetivos.length && !proyectos.length && !enCrm.length && <div className="item" style={{ color: 'var(--texto-3)' }}>Sin resultados</div>}
      {tareas.length > 0 && <div className="cabecera-menu">Tareas</div>}
      {tareas.map(t => <button key={t.id} className="item" onClick={() => onAbrirTarea(t.id)}><KanbanSquare size={14} /><span style={{ flex: 1 }}>{t.titulo}</span><small style={{ color: 'var(--texto-3)' }}>{proyecto(t.proyectoId)?.nombre}</small></button>)}
      {objetivos.length > 0 && <div className="cabecera-menu">Objetivos</div>}
      {objetivos.map(o => <button key={o.id} className="item" onClick={() => onIr('objetivos')}><Target size={14} /><span>{o.titulo}</span></button>)}
      {proyectos.length > 0 && <div className="cabecera-menu">Proyectos</div>}
      {proyectos.map(p => <button key={p.id} className="item" onClick={() => onIr('proyectos')}><i className="punto-proyecto" style={{ background: p.color }} /><span>{p.nombre}</span><small style={{ color: 'var(--texto-3)' }}>{p.cliente}</small></button>)}
      <ResultadosCrm resultados={enCrm} onElegido={onIr} />
    </div>
  )
}
