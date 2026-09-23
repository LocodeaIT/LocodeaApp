/** Iconos del CRM (lucide), por tipo de registro y por tipo de actividad. */
import {
  Building2, CalendarDays, Crosshair, FileText, ListChecks, Mail, Package, Phone, Receipt, ReceiptText, ShoppingBag, ShoppingCart,
  SquareCheck, UserPlus, UserRound, type LucideIcon,
} from 'lucide-react'
import type { ColEntidad, TipoActividad } from './types'

export const ICONO_COL: Record<ColEntidad, LucideIcon> = {
  cuentas: Building2, contactos: UserRound, potenciales: UserPlus, oportunidades: Crosshair, ofertas: FileText,
  pedidosVenta: ShoppingCart, facturasVenta: Receipt, pedidosCompra: ShoppingBag, facturasCompra: ReceiptText,
  productos: Package, actividades: ListChecks,
}

export const ICONO_ACTIVIDAD: Record<TipoActividad, LucideIcon> = { tarea: SquareCheck, llamada: Phone, correo: Mail, cita: CalendarDays }
