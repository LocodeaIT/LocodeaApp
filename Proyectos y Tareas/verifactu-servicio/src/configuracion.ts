/**
 * Configuración del servicio, leída de las variables de entorno (en Azure,
 * «Configuración» de la Function App; en local, local.settings.json).
 * Ningún valor de aquí es secreto: el certificado vive en Key Vault.
 */

export type EntornoAeat = 'pruebas' | 'produccion'

export function obligatoria(nombre: string): string {
  const v = String(process.env[nombre] ?? '').trim()
  if (!v) throw new Error(`Falta la variable de configuración ${nombre}`)
  return v
}

const opcional = (nombre: string) => String(process.env[nombre] ?? '').trim()

export const configuracion = {
  /** URL del Key Vault: https://<nombre>.vault.azure.net/ */
  keyVaultUrl: () => obligatoria('KEY_VAULT_URL'),
  /** Nombre del certificado (o secreto) en Key Vault. Es el `certificadoRef` de la configuración de Verifactu de la app. */
  certificadoSecreto: () => obligatoria('CERTIFICADO_SECRETO'),
  /** Secreto con la contraseña del PFX, solo si se guardó como secreto protegido con contraseña. */
  certificadoClaveSecreto: () => opcional('CERTIFICADO_CLAVE_SECRETO'),
  /** true si el certificado es de sello electrónico: cambia el punto de acceso (www10 / prewww10). */
  certificadoSello: () => opcional('AEAT_CERTIFICADO_SELLO').toLowerCase() === 'true',
  /** Entornos que este despliegue puede usar. Producción solo se añade a propósito cuando todo esté probado. */
  entornosPermitidos: (): EntornoAeat[] => (opcional('ENTORNOS_PERMITIDOS') || 'pruebas')
    .split(',').map(s => s.trim()).filter((s): s is EntornoAeat => s === 'pruebas' || s === 'produccion'),
  timeoutMs: () => Number(opcional('AEAT_TIMEOUT_MS')) || 60_000,
  /** «desactivada-solo-en-local» quita la comprobación de usuario; cualquier otro valor la exige. */
  autenticacionDesactivada: () => opcional('AUTENTICACION') === 'desactivada-solo-en-local' && !process.env.WEBSITE_SITE_NAME,
  /** Rol de aplicación de Entra ID que debe tener el usuario (vacío = basta con estar autenticado en el inquilino). */
  rolRequerido: () => opcional('ROL_REQUERIDO'),
  dataverseUrl: () => opcional('DATAVERSE_URL'),
}
