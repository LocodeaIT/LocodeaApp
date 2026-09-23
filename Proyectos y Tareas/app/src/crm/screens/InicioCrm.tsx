/**
 * Inicio del CRM (área de trabajo de Business Central): indicadores que abren
 * la lista filtrada, mis actividades, pipeline por fase, facturación de los
 * últimos seis meses y la actividad reciente.
 */
import { ArrowRight, Check, Clock, StickyNote, type LucideIcon } from 'lucide-react'
import { useApp } from '../../store'
import { useCrm } from '../contexto'
import { FASE, FASES, TIPO_ACTIVIDAD } from '../catalogos'
import { actividadVencida, nombreRegistro, registroDe } from '../consultas'
import { estadoFactura, totalDoc } from '../documentos'
import { eur0, eurK, mesCorto, relativo } from '../formato'
import { fechaLarga, hoy } from '../../domain/fechas'
import { ICONO_COL } from '../iconos'
import { MenuAvisos, MenuDatos } from './HerramientasInicio'

const suma = (xs: number[]) => xs.reduce((a, x) => a + (Number(x) || 0), 0)

function Indicador({ titulo, valor, sub, icono: Ico, alerta, onClick }: { titulo: string; valor: string | number; sub?: string; icono: LucideIcon; alerta?: boolean; onClick: () => void }) {
  return (
    <button type="button" className={`tarjeta crm-indicador ${alerta ? 'alerta' : ''}`} onClick={onClick}>
      <span className="ico"><Ico size={15} /></span>
      <b>{valor}</b>
      <span className="etiqueta">{titulo}</span>
      {sub && <small>{sub}</small>}
    </button>
  )
}

