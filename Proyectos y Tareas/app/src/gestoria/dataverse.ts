/**
 * Repositorio de la Gestoría sobre Dataverse (tablas loc_perfilfiscal,
 * loc_presentacion, loc_asiento, loc_verifactuconfig, loc_registrofacturacion
 * y loc_envioverifactu de la solución LocodeaObjetivos; el esquema lo crea
 * scripts/gestoria-esquema.mjs).
 *
 * Mismas reglas que ../gestion/dataverse.ts: el id es el GUID de la fila y se
 * manda como clave primaria al crear; los catálogos son columnas Choice
 * (valores 4120005xx); las búsquedas se leen de `_loc_x_value` y se escriben
 * con `loc_X@odata.bind`. Lo que tiene forma de lista o de diccionario
 * (casillas, líneas de asiento, bases negativas) viaja como JSON en texto largo.
 *
 * Usa el cliente de datos de la Code App con el nombre de cada fuente (el
 * conjunto de entidades), igual que los servicios generados: así no hace falta
 * un servicio por tabla y, mientras una tabla no esté añadida como fuente de
 * datos (`pa app add data-source`), el módulo lo dice en vez de romperse.
 */
import { getClient } from '@microsoft/power-apps/data'
import { dataSourcesInfo } from '../../.power/schemas/appschemas/dataSourcesInfo'
import type { TipoFactura } from '../crm/types'
import type { GestoriaRepositorio } from './repo'
import type {
  AsientoManual, ColGestoria, ConfigVerifactu, EntornoVerifactu, EnvioVerifactu, EstadoEnvio, EstadoPresentacion, EstadoRegistro, GestoriaInstantanea,
  ModeloFiscal, PerfilFiscal, PeriodicidadIva, Presentacion, RegistroFacturacion, RegistroGestoria, RegistroGestoriaDe, TipoAsiento, TipoRegistro,
} from './types'
import { COLECCIONES_GESTORIA } from './types'

// ─────────────────────────────────────────────── choices (mismos valores que scripts/gestoria-esquema.mjs)

function inverso<T extends string>(m: Record<T, number>): Record<number, T> {
  const r = {} as Record<number, T>
  for (const k of Object.keys(m) as T[]) r[m[k]] = k
  return r
}

const PERIODICIDAD: Record<PeriodicidadIva, number> = { trimestral: 412000530, mensual: 412000531 }
const EST_PRESENTACION: Record<EstadoPresentacion, number> = {
  pendiente: 412000540, preparada: 412000541, presentada: 412000542, pagada: 412000543, domiciliada: 412000544, 'no-procede': 412000545,
}
const TIPO_ASIENTO: Record<TipoAsiento, number> = {
  apertura: 412000550, capital: 412000551, ajuste: 412000552, amortizacion: 412000553, periodificacion: 412000554, impuesto: 412000555,
  regularizacion: 412000556, cierre: 412000557, otro: 412000558,
}
const ENTORNO: Record<EntornoVerifactu, number> = { preparacion: 412000560, pruebas: 412000561, produccion: 412000562 }
const TIPO_REGISTRO: Record<TipoRegistro, number> = { alta: 412000570, anulacion: 412000571 }
const EST_REGISTRO: Record<EstadoRegistro, number> = { simulado: 412000575, pendiente: 412000576, correcto: 412000577, 'aceptado-errores': 412000578, rechazado: 412000579 }
const EST_ENVIO: Record<EstadoEnvio, number> = { correcto: 412000585, parcial: 412000586, incorrecto: 412000587, error: 412000588 }
const TIPO_FACTURA: Record<TipoFactura, number> = { F1: 412000480, F2: 412000481, F3: 412000482, R1: 412000483, R2: 412000484, R3: 412000485, R4: 412000486, R5: 412000487 }

