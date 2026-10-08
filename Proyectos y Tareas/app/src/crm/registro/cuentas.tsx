/** Cuentas: clientes y proveedores. */
import { BadgeCheck, Crosshair, ExternalLink, FileText, ShoppingBag, UserRound } from 'lucide-react'
import type { Cuenta } from '../types'
import { CONDICIONES_PAGO, EMPLEADOS, ESTADO_ACTIVO, METODO_PAGO, REGIMEN_IVA, TIPO_CUENTA, opcionesDe } from '../catalogos'
import { validarNif } from '../../gestion/calculos'
import { FISCAL_CUENTA, PAISES, TIPO_ID_FISCAL, esUE, regimenPorPais, tipoIdPorDefecto } from '../fiscal'
import { fecha } from '../formato'
import { hoy } from '../../domain/fechas'
import { facturado, pipelineAbierto } from '../consultas'
import { eur0 } from '../formato'
import { ICONO_COL } from '../iconos'
import { ChipEstado, Quien } from '../ui'
import { ContactosCuenta, DocumentosCuenta, EscalaTiempo, EstadisticasCuenta, OportunidadesDe } from '../screens/Hechos'
import { colNo, colPropietario, esMio, filtroPropietario, opcionesDistintas, opcionesPropietario, ordenTexto } from './comunes'
import type { Entidad } from './tipos'

