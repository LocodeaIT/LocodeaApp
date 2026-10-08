/**
 * Quién llama. La Function App se protege con la autenticación integrada de
 * App Service («Easy Auth») contra Entra ID: rechaza las peticiones sin
 * sesión y añade la cabecera x-ms-client-principal con el usuario. Aquí se
 * comprueba que esa cabecera existe (y el rol, si se configura), para que un
 * despliegue sin Easy Auth no deje el certificado de la sociedad abierto a
 * cualquiera.
 * Fuente: https://learn.microsoft.com/azure/app-service/configure-authentication-user-identities
 */
import type { HttpRequest } from '@azure/functions'
import { configuracion } from './configuracion'

interface Principal { auth_typ?: string; claims?: { typ: string; val: string }[] }

/** null si puede pasar; si no, el motivo del rechazo. */
export function motivoRechazo(req: HttpRequest): string | null {
  if (configuracion.autenticacionDesactivada()) return null
  const cabecera = req.headers.get('x-ms-client-principal')
  if (!cabecera) return 'Hace falta iniciar sesión con la cuenta de Locodea (Easy Auth no está activa o la petición no lleva sesión)'
  let principal: Principal
  try {
    principal = JSON.parse(Buffer.from(cabecera, 'base64').toString('utf8')) as Principal
  } catch {
    return 'Cabecera de identidad no válida'
  }
  const rol = configuracion.rolRequerido()
  if (rol && !(principal.claims ?? []).some(c => (c.typ === 'roles' || c.typ.endsWith('/role')) && c.val === rol)) {
    return `El usuario no tiene el rol «${rol}»`
  }
  return null
}
