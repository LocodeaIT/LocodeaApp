import { describe, expect, it } from 'vitest'
import type { TipoIdFiscal } from '../../crm/types'
import { cuentaDePrueba } from './datos-de-prueba'
import { calificacion, destinatarioDe, idTypeDe } from './mapeo'

describe('calificacion', () => {
  it('interior y particular de la UE: sujeta (S1), régimen general', () => {
    expect(calificacion('interior')).toEqual({ claveRegimen: '01', calificacion: 'S1' })
    expect(calificacion('ue-particular')).toEqual({ claveRegimen: '01', calificacion: 'S1' })
  })

  it('empresa de la UE y fuera de la UE: no sujeta por reglas de localización (N2)', () => {
    expect(calificacion('ue-empresa')).toEqual({ claveRegimen: '01', calificacion: 'N2' })
    expect(calificacion('fuera-ue')).toEqual({ claveRegimen: '01', calificacion: 'N2' })
  })

  it('ventanilla única: clave 17', () => {
    expect(calificacion('ue-oss').claveRegimen).toBe('17')
  })

  it('inversión del sujeto pasivo: S2; exenta: E1 sin calificación', () => {
    expect(calificacion('isp-interior')).toEqual({ claveRegimen: '01', calificacion: 'S2' })
    expect(calificacion('exenta')).toEqual({ claveRegimen: '01', exenta: 'E1' })
  })
})

describe('idTypeDe', () => {
  it('códigos de la AEAT', () => {
    const esperado: Record<TipoIdFiscal, string | null> = {
      nif: null, nifiva: '02', pasaporte: '03', docoficial: '04', residencia: '05', otro: '06', nocensado: '07',
    }
    for (const [t, id] of Object.entries(esperado)) expect(idTypeDe(t as TipoIdFiscal)).toBe(id)
  })
})

describe('destinatarioDe', () => {
  it('cliente español con NIF', () => {
    expect(destinatarioDe(cuentaDePrueba({ cif: 'b-12345674' }))).toEqual({ nombre: 'Cliente Ejemplo SL', nif: 'B12345674' })
  })

  it('empresa de la UE: NIF-IVA con prefijo del país', () => {
    const d = destinatarioDe(cuentaDePrueba({ codigoPais: 'FR', tipoIdFiscal: 'nifiva', cif: '12 345678901' }))
    expect(d.idOtro).toEqual({ codigoPais: 'FR', idType: '02', id: 'FR12345678901' })
    expect(destinatarioDe(cuentaDePrueba({ codigoPais: 'GR', tipoIdFiscal: 'nifiva', cif: 'GR123456789' })).idOtro?.id).toBe('EL123456789')
  })

  it('extranjero marcado como NIF: sin IDType, para que la validación lo detecte', () => {
    expect(destinatarioDe(cuentaDePrueba({ codigoPais: 'US', tipoIdFiscal: 'nif', cif: '12-3456789' })).idOtro)
      .toEqual({ codigoPais: 'US', idType: '', id: '123456789' })
  })
})