const DE = {
  periodicidad: inverso(PERIODICIDAD), presentacion: inverso(EST_PRESENTACION), asiento: inverso(TIPO_ASIENTO), entorno: inverso(ENTORNO),
  registro: inverso(TIPO_REGISTRO), estRegistro: inverso(EST_REGISTRO), envio: inverso(EST_ENVIO), tipoFactura: inverso(TIPO_FACTURA),
}

// ─────────────────────────────────────────────── utilidades

/* eslint-disable @typescript-eslint/no-explicit-any */
type Fila = any
type Payload = Record<string, unknown>

interface Resultado { success?: boolean; data?: unknown; error?: unknown }

function comprobar<T extends Resultado>(r: T, donde: string): T {
  if (r && r.success === false) {
    const e = r.error
    throw e instanceof Error ? e : new Error(`Dataverse falló al ${donde}`)
  }
  return r
}

const lista = (r: Resultado): Fila[] => (Array.isArray(r?.data) ? r.data : [])
const ref = (conjunto: string, id: string | null | undefined): string | null => (id ? `/${conjunto}(${id})` : null)
const txt = (v: unknown): string => (v === undefined || v === null ? '' : String(v))
const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v) || 0)
const nulo = (v: unknown): string | null => (v ? String(v) : null)
const dia = (v: unknown): string => (v ? String(v).slice(0, 10) : '')
const diaONulo = (v: unknown): string | null => (v ? String(v).slice(0, 10) : null)
const fechaONulo = (v: string | null | undefined): string | null => (v ? v : null)

/** JSON guardado en texto largo; si está vacío o roto, el valor por defecto. */
function json<T>(v: unknown, defecto: T): T {
  if (!v) return defecto
  try { return JSON.parse(String(v)) as T } catch { return defecto }
}

// ─────────────────────────────────────────────── tablas

const cliente = getClient(dataSourcesInfo)
const fuentes = dataSourcesInfo as Record<string, unknown>

interface Tabla<K extends ColGestoria> {
  conjunto: string
  clave: string
  leer: (f: Fila) => RegistroGestoriaDe<K>
  escribir: (o: RegistroGestoriaDe<K>) => Payload
}

const base = (f: Fila, clave: string) => ({ id: f[clave] as string, creadoEl: txt(f.createdon), actualizadoEl: nulo(f.modifiedon) })

const perfil: Tabla<'perfil'> = {
  conjunto: 'loc_perfilfiscals', clave: 'loc_perfilfiscalid',
  leer: (f): PerfilFiscal => ({
    ...base(f, 'loc_perfilfiscalid'), razonSocial: txt(f.loc_razonsocial), nif: txt(f.loc_nif), domicilio: txt(f.loc_domicilio),
    fechaConstitucion: dia(f.loc_fechaconstitucion), mesCierre: num(f.loc_mescierre) || 12, periodicidadIva: DE.periodicidad[f.loc_periodicidadiva] ?? 'trimestral',
    criterioCaja: f.loc_criteriocaja === true, roi: f.loc_roi !== false, oss: f.loc_oss === true, nuevaCreacion: f.loc_nuevacreacion !== false,
    primerEjercicioPositivo: num(f.loc_primerejerciciopositivo), cifraNegocios: num(f.loc_cifranegocios),
    administradoresRetribuidos: f.loc_administradoresretribuidos === true, retencionAdministradores: num(f.loc_retencionadministradores) || 19,
    empleados: f.loc_empleados === true, alquilerLocal: f.loc_alquilerlocal === true, dividendosOPrestamosSocios: f.loc_dividendosprestamos === true,
    operacionesVinculadas: f.loc_operacionesvinculadas === true, ibanDomiciliacion: txt(f.loc_ibandomiciliacion), saldoBanco: num(f.loc_saldobanco),
    saldoBancoFecha: dia(f.loc_saldobancofecha), basesNegativas: json(f.loc_basesnegativas, {}), notas: txt(f.loc_notas),
  }),
  escribir: p => ({
    loc_razonsocial: p.razonSocial.slice(0, 200) || 'Locodea SL', loc_nif: p.nif.slice(0, 20), loc_domicilio: p.domicilio.slice(0, 300),
    loc_fechaconstitucion: fechaONulo(p.fechaConstitucion), loc_mescierre: Math.round(num(p.mesCierre)) || 12, loc_periodicidadiva: PERIODICIDAD[p.periodicidadIva],
    loc_criteriocaja: !!p.criterioCaja, loc_roi: !!p.roi, loc_oss: !!p.oss, loc_nuevacreacion: !!p.nuevaCreacion,
    loc_primerejerciciopositivo: Math.round(num(p.primerEjercicioPositivo)), loc_cifranegocios: num(p.cifraNegocios),
    loc_administradoresretribuidos: !!p.administradoresRetribuidos, loc_retencionadministradores: num(p.retencionAdministradores), loc_empleados: !!p.empleados,
    loc_alquilerlocal: !!p.alquilerLocal, loc_dividendosprestamos: !!p.dividendosOPrestamosSocios, loc_operacionesvinculadas: !!p.operacionesVinculadas,
    loc_ibandomiciliacion: p.ibanDomiciliacion.slice(0, 40), loc_saldobanco: num(p.saldoBanco), loc_saldobancofecha: fechaONulo(p.saldoBancoFecha),
    loc_basesnegativas: JSON.stringify(p.basesNegativas ?? {}), loc_notas: p.notas,
  }),
}

