/**
 * Verifactu: configuración del sistema de facturación, estado de la cadena de
 * registros, cada registro con su QR, la declaración responsable y los pasos
 * para asociar el certificado de la SL cuando exista.
 *
 * Hasta entonces funciona en modo preparación: cada factura de venta que se
 * registra en el CRM genera su registro encadenado, su huella y su QR, sin
 * enviar nada a la AEAT. El certificado nunca pasa por la app: vive en Azure
 * Key Vault y solo lo usa el servicio de Azure (Proyectos y Tareas/verifactu-servicio).
 */
import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, ExternalLink, FileSignature, Link2, RefreshCw, Save, Send, ShieldCheck } from 'lucide-react'
import { useApp } from '../../store'
import { useCrm } from '../../crm/contexto'
import { Campo, Modal, Vacio } from '../../ui/basicos'
import { Select } from '../../ui/Select'
import { eur, fecha } from '../../crm/formato'
import { hoy } from '../../domain/fechas'
import { useGestoria } from '../store'
import type { ConfigVerifactu, EntornoVerifactu, EstadoRegistro, RegistroFacturacion } from '../types'
import { LEYENDA_VERIFACTU, qrDataUrl, textoDeclaracionResponsable, urlCotejo, verificarCadena } from '../verifactu'

const ENTORNO: Record<EntornoVerifactu, string> = { preparacion: 'Preparación (no se envía nada)', pruebas: 'Pruebas de la AEAT', produccion: 'Producción' }
const ESTADO: Record<EstadoRegistro, string> = { simulado: 'Simulado', pendiente: 'Pendiente', correcto: 'Correcto', 'aceptado-errores': 'Aceptado con errores', rechazado: 'Rechazado' }
const TONO: Record<EstadoRegistro, string> = { simulado: 'contorno', pendiente: 'aviso', correcto: 'ok', 'aceptado-errores': 'aviso', rechazado: 'error' }

/** Pasos para dejar Verifactu en producción (los de la propuesta). */
const PASOS: { clave: string; texto: string; hecho: (c: ConfigVerifactu, nif: string) => boolean }[] = [
  { clave: 'nif', texto: 'Constituir la SL y tener el NIF definitivo (en el 036 de alta, pedir el alta como operador intracomunitario).', hecho: (_, nif) => !!nif },
  { clave: 'certificado', texto: 'Pedir el certificado de representante de persona jurídica para el administrador.', hecho: c => !!c.certificadoCaduca },
  { clave: 'declaracion', texto: 'Firmar la declaración responsable del sistema (Locodea es productora de su propio software).', hecho: c => !!c.declaracionFirmadaEl },
  { clave: 'keyvault', texto: 'Subir el certificado a Azure Key Vault (nunca por correo ni a Dataverse) y desplegar el servicio de Azure.', hecho: c => !!c.servicioUrl },
  { clave: 'pruebas', texto: 'Enviar una factura ficticia al entorno de pruebas de la AEAT y revisar la respuesta.', hecho: c => c.entorno === 'pruebas' || c.entorno === 'produccion' },
  { clave: 'produccion', texto: 'Pasar a producción antes de la primera factura real y, como tarde, el 1 de enero de 2027.', hecho: c => c.entorno === 'produccion' },
]

