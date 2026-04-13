import { describe, it, expect } from 'vitest'

describe('T1.3: Terms of Service Page', () => {
  it('debería existir el archivo de términos de servicio', () => {
    const fs = require('fs')
    const path = require('path')
    const pagePath = path.join(process.cwd(), 'src/app/(legal)/terms/page.tsx')
    expect(fs.existsSync(pagePath)).toBe(true)
  })

  it('debería tener título de términos de servicio', () => {
    const fs = require('fs')
    const path = require('path')
    const pagePath = path.join(process.cwd(), 'src/app/(legal)/terms/page.tsx')
    const content = fs.readFileSync(pagePath, 'utf-8')
    expect(content).toContain('Términos y Condiciones')
  })

  it('debería contener condiciones de uso', () => {
    const fs = require('fs')
    const path = require('path')
    const pagePath = path.join(process.cwd(), 'src/app/(legal)/terms/page.tsx')
    const content = fs.readFileSync(pagePath, 'utf-8')
    expect(content).toContain('Condiciones de Uso')
  })

  it('debería contener limitaciones de responsabilidad', () => {
    const fs = require('fs')
    const path = require('path')
    const pagePath = path.join(process.cwd(), 'src/app/(legal)/terms/page.tsx')
    const content = fs.readFileSync(pagePath, 'utf-8')
    expect(content).toContain('Limitación de Responsabilidad')
  })

  it('debería contener derechos de propiedad intelectual', () => {
    const fs = require('fs')
    const path = require('path')
    const pagePath = path.join(process.cwd(), 'src/app/(legal)/terms/page.tsx')
    const content = fs.readFileSync(pagePath, 'utf-8')
    expect(content).toContain('Propiedad Intelectual')
  })

  it('debería contener términos de suscripción (placeholder)', () => {
    const fs = require('fs')
    const path = require('path')
    const pagePath = path.join(process.cwd(), 'src/app/(legal)/terms/page.tsx')
    const content = fs.readFileSync(pagePath, 'utf-8')
    // Subscription terms are placeholder for future
    expect(content).toMatch(/suscripción|plan|precio/i)
  })
})

describe('T1.4: Legal Notice (Aviso Legal) Page', () => {
  it('debería existir el archivo de aviso legal', () => {
    const fs = require('fs')
    const path = require('path')
    const pagePath = path.join(process.cwd(), 'src/app/(legal)/legal-notice/page.tsx')
    expect(fs.existsSync(pagePath)).toBe(true)
  })

  it('debería tener título de aviso legal', () => {
    const fs = require('fs')
    const path = require('path')
    const pagePath = path.join(process.cwd(), 'src/app/(legal)/legal-notice/page.tsx')
    const content = fs.readFileSync(pagePath, 'utf-8')
    expect(content).toContain('Aviso Legal')
  })

  it('debería contener nombre de la empresa', () => {
    const fs = require('fs')
    const path = require('path')
    const pagePath = path.join(process.cwd(), 'src/app/(legal)/legal-notice/page.tsx')
    const content = fs.readFileSync(pagePath, 'utf-8')
    expect(content).toContain('Flota Camiones')
  })

  it('debería contener CIF/NIF', () => {
    const fs = require('fs')
    const path = require('path')
    const pagePath = path.join(process.cwd(), 'src/app/(legal)/legal-notice/page.tsx')
    const content = fs.readFileSync(pagePath, 'utf-8')
    expect(content).toContain('CIF')
  })

  it('debería contener datos de registro', () => {
    const fs = require('fs')
    const path = require('path')
    const pagePath = path.join(process.cwd(), 'src/app/(legal)/legal-notice/page.tsx')
    const content = fs.readFileSync(pagePath, 'utf-8')
    expect(content).toMatch(/registro|Registro Mercantil/i)
  })

  it('debería contener email de contacto', () => {
    const fs = require('fs')
    const path = require('path')
    const pagePath = path.join(process.cwd(), 'src/app/(legal)/legal-notice/page.tsx')
    const content = fs.readFileSync(pagePath, 'utf-8')
    expect(content).toContain('@flota-camiones.com')
  })

  it('debería contener referencia LSSICE', () => {
    const fs = require('fs')
    const path = require('path')
    const pagePath = path.join(process.cwd(), 'src/app/(legal)/legal-notice/page.tsx')
    const content = fs.readFileSync(pagePath, 'utf-8')
    expect(content).toContain('LSSI')
  })
})