export const cuentas: Entidad<Cuenta> = {
  col: 'cuentas', uno: 'Cuenta', muchos: 'Cuentas', fem: true, icono: ICONO_COL.cuentas,
  vistas: [
    { clave: 'activas', titulo: 'Cuentas activas', filtro: a => a.estado !== 'inactivo' },
    { clave: 'mias', titulo: 'Mis cuentas', filtro: esMio },
    { clave: 'clientes', titulo: 'Clientes', filtro: a => a.tipo !== 'proveedor' },
    { clave: 'proveedores', titulo: 'Proveedores', filtro: a => a.tipo !== 'cliente' },
    { clave: 'todas', titulo: 'Todas las cuentas', filtro: () => true },
  ],
  buscar: a => [a.no, a.nombre, a.cif, a.ciudad, a.sector, a.email, a.telefono],
  filtros: [
    { clave: 'tipo', titulo: 'Tipo', opciones: () => opcionesDe(TIPO_CUENTA) },
    filtroPropietario(),
    { clave: 'sector', titulo: 'Sector', opciones: c => opcionesDistintas(c.datos.cuentas.map(a => a.sector)) },
  ],
  columnas: [
    colNo(),
    { clave: 'nombre', titulo: 'Nombre', enlace: true, orden: a => ordenTexto(a.nombre), texto: a => a.nombre, celda: a => <Quien nombre={a.nombre} sub={a.sector} cuadrado /> },
    { clave: 'tipo', titulo: 'Tipo', texto: a => TIPO_CUENTA[a.tipo] },
    { clave: 'ciudad', titulo: 'Ciudad', texto: a => a.ciudad },
    { clave: 'telefono', titulo: 'Teléfono', texto: a => a.telefono },
    { clave: 'email', titulo: 'Correo', texto: a => a.email },
    { clave: 'pipeline', titulo: 'Pipeline abierto', num: true, orden: (a, c) => pipelineAbierto(c.datos, a.id), texto: (a, c) => pipelineAbierto(c.datos, a.id) ? eur0(pipelineAbierto(c.datos, a.id)) : '' },
    { clave: 'facturado', titulo: 'Facturado', num: true, orden: (a, c) => facturado(c.datos, a.id), texto: (a, c) => facturado(c.datos, a.id) ? eur0(facturado(c.datos, a.id)) : '' },
    colPropietario(),
    { clave: 'estado', titulo: 'Estado', texto: a => ESTADO_ACTIVO[a.estado], celda: a => <ChipEstado estado={a.estado} etiqueta={ESTADO_ACTIVO[a.estado]} /> },
  ],
  nuevo: c => ({
    id: '', no: '', nombre: '', tipo: 'cliente', estado: 'activo', cif: '', sector: '', direccion: '', cp: '', ciudad: '', provincia: '', pais: 'España',
    web: '', telefono: '', email: '', empleados: '', propietarioId: c.yoId, condicionesPago: '30', metodoPago: 'transferencia', iva: 21, iban: '', regimenIva: 'general', notas: '', creadoEl: '',
    ...FISCAL_CUENTA,
  }),
  titulo: a => a.nombre,
  validar: d => (!d.nombre.trim() ? 'Escribe el nombre de la cuenta.' : d.tipoIdFiscal === 'nif' || d.tipoIdFiscal === 'nifiva' ? validarNif(d.cif) : null),
  pestanas: [
    {
      clave: 'general', titulo: 'General', campos: [
        { clave: 'no', titulo: 'Nº', soloLectura: true },
        { clave: 'nombre', titulo: 'Nombre', req: true },
        { clave: 'tipo', titulo: 'Tipo', tipo: 'opciones', opciones: opcionesDe(TIPO_CUENTA) },
        { clave: 'cif', titulo: 'CIF / NIF' },
        { clave: 'sector', titulo: 'Sector' },
        { clave: 'web', titulo: 'Sitio web' },
        { clave: 'propietarioId', titulo: 'Propietario', tipo: 'opciones', opciones: (_, c) => opcionesPropietario(c) },
        { clave: 'estado', titulo: 'Estado', tipo: 'opciones', opciones: opcionesDe(ESTADO_ACTIVO) },
      ],
    },
    {
      clave: 'direccion', titulo: 'Dirección y contacto', campos: [
        { clave: 'direccion', titulo: 'Dirección' },
        { clave: 'cp', titulo: 'Código postal' },
        { clave: 'ciudad', titulo: 'Ciudad' },
        { clave: 'provincia', titulo: 'Provincia' },
        { clave: 'pais', titulo: 'País' },
        { clave: 'telefono', titulo: 'Teléfono' },
        { clave: 'email', titulo: 'Correo electrónico', tipo: 'email' },
        { clave: 'empleados', titulo: 'Empleados', tipo: 'opciones', opciones: opcionesDe(EMPLEADOS) },
      ],
    },
    {
      clave: 'facturacion', titulo: 'Facturación', abierta: false, campos: [
        { clave: 'condicionesPago', titulo: 'Condiciones de pago', tipo: 'opciones', opciones: opcionesDe(CONDICIONES_PAGO) },
        { clave: 'metodoPago', titulo: 'Método de pago', tipo: 'opciones', opciones: opcionesDe(METODO_PAGO) },
        { clave: 'iban', titulo: 'IBAN' },
        { clave: 'iva', titulo: 'IVA %', tipo: 'numero', min: 0 },
        { clave: 'regimenIva', titulo: 'Régimen de IVA', tipo: 'opciones', opciones: opcionesDe(REGIMEN_IVA) },
      ],
    },
    {
      // Lo que la Gestoría necesita para el IVA, el 349, el 347 y Verifactu
      clave: 'fiscal', titulo: 'Fiscal', abierta: false, campos: [
        {
          clave: 'codigoPais', titulo: 'País (fiscal)', tipo: 'opciones',
          opciones: d => [...Object.entries(PAISES), ...(d.codigoPais && !PAISES[d.codigoPais] ? [[d.codigoPais, d.codigoPais]] : [])].map(([valor, etiqueta]) => ({ valor, etiqueta })),
          alCambiar: d => ({ ...d, tipoIdFiscal: tipoIdPorDefecto(d.codigoPais), regimenIva: d.regimenIva === 'exento' || d.regimenIva === 'recargo' ? d.regimenIva : regimenPorPais(d.codigoPais), pais: PAISES[d.codigoPais] ?? d.pais, viesValido: null, viesComprobadoEl: null }),
        },
        { clave: 'tipoIdFiscal', titulo: 'Documento fiscal', tipo: 'opciones', opciones: opcionesDe(TIPO_ID_FISCAL) },
        { clave: 'particular', titulo: 'Particular (consumidor final)', tipo: 'sino' },
        {
          clave: 'viesValido', titulo: 'NIF-IVA en VIES',
          mostrar: d => !esUE(d.codigoPais) || d.codigoPais === 'ES' ? 'No aplica' : d.viesValido === null ? 'Sin comprobar' : `${d.viesValido ? 'Válido' : 'No válido'}${d.viesComprobadoEl ? ' · ' + fecha(d.viesComprobadoEl) : ''}`,
        },
      ],
    },
    { clave: 'notas', titulo: 'Notas', abierta: false, campos: [{ clave: 'notas', titulo: 'Notas', tipo: 'area', completo: true }] },
  ],
  comandos: (a, c) => [
    esUE(a.codigoPais) && a.codigoPais !== 'ES' && !a.particular && { texto: 'Comprobar en VIES', icono: ExternalLink, accion: () => { window.open('https://ec.europa.eu/taxation_customs/vies/#/vat-validation', '_blank', 'noopener') } },
    esUE(a.codigoPais) && a.codigoPais !== 'ES' && !a.particular && a.viesValido !== true && { texto: 'Marcar NIF-IVA válido', icono: BadgeCheck, accion: () => c.guardar('cuentas', { ...a, viesValido: true, viesComprobadoEl: hoy() }).then(() => undefined) },
    { texto: 'Nuevo contacto', icono: UserRound, accion: () => c.abrir('contactos', 'nuevo', { cuentaId: a.id }) },
    { texto: 'Nueva oportunidad', icono: Crosshair, accion: () => c.abrir('oportunidades', 'nuevo', { cuentaId: a.id }) },
    a.tipo === 'proveedor'
      ? { texto: 'Nuevo pedido de compra', icono: ShoppingBag, accion: () => c.abrir('pedidosCompra', 'nuevo', { cuentaId: a.id }) }
      : { texto: 'Nueva oferta', icono: FileText, accion: () => c.abrir('ofertas', 'nuevo', { cuentaId: a.id }) },
  ],
  hechos: a => <>
    <EstadisticasCuenta cuenta={a} />
    <ContactosCuenta cuenta={a} />
    <OportunidadesDe filtro={o => o.cuentaId === a.id} prefill={{ cuentaId: a.id }} />
    <DocumentosCuenta cuenta={a} />
    <EscalaTiempo col="cuentas" id={a.id} />
  </>,
}
