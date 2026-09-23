/** Contactos: personas de las cuentas. */
import { Crosshair, ListChecks, Mail } from 'lucide-react'
import type { Contacto } from '../types'
import { ESTADO_ACTIVO, opcionesDe } from '../catalogos'
import { nombreCompleto, nombreCuenta } from '../consultas'
import { ICONO_COL } from '../iconos'
import { ChipEstado, Enlace, Quien } from '../ui'
import { CuentaDelContacto, EscalaTiempo, OportunidadesDe } from '../screens/Hechos'
import { colNo, colPropietario, cuentasFiltro, esMio, filtroPropietario, opcionesCuentas, opcionesPropietario, ordenTexto } from './comunes'
import type { Entidad } from './tipos'

export const contactos: Entidad<Contacto> = {
  col: 'contactos', uno: 'Contacto', muchos: 'Contactos', icono: ICONO_COL.contactos,
  vistas: [
    { clave: 'activos', titulo: 'Contactos activos', filtro: x => x.estado !== 'inactivo' },
    { clave: 'mios', titulo: 'Mis contactos', filtro: esMio },
    { clave: 'todos', titulo: 'Todos los contactos', filtro: () => true },
  ],
  buscar: (x, c) => [x.no, nombreCompleto(x), nombreCuenta(c.datos, x.cuentaId), x.email, x.telefono, x.movil, x.cargo, x.ciudad],
  filtros: [
    { clave: 'cuentaId', titulo: 'Cuenta', opciones: c => cuentasFiltro(c) },
    filtroPropietario(),
  ],
  columnas: [
    colNo(),
    { clave: 'nombre', titulo: 'Nombre completo', enlace: true, orden: x => ordenTexto(nombreCompleto(x)), texto: x => nombreCompleto(x), celda: x => <Quien nombre={nombreCompleto(x)} sub={x.cargo} /> },
    { clave: 'cuentaId', titulo: 'Cuenta', orden: (x, c) => ordenTexto(nombreCuenta(c.datos, x.cuentaId)), texto: (x, c) => nombreCuenta(c.datos, x.cuentaId), celda: x => <Enlace col="cuentas" id={x.cuentaId} /> },
    { clave: 'email', titulo: 'Correo', texto: x => x.email },
    { clave: 'movil', titulo: 'Móvil', texto: x => x.movil || x.telefono },
    { clave: 'ciudad', titulo: 'Ciudad', texto: x => x.ciudad },
    colPropietario(),
    { clave: 'estado', titulo: 'Estado', texto: x => ESTADO_ACTIVO[x.estado], celda: x => <ChipEstado estado={x.estado} etiqueta={ESTADO_ACTIVO[x.estado]} /> },
  ],
  nuevo: c => ({
    id: '', no: '', nombre: '', apellidos: '', cuentaId: null, cargo: '', email: '', telefono: '', movil: '', ciudad: '', linkedin: '',
    propietarioId: c.yoId, estado: 'activo', notas: '', creadoEl: '',
  }),
  titulo: x => nombreCompleto(x),
  validar: d => (!d.nombre.trim() && !d.apellidos.trim() ? 'Escribe el nombre del contacto.' : null),
  pestanas: [
    {
      clave: 'general', titulo: 'General', campos: [
        { clave: 'no', titulo: 'Nº', soloLectura: true },
        { clave: 'nombre', titulo: 'Nombre', req: true },
        { clave: 'apellidos', titulo: 'Apellidos' },
        { clave: 'cuentaId', titulo: 'Cuenta', tipo: 'opciones', opciones: (_, c) => opcionesCuentas(c) },
        { clave: 'cargo', titulo: 'Cargo' },
        { clave: 'propietarioId', titulo: 'Propietario', tipo: 'opciones', opciones: (_, c) => opcionesPropietario(c) },
        { clave: 'estado', titulo: 'Estado', tipo: 'opciones', opciones: opcionesDe(ESTADO_ACTIVO) },
      ],
    },
    {
      clave: 'contacto', titulo: 'Datos de contacto', campos: [
        { clave: 'email', titulo: 'Correo electrónico', tipo: 'email' },
        { clave: 'telefono', titulo: 'Teléfono' },
        { clave: 'movil', titulo: 'Móvil' },
        { clave: 'linkedin', titulo: 'LinkedIn' },
        { clave: 'ciudad', titulo: 'Ciudad' },
      ],
    },
    { clave: 'notas', titulo: 'Notas', abierta: false, campos: [{ clave: 'notas', titulo: 'Notas', tipo: 'area', completo: true }] },
  ],
  comandos: (x, c) => [
    { texto: 'Nueva oportunidad', icono: Crosshair, accion: () => c.abrir('oportunidades', 'nuevo', { cuentaId: x.cuentaId, contactoId: x.id }) },
    { texto: 'Nueva actividad', icono: ListChecks, accion: () => c.abrir('actividades', 'nuevo', { referenteTipo: 'contactos', referenteId: x.id }) },
    !!x.email && { texto: 'Enviar correo', icono: Mail, accion: () => { window.open(`mailto:${x.email}`, '_blank') } },
  ],
  hechos: x => <>
    <CuentaDelContacto contacto={x} />
    <OportunidadesDe filtro={o => o.contactoId === x.id} prefill={{ cuentaId: x.cuentaId, contactoId: x.id }} />
    <EscalaTiempo col="contactos" id={x.id} />
  </>,
}
