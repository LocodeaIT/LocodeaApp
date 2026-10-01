/**
 * Bóveda: contraseñas, claves API y notas seguras del equipo y de cada uno.
 * Cerrada enseña cómo abrirla (o crearla); abierta, la lista con su ficha, la
 * salud de las contraseñas y las herramientas (generador, ajustes, bloquear).
 */
import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CodeXml, KeyRound, Lock, LockKeyhole, Plus, Search, Settings2, ShieldCheck, Star, StickyNote, WandSparkles } from 'lucide-react'
import { Anillo, Segmentado, Vacio, confirmar } from '../../ui/basicos'
import { useBoveda } from '../store'
import type { Elemento, TipoBoveda, TipoElemento } from '../types'
import { calcularSalud, dominio } from '../calculos'
import { Desbloqueo } from './Desbloqueo'
import { Detalle } from './Detalle'
import { ModalElemento } from './ModalElemento'
import { ModalGenerador } from './Generador'
import { ModalAjustes } from './Ajustes'
import { CuentaAtras, Monograma } from './comunes'

type Filtro = 'todo' | TipoElemento | 'favoritos' | 'revisar'

const ICONO_TIPO: Record<TipoElemento, typeof KeyRound> = { login: KeyRound, api: CodeXml, nota: StickyNote }

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`

const quitarTildes = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

function subtitulo(e: Elemento): string {
  if (e.tipo === 'login') return e.usuario || dominio(e.url) || 'Sin usuario'
  if (e.tipo === 'api') return [e.entorno && { produccion: 'Producción', pruebas: 'Pruebas', desarrollo: 'Desarrollo' }[e.entorno], dominio(e.url)].filter(Boolean).join(' · ') || 'Clave API'
  return 'Nota segura'
}

export default function PantallaBoveda() {
  const b = useBoveda()
  const [tipo, setTipo] = useState<TipoBoveda>(() => b.abierta?.tipo ?? 'equipo')

  useEffect(() => { if (!b.cargado) void b.cargar() }, [b])

  if (!b.disponible) {
    return (
      <div className="pagina">
        <div className="tarjeta padded">
          <Vacio icono={<LockKeyhole size={36} />} titulo="La bóveda aún no tiene tablas en Dataverse" texto="Llegará en cuanto existan sus tablas en el entorno (scripts/boveda-esquema.mjs)." />
        </div>
      </div>
    )
  }
  if (b.error && !b.cargado) {
    return (
      <div className="pagina">
        <div className="tarjeta padded">
          <Vacio icono={<LockKeyhole size={36} />} titulo="No se pudo cargar la bóveda" texto={b.error} accion={<button className="btn primario pequeno" onClick={() => void b.cargar()}>Reintentar</button>} />
        </div>
      </div>
    )
  }
  if (!b.cargado) return <div className="carga"><div className="spinner" /></div>

  const cambiarTipo = (t: TipoBoveda) => {
    if (b.abierta && b.abierta.tipo !== t) b.bloquear()
    setTipo(t)
  }
  const abiertaAqui = b.abierta && b.abierta.tipo === tipo ? b.abierta : null

  return (
    <div className="pagina bov">
      <div className="titulo-pagina">
        <div>
          <h1>Bóveda.</h1>
          <div className="sub">
            {abiertaAqui
              ? <>Abierta · se cierra sola en <b className="bov-reloj"><CuentaAtras hasta={b.bloqueaEn} /></b> sin actividad.</>
              : 'Contraseñas, claves API y notas seguras, cifradas en tu navegador antes de guardarse.'}
          </div>
        </div>
        <div className="acciones">
          <Segmentado etiqueta="Bóveda" valor={tipo} opciones={[{ valor: 'equipo', etiqueta: 'Equipo' }, { valor: 'personal', etiqueta: 'Personal' }]} onCambio={cambiarTipo} />
          {abiertaAqui && <AccionesAbierta />}
        </div>
      </div>

      {abiertaAqui ? <Abierta /> : <Desbloqueo tipo={tipo} boveda={b.bovedaDe(tipo)} />}
    </div>
  )
}

function AccionesAbierta() {
  const { bloquear } = useBoveda()
  const [generador, setGenerador] = useState(false)
  const [ajustes, setAjustes] = useState(false)
  return (
    <>
      <button className="btn sutil" onClick={() => setGenerador(true)}><WandSparkles size={16} /> Generador</button>
      <button className="btn sutil icono" onClick={() => setAjustes(true)} title="Ajustes de la bóveda" aria-label="Ajustes"><Settings2 size={17} /></button>
      <button className="btn primario" onClick={bloquear} title="Cerrar la bóveda ahora"><Lock size={15} /> Bloquear</button>
      {generador && <ModalGenerador onCerrar={() => setGenerador(false)} />}
      {ajustes && <ModalAjustes onCerrar={() => setAjustes(false)} />}
    </>
  )
}

function Abierta() {
  const { abierta, elementos, ilegibles, guardar, borrar } = useBoveda()
  const [filtro, setFiltro] = useState<Filtro>('todo')
  const [texto, setTexto] = useState('')
  const [seleccion, setSeleccion] = useState<string | null>(null)
  const [editando, setEditando] = useState<Elemento | 'nuevo' | null>(null)

  const salud = useMemo(() => calcularSalud(elementos), [elementos])

  const visibles = useMemo(() => {
    const q = quitarTildes(texto.trim())
    return elementos
      .filter(e => filtro === 'todo' ? true : filtro === 'favoritos' ? e.favorito : filtro === 'revisar' ? salud.problemas.has(e.id) : e.tipo === filtro)
      .filter(e => !q || quitarTildes(`${e.titulo} ${e.usuario} ${e.url} ${e.etiquetas.join(' ')} ${e.campos.map(c => c.oculto ? c.nombre : `${c.nombre} ${c.valor}`).join(' ')}`).includes(q))
      .sort((a, b) => Number(b.favorito) - Number(a.favorito))
  }, [elementos, filtro, texto, salud])

  const actual = visibles.find(e => e.id === seleccion) ?? visibles[0] ?? null

  // atajo: «/» enfoca el buscador, como en el resto de herramientas
  useEffect(() => {
    const h = (ev: KeyboardEvent) => {
      if (ev.key === '/' && !(ev.target instanceof HTMLInputElement || ev.target instanceof HTMLTextAreaElement)) {
        ev.preventDefault()
        document.getElementById('bov-buscar')?.focus()
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  if (!abierta) return null

  const n = (t: TipoElemento) => elementos.filter(e => e.tipo === t).length
  const revisar = salud.problemas.size
  const FILTROS: { valor: Filtro; etiqueta: string }[] = [
    { valor: 'todo', etiqueta: 'Todo' },
    { valor: 'login', etiqueta: 'Contraseñas' },
    { valor: 'api', etiqueta: 'Claves API' },
    { valor: 'nota', etiqueta: 'Notas' },
    { valor: 'favoritos', etiqueta: 'Favoritos' },
    { valor: 'revisar', etiqueta: revisar ? `Revisar · ${revisar}` : 'Revisar' },
  ]

  const eliminar = async (e: Elemento) => {
    if (!(await confirmar(`¿Borrar «${e.titulo}» de la bóveda?`, { texto: 'Se borra para todos los que usan esta bóveda y no se puede deshacer.', aceptar: 'Borrar', peligro: true }))) return
    await borrar(e.id)
    setEditando(null)
    setSeleccion(null)
  }

  return (
    <>
      <div className="kpis bov-kpis">
        <div className="tarjeta kpi anim-aparecer retraso-1">
          <div className="etiqueta"><span className="ico"><LockKeyhole size={14} /></span>En la bóveda</div>
          <div className="valor">{elementos.length}</div>
          <div className="pie">{plural(n('login'), 'contraseña', 'contraseñas')} · {plural(n('api'), 'clave API', 'claves API')} · {plural(n('nota'), 'nota', 'notas')}</div>
        </div>
        <div className="tarjeta kpi bov-kpi-salud anim-aparecer retraso-2">
          <div>
            <div className="etiqueta"><span className="ico"><ShieldCheck size={14} /></span>Salud</div>
            <div className="valor">{salud.puntuacion}<small>%</small></div>
            <div className={`pie ${salud.puntuacion >= 90 ? 'ok' : salud.puntuacion < 60 ? 'mal' : ''}`}>{salud.conSecreto ? `${salud.conSecreto - revisar} de ${salud.conSecreto} sin problemas` : 'aún no hay contraseñas'}</div>
          </div>
          <Anillo pct={salud.puntuacion} tamano={58} color={salud.puntuacion >= 90 ? 'var(--ok)' : salud.puntuacion < 60 ? 'var(--danger)' : 'var(--bronze)'} />
        </div>
        <div className="tarjeta kpi anim-aparecer retraso-3">
          <div className="etiqueta"><span className="ico"><AlertTriangle size={14} /></span>Débiles o repetidas</div>
          <div className={`valor ${salud.debiles + salud.repetidas ? 'neg' : ''}`}>{salud.debiles + salud.repetidas}</div>
          <div className={`pie ${salud.debiles + salud.repetidas ? 'mal' : 'ok'}`}>{salud.debiles + salud.repetidas ? `${plural(salud.debiles, 'débil', 'débiles')} · ${plural(salud.repetidas, 'repetida', 'repetidas')}` : 'ninguna'}</div>
        </div>
        <div className="tarjeta kpi anim-aparecer retraso-4">
          <div className="etiqueta"><span className="ico"><CodeXml size={14} /></span>Claves que caducan</div>
          <div className="valor">{salud.caducan}</div>
          <div className={`pie ${salud.caducan ? 'mal' : ''}`}>{salud.caducan ? 'en 30 días o ya caducadas' : 'ninguna en los próximos 30 días'}</div>
        </div>
      </div>

      {ilegibles > 0 && <div className="bov-aviso-ilegibles"><AlertTriangle size={15} /> {ilegibles} {ilegibles === 1 ? 'elemento no se ha podido' : 'elementos no se han podido'} descifrar con esta clave. No se ha borrado nada.</div>}

      <div className="bov-cuerpo">
        <div className="tarjeta bov-lista">
          <div className="herramientas">
            <label className="buscar"><Search size={15} /><input id="bov-buscar" placeholder="Buscar…  ( / )" value={texto} onChange={ev => setTexto(ev.target.value)} autoComplete="off" spellCheck={false} /></label>
            <button className="btn acento pequeno" onClick={() => setEditando('nuevo')}><Plus size={15} /> Nuevo</button>
          </div>
          <div className="filtros" role="tablist">
            {FILTROS.map(f => <button key={f.valor} role="tab" aria-selected={filtro === f.valor} className={`bov-toggle ${filtro === f.valor ? 'activo' : ''} ${f.valor === 'revisar' && revisar ? 'alerta' : ''}`} onClick={() => setFiltro(f.valor)}>{f.etiqueta}</button>)}
          </div>
          <div className="elementos">
            {visibles.length === 0 && (
              elementos.length === 0
                ? <Vacio icono={<KeyRound size={32} />} titulo="La bóveda está vacía" texto="Guarda aquí la primera contraseña o clave API." accion={<button className="btn acento pequeno" onClick={() => setEditando('nuevo')}><Plus size={15} /> Añadir</button>} />
                : <Vacio icono={<Search size={32} />} titulo="Nada con estos filtros" />
            )}
            {visibles.map(e => {
              const Icono = ICONO_TIPO[e.tipo]
              const problemas = salud.problemas.get(e.id)
              return (
                <button key={e.id} className={`bov-item ${actual?.id === e.id ? 'activo' : ''}`} onClick={() => setSeleccion(e.id)} onDoubleClick={() => setEditando(e)}>
                  <Monograma texto={e.titulo} />
                  <span className="textos">
                    <b>{e.titulo}</b>
                    <small><Icono size={12} /> {subtitulo(e)}</small>
                  </span>
                  {problemas && <span className="bov-punto" title={problemas.length === 1 ? 'Hay algo que revisar' : 'Hay cosas que revisar'} />}
                  {e.favorito && <Star size={14} className="bov-fav" />}
                </button>
              )
            })}
          </div>
        </div>

        <div className="tarjeta bov-detalle">
          {actual
            ? <Detalle e={actual} problemas={salud.problemas.get(actual.id) ?? []} onEditar={() => setEditando(actual)} onFavorito={() => void guardar({ ...actual, favorito: !actual.favorito })} />
            : <Vacio icono={<LockKeyhole size={36} />} titulo="Elige un elemento" texto="Su ficha aparece aquí." />}
        </div>
      </div>

      {editando && (
        <ModalElemento
          inicial={editando === 'nuevo' ? null : editando}
          bovedaId={abierta.id}
          onCerrar={() => setEditando(null)}
          onGuardar={async e => { const g = await guardar(e); setSeleccion(g.id); setEditando(null) }}
          onBorrar={eliminar}
        />
      )}
    </>
  )
}
