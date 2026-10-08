import { describe, expect, it } from 'vitest'
import type { RegistroFacturacion } from '../types'
import { configDePrueba, cuentaDePrueba, facturaDePrueba } from './datos-de-prueba'
import { crearRegistroAlta } from './registro'
import { enviarAlServicio } from './servicio'

const config = configDePrueba()

async function registro(id: string, orden: number): Promise<RegistroFacturacion> {
  const r = await crearRegistroAlta({ factura: facturaDePrueba({ no: `F-2600${orden}` }), cuenta: cuentaDePrueba(), config, anterior: null, ahora: new Date('2026-10-05T09:00:00Z') })
  return { ...r, id, creadoEl: '', orden }
}

/** fetch falso que guarda la petición y responde con `cuerpo`. */
function fetchFalso(cuerpo: unknown, status = 200) {
  const llamadas: { url: string; init: RequestInit }[] = []
  const f = (async (url: string, init: RequestInit) => {
    llamadas.push({ url, init })
    return new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })
  }) as unknown as typeof fetch
  return { f, llamadas }
}

describe('enviarAlServicio', () => {
  it('no envía en preparación ni sin URL', async () => {
    const r = await registro('r1', 1)
    await expect(enviarAlServicio(configDePrueba({ entorno: 'preparacion' }), [r])).rejects.toThrow(/modo preparación/)
    await expect(enviarAlServicio(configDePrueba({ servicioUrl: ' ' }), [r])).rejects.toThrow(/Falta la URL del servicio/)
  })

  it('no envía registros simulados ni de otro entorno', async () => {
    const r = await registro('r1', 1)
    await expect(enviarAlServicio(config, [{ ...r, estado: 'simulado' }])).rejects.toThrow(/no está pendiente/)
    await expect(enviarAlServicio(config, [{ ...r, entorno: 'produccion' }])).rejects.toThrow(/entorno/)
  })

  it('manda los registros en orden y devuelve la respuesta normalizada', async () => {
    const r1 = await registro('r1', 1), r2 = await registro('r2', 2)
    const { f, llamadas } = fetchFalso({
      estado: 'parcial', csv: 'A-CSV-123', esperaSegundos: 90,
      respuestas: [
        { registroId: 'r1', estado: 'correcto', codigoError: '', descripcionError: '' },
        { registroId: 'r2', estado: 'rechazado', codigoError: '1100', descripcionError: 'Valor o tipo incorrecto' },
        { registroId: 'otro', estado: 'correcto' },
      ],
    })
    const res = await enviarAlServicio(config, [r2, r1], { fetch: f, token: 'tkn' })
    expect(llamadas).toHaveLength(1)
    expect(llamadas[0].url).toBe(config.servicioUrl)
    expect((llamadas[0].init.headers as Record<string, string>).Authorization).toBe('Bearer tkn')
    const enviado = JSON.parse(String(llamadas[0].init.body))
    expect(enviado.entorno).toBe('pruebas')
    expect(enviado.cabecera).toEqual({ nif: '89890001K', razonSocial: 'Locodea SL' })
    expect(enviado.registros.map((x: { id: string }) => x.id)).toEqual(['r1', 'r2'])
    expect(res).toEqual({
      estado: 'parcial', csv: 'A-CSV-123', esperaSegundos: 90,
      respuestas: [
        { registroId: 'r1', estado: 'correcto', codigoError: '', descripcionError: '' },
        { registroId: 'r2', estado: 'rechazado', codigoError: '1100', descripcionError: 'Valor o tipo incorrecto' },
      ],
    })
  })

  it('error claro si el servicio responde con error', async () => {
    const { f } = fetchFalso({ error: 'Hay que esperar al control de flujo', esperaSegundos: 42 }, 429)
    await expect(enviarAlServicio(config, [await registro('r1', 1)], { fetch: f })).rejects.toThrow(/429: Hay que esperar al control de flujo \(espera 42 s\)/)
  })
})
