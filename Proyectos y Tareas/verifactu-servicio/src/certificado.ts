/**
 * Lectura del certificado electrónico de Locodea SL desde Azure Key Vault con
 * la identidad administrada de la Function App (DefaultAzureCredential: en
 * Azure usa la identidad administrada; en local, la sesión de `az login`).
 *
 * Un certificado importado en Key Vault se lee como secreto con el mismo
 * nombre: si es PKCS#12 llega en base64 y sin contraseña
 * (contentType application/x-pkcs12); si es PEM, como texto con la clave y el
 * certificado (application/x-pem-file).
 * Fuente: https://learn.microsoft.com/azure/key-vault/certificates/about-certificates
 *
 * El certificado solo existe en memoria del proceso y se refresca cada hora
 * para recoger las renovaciones. Nunca se escribe en disco ni en los registros.
 */
import { DefaultAzureCredential } from '@azure/identity'
import { SecretClient } from '@azure/keyvault-secrets'
import { configuracion } from './configuracion'

export type Certificado =
  | { tipo: 'pfx'; pfx: Buffer; clave?: string }
  | { tipo: 'pem'; pem: string }

const DURACION_CACHE_MS = 60 * 60 * 1000

let cache: { certificado: Certificado; hasta: number } | null = null
let cliente: SecretClient | null = null

function secretos(): SecretClient {
  cliente ??= new SecretClient(configuracion.keyVaultUrl(), new DefaultAzureCredential())
  return cliente
}

/** Certificado para el TLS mutuo con la AEAT. */
export async function leerCertificado(): Promise<Certificado> {
  if (cache && cache.hasta > Date.now()) return cache.certificado
  const nombre = configuracion.certificadoSecreto()
  const secreto = await secretos().getSecret(nombre)
  if (!secreto.value) throw new Error(`El secreto «${nombre}» de Key Vault está vacío`)
  const tipo = secreto.properties.contentType ?? ''
  let certificado: Certificado
  if (tipo === 'application/x-pem-file' || secreto.value.includes('-----BEGIN')) {
    certificado = { tipo: 'pem', pem: secreto.value }
  } else {
    const nombreClave = configuracion.certificadoClaveSecreto()
    const clave = nombreClave ? (await secretos().getSecret(nombreClave)).value : undefined
    certificado = { tipo: 'pfx', pfx: Buffer.from(secreto.value, 'base64'), clave }
  }
  cache = { certificado, hasta: Date.now() + DURACION_CACHE_MS }
  return certificado
}

/** Olvida el certificado en memoria (p. ej. tras un error de TLS, por si se ha renovado). */
export function olvidarCertificado() {
  cache = null
}
