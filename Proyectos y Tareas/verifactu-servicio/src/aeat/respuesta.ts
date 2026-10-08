/**
 * Interpretación de la respuesta de la AEAT a RegFactuSistemaFacturacion.
 *
 * Fuentes:
 *  - RespuestaSuministro.xsd (CSV, TiempoEsperaEnvio, EstadoEnvio Correcto /
 *    ParcialmenteCorrecto / Incorrecto; RespuestaLinea con IDFactura, Operacion/
 *    TipoOperacion Alta|Anulacion, EstadoRegistro Correcto / AceptadoConErrores /
 *    Incorrecto, CodigoErrorRegistro, DescripcionErrorRegistro, RegistroDuplicado):
 *    https://prewww2.aeat.es/static_files/common/internet/dep/aplicaciones/es/aeat/tikeV1.0/cont/ws/RespuestaSuministro.xsd
 *  - Descripción del servicio web v1.0.3, apdo. 5.1 (los errores de formato o de
 *    cabecera llegan como SOAP Fault y rechazan el envío completo; ejemplo de
 *    faultstring «Codigo[4104].…»):
 *    https://www.agenciatributaria.es/static_files/AEAT_Desarrolladores/EEDD/IVA/VERI-FACTU/Veri-Factu_Descripcion_SWeb.pdf
 *
 * Los prefijos de espacio de nombres de la respuesta cambian (tikR, tik, env…),
 * así que se lee por nombre local.
 */
import { bloques, claveRegistro, valor, type TipoOperacion } from './xml'

export interface LineaAeat {
  clave: string
  estado: 'Correcto' | 'AceptadoConErrores' | 'Incorrecto' | string
  codigo: string
  descripcion: string
}

export interface RespuestaAeat {
  /** SOAP Fault: el envío entero se rechazó (formato o cabecera). */
  fallo: { codigo: string; mensaje: string } | null
  csv: string
  /** TiempoEsperaEnvio en segundos, o null si no vino. */
  esperaSegundos: number | null
  estadoEnvio: 'Correcto' | 'ParcialmenteCorrecto' | 'Incorrecto' | string
  lineas: LineaAeat[]
}

export function interpretarRespuesta(xml: string): RespuestaAeat {
  const fault = bloques(xml, 'Fault')[0]
  if (fault !== undefined) {
    const mensaje = valor(fault, 'faultstring').replace(/\s+/g, ' ')
    const codigo = /Codigo\[(\d+)\]/i.exec(mensaje)?.[1] ?? valor(fault, 'faultcode')
    return { fallo: { codigo, mensaje }, csv: '', esperaSegundos: null, estadoEnvio: '', lineas: [] }
  }
  const espera = valor(xml, 'TiempoEsperaEnvio')
  return {
    fallo: null,
    csv: valor(xml, 'CSV'),
    esperaSegundos: espera === '' || !Number.isFinite(Number(espera)) ? null : Number(espera),
    estadoEnvio: valor(xml, 'EstadoEnvio'),
    lineas: bloques(xml, 'RespuestaLinea').map(linea => {
      // El bloque RegistroDuplicado repite EstadoRegistro y CodigoErrorRegistro: se quita antes de leer.
      const propia = linea.replace(/<(?:[\w.-]+:)?RegistroDuplicado[\s>][\s\S]*?<\/(?:[\w.-]+:)?RegistroDuplicado>/g, '')
      const id = bloques(propia, 'IDFactura')[0] ?? ''
      const tipo = (valor(propia, 'TipoOperacion') || 'Alta') as TipoOperacion
      return {
        clave: claveRegistro(tipo, valor(id, 'IDEmisorFactura'), valor(id, 'NumSerieFactura'), valor(id, 'FechaExpedicionFactura')),
        estado: valor(propia, 'EstadoRegistro'),
        codigo: valor(propia, 'CodigoErrorRegistro'),
        descripcion: valor(propia, 'DescripcionErrorRegistro'),
      }
    }),
  }
}
