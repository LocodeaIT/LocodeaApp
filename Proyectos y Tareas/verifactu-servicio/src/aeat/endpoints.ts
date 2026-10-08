/**
 * Puntos de acceso del servicio VerifactuSOAP de la AEAT (sistemas que emiten
 * facturas verificables), según el WSDL oficial:
 * https://prewww2.aeat.es/static_files/common/internet/dep/aplicaciones/es/aeat/tikeV1.0/cont/ws/SistemaFacturacion.wsdl
 *
 * Con certificado de sello electrónico se usan los puertos «Sello» (www10 / prewww10).
 */
import type { EntornoAeat } from '../configuracion'

const ENDPOINTS: Record<EntornoAeat, { normal: string; sello: string }> = {
  pruebas: {
    normal: 'https://prewww1.aeat.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP',
    sello: 'https://prewww10.aeat.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP',
  },
  produccion: {
    normal: 'https://www1.agenciatributaria.gob.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP',
    sello: 'https://www10.agenciatributaria.gob.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP',
  },
}

export const endpointAeat = (entorno: EntornoAeat, sello: boolean) => (sello ? ENDPOINTS[entorno].sello : ENDPOINTS[entorno].normal)
