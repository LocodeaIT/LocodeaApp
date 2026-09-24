/**
 * Repositorio de Gestión sobre Dataverse (tablas loc_gasto y loc_documento de
 * la solución LocodeaObjetivos; el esquema lo crea scripts/gestion-esquema.mjs).
 *
 * Mismas reglas que ../crm/dataverse.ts: el id es el GUID de la fila y se
 * manda como clave primaria al crear; los catálogos son columnas Choice
 * (valores 4120004xx); las búsquedas se leen de `_loc_x_value` y se escriben
 * con `loc_X@odata.bind`. La foto del ticket viaja como data URL en una
 * columna de texto largo (1 MB), comprimida antes por el formulario.
 */
import type { GestionRepositorio } from './repo'
import type { CategoriaGasto, ColGestion, DocumentoGestion, EstadoGasto, Gasto, GestionInstantanea, MetodoPagoGasto, RegistroGestion, RegistroGestionDe, TipoDocumento } from './types'
import { COLECCIONES_GESTION } from './types'
import { Loc_gastosService } from '../generated/services/Loc_gastosService'
import { Loc_documentosService } from '../generated/services/Loc_documentosService'

// ─────────────────────────────────────────────── choices (mismos valores que scripts/gestion-esquema.mjs)

function inverso<T extends string>(m: Record<T, number>): Record<number, T> {
  const r = {} as Record<number, T>
  for (const k of Object.keys(m) as T[]) r[m[k]] = k
  return r
}

const CATEGORIA: Record<CategoriaGasto, number> = {
  viajes: 412000400, dietas: 412000401, software: 412000402, hosting: 412000403, material: 412000404, formacion: 412000405,
  marketing: 412000406, asesoria: 412000407, telefonia: 412000408, suministros: 412000409, otros: 412000410,
}
const ESTADO: Record<EstadoGasto, number> = { pendiente: 412000415, pagado: 412000416, reembolsar: 412000417, reembolsado: 412000418 }
const METODO: Record<MetodoPagoGasto, number> = { tarjeta: 412000420, transferencia: 412000421, domiciliacion: 412000422, efectivo: 412000423 }
const TIPO_DOC: Record<TipoDocumento, number> = {
  contrato: 412000430, nda: 412000431, sepa: 412000432, certificado: 412000433, escritura: 412000434, cif: 412000435, lopd: 412000436, poder: 412000437, otro: 412000438,
}
const DE = { categoria: inverso(CATEGORIA), estado: inverso(ESTADO), metodo: inverso(METODO), tipoDoc: inverso(TIPO_DOC) }

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

interface Servicio {
  create(r: any): Promise<Resultado>
  update(id: string, r: any): Promise<Resultado>
  delete(id: string): Promise<void>
  getAll(o?: any): Promise<Resultado>
}

interface Tabla<K extends ColGestion> {
  conjunto: string
  clave: string
  servicio: Servicio
  leer: (f: Fila) => RegistroGestionDe<K>
  escribir: (o: RegistroGestionDe<K>) => Payload
}

const base = (f: Fila, clave: string) => ({ id: f[clave] as string, creadoEl: txt(f.createdon), actualizadoEl: nulo(f.modifiedon) })

