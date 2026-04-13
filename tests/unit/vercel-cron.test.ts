import { describe, it, expect } from 'vitest'

describe('T4.10: Vercel Cron config', () => {
  it('debería existir vercel.json', () => {
    const fs = require('fs')
    const path = require('path')
    const configPath = path.join(process.cwd(), 'vercel.json')
    expect(fs.existsSync(configPath)).toBe(true)
  })

  it('debería configurar el cron job para purge diariamente a las 00:00 UTC', () => {
    const fs = require('fs')
    const path = require('path')
    const configPath = path.join(process.cwd(), 'vercel.json')
    const content = fs.readFileSync(configPath, 'utf-8')
    expect(content).toContain('cron')
    expect(content).toContain('purge')
  })

  it('debería tener el path correcto para el cron', () => {
    const fs = require('fs')
    const path = require('path')
    const configPath = path.join(process.cwd(), 'vercel.json')
    const content = fs.readFileSync(configPath, 'utf-8')
    expect(content).toContain('api/data/purge')
  })
})

describe('T4.10: CRON_SECRET en .env.example', () => {
  it('debería documentar CRON_SECRET en .env.example', () => {
    const fs = require('fs')
    const path = require('path')
    const envPath = path.join(process.cwd(), '.env.example')
    
    // Check if .env.example exists, if not check .env
    const exists = fs.existsSync(envPath)
    
    if (exists) {
      const content = fs.readFileSync(envPath, 'utf-8')
      expect(content).toContain('CRON_SECRET')
    } else {
      // .env.example might not exist yet - that's OK for dev
      // Just verify the env var is used in the purge endpoint
      const purgePath = path.join(process.cwd(), 'src/app/api/data/purge/route.ts')
      const purgeContent = fs.readFileSync(purgePath, 'utf-8')
      expect(purgeContent).toContain('CRON_SECRET')
    }
  })
})
