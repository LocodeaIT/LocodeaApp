/**
 * Datos de ejemplo de Gestión para el modo demostración. Enlazan con las
 * cuentas y facturas de la semilla del CRM (ids a1…, fc…) y con los miembros
 * de la semilla de Proyectos y Tareas.
 */
import { hoy, sumarDias } from '../domain/fechas'
import { totalDesdeBase } from './calculos'
import type { DocumentoGestion, Gasto, GestionInstantanea } from './types'

const A = 'm-alejandro'
const J = 'm-jesus'
const M = 'm-marco'

export function generarSemillaGestion(): GestionInstantanea {
  const d = (n: number) => sumarDias(hoy(), n)
  const iso = (n: number) => new Date(Date.parse(d(n)) + 10 * 3600000).toISOString()

  const gasto = (
    id: string, n: number, concepto: string, fecha: number, base: number, iva: number, categoria: Gasto['categoria'], estado: Gasto['estado'],
    metodoPago: Gasto['metodoPago'], pagadorId: string | null, extra: Partial<Gasto> = {},
  ): Gasto => ({
    id, no: 'G-' + (26000 + n), concepto, fecha: d(fecha), base, iva, irpf: extra.irpf ?? 0, total: totalDesdeBase(base, iva, extra.irpf ?? 0),
    categoria, estado, metodoPago, recurrente: false, diaCargo: 1, deducible: true, noFactura: '', enlace: '', foto: '', notas: '',
    proveedorId: null, proyectoId: null, pagadorId, facturaCompraId: null, creadoEl: iso(fecha), ...extra,
  })

  const gastos: Gasto[] = [
    gasto('g1', 1, 'Microsoft 365 Business Standard · 4 usuarios', -22, 50.4, 21, 'software', 'pagado', 'tarjeta', null, { recurrente: true, diaCargo: 3, proveedorId: 'a11', noFactura: 'E0200987123' }),
    gasto('g2', 2, 'Servidor n8n · Hetzner CX32', -20, 24, 21, 'hosting', 'pagado', 'tarjeta', null, { recurrente: true, diaCargo: 1, proveedorId: 'a12' }),
    gasto('g3', 3, 'Claude Max · equipo', -18, 180, 21, 'software', 'pagado', 'tarjeta', null, { recurrente: true, diaCargo: 15 }),
    gasto('g4', 4, 'Gestoría · cuota mensual', -12, 120, 21, 'asesoria', 'pendiente', 'domiciliacion', null, { recurrente: true, diaCargo: 5, irpf: 15 }),
    gasto('g5', 5, 'Tren Madrid–Sevilla · visita Panaderías Churros', -9, 62.4, 10, 'viajes', 'reembolsar', 'tarjeta', M, { proyectoId: 'p1' }),
    gasto('g6', 6, 'Comida con el equipo de OrtoAlresa', -7, 84, 10, 'dietas', 'reembolsar', 'efectivo', J, { notas: 'Cuatro personas. Ticket en la foto.' }),
    gasto('g7', 7, 'Monitor 27" para el puesto de Marco', -30, 289, 21, 'material', 'pagado', 'transferencia', null, { noFactura: 'A-2026-4471' }),
    gasto('g8', 8, 'Curso Power Platform · PL-400', -45, 495, 21, 'formacion', 'reembolsado', 'tarjeta', A),
    gasto('g9', 9, 'Fibra y móviles · septiembre', -3, 96.5, 21, 'telefonia', 'pendiente', 'domiciliacion', null, { recurrente: true, diaCargo: 20 }),
    gasto('g10', 10, 'Anuncios LinkedIn · campaña Power Apps', -14, 150, 21, 'marketing', 'pagado', 'tarjeta', null, { deducible: true }),
    gasto('g11', 11, 'Multa de aparcamiento', -5, 90, 0, 'otros', 'pagado', 'tarjeta', A, { deducible: false, notas: 'No deducible.' }),
  ]

  const doc = (id: string, nombre: string, tipo: DocumentoGestion['tipo'], caduca: number | null, cuentaId: string | null, responsableId: string | null, extra: Partial<DocumentoGestion> = {}): DocumentoGestion => ({
    id, nombre, tipo, caduca: caduca === null ? null : d(caduca), avisoDias: 30, enlace: '', firmado: true, firmadoEl: d(-120), notas: '', cuentaId, responsableId, creadoEl: iso(-120), ...extra,
  })

  const documentos: DocumentoGestion[] = [
    doc('d1', 'Certificado digital de la SL (FNMT)', 'certificado', 18, null, A, { notas: 'Renovar en la sede de la FNMT con el certificado vigente.' }),
    doc('d2', 'Contrato de soporte · Apple', 'contrato', 55, 'a1', A),
    doc('d3', 'NDA · OrtoAlresa', 'nda', 300, 'a2', J),
    doc('d4', 'Mandato SEPA · Udia', 'sepa', null, 'a3', A),
    doc('d5', 'Escritura de constitución', 'escritura', null, null, A),
    doc('d6', 'Contrato marco · Grupo Logístico Ebro', 'contrato', -10, 'a7', A, { notas: 'Caducado: pendiente de renovar con la nueva tarifa.' }),
    doc('d7', 'Acuerdo de encargado de tratamiento · Colegio Las Encinas', 'lopd', 200, 'a10', A, { firmado: false, firmadoEl: null }),
    doc('d8', 'Seguro de responsabilidad civil', 'otro', 95, null, M, { avisoDias: 45 }),
  ]

  return { gastos, documentos }
}
