import { describe, it, expect } from 'vitest'

describe('T1.1: (legal) route group layout', () => {
  it('debería existir el archivo layout en (legal)', () => {
    // This test verifies the layout file exists
    // RED: file does not exist → test fails
    // GREEN: create the file → test passes
    const fs = require('fs')
    const path = require('path')
    const layoutPath = path.join(process.cwd(), 'src/app/(legal)/layout.tsx')
    expect(fs.existsSync(layoutPath)).toBe(true)
  })

  it('el layout no debe importar Sidebar ni MainLayout', () => {
    const fs = require('fs')
    const path = require('path')
    const layoutPath = path.join(process.cwd(), 'src/app/(legal)/layout.tsx')
    const content = fs.readFileSync(layoutPath, 'utf-8')
    // Layout should be minimal - just renders children
    expect(content).not.toContain('Sidebar')
    expect(content).not.toContain('MainLayout')
  })
})
