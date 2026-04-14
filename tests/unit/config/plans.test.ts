import { describe, it, expect } from 'vitest'
import { PLANS, PlanType, RESOURCE_TYPES, getPlanLimits, isWithinLimit } from '@/config/plans'

describe('T5.2: Plan Config File', () => {
  describe('src/config/plans.ts', () => {
    it('debería existir el archivo de configuración de planes', () => {
      const fs = require('fs')
      const path = require('path')
      const configPath = path.join(process.cwd(), 'src/config/plans.ts')
      expect(fs.existsSync(configPath)).toBe(true)
    })

    it('debería exportar PLANS con FREE, PRO, ENTERPRISE', () => {
      expect(PLANS).toBeDefined()
      expect(PLANS.FREE).toBeDefined()
      expect(PLANS.PRO).toBeDefined()
      expect(PLANS.ENTERPRISE).toBeDefined()
    })

    it('debería tener límites correctos para FREE (5 trucks, 10 workers, 100 transactions)', () => {
      expect(PLANS.FREE.trucks).toBe(5)
      expect(PLANS.FREE.workers).toBe(10)
      expect(PLANS.FREE.transactions).toBe(100)
      expect(PLANS.FREE.orgs).toBe(1)
    })

    it('debería tener límites correctos para PRO (50 trucks, 100 workers, unlimited)', () => {
      expect(PLANS.PRO.trucks).toBe(50)
      expect(PLANS.PRO.workers).toBe(100)
      expect(PLANS.PRO.transactions).toBe(Infinity)
      expect(PLANS.PRO.orgs).toBe(1)
    })

    it('debería tener límites correctos para ENTERPRISE (unlimited)', () => {
      expect(PLANS.ENTERPRISE.trucks).toBe(Infinity)
      expect(PLANS.ENTERPRISE.workers).toBe(Infinity)
      expect(PLANS.ENTERPRISE.transactions).toBe(Infinity)
      expect(PLANS.ENTERPRISE.orgs).toBe(Infinity)
    })

    it('debería exportar PlanType que coincida con el enum de Prisma', () => {
      expect(PlanType).toBeDefined()
      expect(PlanType.FREE).toBe('FREE')
      expect(PlanType.PRO).toBe('PRO')
      expect(PlanType.ENTERPRISE).toBe('ENTERPRISE')
    })

    it('debería exportar getPlanLimits(planType) que retorne los límites', () => {
      expect(typeof getPlanLimits).toBe('function')
      expect(getPlanLimits('FREE')).toEqual({ trucks: 5, workers: 10, transactions: 100, orgs: 1 })
      expect(getPlanLimits('PRO')).toEqual({ trucks: 50, workers: 100, transactions: Infinity, orgs: 1 })
      expect(getPlanLimits('ENTERPRISE')).toEqual({ trucks: Infinity, workers: Infinity, transactions: Infinity, orgs: Infinity })
    })

    it('debería exportar RESOURCE_TYPES con workers, trucks, transactions', () => {
      expect(RESOURCE_TYPES).toBeDefined()
      expect(RESOURCE_TYPES.WORKERS).toBe('workers')
      expect(RESOURCE_TYPES.TRUCKS).toBe('trucks')
      expect(RESOURCE_TYPES.TRANSACTIONS).toBe('transactions')
    })

    it('isWithinLimit debería retornar true si count < limit', () => {
      expect(isWithinLimit(3, 'FREE', 'trucks')).toBe(true)
      expect(isWithinLimit(5, 'FREE', 'trucks')).toBe(false)
      expect(isWithinLimit(100, 'FREE', 'transactions')).toBe(false)
      expect(isWithinLimit(99, 'FREE', 'transactions')).toBe(true)
    })

    it('isWithinLimit debería retornar true para Infinity (sin límite)', () => {
      expect(isWithinLimit(1000, 'ENTERPRISE', 'trucks')).toBe(true)
      expect(isWithinLimit(10000, 'PRO', 'transactions')).toBe(true)
    })
  })
})
