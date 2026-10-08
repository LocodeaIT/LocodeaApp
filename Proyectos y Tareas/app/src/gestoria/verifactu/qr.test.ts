/**
 * Pruebas de la URL de cotejo con el ejemplo de la AEAT («Características del
 * QR…», v0.5.0, apdo. 4):
 * https://www.agenciatributaria.es/static_files/AEAT_Desarrolladores/EEDD/IVA/VERI-FACTU/DetalleEspecificacTecnCodigoQRfactura.pdf
 */
import { describe, expect, it } from 'vitest'
import { LEYENDA_VERIFACTU, LEYENDA_VERIFACTU_LARGA, qrDataUrl, urlCotejo } from './qr'

const ejemplo = { nif: '89890001K', serieNumero: '12345678&G33', fechaExpedicion: '2024-01-01', importeTotal: 241.4 }

describe('urlCotejo', () => {
  it('pruebas: codifica el & del número (ejemplo de la AEAT)', () => {
    expect(urlCotejo({ ...ejemplo, entorno: 'pruebas' }))
      .toBe('https://prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQR?nif=89890001K&numserie=12345678%26G33&fecha=01-01-2024&importe=241.40')
  })

  it('preparación usa también la URL de pruebas', () => {
    expect(urlCotejo({ ...ejemplo, entorno: 'preparacion' })).toMatch(/^https:\/\/prewww2\.aeat\.es\/wlpl\/TIKE-CONT\/ValidarQR\?/)
  })

  it('producción', () => {
    expect(urlCotejo({ ...ejemplo, serieNumero: 'F-26001', entorno: 'produccion' }))
      .toBe('https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQR?nif=89890001K&numserie=F-26001&fecha=01-01-2024&importe=241.40')
  })

  it('codifica espacios y barras, y lleva solo cuatro parámetros', () => {
    const url = urlCotejo({ ...ejemplo, serieNumero: 'A 1/2', entorno: 'pruebas' })
    expect(url).toContain('numserie=A%201%2F2')
    expect(new URL(url).searchParams.get('numserie')).toBe('A 1/2')
    expect([...new URL(url).searchParams.keys()]).toEqual(['nif', 'numserie', 'fecha', 'importe'])
  })

  it('importes negativos de rectificativas', () => {
    expect(urlCotejo({ ...ejemplo, importeTotal: -121, entorno: 'pruebas' })).toContain('&importe=-121.00')
  })
})

describe('qrDataUrl y leyendas', () => {
  it('genera una imagen PNG', async () => {
    const png = await qrDataUrl(urlCotejo({ ...ejemplo, entorno: 'pruebas' }))
    expect(png.startsWith('data:image/png;base64,')).toBe(true)
  })

  it('leyendas admitidas', () => {
    expect(LEYENDA_VERIFACTU).toBe('VERI*FACTU')
    expect(LEYENDA_VERIFACTU_LARGA).toBe('Factura verificable en la sede electrónica de la AEAT')
  })
})