const presentaciones: Tabla<'presentaciones'> = {
  conjunto: 'loc_presentacions', clave: 'loc_presentacionid',
  leer: (f): Presentacion => ({
    ...base(f, 'loc_presentacionid'), modelo: txt(f.loc_modelo) as ModeloFiscal, periodo: txt(f.loc_periodo), estado: DE.presentacion[f.loc_estado] ?? 'pendiente',
    importe: num(f.loc_importe), presentadaEl: diaONulo(f.loc_presentadael), csv: txt(f.loc_csv), nrc: txt(f.loc_nrc), justificante: txt(f.loc_justificante),
    casillas: json(f.loc_casillas, {}), incluidos: json(f.loc_incluidos, []), complementariaDe: nulo(f.loc_complementariade), notas: txt(f.loc_notas),
  }),
  escribir: p => ({
    loc_nombre: `${p.modelo} · ${p.periodo}`, loc_modelo: p.modelo, loc_periodo: p.periodo, loc_estado: EST_PRESENTACION[p.estado], loc_importe: num(p.importe),
    loc_presentadael: fechaONulo(p.presentadaEl), loc_csv: p.csv.slice(0, 40), loc_nrc: p.nrc.slice(0, 40), loc_justificante: p.justificante.slice(0, 500),
    loc_casillas: JSON.stringify(p.casillas ?? {}), loc_incluidos: JSON.stringify(p.incluidos ?? []), loc_complementariade: p.complementariaDe ?? '', loc_notas: p.notas,
  }),
}

const asientos: Tabla<'asientos'> = {
  conjunto: 'loc_asientos', clave: 'loc_asientoid',
  leer: (f): AsientoManual => ({
    ...base(f, 'loc_asientoid'), fecha: dia(f.loc_fecha), ejercicio: num(f.loc_ejercicio), tipo: DE.asiento[f.loc_tipo] ?? 'otro',
    concepto: txt(f.loc_concepto), lineas: json(f.loc_lineas, []),
  }),
  escribir: a => ({
    loc_concepto: a.concepto.slice(0, 300) || 'Asiento', loc_fecha: fechaONulo(a.fecha), loc_ejercicio: Math.round(num(a.ejercicio)), loc_tipo: TIPO_ASIENTO[a.tipo],
    loc_lineas: JSON.stringify(a.lineas ?? []),
  }),
}

