/**
 * Tarifas de la calculadora de precios (menú Catálogo): precios por
 * herramienta, multiplicadores de complejidad, recargos de integración,
 * mantenimiento, tramos de trabajadores y facturación, países, plazo,
 * relación y reglas. Se edita un borrador y «Guardar» crea una versión nueva
 * para todo el equipo. Solo los socios guardan; el resto ve las tarifas.
 * A la derecha, un ejemplo recalcula el precio con lo que se está editando.
 */
import { useMemo, useState } from 'react'
import { Calculator, Plus, RotateCcw, Save, Upload, X } from 'lucide-react'
import { useApp } from '../../store'
import { Modal, confirmar } from '../../ui/basicos'
import { fecha } from '../../crm/formato'
import { nuevoId } from '../../data/repo'
import {
  SECCIONES, TARIFAS_INICIALES, calcular, desdeCalculadoraWeb, normalizarTarifas, type Calculo, type Factor, type HerramientaTarifa, type Seccion, type Tarifas,
} from '../motor'
import { useTarifas } from '../store'
import { ResumenPrecio } from './Calculadora'
import '../tarifas.css'

/** Proyecto de ejemplo para ver el efecto de los cambios. */
const EJEMPLO: Calculo = {
  empleados: '11–50', facturacion: '2a10m', pais: 'ES', plazo: 'estandar', relacion: 'grupo2', programas: 1,
  mantenimiento: { incluido: true, meses: 12, cuotaPactada: null },
  lineas: [
    { herramientaId: 'apps', cantidad: 2, complejidad: 'media', integracion: 'ninguna' },
    { herramientaId: 'automate', cantidad: 3, complejidad: 'baja', integracion: 'api' },
    { herramientaId: 'bi', cantidad: 1, complejidad: 'media', integracion: 'ninguna' },
    { herramientaId: 'migracion', cantidad: 1, complejidad: 'media', integracion: 'ninguna' },
    { herramientaId: 'formacion', cantidad: 4, complejidad: 'media', integracion: 'ninguna' },
  ],
}

const num = (v: string) => { const n = parseFloat(v.replace(',', '.')); return Number.isFinite(n) ? n : 0 }

