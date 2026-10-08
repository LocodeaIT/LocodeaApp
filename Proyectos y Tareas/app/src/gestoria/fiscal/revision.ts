/**
 * Revisión de los datos antes de cerrar un periodo: lo que haría una gestoría
 * al recibir las facturas del trimestre. Cada incidencia dice qué falla, en qué
 * registro y con qué gravedad (error: el modelo saldría mal; aviso: conviene
 * mirarlo).
 *
 * Fuentes:
 *  - Validación de NIF/NIE/CIF: `validarNif` de Gestión.
 *  - Inversión del sujeto pasivo y localización de servicios (arts. 69, 70 y 84 LIVA); Canarias, Ceuta y Melilla
 *    fuera del territorio de aplicación del IVA (art. 3 LIVA): https://www.boe.es/buscar/act.php?id=BOE-A-1992-28740
 *  - Derecho a deducir solo con factura completa (art. 97 LIVA) y facturas rectificativas (art. 15 del Reglamento
 *    de facturación, RD 1619/2012): https://www.boe.es/buscar/act.php?id=BOE-A-2012-14696
 *  - Numeración correlativa por series (art. 6.1.a RD 1619/2012).
 *  - Verifactu obligatorio para los contribuyentes del Impuesto sobre Sociedades desde el 1 de enero de 2027
 *    (RD-ley 15/2025): https://www.boe.es/buscar/doc.php?id=BOE-A-2025-24446
 *  - Complementarias o rectificativas del 303 cuando cambian datos ya presentados (art. 122 LGT y art. 71 RIVA).
 */
import type { CrmInstantanea, Cuenta, FacturaCompra, FacturaVenta } from '../../crm/types'
import { esEspana, esUE } from '../../crm/fiscal'
import { totales } from '../../crm/documentos'
import { validarNif } from '../../gestion/calculos'
import type { Gasto, GestionInstantanea } from '../../gestion/types'
import type { GestoriaInstantanea, Presentacion } from '../types'
import { nifSinPrefijo } from './modelos'
import { estaPresentada } from './modelos'
import { enRango, etiquetaDeClave, periodoDeClave, r2, rangoPeriodo } from './periodos'
import { serieYNumero } from './libros'

export interface Incidencia {
  id: string
  gravedad: 'error' | 'aviso'
  tipo: string
  texto: string
  col: 'cuentas' | 'facturasVenta' | 'facturasCompra' | 'gastos' | 'perfil' | 'verifactu' | 'presentaciones'
  registroId: string | null
}

interface Entrada {
  crm: CrmInstantanea
  gestion: GestionInstantanea
  gestoria: GestoriaInstantanea
  desde: string
  hasta: string
}

/** Fecha desde la que Verifactu es obligatorio para las sociedades (RD-ley 15/2025). */
export const VERIFACTU_OBLIGATORIO_SOCIEDADES = '2027-01-01'

const vale = (estado: string) => estado === 'registrada' || estado === 'pagada'
const fechaCompra = (f: FacturaCompra) => f.fechaRecepcion || f.fecha
const normal = (s: string) => String(s ?? '').toUpperCase().replace(/[\s./-]/g, '')

/** Canarias (35, 38), Ceuta (51) y Melilla (52): España, pero fuera del territorio de aplicación del IVA. */
const fueraTerritorioIva = (c: Cuenta) => esEspana(c.codigoPais) && /^(35|38|51|52)\d{3}$/.test(String(c.cp ?? '').trim())

/** Instante comparable; una fecha sin hora cuenta como el final de ese día. */
const instante = (s: string | null | undefined) => {
  if (!s) return NaN
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? Date.parse(s + 'T23:59:59Z') : Date.parse(s)
}

