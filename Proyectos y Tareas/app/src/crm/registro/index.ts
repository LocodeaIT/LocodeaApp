/** Registro de entidades del CRM, por colección. */
import type { ColEntidad, RegistroBase } from '../types'
import type { Entidad } from './tipos'
import { cuentas } from './cuentas'
import { contactos } from './contactos'
import { potenciales } from './potenciales'
import { oportunidades } from './oportunidades'
import { facturasCompra, facturasVenta, ofertas, pedidosCompra, pedidosVenta } from './documentos'
import { productos } from './productos'
import { actividades } from './actividades'

const ENTIDADES = {
  cuentas, contactos, potenciales, oportunidades, ofertas, pedidosVenta, facturasVenta, pedidosCompra, facturasCompra, productos, actividades,
} satisfies Record<ColEntidad, unknown>

/**
 * Entidad de una colección, con el tipo de registro borrado: la lista y la
 * ficha genéricas trabajan con `RegistroBase` y cada entidad sabe lo suyo.
 */
export function entidadDe(col: ColEntidad): Entidad<RegistroBase> {
  return ENTIDADES[col] as unknown as Entidad<RegistroBase>
}