export default function PantallaTarifas() {
  const { datos } = useApp()
  const { tarifas, version, cargando, disponible, puedeEditar, guardar } = useTarifas()
  const [borrador, setBorrador] = useState<Tarifas>(() => normalizarTarifas(tarifas))
  const [base, setBase] = useState(tarifas)
  const [importar, setImportar] = useState(false)
  // si llegan otras tarifas (carga inicial, guardado de otro) y no hay cambios, se recargan
  const sucio = JSON.stringify(borrador) !== JSON.stringify(normalizarTarifas(base))
  if (tarifas !== base && !sucio) { setBase(tarifas); setBorrador(normalizarTarifas(tarifas)) }

  const r = useMemo(() => calcular(borrador, EJEMPLO), [borrador])
  const cambiar = (x: Partial<Tarifas>) => setBorrador(b => ({ ...b, ...x }))
  const autor = datos.miembros.find(m => m.id === version?.autorId)?.nombre

  const guardarBorrador = async () => {
    if (await guardar(borrador)) setBase(borrador)
  }

  if (cargando) return <div className="carga"><div className="spinner" /></div>

  return (
    <div className="pagina tar-pagina">
      <div className="titulo-pagina">
        <div>
          <h1>Tarifas.</h1>
          <div className="sub">
            Precios y coeficientes de la calculadora de ofertas y pedidos. Todos los importes sin IVA.{' '}
            {version ? `Última modificación${autor ? ` por ${autor}` : ''} el ${fecha(version.creadoEl)}.` : 'Todavía no se han guardado: se usan las tarifas de partida.'}
          </div>
        </div>
        <div className="acciones">
          {sucio && <span className="chip pequeno aviso">Sin guardar</span>}
          {puedeEditar && <>
            <button className="btn sutil" onClick={() => setImportar(true)}><Upload size={15} /> Importar de la calculadora web</button>
            <button className="btn sutil" onClick={() => void confirmar('¿Volver a las tarifas de partida?', { texto: 'Se cargan en el borrador; no se guardan hasta que pulses Guardar.', aceptar: 'Cargar' }).then(ok => { if (ok) setBorrador(normalizarTarifas(TARIFAS_INICIALES)) })}>
              <RotateCcw size={15} /> Tarifas de partida
            </button>
            {sucio && <button className="btn" onClick={() => setBorrador(normalizarTarifas(base))}><X size={15} /> Descartar cambios</button>}
            <button className="btn primario" disabled={!sucio} onClick={() => void guardarBorrador()}><Save size={15} /> Guardar</button>
          </>}
        </div>
      </div>

      {!disponible && (
        <div className="tar-nota aviso">
          La tabla de tarifas aún no está en Dataverse (scripts/tarifas-esquema.mjs y añadirla como fuente de datos). Mientras tanto la calculadora usa las tarifas de partida y no se pueden guardar cambios.
        </div>
      )}
      {disponible && !puedeEditar && <div className="tar-nota">Solo los socios pueden cambiar las tarifas. Aquí puedes consultarlas.</div>}

      <div className="tar-pagina-columnas">
        <fieldset className="tar-editor" disabled={!puedeEditar}>
          <section className="tarjeta padded tar-seccion">
            <h2>Productos y precios</h2>
            <p className="tar-ayuda">Precio por unidad de complejidad media. El apartado decide dónde sale en la calculadora: solo las de desarrollo llevan integración.</p>
            <div className="tar-tabla-marco">
              <table className="tar-tabla">
                <thead><tr><th>Producto</th><th>Unidad</th><th className="num">Precio (€)</th><th>Apartado</th><th>Color</th><th /></tr></thead>
                <tbody>
                  {borrador.herramientas.map((h, i) => {
                    const fijar = (x: Partial<HerramientaTarifa>) => cambiar({ herramientas: borrador.herramientas.map((y, j) => (j === i ? { ...y, ...x } : y)) })
                    return (
                      <tr key={h.id}>
                        <td><input value={h.nombre} aria-label="Producto" onChange={e => fijar({ nombre: e.target.value })} /></td>
                        <td><input value={h.unidad} aria-label="Unidad" onChange={e => fijar({ unidad: e.target.value })} /></td>
                        <td className="num"><input type="number" min={0} step={10} value={h.precio} aria-label="Precio" onChange={e => fijar({ precio: num(e.target.value) })} /></td>
                        <td>
                          <select value={h.seccion} aria-label="Apartado" onChange={e => fijar({ seccion: e.target.value as Seccion })}>
                            {SECCIONES.map(s => <option key={s.id} value={s.id}>{s.titulo}</option>)}
                          </select>
                        </td>
                        <td><input type="color" value={h.color} aria-label="Color" onChange={e => fijar({ color: e.target.value })} /></td>
                        <td><button type="button" className="btn sutil icono pequeno" aria-label={`Quitar ${h.nombre}`} disabled={borrador.herramientas.length <= 1}
                          onClick={() => cambiar({ herramientas: borrador.herramientas.filter((_, j) => j !== i) })}><X size={14} /></button></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <button type="button" className="btn pequeno" onClick={() => cambiar({ herramientas: [...borrador.herramientas, { id: nuevoId(), nombre: 'Nuevo producto', unidad: 'unidad', precio: 0, color: '#6b6b6b', seccion: 'desarrollo' }] })}>
              <Plus size={14} /> Añadir producto
            </button>
          </section>

          <section className="tarjeta padded tar-seccion">
            <h2>Complejidad</h2>
            <EditorFactores lista={borrador.complejidad} fijo onCambio={complejidad => cambiar({ complejidad })} etiquetaF="Multiplicador" />
          </section>

          <section className="tarjeta padded tar-seccion">
            <h2>Integración</h2>
            <p className="tar-ayuda">Recargo sobre el precio de cada pieza de desarrollo que se conecta a un programa que el cliente ya usa (0,6 = +60 %).</p>
            <EditorFactores lista={borrador.integracion} fijo onCambio={integracion => cambiar({ integracion })} etiquetaF="Recargo" detalle />
            <div className="tar-reglas">
              <Regla etiqueta="Puesta en marcha por programa (€)" valor={borrador.puestaEnMarcha} onCambio={n => cambiar({ puestaEnMarcha: n })} />
            </div>
          </section>

          <section className="tarjeta padded tar-seccion">
            <h2>Mantenimiento</h2>
            <div className="tar-reglas">
              <Regla etiqueta="Cuota mensual (% del proyecto)" valor={+(borrador.mantenimiento * 100).toFixed(2)} onCambio={n => cambiar({ mantenimiento: n / 100 })} />
              <Regla etiqueta="Cuota mensual mínima (€)" valor={borrador.mantenimientoMinimo} onCambio={n => cambiar({ mantenimientoMinimo: n })} />
            </div>
          </section>

          <section className="tarjeta padded tar-seccion">
            <h2>Tamaño de la empresa</h2>
            <p className="tar-ayuda">El factor de tamaño es la media de los dos, con el peso de los trabajadores que pongas en Reglas.</p>
            <h3>Trabajadores</h3>
            <EditorFactores lista={borrador.empleados} fijo onCambio={empleados => cambiar({ empleados })} etiquetaF="Coeficiente" />
            <h3>Facturación anual</h3>
            <EditorFactores lista={borrador.facturacion} onCambio={facturacion => cambiar({ facturacion })} etiquetaF="Coeficiente" />
          </section>

          <section className="tarjeta padded tar-seccion">
            <h2>Países</h2>
            <EditorFactores lista={borrador.paises} codigo onCambio={paises => cambiar({ paises })} etiquetaF="Coeficiente" />
          </section>

          <section className="tarjeta padded tar-seccion">
            <h2>Relación y plazo</h2>
            <h3>Relación</h3>
            <EditorFactores lista={borrador.relacion} detalle onCambio={relacion => cambiar({ relacion })} etiquetaF="Coeficiente" />
            <h3>Plazo</h3>
            <EditorFactores lista={borrador.plazo} onCambio={plazo => cambiar({ plazo })} etiquetaF="Coeficiente" />
          </section>

          <section className="tarjeta padded tar-seccion">
            <h2>Reglas</h2>
            <div className="tar-reglas">
              <Regla etiqueta="Peso de los trabajadores en el tamaño (0–1)" valor={borrador.pesoEmpleados} paso={0.1} onCambio={n => cambiar({ pesoEmpleados: Math.min(1, Math.max(0, n)) })} />
              <Regla etiqueta="Precio mínimo de proyecto (€)" valor={borrador.precioMinimo} onCambio={n => cambiar({ precioMinimo: n })} />
              <Regla etiqueta="Descuento máximo negociable (%)" valor={Math.round(borrador.descuentoMaximo * 100)} onCambio={n => cambiar({ descuentoMaximo: n / 100 })} />
              <Regla etiqueta="Techo de propuesta (%)" valor={Math.round(borrador.techo * 100)} onCambio={n => cambiar({ techo: n / 100 })} />
              <Regla etiqueta="Redondeo del precio (€)" valor={borrador.redondeo} onCambio={n => cambiar({ redondeo: Math.max(1, n) })} />
            </div>
          </section>
        </fieldset>

        <aside className="tar-prueba">
          <div className="tar-prueba-titulo"><Calculator size={15} /> Ejemplo con estas tarifas</div>
          <p className="tar-ayuda">Pyme de 11–50 trabajadores y 2–10 M€ en España, Grupo 2: 2 apps, 3 flujos con API, 1 informe, 1 migración, 4 h de formación y 12 meses de mantenimiento.</p>
          <ResumenPrecio tarifas={borrador} calculo={EJEMPLO} resultado={r} />
        </aside>
      </div>

      {importar && <ModalImportar onCerrar={() => setImportar(false)} onImportar={t => { setBorrador(t); setImportar(false) }} />}
    </div>
  )
}

function Regla({ etiqueta, valor, onCambio, paso = 1 }: { etiqueta: string; valor: number; onCambio: (n: number) => void; paso?: number }) {
  return (
    <label className="tar-regla">
      <span>{etiqueta}</span>
      <input type="number" step={paso} value={valor} onChange={e => onCambio(num(e.target.value))} />
    </label>
  )
}

/**
 * Lista de opciones con su coeficiente. `fijo`: no se añaden ni se quitan
 * (las usan los cálculos guardados por su id). `codigo`: el id se edita (país).
 */
function EditorFactores({ lista, onCambio, etiquetaF, fijo, codigo, detalle }: {
  lista: Factor[]; onCambio: (l: Factor[]) => void; etiquetaF: string; fijo?: boolean; codigo?: boolean; detalle?: boolean
}) {
  const fijar = (i: number, x: Partial<Factor>) => onCambio(lista.map((f, j) => (j === i ? { ...f, ...x } : f)))
  return (
    <div className="tar-factores">
      <div className={`tar-factor cab ${codigo ? 'con-codigo' : ''} ${detalle ? 'con-detalle' : ''}`}>
        {codigo && <span>Código</span>}<span>Nombre</span>{detalle && <span>Detalle</span>}<span className="num">{etiquetaF}</span><span />
      </div>
      {lista.map((f, i) => (
        <div key={i} className={`tar-factor ${codigo ? 'con-codigo' : ''} ${detalle ? 'con-detalle' : ''}`}>
          {codigo && <input value={f.id} maxLength={3} aria-label="Código" onChange={e => fijar(i, { id: e.target.value.toUpperCase() })} />}
          <input value={f.etiqueta} aria-label="Nombre" onChange={e => fijar(i, { etiqueta: e.target.value })} />
          {detalle && <input value={f.detalle ?? ''} aria-label="Detalle" onChange={e => fijar(i, { detalle: e.target.value })} />}
          <input className="num" type="number" step={0.05} value={f.f} aria-label={etiquetaF} onChange={e => fijar(i, { f: num(e.target.value) })} />
          {fijo ? <span /> : (
            <button type="button" className="btn sutil icono pequeno" aria-label={`Quitar ${f.etiqueta}`} disabled={lista.length <= 1} onClick={() => onCambio(lista.filter((_, j) => j !== i))}><X size={14} /></button>
          )}
        </div>
      ))}
      {!fijo && (
        <button type="button" className="btn pequeno sutil" onClick={() => onCambio([...lista, { id: codigo ? '' : nuevoId(), etiqueta: 'Nueva opción', f: 1 }])}>
          <Plus size={14} /> Añadir
        </button>
      )}
    </div>
  )
}

function ModalImportar({ onCerrar, onImportar }: { onCerrar: () => void; onImportar: (t: Tarifas) => void }) {
  const [texto, setTexto] = useState('')
  const t = texto.trim() ? desdeCalculadoraWeb(texto) : null
  return (
    <Modal titulo="Importar tarifas de la calculadora web" onCerrar={onCerrar} pie={<>
      <button className="btn" onClick={onCerrar}>Cancelar</button>
      <button className="btn primario" disabled={!t} onClick={() => t && onImportar(t)}><Upload size={15} /> Cargar en el borrador</button>
    </>}>
      <div className="formulario">
        <p className="tar-ayuda">En la calculadora web, abre «Tarifas y coeficientes» y pulsa «Copiar tarifas para la app». Pega aquí el texto. Se carga en el borrador; revísalo y pulsa Guardar.</p>
        <textarea className="tar-importar" value={texto} onChange={e => setTexto(e.target.value)} placeholder="Pega aquí las tarifas copiadas" aria-label="Tarifas copiadas" autoFocus />
        {texto.trim() && !t && <span className="tar-nota aviso">Esto no parecen tarifas de la calculadora web.</span>}
        {t && <span className="tar-nota">Leídas: {t.herramientas.length} productos, {t.paises.length} países, {t.facturacion.length} tramos de facturación.</span>}
      </div>
    </Modal>
  )
}
