import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockPrismaConsentLog = {
  create: vi.fn(),
}

vi.mock('@/lib/prisma', () => ({
  prisma: {
    consentLog: mockPrismaConsentLog,
  },
}))

describe('T1.10: POST /api/consent endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('debería existir el archivo de ruta /api/consent', () => {
    const fs = require('fs')
    const path = require('path')
    const routePath = path.join(process.cwd(), 'src/app/api/consent/route.ts')
    expect(fs.existsSync(routePath)).toBe(true)
  })

  it('debería importar Zod schema de consentimiento', () => {
    const fs = require('fs')
    const path = require('path')
    const routePath = path.join(process.cwd(), 'src/app/api/consent/route.ts')
    const content = fs.readFileSync(routePath, 'utf-8')
    expect(content).toContain('consent.schema')
  })

  it('debería importar el ConsentService', () => {
    const fs = require('fs')
    const path = require('path')
    const routePath = path.join(process.cwd(), 'src/app/api/consent/route.ts')
    const content = fs.readFileSync(routePath, 'utf-8')
    expect(content).toContain('consent.service')
  })

  it('debería exportar función POST', () => {
    const fs = require('fs')
    const path = require('path')
    const routePath = path.join(process.cwd(), 'src/app/api/consent/route.ts')
    const content = fs.readFileSync(routePath, 'utf-8')
    expect(content).toContain('export async function POST')
  })
})

describe('T1.10: consent.schema.ts', () => {
  it('debería existir el schema Zod de consentimiento', () => {
    const fs = require('fs')
    const path = require('path')
    const schemaPath = path.join(process.cwd(), 'src/schemas/consent.schema.ts')
    expect(fs.existsSync(schemaPath)).toBe(true)
  })

  it('debería exportar esquema con categorías analytics y marketing', () => {
    const fs = require('fs')
    const path = require('path')
    const schemaPath = path.join(process.cwd(), 'src/schemas/consent.schema.ts')
    const content = fs.readFileSync(schemaPath, 'utf-8')
    expect(content).toContain('analytics')
    expect(content).toContain('marketing')
  })
})

describe('T1.10: consent.service.ts', () => {
  it('debería existir el servicio de consentimiento', () => {
    const fs = require('fs')
    const path = require('path')
    const servicePath = path.join(process.cwd(), 'src/services/consent.service.ts')
    expect(fs.existsSync(servicePath)).toBe(true)
  })

  it('debería exportar método recordConsent', () => {
    const fs = require('fs')
    const path = require('path')
    const servicePath = path.join(process.cwd(), 'src/services/consent.service.ts')
    const content = fs.readFileSync(servicePath, 'utf-8')
    expect(content).toContain('recordConsent')
  })
})

describe('T1.10: consent-log.repository.ts', () => {
  it('debería existir el repositorio de consent logs', () => {
    const fs = require('fs')
    const path = require('path')
    const repoPath = path.join(process.cwd(), 'src/repositories/consent-log.repository.ts')
    expect(fs.existsSync(repoPath)).toBe(true)
  })

  it('debería exportar método create', () => {
    const fs = require('fs')
    const path = require('path')
    const repoPath = path.join(process.cwd(), 'src/repositories/consent-log.repository.ts')
    const content = fs.readFileSync(repoPath, 'utf-8')
    expect(content).toContain('create')
  })
})