const gastos: Tabla<'gastos'> = {
  conjunto: 'loc_gastos', clave: 'loc_gastoid', servicio: Loc_gastosService,
  leer: (f): Gasto => ({
    ...base(f, 'loc_gastoid'), no: txt(f.loc_numero), concepto: txt(f.loc_concepto), fecha: dia(f.loc_fecha), base: num(f.loc_base),
    iva: num(f.loc_iva), irpf: num(f.loc_irpf), total: num(f.loc_total), categoria: DE.categoria[f.loc_categoria] ?? 'otros',
    estado: DE.estado[f.loc_estado] ?? 'pagado', metodoPago: DE.metodo[f.loc_metodopago] ?? 'tarjeta', recurrente: f.loc_recurrente === true,
    diaCargo: num(f.loc_diacargo) || 1, deducible: f.loc_deducible !== false, noFactura: txt(f.loc_nofactura), enlace: txt(f.loc_enlace),
    foto: txt(f.loc_foto), notas: txt(f.loc_notas), proveedorId: f._loc_proveedor_value ?? null, proyectoId: f._loc_proyecto_value ?? null,
    pagadorId: f._loc_pagador_value ?? null, facturaCompraId: f._loc_facturacompra_value ?? null,
  }),
  escribir: g => ({
    loc_numero: g.no, loc_concepto: g.concepto.slice(0, 300), loc_fecha: fechaONulo(g.fecha), loc_base: num(g.base), loc_iva: num(g.iva),
    loc_irpf: num(g.irpf), loc_total: num(g.total), loc_categoria: CATEGORIA[g.categoria], loc_estado: ESTADO[g.estado],
    loc_metodopago: METODO[g.metodoPago], loc_recurrente: !!g.recurrente, loc_diacargo: Math.round(num(g.diaCargo)) || 1,
    loc_deducible: !!g.deducible, loc_nofactura: g.noFactura.slice(0, 100), loc_enlace: g.enlace.slice(0, 500), loc_foto: g.foto, loc_notas: g.notas,
    'loc_Proveedor@odata.bind': ref('loc_cuentas', g.proveedorId), 'loc_Proyecto@odata.bind': ref('loc_proyectos', g.proyectoId),
    'loc_Pagador@odata.bind': ref('loc_miembros', g.pagadorId), 'loc_FacturaCompra@odata.bind': ref('loc_facturacompras', g.facturaCompraId),
  }),
}

const documentos: Tabla<'documentos'> = {
  conjunto: 'loc_documentos', clave: 'loc_documentoid', servicio: Loc_documentosService,
  leer: (f): DocumentoGestion => ({
    ...base(f, 'loc_documentoid'), nombre: txt(f.loc_nombre), tipo: DE.tipoDoc[f.loc_tipo] ?? 'otro', caduca: diaONulo(f.loc_caduca),
    avisoDias: num(f.loc_avisodias) || 30, enlace: txt(f.loc_enlace), firmado: f.loc_firmado === true, firmadoEl: diaONulo(f.loc_firmadoel),
    notas: txt(f.loc_notas), cuentaId: f._loc_cuenta_value ?? null, responsableId: f._loc_responsable_value ?? null,
  }),
  escribir: d => ({
    loc_nombre: d.nombre.slice(0, 300), loc_tipo: TIPO_DOC[d.tipo], loc_caduca: fechaONulo(d.caduca), loc_avisodias: Math.round(num(d.avisoDias)) || 30,
    loc_enlace: d.enlace.slice(0, 500), loc_firmado: !!d.firmado, loc_firmadoel: fechaONulo(d.firmadoEl), loc_notas: d.notas,
    'loc_Cuenta@odata.bind': ref('loc_cuentas', d.cuentaId), 'loc_Responsable@odata.bind': ref('loc_miembros', d.responsableId),
  }),
}

const TABLAS: { [K in ColGestion]: Tabla<K> } = { gastos, documentos }

// ─────────────────────────────────────────────── repositorio

const TOPE = 5000
const conocidos = new Map<ColGestion, Set<string>>()

export const gestionRepoDataverse: GestionRepositorio = {
  disponible: true,

  async cargar() {
    const filas = await Promise.all(COLECCIONES_GESTION.map(c => TABLAS[c].servicio.getAll({ top: TOPE }).then(r => comprobar(r, `leer ${c}`))))
    const d = Object.fromEntries(COLECCIONES_GESTION.map((c, i) => [c, lista(filas[i]).map(f => TABLAS[c].leer(f))])) as unknown as GestionInstantanea
    for (const c of COLECCIONES_GESTION) conocidos.set(c, new Set((d[c] as RegistroGestion[]).map(o => o.id)))
    return d
  },

  async guardar(col, obj) {
    const t = TABLAS[col] as unknown as Tabla<typeof col>
    const ids = conocidos.get(col) ?? new Set<string>()
    conocidos.set(col, ids)
    const cuerpo = t.escribir(obj)
    if (ids.has(obj.id)) {
      comprobar(await t.servicio.update(obj.id, cuerpo), `actualizar ${col}`)
    } else {
      comprobar(await t.servicio.create({ ...cuerpo, [t.clave]: obj.id, statecode: 0 }), `crear en ${col}`)
      ids.add(obj.id)
    }
    return obj
  },

  async borrar(col, id) {
    await TABLAS[col].servicio.delete(id)
    conocidos.get(col)?.delete(id)
  },
}