const verifactu: Tabla<'verifactu'> = {
  conjunto: 'loc_verifactuconfigs', clave: 'loc_verifactuconfigid',
  leer: (f): ConfigVerifactu => ({
    ...base(f, 'loc_verifactuconfigid'), entorno: DE.entorno[f.loc_entorno] ?? 'preparacion', nifEmisor: txt(f.loc_nifemisor), razonSocial: txt(f.loc_razonsocial),
    certificadoRef: txt(f.loc_certificadoref), certificadoCaduca: diaONulo(f.loc_certificadocaduca), servicioUrl: txt(f.loc_serviciourl),
    sistemaNombre: txt(f.loc_sistemanombre), sistemaId: txt(f.loc_sistemaid), sistemaVersion: txt(f.loc_sistemaversion), numeroInstalacion: txt(f.loc_numeroinstalacion),
    altaEl: diaONulo(f.loc_altael), declaracionFirmadaEl: diaONulo(f.loc_declaracionfirmadael), declaracionFirmante: txt(f.loc_declaracionfirmante),
  }),
  escribir: v => ({
    loc_razonsocial: v.razonSocial.slice(0, 200) || 'Locodea SL', loc_entorno: ENTORNO[v.entorno], loc_nifemisor: v.nifEmisor.slice(0, 20),
    loc_certificadoref: v.certificadoRef.slice(0, 200), loc_certificadocaduca: fechaONulo(v.certificadoCaduca), loc_serviciourl: v.servicioUrl.slice(0, 500),
    loc_sistemanombre: v.sistemaNombre.slice(0, 100), loc_sistemaid: v.sistemaId.slice(0, 10), loc_sistemaversion: v.sistemaVersion.slice(0, 20),
    loc_numeroinstalacion: v.numeroInstalacion.slice(0, 50), loc_altael: fechaONulo(v.altaEl), loc_declaracionfirmadael: fechaONulo(v.declaracionFirmadaEl),
    loc_declaracionfirmante: v.declaracionFirmante.slice(0, 200),
  }),
}

const registros: Tabla<'registros'> = {
  conjunto: 'loc_registrofacturacions', clave: 'loc_registrofacturacionid',
  leer: (f): RegistroFacturacion => ({
    ...base(f, 'loc_registrofacturacionid'), tipo: DE.registro[f.loc_tipo] ?? 'alta', facturaId: txt(f._loc_facturaventa_value), nifEmisor: txt(f.loc_nifemisor),
    serieNumero: txt(f.loc_serienumero), fechaExpedicion: dia(f.loc_fechaexpedicion), tipoFactura: DE.tipoFactura[f.loc_tipofactura] ?? 'F1',
    cuotaTotal: num(f.loc_cuotatotal), importeTotal: num(f.loc_importetotal), huella: txt(f.loc_huella), huellaAnterior: txt(f.loc_huellaanterior),
    fechaHoraGeneracion: txt(f.loc_fechahorageneracion), xml: txt(f.loc_xml), estado: DE.estRegistro[f.loc_estado] ?? 'simulado',
    entorno: DE.entorno[f.loc_entorno] ?? 'preparacion', codigoError: txt(f.loc_codigoerror), descripcionError: txt(f.loc_descripcionerror),
    csv: txt(f.loc_csv), envioId: f._loc_envio_value ?? null, orden: num(f.loc_orden),
  }),
  escribir: r => ({
    loc_serienumero: r.serieNumero.slice(0, 60) || '—', loc_tipo: TIPO_REGISTRO[r.tipo], loc_nifemisor: r.nifEmisor.slice(0, 20),
    loc_fechaexpedicion: fechaONulo(r.fechaExpedicion), loc_tipofactura: TIPO_FACTURA[r.tipoFactura], loc_cuotatotal: num(r.cuotaTotal),
    loc_importetotal: num(r.importeTotal), loc_huella: r.huella.slice(0, 100), loc_huellaanterior: r.huellaAnterior.slice(0, 100),
    loc_fechahorageneracion: r.fechaHoraGeneracion.slice(0, 40), loc_xml: r.xml, loc_estado: EST_REGISTRO[r.estado], loc_entorno: ENTORNO[r.entorno],
    loc_codigoerror: r.codigoError.slice(0, 20), loc_descripcionerror: r.descripcionError.slice(0, 4000), loc_csv: r.csv.slice(0, 40), loc_orden: Math.round(num(r.orden)),
    'loc_FacturaVenta@odata.bind': ref('loc_facturaventas', r.facturaId || null), 'loc_Envio@odata.bind': ref('loc_envioverifactus', r.envioId),
  }),
}