export function revisar(e: Entrada): Incidencia[] {
  const { crm, gestion, gestoria, desde, hasta } = e
  const out: Incidencia[] = []
  const vistos = new Set<string>()
  const add = (i: Omit<Incidencia, 'id'> & { id?: string }) => {
    const id = i.id ?? `${i.tipo}:${i.registroId ?? '-'}`
    if (vistos.has(id)) return
    vistos.add(id)
    out.push({ ...i, id })
  }
  const cuentaDe = (id: string | null) => (id ? crm.cuentas.find(c => c.id === id) ?? null : null)
  const enP = (d: string | null | undefined) => enRango(d, desde, hasta)

  const ventas = crm.facturasVenta.filter(f => f.estado !== 'anulada' && enP(f.fecha))
  const ventasValidas = ventas.filter(f => vale(f.estado))
  const compras = crm.facturasCompra.filter(f => f.estado !== 'anulada' && (enP(fechaCompra(f)) || enP(f.fecha)))
  const gastos = gestion.gastos.filter(g => !g.facturaCompraId && enP(g.fecha))
  const ref = (f: FacturaVenta | FacturaCompra) => f.no || f.referencia || f.id

  // ── perfil fiscal
  const perfil = gestoria.perfil[0]
  if (!perfil) add({ gravedad: 'error', tipo: 'perfil-ausente', texto: 'Falta el perfil fiscal de la sociedad: sin él no se sabe qué modelos tocan.', col: 'perfil', registroId: null })
  else if (!perfil.nif) add({ gravedad: 'error', tipo: 'perfil-sin-nif', texto: 'El perfil fiscal no tiene NIF: hace falta para presentar cualquier modelo.', col: 'perfil', registroId: perfil.id })
  else { const m = validarNif(perfil.nif); if (m) add({ gravedad: 'error', tipo: 'perfil-nif-invalido', texto: `El NIF del perfil fiscal no es válido: ${m}`, col: 'perfil', registroId: perfil.id }) }

  // ── NIF de los terceros con factura en el periodo
  const terceros = new Map<string, { c: Cuenta; soloSimplificadas: boolean }>()
  const marcar = (id: string | null, simplificada: boolean) => {
    const c = cuentaDe(id); if (!c) return
    const x = terceros.get(c.id) ?? { c, soloSimplificadas: true }
    x.soloSimplificadas = x.soloSimplificadas && simplificada
    terceros.set(c.id, x)
  }
  for (const f of ventas) marcar(f.cuentaId, f.tipoFactura === 'F2')
  for (const f of compras) marcar(f.cuentaId, false)
  for (const g of gastos) marcar(g.proveedorId, !g.facturaCompleta)
  for (const { c, soloSimplificadas } of terceros.values()) {
    if (soloSimplificadas) continue
    const nif = normal(c.cif)
    if (!nif) {
      const extranjero = !esEspana(c.codigoPais) && !esUE(c.codigoPais)
      add({ gravedad: extranjero ? 'aviso' : 'error', tipo: 'nif-ausente', texto: `${c.nombre} no tiene NIF y tiene facturas en el periodo: lo necesitan las facturas, el 347 y el 349.`, col: 'cuentas', registroId: c.id })
    } else if (esEspana(c.codigoPais) || c.tipoIdFiscal === 'nif') {
      const m = validarNif(nif)
      if (m) add({ gravedad: 'error', tipo: 'nif-invalido', texto: `El NIF de ${c.nombre} (${c.cif}) no es válido: ${m}`, col: 'cuentas', registroId: c.id })
    } else if (esUE(c.codigoPais) && !/^[A-Z0-9]{2,13}$/.test(nifSinPrefijo(nif, c.codigoPais))) {
      add({ gravedad: 'aviso', tipo: 'nif-invalido', texto: `El NIF-IVA de ${c.nombre} (${c.cif}) no tiene un formato válido.`, col: 'cuentas', registroId: c.id })
    }
  }

  // ── tipo de operación coherente con el país y el régimen
  for (const f of ventas) {
    const c = cuentaDe(f.cuentaId); if (!c) continue
    const op = f.tipoOperacion || 'interior', n = ref(f)
    const err = (texto: string, gravedad: Incidencia['gravedad'] = 'error') => add({ gravedad, tipo: 'operacion-incoherente', texto, col: 'facturasVenta', registroId: f.id })
    if (fueraTerritorioIva(c)) {
      if (op === 'interior') err(`${n}: ${c.nombre} está en Canarias, Ceuta o Melilla, fuera del territorio del IVA; la operación no lleva IVA español.`, 'aviso')
    } else if (esEspana(c.codigoPais)) {
      if (op.startsWith('ue-') || op === 'fuera-ue') err(`${n}: ${c.nombre} es un cliente español y la factura está como «${op}».`)
    } else if (esUE(c.codigoPais)) {
      if (op === 'interior' || op === 'isp-interior' || op === 'fuera-ue') err(`${n}: ${c.nombre} es de ${c.codigoPais} (UE) y la factura está como «${op}».`)
      else if (op === 'ue-empresa' && c.particular) err(`${n}: ${c.nombre} es un particular y la factura está como venta a empresa de la UE (sin IVA).`)
      else if ((op === 'ue-particular' || op === 'ue-oss') && !c.particular) err(`${n}: ${c.nombre} está como empresa y la factura como venta a particular de la UE.`, 'aviso')
    } else if (op === 'interior') {
      err(`${n}: ${c.nombre} es de fuera de la UE (${c.codigoPais}); la consultoría y los servicios informáticos no se localizan en España (art. 69.Dos LIVA).`, c.particular ? 'aviso' : 'error')
    } else if (op.startsWith('ue-') || op === 'isp-interior') err(`${n}: ${c.nombre} es de fuera de la UE (${c.codigoPais}) y la factura está como «${op}».`)
    if (c.regimenIva === 'exento' && op !== 'exenta') err(`${n}: ${c.nombre} tiene régimen exento y la factura no está como exenta.`, 'aviso')
    if (c.regimenIva === 'intracomunitario' && op === 'interior') err(`${n}: ${c.nombre} tiene régimen intracomunitario y la factura lleva IVA español.`, 'aviso')

    // VIES
    if (op === 'ue-empresa') {
      if (c.viesValido === false) add({ gravedad: 'error', tipo: 'vies', texto: `${n}: el NIF-IVA de ${c.nombre} no es válido en VIES; sin él la venta no puede ir sin IVA.`, col: 'cuentas', registroId: c.id, id: `vies:${c.id}` })
      else if (c.viesValido !== true) add({ gravedad: 'aviso', tipo: 'vies', texto: `${c.nombre}: comprueba su NIF-IVA en VIES antes de facturar sin IVA a una empresa de la UE.`, col: 'cuentas', registroId: c.id, id: `vies:${c.id}` })
      if (c.tipoIdFiscal !== 'nifiva') add({ gravedad: 'aviso', tipo: 'vies', texto: `${c.nombre}: el tipo de identificación debería ser «NIF-IVA».`, col: 'cuentas', registroId: c.id, id: `vies-tipo:${c.id}` })
    }
  }
  for (const f of compras) {
    const c = cuentaDe(f.cuentaId); if (!c) continue
    const op = f.tipoOperacion || 'interior', n = ref(f)
    const err = (texto: string, gravedad: Incidencia['gravedad'] = 'error') => add({ gravedad, tipo: 'operacion-incoherente', texto, col: 'facturasCompra', registroId: f.id })
    if (esEspana(c.codigoPais) && !fueraTerritorioIva(c)) {
      if (op === 'ue' || op === 'fuera-ue' || op === 'importacion') err(`${n}: ${c.nombre} es un proveedor español y la compra está como «${op}».`)
    } else if (esUE(c.codigoPais)) {
      if (op === 'fuera-ue' || op === 'importacion') err(`${n}: ${c.nombre} es de ${c.codigoPais} (UE): es una adquisición intracomunitaria, no «${op}».`)
      else if (op === 'interior') err(`${n}: ${c.nombre} es de la UE y la factura trae IVA español; solo es correcto si está registrado a efectos del IVA en España.`, 'aviso')
      if (op === 'ue' && c.viesValido === false) add({ gravedad: 'aviso', tipo: 'vies', texto: `${n}: el NIF-IVA de ${c.nombre} no es válido en VIES.`, col: 'cuentas', registroId: c.id, id: `vies:${c.id}` })
    } else if (!esEspana(c.codigoPais)) {
      if (op === 'ue') err(`${n}: ${c.nombre} es de fuera de la UE (${c.codigoPais}) y la compra está como intracomunitaria.`)
      else if (op === 'interior') err(`${n}: ${c.nombre} es de fuera de la UE y la factura trae IVA español; revisa si debe ser inversión del sujeto pasivo.`, 'aviso')
    }
  }

  // ── retenciones
  for (const f of compras) {
    const irpf = Number(f.irpf) || 0, clave = f.claveRetencion || 'ninguna'
    if (clave !== 'ninguna' && !irpf) add({ gravedad: 'aviso', tipo: 'retencion-sin-tipo', texto: `${ref(f)}: tiene clave de retención «${clave}» pero un 0 % de IRPF.`, col: 'facturasCompra', registroId: f.id })
    if (irpf > 0 && clave === 'ninguna') add({ gravedad: 'error', tipo: 'retencion-sin-clave', texto: `${ref(f)}: tiene un ${irpf} % de IRPF sin clave de retención: no se sabe si va al 111 o al 115.`, col: 'facturasCompra', registroId: f.id })
  }

  // ── justificantes
  for (const f of compras) {
    const iva = totales(f).iva
    const isp = f.tipoOperacion === 'ue' || f.tipoOperacion === 'fuera-ue' || f.tipoOperacion === 'isp-interior'
    if ((iva > 0 || isp) && !String(f.enlace ?? '').trim()) add({ gravedad: 'aviso', tipo: 'sin-justificante', texto: `${ref(f)}: no tiene enlace al PDF de la factura; sin factura no se puede deducir el IVA.`, col: 'facturasCompra', registroId: f.id })
    if (f.fechaRecepcion && f.fechaRecepcion < f.fecha) add({ gravedad: 'aviso', tipo: 'fecha-recepcion', texto: `${ref(f)}: la fecha de recepción es anterior a la de la factura.`, col: 'facturasCompra', registroId: f.id })
    if (f.bienInversion && !(Number(f.vidaUtil) > 0)) add({ gravedad: 'aviso', tipo: 'sin-vida-util', texto: `${ref(f)}: es bien de inversión y no tiene vida útil para amortizarlo.`, col: 'facturasCompra', registroId: f.id })
  }
  for (const g of gastos) {
    // la lista de gastos no trae la foto descargada: basta con `tieneFoto`
    if ((Number(g.iva) || 0) > 0 && !String(g.enlace ?? '').trim() && !String(g.foto ?? '').trim() && !g.tieneFoto) {
      add({ gravedad: 'aviso', tipo: 'sin-justificante', texto: `Gasto ${g.no} (${g.concepto}): tiene IVA y no hay ni PDF ni foto del ticket.`, col: 'gastos', registroId: g.id })
    }
    if (g.deducible && !g.facturaCompleta && (Number(g.iva) || 0) > 0) {
      add({ gravedad: 'aviso', tipo: 'ticket-deducible', texto: `Gasto ${g.no} (${g.concepto}): está marcado con IVA deducible pero no es factura completa; ese IVA no se deduce.`, col: 'gastos', registroId: g.id })
    }
  }

  // ── duplicados
  const todasCompras = crm.facturasCompra.filter(f => f.estado !== 'anulada')
  const idsCompras = new Set(compras.map(f => f.id))
  for (let i = 0; i < todasCompras.length; i++) {
    for (let j = i + 1; j < todasCompras.length; j++) {
      const a = todasCompras[i], b = todasCompras[j]
      if (!a.cuentaId || a.cuentaId !== b.cuentaId || (!idsCompras.has(a.id) && !idsCompras.has(b.id))) continue
      const nombre = cuentaDe(a.cuentaId)?.nombre ?? ''
      if (normal(a.noProveedor) && normal(a.noProveedor) === normal(b.noProveedor)) {
        add({ gravedad: 'error', tipo: 'compra-duplicada', texto: `${ref(a)} y ${ref(b)}: la misma factura n.º ${a.noProveedor} de ${nombre} está registrada dos veces.`, col: 'facturasCompra', registroId: b.id })
      } else if (a.fecha === b.fecha && r2(totales(a).total) === r2(totales(b).total)) {
        add({ gravedad: 'aviso', tipo: 'compra-duplicada', texto: `${ref(a)} y ${ref(b)}: dos facturas de ${nombre} del mismo día y por el mismo importe; ¿es la misma?`, col: 'facturasCompra', registroId: b.id })
      }
    }
  }
  const totalGasto = (g: Gasto) => r2(Number(g.total) || 0)
  for (const g of gastos) {
    if (!g.proveedorId) continue
    const igual = todasCompras.find(f => f.cuentaId === g.proveedorId && f.fecha === g.fecha && r2(totales(f).total - (totales(f).base * (Number(f.irpf) || 0) / 100)) === totalGasto(g))
    if (igual) add({ gravedad: 'aviso', tipo: 'gasto-duplicado', texto: `Gasto ${g.no} y factura ${ref(igual)}: mismo proveedor, día e importe. Si son lo mismo, enlaza el gasto con la factura para no contarlo dos veces.`, col: 'gastos', registroId: g.id })
    const otro = gestion.gastos.find(h => h.id !== g.id && !h.facturaCompraId && h.proveedorId === g.proveedorId && h.fecha === g.fecha && totalGasto(h) === totalGasto(g))
    if (otro && otro.id > g.id) add({ gravedad: 'aviso', tipo: 'gasto-duplicado', texto: `Gastos ${g.no} y ${otro.no}: mismo proveedor, día e importe; ¿es el mismo ticket?`, col: 'gastos', registroId: otro.id })
  }

  // ── numeración de las facturas de venta registradas, por serie (FV-, FR-…)
  const series = new Map<string, { n: number; f: FacturaVenta }[]>()
  for (const f of crm.facturasVenta) {
    if (!vale(f.estado) || !f.no) continue
    const [serie, num] = serieYNumero(f.no)
    if (!/^\d+$/.test(num)) continue
    const l = series.get(serie) ?? []
    l.push({ n: Number(num), f })
    series.set(serie, l)
  }
  for (const [serie, l] of series) {
    l.sort((a, b) => a.n - b.n)
    for (let i = 1; i < l.length; i++) {
      const prev = l[i - 1], cur = l[i]
      if (!enP(cur.f.fecha) && !enP(prev.f.fecha)) continue
      if (cur.n === prev.n) {
        add({ gravedad: 'error', tipo: 'numero-repetido', texto: `El número ${cur.f.no} está en dos facturas registradas.`, col: 'facturasVenta', registroId: cur.f.id })
      } else if (cur.n > prev.n + 1) {
        const faltan = cur.n - prev.n - 1
        const ancho = serieYNumero(prev.f.no).at(1)?.length ?? 0
        const primero = serie + String(prev.n + 1).padStart(ancho, '0')
        const anulada = crm.facturasVenta.find(f => f.estado === 'anulada' && f.no === primero)
        add({
          gravedad: anulada ? 'aviso' : 'error', tipo: 'salto-numeracion', col: 'facturasVenta', registroId: cur.f.id,
          texto: `Salto en la serie ${serie}: entre ${prev.f.no} y ${cur.f.no} falta${faltan > 1 ? `n ${faltan} números` : ` el ${primero}`}`
            + (anulada ? ' (está anulada: debe constar su anulación).' : '. La numeración tiene que ser correlativa.'),
        })
      }
      if (cur.n > prev.n && cur.f.fecha < prev.f.fecha) {
        add({ gravedad: 'aviso', tipo: 'orden-fechas', texto: `${cur.f.no} tiene fecha anterior a ${prev.f.no}: en una serie, los números y las fechas deben ir en orden.`, col: 'facturasVenta', registroId: cur.f.id })
      }
    }
  }

  // ── pendientes y borradores con fecha en el periodo
  for (const f of crm.facturasCompra) {
    if (f.estado === 'pendiente' && (enP(f.fecha) || enP(fechaCompra(f)))) {
      add({ gravedad: 'aviso', tipo: 'compra-pendiente', texto: `${ref(f)} (${cuentaDe(f.cuentaId)?.nombre ?? 'sin proveedor'}): pendiente de registrar con fecha en el periodo; no entra en los modelos hasta registrarla.`, col: 'facturasCompra', registroId: f.id })
    }
  }
  for (const f of ventas) {
    if (f.estado === 'borrador') add({ gravedad: 'aviso', tipo: 'venta-borrador', texto: `Factura en borrador para ${cuentaDe(f.cuentaId)?.nombre ?? 'sin cliente'} con fecha ${f.fecha}: regístrala o cambia la fecha antes de cerrar el periodo.`, col: 'facturasVenta', registroId: f.id })
  }

  // ── rectificativas
  for (const f of ventas) {
    if (!String(f.tipoFactura ?? '').startsWith('R')) continue
    if (!f.rectificadaId) add({ gravedad: 'error', tipo: 'rectificativa-sin-original', texto: `${ref(f)}: es rectificativa (${f.tipoFactura}) y no indica qué factura rectifica.`, col: 'facturasVenta', registroId: f.id })
    else if (!crm.facturasVenta.some(x => x.id === f.rectificadaId)) add({ gravedad: 'error', tipo: 'rectificativa-sin-original', texto: `${ref(f)}: la factura que rectifica no existe.`, col: 'facturasVenta', registroId: f.id })
  }

  // ── IVA de las ventas interiores
  for (const f of ventasValidas) {
    if ((f.tipoOperacion || 'interior') !== 'interior') continue
    const tipos = [...new Set(f.lineas.map(l => Number(l.iva ?? 21) || 0))]
    const raros = tipos.filter(t => ![0, 4, 10, 21].includes(t))
    if (raros.length) add({ gravedad: 'aviso', tipo: 'tipo-iva', texto: `${ref(f)}: tipo de IVA ${raros.join(', ')} % que no existe en el 303.`, col: 'facturasVenta', registroId: f.id })
    else if (tipos.includes(0)) add({ gravedad: 'aviso', tipo: 'tipo-iva', texto: `${ref(f)}: venta interior con líneas al 0 %; si es exenta, márcala como exenta.`, col: 'facturasVenta', registroId: f.id })
  }

  // ── ROI
  if (perfil && !perfil.roi) {
    const ue = ventasValidas.some(f => f.tipoOperacion === 'ue-empresa') || compras.some(f => vale(f.estado) && f.tipoOperacion === 'ue')
    if (ue) add({ gravedad: 'error', tipo: 'sin-roi', texto: 'Hay operaciones intracomunitarias y la sociedad no está dada de alta en el ROI (036).', col: 'perfil', registroId: perfil.id })
  }

  // ── Verifactu: solo facturas registradas desde el alta (o desde que existe la configuración)
  const config = gestoria.verifactu[0]
  if (config) {
    const inicio = String(config.altaEl || config.creadoEl || '').slice(0, 10)
    for (const f of ventasValidas) {
      const registrada = String(f.registradaEl || f.fecha).slice(0, 10)
      if (inicio && registrada < inicio) continue
      const regs = gestoria.registros.filter(r => r.facturaId === f.id && r.tipo === 'alta').sort((a, b) => (b.orden || 0) - (a.orden || 0) || String(b.creadoEl).localeCompare(String(a.creadoEl)))
      const ultimo = regs[0]
      if (!ultimo) {
        add({ gravedad: 'error', tipo: 'verifactu-sin-registro', texto: `${ref(f)}: registrada sin registro de facturación de Verifactu.` + (registrada >= VERIFACTU_OBLIGATORIO_SOCIEDADES ? ' Desde 2027 es obligatorio.' : ''), col: 'verifactu', registroId: f.id })
      } else if (ultimo.estado === 'rechazado' || f.estadoVerifactu === 'rechazado') {
        add({ gravedad: 'error', tipo: 'verifactu-rechazado', texto: `${ref(f)}: la AEAT rechazó su registro de Verifactu${ultimo.descripcionError ? ` (${ultimo.codigoError} ${ultimo.descripcionError})` : ''}; hay que corregirlo y volver a enviarlo.`, col: 'verifactu', registroId: f.id })
      } else if (ultimo.estado === 'aceptado-errores') {
        add({ gravedad: 'aviso', tipo: 'verifactu-errores', texto: `${ref(f)}: registro de Verifactu aceptado con errores${ultimo.descripcionError ? ` (${ultimo.descripcionError})` : ''}; conviene subsanarlo.`, col: 'verifactu', registroId: f.id })
      }
    }
  }

  // ── cambios después de presentar el 303 (complementaria)
  const p303 = gestoria.presentaciones.filter(p => p.modelo === '303' && estaPresentada(p) && p.presentadaEl)
  const presentacionDe = (dia: string): Presentacion | undefined => p303
    .filter(p => { const x = periodoDeClave(p.periodo); if (!x) return false; const r = rangoPeriodo(x); return dia >= r.desde && dia <= r.hasta })
    .sort((a, b) => instante(b.presentadaEl) - instante(a.presentadaEl))[0]
  const revisarCambio = (col: Incidencia['col'], id: string, nombre: string, dia: string, creadoEl: string, actualizadoEl: string | null | undefined, cuenta: boolean) => {
    if (!enP(dia)) return
    const p = presentacionDe(dia); if (!p) return
    const pres = instante(p.presentadaEl)
    const cambiado = instante(actualizadoEl) > pres || instante(creadoEl) > pres
    const fuera = cuenta && p.incluidos?.length > 0 && !p.incluidos.includes(id)
    const sobra = !cuenta && p.incluidos?.includes(id)
    if (cambiado || fuera || sobra) {
      add({
        gravedad: 'aviso', tipo: 'complementaria', col, registroId: id,
        texto: `${nombre}: ${sobra ? 'se incluyó en el 303 y ya no cuenta' : fuera ? 'no estaba en el 303 presentado' : 'ha cambiado después de presentar el 303'} de ${etiquetaDeClave(p.periodo)}. Puede hacer falta una autoliquidación rectificativa.`,
      })
    }
  }
  for (const f of crm.facturasVenta) revisarCambio('facturasVenta', f.id, `Factura ${ref(f)}`, f.fecha, f.creadoEl, f.actualizadoEl, vale(f.estado))
  for (const f of crm.facturasCompra) revisarCambio('facturasCompra', f.id, `Factura ${ref(f)}`, fechaCompra(f), f.creadoEl, f.actualizadoEl, vale(f.estado))
  for (const g of gestion.gastos) revisarCambio('gastos', g.id, `Gasto ${g.no}`, g.fecha, g.creadoEl, g.actualizadoEl, !g.facturaCompraId)

  const peso = (i: Incidencia) => (i.gravedad === 'error' ? 0 : 1)
  return out.sort((a, b) => peso(a) - peso(b) || a.col.localeCompare(b.col) || a.tipo.localeCompare(b.tipo))
}
