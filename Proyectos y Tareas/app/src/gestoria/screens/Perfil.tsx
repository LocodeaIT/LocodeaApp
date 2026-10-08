/**
 * Perfil fiscal de la sociedad: lo que decide qué modelos aparecen en el
 * calendario (IVA trimestral, operador intracomunitario, nóminas, alquiler,
 * socios…), el tipo del Impuesto sobre Sociedades (nueva creación, cifra de
 * negocios) y el saldo del banco que usa la Caja del CRM.
 */
import { useEffect, useState } from 'react'
import { Save, ScrollText } from 'lucide-react'
import { Campo } from '../../ui/basicos'
import { Select } from '../../ui/Select'
import { validarNif } from '../../gestion/calculos'
import { useGestoria } from '../store'
import type { PerfilFiscal } from '../types'

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

export function Perfil() {
  const g = useGestoria()
  const [p, setP] = useState<PerfilFiscal>(g.perfil)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const lectura = g.acceso !== 'completo'
  useEffect(() => { setP(g.perfil) }, [g.perfil])
  const set = (c: Partial<PerfilFiscal>) => setP(x => ({ ...x, ...c }))

  const guardar = async () => {
    const e = p.nif ? validarNif(p.nif) : null
    if (e) { setError(e); return }
    setError(null); setGuardando(true)
    try { await g.guardarPerfil(p) } finally { setGuardando(false) }
  }

  const casilla = (clave: keyof PerfilFiscal, texto: string, ayuda?: string) => (
    <label className="ges-check" title={ayuda}>
      <input type="checkbox" checked={!!p[clave]} onChange={e => set({ [clave]: e.target.checked } as Partial<PerfilFiscal>)} /> {texto}
    </label>
  )

  return (
    <div className="pagina">
      <div className="titulo-pagina">
        <div>
          <h1>Perfil fiscal.</h1>
          <div className="sub">Lo que decide qué modelos tiene que presentar Locodea y con qué tipo tributa. Cambia algo aquí y el calendario se ajusta solo.</div>
        </div>
        <div className="acciones">
          {!lectura && <button className="btn acento" onClick={() => void guardar()} disabled={guardando}><Save size={16} /> {guardando ? 'Guardando…' : 'Guardar'}</button>}
        </div>
      </div>

      {!g.perfil.id && <div className="ges-aviso" style={{ marginBottom: 16 }}>Aún no hay perfil guardado: se muestra el de partida acordado (sociedad nueva, IVA trimestral, sin nóminas ni alquiler). Revísalo y guárdalo.</div>}

      <fieldset disabled={lectura} className="gst-perfil">
        <div className="tarjeta padded">
          <div className="tarjeta-cabecera"><div><h3>Sociedad</h3></div><ScrollText size={18} style={{ color: 'var(--faint)' }} /></div>
          <div className="formulario">
            <div className="fila-campos">
              <Campo label="Razón social"><input value={p.razonSocial} onChange={e => set({ razonSocial: e.target.value })} /></Campo>
              <Campo label="NIF"><input value={p.nif} onChange={e => set({ nif: e.target.value.toUpperCase() })} placeholder="B00000000 (cuando exista)" /></Campo>
            </div>
            <Campo label="Domicilio fiscal"><input value={p.domicilio} onChange={e => set({ domicilio: e.target.value })} /></Campo>
            <div className="fila-campos">
              <Campo label="Fecha de constitución"><input type="date" value={p.fechaConstitucion} onChange={e => set({ fechaConstitucion: e.target.value })} /></Campo>
              <Campo label="Cierre del ejercicio">
                <Select valor={String(p.mesCierre)} opciones={MESES.map((m, i) => ({ valor: String(i + 1), etiqueta: `Final de ${m}` }))} onCambio={v => set({ mesCierre: Number(v) })} />
              </Campo>
              <Campo label="IBAN de domiciliación"><input value={p.ibanDomiciliacion} onChange={e => set({ ibanDomiciliacion: e.target.value.toUpperCase() })} /></Campo>
            </div>
          </div>
        </div>

        <div className="tarjeta padded">
          <div className="tarjeta-cabecera"><div><h3>IVA</h3><div className="sub">Modelos 303, 390, 349 y 369</div></div></div>
          <div className="formulario">
            <div className="fila-campos">
              <Campo label="Periodicidad">
                <Select valor={p.periodicidadIva} opciones={[{ valor: 'trimestral', etiqueta: 'Trimestral' }, { valor: 'mensual', etiqueta: 'Mensual (gran empresa o REDEME)' }]} onCambio={v => set({ periodicidadIva: v as PerfilFiscal['periodicidadIva'] })} />
              </Campo>
            </div>
            <div className="gst-casillas">
              {casilla('criterioCaja', 'Criterio de caja', 'Régimen especial: el IVA se declara al cobrar y pagar. Locodea va por devengo.')}
              {casilla('roi', 'Operador intracomunitario (ROI)', 'Se pide en el 036 de alta. Sin él, los clientes de la UE no validan el NIF-IVA.')}
              {casilla('oss', 'Ventanilla única (OSS · 369)', 'Solo si se venden servicios electrónicos a particulares de la UE por encima de 10.000 € al año.')}
            </div>
          </div>
        </div>

        <div className="tarjeta padded">
          <div className="tarjeta-cabecera"><div><h3>Retenciones</h3><div className="sub">Modelos 111, 115, 123 y sus resúmenes 190, 180 y 193</div></div></div>
          <div className="gst-casillas">
            {casilla('empleados', 'Tiene empleados (nóminas)')}
            {casilla('administradoresRetribuidos', 'Administradores que cobran de la sociedad')}
            {casilla('alquilerLocal', 'Alquila oficina o local')}
            {casilla('dividendosOPrestamosSocios', 'Dividendos o préstamos de socios con intereses')}
            {casilla('operacionesVinculadas', 'Operaciones vinculadas por encima del umbral (232)')}
          </div>
          {p.administradoresRetribuidos && (
            <div className="formulario" style={{ marginTop: 12 }}>
              <Campo label="Retención de los administradores (%)">
                <Select valor={String(p.retencionAdministradores)} opciones={[{ valor: '35', etiqueta: '35 %' }, { valor: '19', etiqueta: '19 % (cifra de negocios < 100.000 €)' }]} onCambio={v => set({ retencionAdministradores: Number(v) })} />
              </Campo>
            </div>
          )}
        </div>

        <div className="tarjeta padded">
          <div className="tarjeta-cabecera"><div><h3>Impuesto sobre Sociedades</h3><div className="sub">Modelos 200 y 202</div></div></div>
          <div className="formulario">
            <div className="gst-casillas">{casilla('nuevaCreacion', 'Entidad de nueva creación (15 %)', 'El primer ejercicio con base imponible positiva y el siguiente, si cumple los requisitos.')}</div>
            <div className="fila-campos">
              <Campo label="Primer ejercicio con base positiva"><input type="number" min={0} value={p.primerEjercicioPositivo || ''} placeholder="Aún ninguno" onChange={e => set({ primerEjercicioPositivo: Number(e.target.value) || 0 })} /></Campo>
              <Campo label="Cifra de negocios del último ejercicio (€)"><input type="number" min={0} step={1000} value={p.cifraNegocios || ''} placeholder="0" onChange={e => set({ cifraNegocios: Number(e.target.value) || 0 })} /></Campo>
            </div>
            <Campo label="Bases imponibles negativas pendientes (JSON: ejercicio → importe)">
              <input value={JSON.stringify(p.basesNegativas)} onChange={e => { try { set({ basesNegativas: JSON.parse(e.target.value || '{}') }) } catch { /* se corrige al seguir escribiendo */ } }} />
            </Campo>
          </div>
        </div>

        <div className="tarjeta padded">
          <div className="tarjeta-cabecera"><div><h3>Banco</h3><div className="sub">Saldo de partida de la Caja del CRM (antes se guardaba solo en cada navegador)</div></div></div>
          <div className="formulario">
            <div className="fila-campos">
              <Campo label="Saldo del banco (€)"><input type="number" step={100} value={p.saldoBanco || ''} onChange={e => set({ saldoBanco: Number(e.target.value) || 0 })} /></Campo>
              <Campo label="A fecha de"><input type="date" value={p.saldoBancoFecha} onChange={e => set({ saldoBancoFecha: e.target.value })} /></Campo>
            </div>
            <Campo label="Notas"><textarea rows={2} value={p.notas} onChange={e => set({ notas: e.target.value })} /></Campo>
          </div>
        </div>
      </fieldset>
      {error && <div className="error-formulario" style={{ marginTop: 12 }}>{error}</div>}
    </div>
  )
}
