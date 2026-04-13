import { describe, it, expect } from 'vitest'

describe('T1.2: Privacy Policy Page', () => {
  it('debería existir el archivo de política de privacidad', () => {
    const fs = require('fs')
    const path = require('path')
    const pagePath = path.join(process.cwd(), 'src/app/(legal)/privacy/page.tsx')
    expect(fs.existsSync(pagePath)).toBe(true)
  })

  it('debería tener título de política de privacidad en español', () => {
    const fs = require('fs')
    const path = require('path')
    const pagePath = path.join(process.cwd(), 'src/app/(legal)/privacy/page.tsx')
    const content = fs.readFileSync(pagePath, 'utf-8')
    expect(content).toContain('Política de Privacidad')
  })

  it('debería contener la sección de responsable del tratamiento', () => {
    const fs = require('fs')
    const path = require('path')
    const pagePath = path.join(process.cwd(), 'src/app/(legal)/privacy/page.tsx')
    const content = fs.readFileSync(pagePath, 'utf-8')
    expect(content).toContain('Responsable del Tratamiento')
  })

  it('debería contener la sección de finalidad del tratamiento', () => {
    const fs = require('fs')
    const path = require('path')
    const pagePath = path.join(process.cwd(), 'src/app/(legal)/privacy/page.tsx')
    const content = fs.readFileSync(pagePath, 'utf-8')
    expect(content).toContain('Finalidad del Tratamiento')
  })

  it('debería contener la sección de derechos del interesado', () => {
    const fs = require('fs')
    const path = require('path')
    const pagePath = path.join(process.cwd(), 'src/app/(legal)/privacy/page.tsx')
    const content = fs.readFileSync(pagePath, 'utf-8')
    expect(content).toContain('Derechos del Interesado')
  })

  it('debería contener información de contacto del DPO', () => {
    const fs = require('fs')
    const path = require('path')
    const pagePath = path.join(process.cwd(), 'src/app/(legal)/privacy/page.tsx')
    const content = fs.readFileSync(pagePath, 'utf-8')
    expect(content).toContain('Delegado de Protección de Datos')
    expect(content).toContain('dpo@flota-camiones.com')
  })

  it('debería contener plazos de conservación', () => {
    const fs = require('fs')
    const path = require('path')
    const pagePath = path.join(process.cwd(), 'src/app/(legal)/privacy/page.tsx')
    const content = fs.readFileSync(pagePath, 'utf-8')
    expect(content).toContain('Plazos de Conservación')
  })

  it('debería contener información de cookies', () => {
    const fs = require('fs')
    const path = require('path')
    const pagePath = path.join(process.cwd(), 'src/app/(legal)/privacy/page.tsx')
    const content = fs.readFileSync(pagePath, 'utf-8')
    expect(content).toContain('Cookies')
  })
})
