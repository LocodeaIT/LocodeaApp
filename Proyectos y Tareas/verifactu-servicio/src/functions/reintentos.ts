/**
 * Reintentos cada hora (Orden HAC/1177/2024, art. 16.4: si una incidencia
 * técnica impide la remisión, hay que reintentar al menos una vez cada hora,
 * respetando el orden de generación, y marcar el envío con Incidencia = S).
 * Fuente: https://www.boe.es/diario_boe/txt.php?id=BOE-A-2024-22138
 *
 * ESQUELETO. Lo que falta es el acceso a Dataverse desde el servicio:
 *  1. Registrar una aplicación en Entra ID (entidad de servicio) y darla de
 *     alta como «usuario de aplicación» en el entorno Locodea PROD con un rol
 *     que solo lea y escriba loc_registrofacturacion y loc_envioverifactu.
 *  2. Guardar su secreto o certificado en el mismo Key Vault (o usar la
 *     identidad administrada de la Function App como usuario de aplicación,
 *     que evita secretos) y pedir un token para `${DATAVERSE_URL}/.default`.
 *  3. Implementar `leerPendientes` y `guardarResultado` con la Web API de
 *     Dataverse (OData v4). Hoy las columnas son las de app/src/gestoria/dataverse.ts:
 *     tabla loc_registrofacturacions; loc_estado (pendiente = 412000576),
 *     loc_entorno (pruebas = 412000561, producción = 412000562), loc_orden,
 *     loc_xml, loc_nifemisor, loc_codigoerror, loc_descripcionerror, loc_csv,
 *     y el envío en loc_envioverifactus.
 *  4. Decidir quién envía: si este temporizador y la app envían a la vez
 *     pueden mandar el mismo registro dos veces (la AEAT lo rechaza como
 *     duplicado). Lo más simple es que la app solo deje los registros
 *     pendientes y el envío lo haga siempre el servicio.
 */
import { app, type InvocationContext, type Timer } from '@azure/functions'
import { configuracion, type EntornoAeat } from '../configuracion'
import { anotarEnvio, esperaPendiente } from '../flujo'
import { remitir, type Salida } from '../remision'
import { MAX_REGISTROS_POR_ENVIO } from '../aeat/xml'

interface Pendiente { id: string; xml: string; orden: number; nif: string; razonSocial: string; entorno: EntornoAeat }

/** Registros pendientes de remitir, en orden de generación. Falta: consulta a Dataverse. */
async function leerPendientes(contexto: InvocationContext): Promise<Pendiente[]> {
  if (!configuracion.dataverseUrl()) return []
  contexto.warn('reintentos: falta implementar la lectura de pendientes en Dataverse (ver comentario del archivo)')
  return []
}

/** Guarda el resultado del envío en Dataverse (registros y fila de loc_envioverifactu). Falta: escritura en Dataverse. */
async function guardarResultado(lote: Pendiente[], salida: Salida, contexto: InvocationContext): Promise<void> {
  contexto.warn(`reintentos: falta guardar en Dataverse el resultado de ${lote.length} registros (${salida.estado})`)
}

export async function reintentos(_timer: Timer, contexto: InvocationContext): Promise<void> {
  const pendientes = await leerPendientes(contexto)
  if (!pendientes.length) return

  // Una cadena por emisor y entorno, en orden de generación y en lotes de hasta 1.000.
  const cadenas = new Map<string, Pendiente[]>()
  for (const p of pendientes) {
    if (!configuracion.entornosPermitidos().includes(p.entorno)) continue
    const k = `${p.nif}|${p.entorno}`
    cadenas.set(k, [...(cadenas.get(k) ?? []), p])
  }
  for (const [clave, lista] of cadenas) {
    lista.sort((a, b) => a.orden - b.orden)
    for (let i = 0; i < lista.length; i += MAX_REGISTROS_POR_ENVIO) {
      const lote = lista.slice(i, i + MAX_REGISTROS_POR_ENVIO)
      const espera = esperaPendiente(clave, lote.length)
      if (espera > 0) {
        contexto.log(`reintentos: ${clave} debe esperar ${espera} s; se deja para la próxima hora`)
        break
      }
      const salida = await remitir({
        entorno: lote[0].entorno,
        cabecera: { nif: lote[0].nif, razonSocial: lote[0].razonSocial },
        registros: lote.map(p => ({ id: p.id, xml: p.xml })),
        incidencia: true,
      }, m => contexto.warn(m))
      anotarEnvio(clave, salida.esperaSegundos)
      await guardarResultado(lote, salida, contexto)
      if (salida.estado === 'error') break
    }
  }
}

app.timer('reintentos', {
  // A los 5 minutos de cada hora (formato NCRONTAB de seis campos).
  schedule: '0 5 * * * *',
  handler: reintentos,
})
