/**
 * Llamada HTTPS con TLS mutuo al servicio SOAP de la AEAT: el certificado
 * electrónico de la entidad autentica la conexión (SOAP 1.1, UTF-8,
 * soapAction vacío según el WSDL).
 * Fuente: Descripción del servicio web v1.0.3, apdo. 4.3 (HTTPS, SOAP 1.1
 * document, certificado electrónico cualificado, UTF-8):
 * https://www.agenciatributaria.es/static_files/AEAT_Desarrolladores/EEDD/IVA/VERI-FACTU/Veri-Factu_Descripcion_SWeb.pdf
 */
import https from 'node:https'
import type { Certificado } from '../certificado'

export interface RespuestaHttp { status: number; cuerpo: string }

export function enviarSoap(url: string, sobre: string, certificado: Certificado, timeoutMs: number): Promise<RespuestaHttp> {
  const cuerpo = Buffer.from(sobre, 'utf8')
  const credenciales = certificado.tipo === 'pfx'
    ? { pfx: certificado.pfx, passphrase: certificado.clave }
    // En PEM, Key Vault entrega clave y certificado juntos: OpenSSL toma de cada uno lo que necesita.
    : { key: certificado.pem, cert: certificado.pem }
  return new Promise((resolve, reject) => {
    const peticion = https.request(url, {
      method: 'POST',
      ...credenciales,
      minVersion: 'TLSv1.2',
      timeout: timeoutMs,
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        SOAPAction: '""',
        'Content-Length': cuerpo.length,
      },
    }, respuesta => {
      const trozos: Buffer[] = []
      respuesta.on('data', (t: Buffer) => trozos.push(t))
      respuesta.on('end', () => resolve({ status: respuesta.statusCode ?? 0, cuerpo: Buffer.concat(trozos).toString('utf8') }))
      respuesta.on('error', reject)
    })
    peticion.on('timeout', () => peticion.destroy(new Error(`La AEAT no respondió en ${Math.round(timeoutMs / 1000)} s`)))
    peticion.on('error', reject)
    peticion.end(cuerpo)
  })
}
