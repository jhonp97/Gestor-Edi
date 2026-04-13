import { describe, it, expect } from 'vitest'

describe('T1.6: Footer integrated into root layout', () => {
  it('el layout raíz debería importar el componente Footer', () => {
    const fs = require('fs')
    const path = require('path')
    const layoutPath = path.join(process.cwd(), 'src/app/layout.tsx')
    const content = fs.readFileSync(layoutPath, 'utf-8')
    expect(content).toContain('Footer')
  })

  it('el componente Footer debería renderizarse en el layout', () => {
    const fs = require('fs')
    const path = require('path')
    const layoutPath = path.join(process.cwd(), 'src/app/layout.tsx')
    const content = fs.readFileSync(layoutPath, 'utf-8')
    expect(content).toContain('<Footer')
  })
})