export function InicioCrm() {
  const c = useCrm()
  const { yo } = useApp()
  const { datos: d, irLista, abrir } = c
  const H = hoy()
  const hora = new Date().getHours()
  const saludo = hora < 14 ? 'Buenos días' : hora < 21 ? 'Buenas tardes' : 'Buenas noches'

  const potencialesAbiertos = d.potenciales.filter(l => l.estado === 'abierto')
  const oppsAbiertas = d.oportunidades.filter(o => o.estado === 'abierta')
  const ofertasActivas = d.ofertas.filter(q => q.estado === 'borrador' || q.estado === 'enviada')
  const pedidosAbiertos = d.pedidosVenta.filter(o => ['abierto', 'liberado', 'enviado'].includes(o.estado))
  const pendCobro = d.facturasVenta.filter(f => f.estado === 'registrada')
  const vencidasVenta = pendCobro.filter(f => estadoFactura(f) === 'vencida')
  const comprasAbiertas = d.pedidosCompra.filter(o => ['abierto', 'liberado', 'recibido'].includes(o.estado))
  const pendPago = d.facturasCompra.filter(f => f.estado === 'pendiente' || f.estado === 'registrada')
  const vencidasCompra = pendPago.filter(f => estadoFactura(f) === 'vencida')
  const mias = d.actividades.filter(a => a.estado === 'abierta' && a.propietarioId === c.yoId)
  const tarde = mias.filter(actividadVencida)
  const deHoy = mias.filter(a => a.fecha === H)
  const misOpps = oppsAbiertas.filter(o => o.propietarioId === c.yoId)

  const meses = Array.from({ length: 6 }, (_, i) => {
    const f = new Date(); f.setDate(1); f.setMonth(f.getMonth() - (5 - i))
    const clave = `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}`
    const valor = suma(d.facturasVenta.filter(x => (x.estado === 'registrada' || x.estado === 'pagada') && x.fecha.startsWith(clave)).map(totalDoc))
    return { clave, etiqueta: mesCorto(f), valor }
  })
  const maxMes = Math.max(1, ...meses.map(m => m.valor))
  const fases = FASES.map(f => { const l = oppsAbiertas.filter(o => o.fase === f); return { f, n: l.length, v: suma(l.map(o => o.importe)) } })
  const maxFase = Math.max(1, ...fases.map(x => x.v))
  const proximas = [...mias].sort((a, b) => `${a.fecha ?? '9'}T${a.hora}`.localeCompare(`${b.fecha ?? '9'}T${b.hora}`)).slice(0, 7)
  const recientes = [...d.notas].sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 6)

  const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`
  const resumen = [
    tarde.length ? `Tienes ${plural(tarde.length, 'actividad vencida', 'actividades vencidas')}${deHoy.length ? ` y ${deHoy.length} para hoy` : ''}.`
      : deHoy.length ? `Tienes ${plural(deHoy.length, 'actividad', 'actividades')} para hoy.` : 'No tienes actividades para hoy. Buen momento para mover el pipeline.',
    vencidasVenta.length ? `Hay ${plural(vencidasVenta.length, 'factura vencida', 'facturas vencidas')} por cobrar.` : '',
  ].filter(Boolean).join(' ')

  const IcoAct = ICONO_COL.actividades
  return (
    <div className="pagina crm">
      <div className="crm-herramientas-inicio no-imprimir">
        <MenuAvisos />
        {c.puedeGestionarDatos && <MenuDatos />}
      </div>
      <div className="bienvenida">
        <div>
          <h1>{saludo}, {yo?.nombre.split(' ')[0]}.</h1>
          <p style={{ textTransform: 'capitalize' }}>{fechaLarga(H)}</p>
          <p>{resumen}</p>
        </div>
        <div className="acciones">
          <button className="btn" onClick={() => abrir('potenciales', 'nuevo')}>Cliente potencial</button>
          <button className="btn" onClick={() => abrir('ofertas', 'nuevo')}>Oferta</button>
          <button className="btn" onClick={() => abrir('facturasVenta', 'nuevo')}>Factura</button>
          <button className="btn blanco" onClick={() => abrir('actividades', 'nuevo')}>Actividad</button>
        </div>
      </div>

      <div className="seccion-titulo">Ventas</div>
      <div className="crm-indicadores">
        <Indicador titulo="Clientes potenciales abiertos" valor={potencialesAbiertos.length} sub={`${eur0(suma(potencialesAbiertos.map(l => l.importeEst)))} estimados`} icono={ICONO_COL.potenciales} onClick={() => irLista('potenciales', 'abiertos')} />
        <Indicador titulo="Oportunidades abiertas" valor={oppsAbiertas.length} sub={`${eur0(suma(oppsAbiertas.map(o => o.importe)))} en pipeline`} icono={ICONO_COL.oportunidades} onClick={() => irLista('oportunidades', 'abiertas')} />
        <Indicador titulo="Ofertas activas" valor={ofertasActivas.length} sub={eur0(suma(ofertasActivas.map(totalDoc)))} icono={ICONO_COL.ofertas} onClick={() => irLista('ofertas', 'activas')} />
        <Indicador titulo="Pedidos de venta abiertos" valor={pedidosAbiertos.length} sub={`${pedidosAbiertos.filter(o => o.estado === 'enviado').length} por facturar`} icono={ICONO_COL.pedidosVenta} onClick={() => irLista('pedidosVenta', 'abiertos')} />
        <Indicador titulo="Pendiente de cobro" valor={eur0(suma(pendCobro.map(totalDoc)))} sub={plural(pendCobro.length, 'factura', 'facturas')} icono={ICONO_COL.facturasVenta} onClick={() => irLista('facturasVenta', 'pendientes')} />
        <Indicador titulo="Facturas vencidas" valor={vencidasVenta.length} sub={eur0(suma(vencidasVenta.map(totalDoc)))} icono={ICONO_COL.facturasVenta} alerta={vencidasVenta.length > 0} onClick={() => irLista('facturasVenta', 'vencidas')} />
      </div>

      <div className="seccion-titulo">Compras y mi trabajo</div>
      <div className="crm-indicadores">
        <Indicador titulo="Pedidos de compra abiertos" valor={comprasAbiertas.length} sub={eur0(suma(comprasAbiertas.map(totalDoc)))} icono={ICONO_COL.pedidosCompra} onClick={() => irLista('pedidosCompra', 'abiertos')} />
        <Indicador titulo="Pendiente de pago" valor={eur0(suma(pendPago.map(totalDoc)))} sub={plural(pendPago.length, 'factura', 'facturas')} icono={ICONO_COL.facturasCompra} onClick={() => irLista('facturasCompra', 'pendientes')} />
        <Indicador titulo="Facturas de compra vencidas" valor={vencidasCompra.length} sub={eur0(suma(vencidasCompra.map(totalDoc)))} icono={ICONO_COL.facturasCompra} alerta={vencidasCompra.length > 0} onClick={() => irLista('facturasCompra', 'vencidas')} />
        <Indicador titulo="Mis oportunidades" valor={misOpps.length} sub={eur0(suma(misOpps.map(o => o.importe)))} icono={ICONO_COL.oportunidades} onClick={() => irLista('oportunidades', 'mias')} />
        <Indicador titulo="Actividades para hoy" valor={deHoy.length} sub="tuyas" icono={ICONO_COL.actividades} onClick={() => irLista('actividades', 'hoy')} />
        <Indicador titulo="Actividades vencidas" valor={tarde.length} sub={tarde.length ? 'revisa hoy' : 'todo al día'} icono={Clock} alerta={tarde.length > 0} onClick={() => irLista('actividades', 'vencidas')} />
      </div>

      <div className="crm-paneles">
        <section className="tarjeta padded">
          <div className="tarjeta-cabecera"><h3>Mis actividades</h3><button className="btn sutil pequeno" onClick={() => irLista('actividades', 'mias')}>Ver todas <ArrowRight size={13} /></button></div>
          {!proximas.length && <p className="crm-vacio">Sin actividades pendientes.</p>}
          <div className="lista-simple">
            {proximas.map(a => {
              const ref = a.referenteTipo ? registroDe(d, a.referenteTipo, a.referenteId) : undefined
              return (
                <div key={a.id} className="crm-clicable" onClick={() => abrir('actividades', a.id)}>
                  <button type="button" className="check crm-check" title="Completar" aria-label="Completar" onClick={e => { e.stopPropagation(); void c.alternarActividad(a) }}><Check size={11} strokeWidth={3} /></button>
                  <span className="crm-crece">
                    <span className="crm-t">{a.asunto}</span>
                    <span className="crm-s">{TIPO_ACTIVIDAD[a.tipo]}{ref && a.referenteTipo && ` · ${nombreRegistro(d, a.referenteTipo, ref)}`}</span>
                  </span>
                  <span className={`crm-cuando ${actividadVencida(a) ? 'crm-tarde' : ''}`}>{relativo(a.fecha)}{a.hora && ` · ${a.hora}`}</span>
                </div>
              )
            })}
          </div>
        </section>

        <section className="tarjeta padded">
          <div className="tarjeta-cabecera"><h3>Pipeline por fase</h3><button className="btn sutil pequeno" onClick={() => irLista('oportunidades', 'abiertas')}>Ver <ArrowRight size={13} /></button></div>
          <p className="crm-cifra">{eur0(suma(oppsAbiertas.map(o => o.importe)))}</p>
          <div className="crm-barras-h">
            {fases.map(x => (
              <div key={x.f} className="crm-barra-h">
                <span className="l">{FASE[x.f]} · {x.n}</span>
                <span className="pista"><i style={{ width: `${Math.max(2, (x.v / maxFase) * 100)}%` }} /></span>
                <span className="v">{eurK(x.v)}</span>
              </div>
            ))}
          </div>
          <div className="seccion-titulo" style={{ marginTop: 18 }}>Facturación · 6 meses</div>
          <p className="crm-cifra">{eur0(suma(meses.map(m => m.valor)))}</p>
          <div className="crm-barras">
            {meses.map((m, i) => (
              <div key={m.clave} className={`crm-barra ${i === meses.length - 1 ? 'actual' : ''}`} title={`${m.etiqueta}: ${eur0(m.valor)}`}>
                <i style={{ height: `${Math.max(2, (m.valor / maxMes) * 100)}%` }} />
                <small>{m.etiqueta}</small>
              </div>
            ))}
          </div>
        </section>

        <section className="tarjeta padded">
          <div className="tarjeta-cabecera"><h3>Actividad reciente</h3><IcoAct size={16} className="crm-apagado" /></div>
          {!recientes.length && <p className="crm-vacio">Sin actividad.</p>}
          <div className="crm-escala">
            {recientes.map(n => {
              const ref = registroDe(d, n.referenteTipo, n.referenteId)
              return (
                <div key={n.id} className="crm-escala-item">
                  <span className="ico"><StickyNote size={14} /></span>
                  <div>
                    <p>{n.texto}</p>
                    <p className="por">
                      {ref && <><button type="button" className="crm-enlace" onClick={() => abrir(n.referenteTipo, n.referenteId)}>{nombreRegistro(d, n.referenteTipo, ref)}</button> · </>}
                      {c.nombreMiembro(n.autorId) || '—'} · {relativo(n.fecha)}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      </div>
    </div>
  )
}
