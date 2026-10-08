/**
 * Declaración responsable del sistema informático de facturación (art. 15 de
 * la Orden HAC/1177/2024). Locodea es productora de su propio sistema, que
 * solo funciona como VERI*FACTU y solo factura para Locodea SL.
 *
 * Fuentes:
 *  - Orden HAC/1177/2024, art. 15 (título, letras a) a l) en ese orden, cada dato
 *    precedido de su texto; anexo recomendado; disponible dentro del propio sistema):
 *    https://www.boe.es/diario_boe/txt.php?id=BOE-A-2024-22138
 *  - Ejemplos de declaraciones responsables de la AEAT (v0.5.1), ejemplo 1
 *    (producto solo VERI*FACTU de empresa con NIF español):
 *    https://www3.agenciatributaria.gob.es/static_files/Sede/Tema/IVA/Verifactu/EjemplosDeclaracionResponsable(V0.5.1).pdf
 */
import type { ConfigVerifactu } from '../types'

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

/** «2026-10-07» (o ISO completo) → «7 de octubre de 2026». */
export function fechaLarga(dia: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(dia ?? ''))
  return m ? `${+m[3]} de ${MESES[+m[2] - 1]} de ${m[1]}` : ''
}

const PENDIENTE = '(pendiente de completar)'
const o = (s: string | null | undefined) => String(s ?? '').trim() || PENDIENTE

/**
 * Texto completo de la declaración responsable. `lugar` es la localidad y el
 * país donde se firma («Madrid - España»); la fecha es la de firma de la
 * configuración. Lo que falte queda marcado como pendiente.
 */
export function textoDeclaracionResponsable(
  config: ConfigVerifactu,
  productor: { nombre: string; nif: string; direccion: string; lugar?: string },
): string {
  const fecha = config.declaracionFirmadaEl ? fechaLarga(config.declaracionFirmadaEl) : ''
  const sistema = 'el sistema informático a que se refiere esta declaración responsable'
  const bloques: [string, string][] = [
    [`a) Nombre del sistema informático a que se refiere esta declaración responsable:`, o(config.sistemaNombre)],
    [`b) Código identificador del sistema informático a que se refiere el apartado a) de esta declaración responsable:`, o(config.sistemaId)],
    [`c) Identificador completo de la versión concreta del sistema informático a que se refiere esta declaración responsable:`, o(config.sistemaVersion)],
    [
      `d) Componentes, hardware y software, de que consta ${sistema}, junto con una breve descripción de lo que hace dicho sistema informático y de sus principales funcionalidades:`,
      [
        'Software, sin hardware propio. Consta de dos componentes:',
        '  - Aplicación web de gestión (Power Apps Code App en React y TypeScript) que se ejecuta en el navegador sobre Microsoft Power Platform y guarda sus datos en Microsoft Dataverse.',
        '  - Servicio de remisión en Microsoft Azure (Azure Functions) que envía los registros de facturación a la Agencia Estatal de Administración Tributaria con el certificado electrónico de la entidad, custodiado en Azure Key Vault.',
        'Funcionalidades: alta de clientes, ofertas, pedidos y facturas de venta; expedición de facturas completas y rectificativas con su código QR tributario; generación de los registros de facturación de alta y de anulación encadenados mediante huella SHA-256; remisión automática de los registros a la AEAT con control de flujo y reintentos; consulta y exportación de los registros y de su estado.',
      ].join('\n'),
    ],
    [`e) Indicación de si ${sistema} se ha producido de tal manera que, a los efectos de cumplir con el Reglamento, solo pueda funcionar exclusivamente como «VERI*FACTU»:`, 'S - Sí'],
    [`f) Indicación de si ${sistema} permite ser usado por varios obligados tributarios o por un mismo usuario para dar soporte a la facturación de varios obligados tributarios:`, `N - No. Solo factura para ${o(config.razonSocial)}.`],
    [
      `g) Tipos de firma utilizados para firmar los registros de facturación y de evento en el caso de que ${sistema} no sea utilizado como «VERI*FACTU»:`,
      'No aplica. El sistema solo funciona como «VERI*FACTU», por lo que no firma expresamente los registros de facturación: quedan firmados al remitirse a la Agencia Estatal de Administración Tributaria con la autenticación del certificado electrónico cualificado.',
    ],
    [`h) Razón social de la entidad productora de ${sistema}:`, o(productor.nombre)],
    [`i) Número de identificación fiscal (NIF) español de la entidad productora de ${sistema}:`, o(productor.nif)],
    [`j) Dirección postal completa de contacto de la entidad productora de ${sistema}:`, o(productor.direccion)],
    [
      `k) La entidad productora de ${sistema} hace constar que dicho sistema informático, en la versión indicada en ella, cumple con lo dispuesto en el artículo 29.2.j) de la Ley 58/2003, de 17 de diciembre, General Tributaria, en el Reglamento que establece los requisitos que deben adoptar los sistemas y programas informáticos o electrónicos que soporten los procesos de facturación de empresarios y profesionales, y la estandarización de formatos de los registros de facturación, aprobado por el Real Decreto 1007/2023, de 5 de diciembre, en la Orden HAC/1177/2024, de 17 de octubre, y en la sede electrónica de la Agencia Estatal de Administración Tributaria para todo aquello que complete las especificaciones de dicha orden.`,
      '',
    ],
    [
      'l) Fecha y lugar en que la entidad productora de este sistema informático suscribe esta declaración responsable del mismo:',
      `  - Fecha: ${fecha || PENDIENTE}\n  - Lugar: ${o(productor.lugar)}`,
    ],
  ]
  const cuerpo = bloques.map(([texto, dato]) => (dato ? `${texto}\n${dato}` : texto)).join('\n\n')
  const firma = config.declaracionFirmante ? `\n\nFirmado por: ${config.declaracionFirmante}, en nombre de ${o(productor.nombre)}.` : ''
  return `DECLARACIÓN RESPONSABLE DEL SISTEMA INFORMÁTICO DE FACTURACIÓN\n\n${cuerpo}${firma}\n`
}
