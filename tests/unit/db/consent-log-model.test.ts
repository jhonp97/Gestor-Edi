import { describe, it, expect } from 'vitest'

describe('T1.9: ConsentLog Prisma model', () => {
  it('debería existir el modelo ConsentLog en el schema', () => {
    const fs = require('fs')
    const path = require('path')
    const schemaPath = path.join(process.cwd(), 'prisma/schema.prisma')
    const content = fs.readFileSync(schemaPath, 'utf-8')
    expect(content).toContain('model ConsentLog')
  })

  it('debería tener los campos requeridos: id, userId, categories, ip, userAgent, organizationId, createdAt', () => {
    const fs = require('fs')
    const path = require('path')
    const schemaPath = path.join(process.cwd(), 'prisma/schema.prisma')
    const content = fs.readFileSync(schemaPath, 'utf-8')
    // Extract ConsentLog model block
    const startIdx = content.indexOf('model ConsentLog')
    expect(startIdx).toBeGreaterThan(-1)
    const braceStart = content.indexOf('{', startIdx)
    let braceCount = 0
    let endIdx = braceStart
    for (let i = braceStart; i < content.length; i++) {
      if (content[i] === '{') braceCount++
      if (content[i] === '}') {
        braceCount--
        if (braceCount === 0) { endIdx = i; break }
      }
    }
    const model = content.substring(startIdx, endIdx + 1)
    expect(model).toContain('id')
    expect(model).toContain('String')
    expect(model).toContain('@id')
    expect(model).toContain('categories')
    expect(model).toContain('Json')
    expect(model).toContain('ip')
    expect(model).toContain('userAgent')
    expect(model).toContain('createdAt')
  })

  it('debería tener relación opcional con User', () => {
    const fs = require('fs')
    const path = require('path')
    const schemaPath = path.join(process.cwd(), 'prisma/schema.prisma')
    const content = fs.readFileSync(schemaPath, 'utf-8')
    expect(content).toContain('userId         String?')
    expect(content).toContain('user           User?')
  })

  it('debería tener relación opcional con Organization', () => {
    const fs = require('fs')
    const path = require('path')
    const schemaPath = path.join(process.cwd(), 'prisma/schema.prisma')
    const content = fs.readFileSync(schemaPath, 'utf-8')
    expect(content).toContain('organizationId String?')
    expect(content).toContain('organization   Organization?')
  })

  it('debería tener índices en userId, organizationId y createdAt', () => {
    const fs = require('fs')
    const path = require('path')
    const schemaPath = path.join(process.cwd(), 'prisma/schema.prisma')
    const content = fs.readFileSync(schemaPath, 'utf-8')
    expect(content).toContain('@@index([userId])')
    expect(content).toContain('@@index([organizationId])')
    expect(content).toContain('@@index([createdAt])')
  })
})
