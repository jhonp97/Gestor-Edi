import { describe, it, expect } from 'vitest'
import { PlanLimitError } from '@/lib/errors'

describe('T5.3: PlanLimitError', () => {
  it('debería existir PlanLimitError en src/lib/errors.ts', () => {
    const fs = require('fs')
    const path = require('path')
    const errorsPath = path.join(process.cwd(), 'src/lib/errors.ts')
    expect(fs.existsSync(errorsPath)).toBe(true)
    const content = fs.readFileSync(errorsPath, 'utf-8')
    expect(content).toContain('PlanLimitError')
  })

  it('debería ser una clase que extiende Error', () => {
    expect(PlanLimitError).toBeDefined()
    expect(new PlanLimitError('workers', 10, 'FREE')).toBeInstanceOf(Error)
  })

  it('debería tener propiedades resource, limit, plan', () => {
    const error = new PlanLimitError('trucks', 5, 'FREE')
    expect(error.resource).toBe('trucks')
    expect(error.limit).toBe(5)
    expect(error.plan).toBe('FREE')
  })

  it('debería tener mensaje con formato correcto', () => {
    const error = new PlanLimitError('workers', 10, 'FREE')
    expect(error.message).toContain('10')
    expect(error.message).toContain('FREE')
    expect(error.message).toContain('workers')
    expect(error.name).toBe('PlanLimitError')
  })

  it('debería permitir mensaje custom', () => {
    const error = new PlanLimitError('trucks', 5, 'PRO', 'Límite personalizado')
    expect(error.message).toBe('Límite personalizado')
  })

  it('debería funcionar con todos los tipos de plan', () => {
    const free = new PlanLimitError('workers', 10, 'FREE')
    const pro = new PlanLimitError('trucks', 50, 'PRO')
    const enterprise = new PlanLimitError('transactions', Infinity, 'ENTERPRISE')
    expect(free.plan).toBe('FREE')
    expect(pro.plan).toBe('PRO')
    expect(enterprise.plan).toBe('ENTERPRISE')
  })
})