export function Verifactu() {
  const g = useGestoria()
  const crm = useCrm()
  const { setPantalla } = useApp()
  const lectura = g.acceso !== 'completo'
  const [c, setC] = useState<ConfigVerifactu>(g.config)
  const [cadena, setCadena] = useState<{ ok: boolean; errores: { orden: number; motivo: string }[] } | null>(null)
  const [abierto, setAbierto] = useState<RegistroFacturacion | null>(null)
  const [declaracion, setDeclaracion] = useState(false)
  const [firmante, setFirmante] = useState('')
  useEffect(() => { setC(g.config) }, [g.config])
  const set = (x: Partial<ConfigVerifactu>) => setC(v => ({ ...v, ...x }))

  const registros = useMemo(() => [...g.datos.registros].sort((a, b) => b.orden - a.orden || b.creadoEl.localeCompare(a.creadoEl)), [g.datos.registros])
  const deEntorno = registros.filter(r => r.entorno === g.config.entorno && r.nifEmisor === g.config.nifEmisor)
  useEffect(() => {
    let vivo = true
    void verificarCadena([...deEntorno].sort((a, b) => a.orden - b.orden)).then(r => { if (vivo) setCadena(r) })
    return () => { vivo = false }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [g.datos.registros, g.config.entorno, g.config.nifEmisor])

  // facturas de venta registradas desde que se activó Verifactu que no tienen registro
  const desde = g.config.altaEl || g.config.creadoEl?.slice(0, 10) || hoy()
  const sinRegistro = crm.datos.facturasVenta.filter(f => (f.estado === 'registrada' || f.estado === 'pagada') && (f.registradaEl ?? f.fecha).slice(0, 10) >= desde
    && !g.datos.registros.some(r => r.facturaId === f.id && r.tipo === 'alta'))

  const guardar = async () => { await g.guardarConfig({ ...c, nifEmisor: c.nifEmisor.toUpperCase().trim() }) }
  const productor = { nombre: g.perfil.razonSocial || 'Locodea SL', nif: g.perfil.nif, direccion: g.perfil.domicilio, lugar: 'Madrid - España' }

  const k = {
    total: deEntorno.length,
    rechazados: deEntorno.filter(r => r.estado === 'rechazado').length,
    pendientes: deEntorno.filter(r => r.estado === 'pendiente').length,
  }

  return (
    <div className="pagina">
      <div className="titulo-pagina">
        <div>
          <h1>Verifactu.</h1>
          <div className="sub">Cada factura de venta que se registra en el CRM pasa por aquí: se crea su registro encadenado, su huella y su QR. Obligatorio para las sociedades desde el 1 de enero de 2027.</div>
        </div>
        <div className="acciones">
          {!lectura && g.config.entorno !== 'preparacion' && <button className="btn" onClick={() => void g.reenviarPendientes()}><Send size={16} /> Reenviar pendientes</button>}
          <button className="btn" onClick={() => setDeclaracion(true)}><FileSignature size={16} /> Declaración responsable</button>
        </div>
      </div>

      {g.config.entorno === 'preparacion' && (
        <div className="ges-aviso" style={{ marginBottom: 16 }}>
          <b>Modo preparación.</b> Los registros se generan y se encadenan como en producción, pero no se envían a la AEAT. Se pasa a pruebas y a producción cuando exista la SL y su certificado, sin tocar código.
        </div>
      )}

      <div className="kpis ges-kpis">
        <div className="tarjeta kpi ges-kpi">
          <div className="etiqueta"><span className="ico"><ShieldCheck size={14} /></span>Entorno</div>
          <div className="valor" style={{ fontSize: 20 }}>{ENTORNO[g.config.entorno].split(' (')[0]}</div>
          <div className="pie">{g.config.altaEl ? `en producción desde ${fecha(g.config.altaEl)}` : 'sin fecha de alta'}</div>
        </div>
        <div className="tarjeta kpi ges-kpi">
          <div className="etiqueta"><span className="ico"><Link2 size={14} /></span>Cadena</div>
          <div className={`valor ${cadena && !cadena.ok ? 'neg' : 'pos'}`} style={{ fontSize: 20 }}>{cadena ? (cadena.ok ? 'Íntegra' : 'Rota') : '…'}</div>
          <div className="pie">{k.total} {k.total === 1 ? 'registro' : 'registros'} en este entorno</div>
        </div>
        <div className="tarjeta kpi ges-kpi">
          <div className="etiqueta"><span className="ico"><AlertTriangle size={14} /></span>Por resolver</div>
          <div className={`valor ${k.rechazados ? 'neg' : ''}`}>{k.rechazados + k.pendientes}</div>
          <div className="pie">{k.rechazados} rechazados · {k.pendientes} pendientes</div>
        </div>
        <div className="tarjeta kpi ges-kpi">
          <div className="etiqueta"><span className="ico"><CheckCircle2 size={14} /></span>Facturas sin registro</div>
          <div className={`valor ${sinRegistro.length ? 'neg' : ''}`}>{sinRegistro.length}</div>
          <div className="pie">registradas desde {fecha(desde)}</div>
        </div>
      </div>

      <div className="gst-dos">
        <div className="gst-columna">
          <div className="tarjeta padded">
            <div className="tarjeta-cabecera"><div><h3>Registros de facturación</h3><div className="sub">Del más reciente al primero. Pulsa uno para ver su QR y su XML.</div></div></div>
            {cadena && !cadena.ok && (
              <div className="error-formulario" style={{ marginBottom: 12 }}>
                La cadena no cuadra: {cadena.errores.slice(0, 3).map(e => `registro ${e.orden}: ${e.motivo}`).join(' · ')}
              </div>
            )}
            {sinRegistro.length > 0 && !lectura && (
              <div className="ges-aviso" style={{ marginBottom: 12, display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
                <span>{sinRegistro.length} {sinRegistro.length === 1 ? 'factura registrada no tiene' : 'facturas registradas no tienen'} registro de Verifactu.</span>
                <button className="btn pequeno" onClick={() => { void (async () => { for (const f of [...sinRegistro].sort((a, b) => a.no.localeCompare(b.no))) await g.registrarFactura(f, 'alta') })() }}><RefreshCw size={14} /> Generarlos</button>
              </div>
            )}
            {registros.length === 0 ? (
              <Vacio icono={<ShieldCheck size={32} />} titulo="Todavía no hay registros" texto="Se crean solos al registrar una factura de venta en el CRM." />
            ) : (
              <div className="ges-tabla-wrap">
                <table className="tabla">
                  <thead><tr><th>Nº</th><th>Factura</th><th>Fecha</th><th>Tipo</th><th className="num">Importe</th><th>Estado</th><th>Huella</th></tr></thead>
                  <tbody>
                    {registros.map(r => (
                      <tr key={r.id} className="clicable" onClick={() => setAbierto(r)}>
                        <td>{r.orden}</td>
                        <td>{r.serieNumero}{r.tipo === 'anulacion' && <span className="chip pequeno contorno" style={{ marginLeft: 6 }}>anulación</span>}</td>
                        <td>{fecha(r.fechaExpedicion)}</td>
                        <td>{r.tipoFactura}</td>
                        <td className="num">{eur(r.importeTotal)}</td>
                        <td><span className={`chip pequeno punto ${TONO[r.estado]}`}>{ESTADO[r.estado]}</span></td>
                        <td className="gst-huella" title={r.huella}>{r.huella.slice(0, 12)}…</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="tarjeta padded">
            <div className="tarjeta-cabecera"><div><h3>Asociar el certificado</h3><div className="sub">Lo que falta para pasar de preparación a producción</div></div></div>
            {PASOS.map(p => {
              const hecho = p.hecho(g.config, g.perfil.nif)
              return (
                <div key={p.clave} className="gst-paso">
                  <span className={`ico ${hecho ? 'hecho' : 'pendiente'}`}>{hecho ? <CheckCircle2 size={18} /> : <span style={{ display: 'inline-block', width: 14, height: 14, borderRadius: 4, border: '1.5px solid currentColor' }} />}</span>
                  <span>{p.texto}</span>
                  <span />
                </div>
              )
            })}
            <div className="ges-aviso" style={{ marginTop: 12 }}>El envío a la AEAT se autentica con el certificado y eso no se puede hacer de forma segura desde el navegador: lo hace el servicio de Azure, que lee el certificado de Key Vault. La app solo guarda el nombre del secreto.</div>
          </div>
        </div>

        <div className="tarjeta padded">
          <div className="tarjeta-cabecera"><div><h3>Configuración</h3></div></div>
          <fieldset disabled={lectura} className="formulario" style={{ border: 0, padding: 0, margin: 0 }}>
            <Campo label="Entorno"><Select valor={c.entorno} opciones={(Object.keys(ENTORNO) as EntornoVerifactu[]).map(v => ({ valor: v, etiqueta: ENTORNO[v] }))} onCambio={v => set({ entorno: v as EntornoVerifactu })} /></Campo>
            {c.entorno !== 'preparacion' && !c.servicioUrl && <div className="error-formulario">Sin la URL del servicio de Azure no se puede enviar: los registros quedarán pendientes.</div>}
            <div className="fila-campos">
              <Campo label="NIF del emisor"><input value={c.nifEmisor} onChange={e => set({ nifEmisor: e.target.value.toUpperCase() })} placeholder={g.perfil.nif || 'NIF de la SL'} /></Campo>
              <Campo label="Razón social"><input value={c.razonSocial} onChange={e => set({ razonSocial: e.target.value })} /></Campo>
            </div>
            <div className="fila-campos">
              <Campo label="Secreto del certificado en Key Vault"><input value={c.certificadoRef} onChange={e => set({ certificadoRef: e.target.value })} /></Campo>
              <Campo label="Caduca el certificado"><input type="date" value={c.certificadoCaduca ?? ''} onChange={e => set({ certificadoCaduca: e.target.value || null })} /></Campo>
            </div>
            <Campo label="URL del servicio de Azure"><input value={c.servicioUrl} onChange={e => set({ servicioUrl: e.target.value })} placeholder="https://…azurewebsites.net/api/registrar" /></Campo>
            <div className="fila-campos">
              <Campo label="Nombre del sistema"><input value={c.sistemaNombre} onChange={e => set({ sistemaNombre: e.target.value })} /></Campo>
              <Campo label="Id. (2 caracteres)"><input value={c.sistemaId} maxLength={2} onChange={e => set({ sistemaId: e.target.value.toUpperCase() })} /></Campo>
            </div>
            <div className="fila-campos">
              <Campo label="Versión"><input value={c.sistemaVersion} onChange={e => set({ sistemaVersion: e.target.value })} /></Campo>
              <Campo label="Nº de instalación"><input value={c.numeroInstalacion} onChange={e => set({ numeroInstalacion: e.target.value })} /></Campo>
            </div>
            <Campo label="En producción desde"><input type="date" value={c.altaEl ?? ''} onChange={e => set({ altaEl: e.target.value || null })} /></Campo>
            {!lectura && <button className="btn acento" onClick={() => void guardar()}><Save size={16} /> Guardar configuración</button>}
          </fieldset>
        </div>
      </div>

      {abierto && <ModalRegistro r={abierto} onCerrar={() => setAbierto(null)} onFactura={() => { crm.abrir('facturasVenta', abierto.facturaId); setPantalla('crm-facturas-venta') }} />}
      {declaracion && (
        <Modal titulo="Declaración responsable del sistema informático de facturación" onCerrar={() => setDeclaracion(false)} ancho pie={<>
          <span style={{ flex: 1 }} />
          {!lectura && !g.config.declaracionFirmadaEl && (
            <button className="btn acento" disabled={!firmante.trim()} onClick={() => { void g.guardarConfig({ ...g.config, declaracionFirmante: firmante.trim(), declaracionFirmadaEl: hoy() }).then(() => setDeclaracion(false)) }}>
              <FileSignature size={16} /> Marcar como firmada hoy
            </button>
          )}
          <button className="btn sutil" onClick={() => setDeclaracion(false)}>Cerrar</button>
        </>}>
          <div className="gst-declaracion">{textoDeclaracionResponsable(g.config, productor)}</div>
          {!lectura && !g.config.declaracionFirmadaEl && <div style={{ marginTop: 12 }}><Campo label="Quién firma (nombre y cargo)"><input value={firmante} onChange={e => setFirmante(e.target.value)} placeholder="Nombre Apellido · Administrador" /></Campo></div>}
          {g.config.declaracionFirmadaEl && <div className="ges-aviso" style={{ marginTop: 12 }}>Firmada el {fecha(g.config.declaracionFirmadaEl)} por {g.config.declaracionFirmante}. Debe quedar visible dentro de la app, como aquí.</div>}
        </Modal>
      )}
    </div>
  )
}

function ModalRegistro({ r, onCerrar, onFactura }: { r: RegistroFacturacion; onCerrar: () => void; onFactura: () => void }) {
  const [qr, setQr] = useState('')
  const url = urlCotejo({ nif: r.nifEmisor, serieNumero: r.serieNumero, fechaExpedicion: r.fechaExpedicion, importeTotal: r.importeTotal, entorno: r.entorno })
  useEffect(() => { let vivo = true; void qrDataUrl(url).then(d => { if (vivo) setQr(d) }); return () => { vivo = false } }, [url])
  return (
    <Modal titulo={`Registro ${r.orden} · ${r.serieNumero}`} onCerrar={onCerrar} ancho pie={<>
      <button className="btn" onClick={onFactura}><ExternalLink size={15} /> Ver la factura</button>
      <span style={{ flex: 1 }} />
      <button className="btn sutil" onClick={onCerrar}>Cerrar</button>
    </>}>
      <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ textAlign: 'center' }}>
          {qr ? <img className="gst-qr" src={qr} alt="QR de cotejo" /> : <div className="gst-qr" />}
          <div style={{ fontSize: 12, fontWeight: 600, marginTop: 6 }}>{LEYENDA_VERIFACTU}</div>
        </div>
        <dl className="crm-kv" style={{ flex: 1, minWidth: 260 }}>
          <dt>Tipo</dt><dd>{r.tipo === 'alta' ? 'Alta' : 'Anulación'} · {r.tipoFactura}</dd>
          <dt>Fecha de expedición</dt><dd>{fecha(r.fechaExpedicion)}</dd>
          <dt>Cuota / total</dt><dd>{eur(r.cuotaTotal)} / {eur(r.importeTotal)}</dd>
          <dt>Generado</dt><dd>{r.fechaHoraGeneracion}</dd>
          <dt>Estado</dt><dd>{ESTADO[r.estado]}{r.codigoError && ` · ${r.codigoError} ${r.descripcionError}`}</dd>
          <dt>Huella</dt><dd className="gst-huella">{r.huella}</dd>
          <dt>Huella anterior</dt><dd className="gst-huella">{r.huellaAnterior || '— primer registro —'}</dd>
          <dt>Cotejo</dt><dd><a href={url} target="_blank" rel="noreferrer">Abrir en la sede de la AEAT</a></dd>
        </dl>
      </div>
      <details style={{ marginTop: 14 }}>
        <summary style={{ cursor: 'pointer', fontSize: 13 }}>XML del registro</summary>
        <pre className="gst-declaracion" style={{ fontSize: 11.5 }}>{r.xml}</pre>
      </details>
    </Modal>
  )
}
