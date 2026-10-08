import { describe, expect, it } from 'vitest'
import { diaHabil, domiciliacionHasta, obligaciones, pascua } from './plazos'
import { perfilCon } from './datosPrueba'

describe('días hábiles', () => {
  it('calcula la Pascua y el Viernes Santo', () => {
    expect(pascua(2026)).toBe('2026-04-05')
    expect(pascua(2027)).toBe('2027-03-28')
    expect(diaHabil('2027-03-26')).toBe('2027-03-29')
  })

  it('pasa sábados, domingos y festivos nacionales al siguiente hábil', () => {
    expect(diaHabil('2027-01-30')).toBe('2027-02-01') // sábado
    expect(diaHabil('2027-02-28')).toBe('2027-03-01') // domingo
    expect(diaHabil('2026-12-08')).toBe('2026-12-09') // Inmaculada, martes
    expect(diaHabil('2026-10-20')).toBe('2026-10-20')
    expect(diaHabil('2026-03-19', ['2026-03-19'])).toBe('2026-03-20')
  })

  it('domiciliación: tres días hábiles antes del fin del plazo, como en el calendario de 2026', () => {
    expect(domiciliacionHasta('2026-01-30')).toBe('2026-01-27') // 303 4T 2025
    expect(domiciliacionHasta('2026-10-20')).toBe('2026-10-15') // 303 3T 2026
    expect(domiciliacionHasta('2026-07-27')).toBe('2026-07-22') // 200
    expect(domiciliacionHasta('2026-12-21')).toBe('2026-12-16') // 202 3P
    expect(domiciliacionHasta('2026-12-30')).toBe('2026-12-24') // 303 mensual de noviembre
    expect(domiciliacionHasta('2026-03-02')).toBe('2026-02-25') // 303 mensual de enero
  })
})

describe('obligaciones de una SL constituida en noviembre de 2026', () => {
  const perfil = perfilCon({ fechaConstitucion: '2026-11-16' })
  const lista = obligaciones({ perfil, desde: '2026-10-01', hasta: '2027-12-31', apuntes: [], cuotaUltimoIS: 1200 })
  const buscar = (modelo: string, periodo: string) => lista.find(o => o.modelo === modelo && o.periodo === periodo)

  it('no incluye periodos anteriores a la constitución', () => {
    expect(buscar('303', '2026-3T')).toBeUndefined()
    expect(buscar('111', '2026-3T')).toBeUndefined()
  })

  it('el 303 del 4T 2026 se presenta sin actividad y vence el lunes 1 de febrero de 2027', () => {
    const o = buscar('303', '2026-4T')!
    expect(o.hasta).toBe('2027-02-01')
    expect(o.domiciliarHasta).toBe('2027-01-27')
    expect(o.aplica).toBe(true)
    expect(o.motivo).toMatch(/sin actividad/i)
    expect(o.etiquetaPeriodo).toBe('4T 2026')
  })

  it('desplaza los plazos de 2027 que caen en fin de semana', () => {
    expect(buscar('390', '2026')!.hasta).toBe('2027-02-01')
    expect(buscar('190', '2026')!.hasta).toBe('2027-02-01') // 31 de enero, domingo
    expect(buscar('347', '2026')!.hasta).toBe('2027-03-01') // 28 de febrero, domingo
    expect(buscar('111', '2026-4T')!.hasta).toBe('2027-01-20')
    expect(buscar('200', '2026')).toMatchObject({ desde: '2027-07-01', hasta: '2027-07-26', aplica: true }) // 25 de julio, domingo
  })

  it('el 369 no se prorroga aunque acabe en domingo', () => {
    expect(buscar('369', '2026-4T')).toMatchObject({ hasta: '2027-01-31', aplica: false, domiciliarHasta: null })
  })

  it('sin 202 en el primer ejercicio ni antes de declarar el primer Impuesto sobre Sociedades', () => {
    expect(buscar('202', '2026-3P')).toMatchObject({ hasta: '2026-12-21', aplica: false })
    expect(buscar('202', '2027-1P')!.aplica).toBe(false)
    expect(buscar('202', '2027-2P')).toMatchObject({ hasta: '2027-10-20', aplica: true })
  })

  it('aplica cada modelo según el perfil', () => {
    expect(buscar('111', '2026-4T')!.aplica).toBe(false)
    expect(buscar('349', '2026-4T')!.aplica).toBe(false)
    expect(buscar('123', '2026-4T')!.aplica).toBe(false)
    expect(buscar('232', '2026')).toMatchObject({ hasta: '2027-11-30', aplica: false })
    const conAdministradores = obligaciones({ perfil: perfilCon({ fechaConstitucion: '2026-11-16', administradoresRetribuidos: true }), desde: '2027-01-01', hasta: '2027-02-28', apuntes: [] })
    expect(conAdministradores.find(o => o.modelo === '111')!.aplica).toBe(true)
    expect(conAdministradores.find(o => o.modelo === '190')!.aplica).toBe(true)
  })

  it('incluye el calendario del Registro Mercantil del primer cierre', () => {
    const rm = lista.filter(o => o.organismo === 'Registro Mercantil').map(o => [o.modelo, o.hasta])
    expect(rm).toEqual([['formulacion', '2027-03-31'], ['legalizacion', '2027-04-30'], ['junta', '2027-06-30'], ['deposito', '2027-07-30']])
  })

  it('ordena por fin de plazo', () => {
    const fechas = lista.map(o => o.hasta)
    expect(fechas).toEqual([...fechas].sort())
  })
})