const envios: Tabla<'envios'> = {
  conjunto: 'loc_envioverifactus', clave: 'loc_envioverifactuid',
  leer: (f): EnvioVerifactu => ({
    ...base(f, 'loc_envioverifactuid'), fecha: txt(f.loc_fecha), entorno: DE.entorno[f.loc_entorno] ?? 'preparacion', registros: num(f.loc_registros),
    estado: DE.envio[f.loc_estado] ?? 'error', csv: txt(f.loc_csv), respuesta: txt(f.loc_respuesta), esperaSegundos: num(f.loc_esperasegundos),
  }),
  escribir: e => ({
    loc_nombre: `Envío ${e.fecha.slice(0, 16).replace('T', ' ')}`, loc_fecha: e.fecha.slice(0, 40), loc_entorno: ENTORNO[e.entorno], loc_registros: Math.round(num(e.registros)),
    loc_estado: EST_ENVIO[e.estado], loc_csv: e.csv.slice(0, 40), loc_respuesta: e.respuesta, loc_esperasegundos: Math.round(num(e.esperaSegundos)),
  }),
}

const TABLAS: { [K in ColGestoria]: Tabla<K> } = { perfil, presentaciones, asientos, verifactu, registros, envios }

// ─────────────────────────────────────────────── repositorio

const TOPE = 5000
const conocidos = new Map<ColGestoria, Set<string>>()

/** Todas las tablas están añadidas como fuentes de datos de la Code App. */
const conFuentes = COLECCIONES_GESTORIA.every(c => TABLAS[c].conjunto in fuentes)

export const gestoriaRepoDataverse: GestoriaRepositorio = {
  disponible: conFuentes,

  async cargar() {
    const filas = await Promise.all(COLECCIONES_GESTORIA.map(c =>
      cliente.retrieveMultipleRecordsAsync<Fila>(TABLAS[c].conjunto, { top: TOPE }).then(r => comprobar(r as Resultado, `leer ${c}`))))
    const d = Object.fromEntries(COLECCIONES_GESTORIA.map((c, i) => [c, lista(filas[i]).map(f => TABLAS[c].leer(f))])) as unknown as GestoriaInstantanea
    for (const c of COLECCIONES_GESTORIA) conocidos.set(c, new Set((d[c] as RegistroGestoria[]).map(o => o.id)))
    return d
  },

  async guardar(col, obj) {
    const t = TABLAS[col] as unknown as Tabla<typeof col>
    const ids = conocidos.get(col) ?? new Set<string>()
    conocidos.set(col, ids)
    const cuerpo = t.escribir(obj)
    if (ids.has(obj.id)) {
      comprobar(await cliente.updateRecordAsync<Payload, Fila>(t.conjunto, obj.id, cuerpo) as Resultado, `actualizar ${col}`)
    } else {
      comprobar(await cliente.createRecordAsync<Payload, Fila>(t.conjunto, { ...cuerpo, [t.clave]: obj.id, statecode: 0 }) as Resultado, `crear en ${col}`)
      ids.add(obj.id)
    }
    return obj
  },

  async borrar(col, id) {
    await cliente.deleteRecordAsync(TABLAS[col].conjunto, id)
    conocidos.get(col)?.delete(id)
  },
}
