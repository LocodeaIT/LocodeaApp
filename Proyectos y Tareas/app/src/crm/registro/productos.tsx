/** Productos y servicios: catálogo con precio de venta y coste. */
import type { Producto } from '../types'
import { SI_NO, TIPO_PRODUCTO, UNIDAD, opcionesDe } from '../catalogos'
import { eur, pct } from '../formato'
import { ICONO_COL } from '../iconos'
import { ChipEstado } from '../ui'
import { EstadisticasProducto } from '../screens/Hechos'
import { colNo, opcionesDistintas, ordenTexto } from './comunes'
import type { Entidad } from './tipos'

const margen = (p: Producto) => (p.precio ? Math.round((1 - (Number(p.coste) || 0) / Number(p.precio)) * 100) : 0)

export const productos: Entidad<Producto> = {
  col: 'productos', uno: 'Producto', muchos: 'Productos', icono: ICONO_COL.productos,
  vistas: [
    { clave: 'activos', titulo: 'Productos activos', filtro: p => p.activo },
    { clave: 'servicios', titulo: 'Servicios', filtro: p => p.tipo === 'servicio' },
    { clave: 'licencias', titulo: 'Licencias', filtro: p => p.tipo === 'licencia' },
    { clave: 'todos', titulo: 'Todos los productos', filtro: () => true },
  ],
  buscar: p => [p.no, p.nombre, p.categoria, p.descripcion],
  filtros: [
    { clave: 'tipo', titulo: 'Tipo', opciones: () => opcionesDe(TIPO_PRODUCTO) },
    { clave: 'categoria', titulo: 'Categoría', opciones: c => opcionesDistintas(c.datos.productos.map(p => p.categoria)) },
  ],
  columnas: [
    colNo(),
    { clave: 'nombre', titulo: 'Nombre', enlace: true, orden: p => ordenTexto(p.nombre), texto: p => p.nombre },
    { clave: 'tipo', titulo: 'Tipo', texto: p => TIPO_PRODUCTO[p.tipo] },
    { clave: 'categoria', titulo: 'Categoría', texto: p => p.categoria },
    { clave: 'unidad', titulo: 'Unidad', texto: p => UNIDAD[p.unidad] },
    { clave: 'precio', titulo: 'Precio venta', num: true, orden: p => p.precio, texto: p => eur(p.precio) },
    { clave: 'coste', titulo: 'Coste', num: true, orden: p => p.coste, texto: p => eur(p.coste) },
    { clave: 'margen', titulo: 'Margen', num: true, orden: margen, texto: p => (p.precio ? `${margen(p)} %` : '') },
    { clave: 'iva', titulo: 'IVA', num: true, orden: p => p.iva, texto: p => pct(p.iva) },
    { clave: 'activo', titulo: 'Activo', texto: p => (p.activo ? 'Sí' : 'No'), celda: p => <ChipEstado estado={p.activo ? 'si' : 'no'} etiqueta={SI_NO[p.activo ? 'si' : 'no']} /> },
  ],
  nuevo: () => ({ id: '', no: '', nombre: '', tipo: 'servicio', categoria: '', unidad: 'hora', precio: 0, coste: 0, iva: 21, activo: true, descripcion: '', creadoEl: '' }),
  titulo: p => p.nombre,
  validar: d => (!d.nombre.trim() ? 'Escribe el nombre del producto.' : null),
  pestanas: [
    {
      clave: 'general', titulo: 'General', campos: [
        { clave: 'no', titulo: 'Nº', soloLectura: true },
        { clave: 'nombre', titulo: 'Nombre', req: true },
        { clave: 'tipo', titulo: 'Tipo', tipo: 'opciones', opciones: opcionesDe(TIPO_PRODUCTO) },
        { clave: 'categoria', titulo: 'Categoría' },
        { clave: 'unidad', titulo: 'Unidad de medida', tipo: 'opciones', opciones: opcionesDe(UNIDAD) },
        { clave: 'activo', titulo: 'Activo', tipo: 'sino' },
      ],
    },
    {
      clave: 'precios', titulo: 'Precios', campos: [
        { clave: 'precio', titulo: 'Precio de venta (€)', tipo: 'numero', paso: 0.01, min: 0 },
        { clave: 'coste', titulo: 'Coste (€)', tipo: 'numero', paso: 0.01, min: 0 },
        { clave: 'iva', titulo: 'IVA %', tipo: 'numero', min: 0 },
      ],
    },
    { clave: 'descripcion', titulo: 'Descripción', abierta: false, campos: [{ clave: 'descripcion', titulo: 'Descripción', tipo: 'area', completo: true }] },
  ],
  hechos: p => <EstadisticasProducto p={p} />,
}
